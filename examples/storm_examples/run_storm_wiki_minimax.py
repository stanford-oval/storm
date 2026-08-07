"""
STORM Wiki pipeline powered by MiniMax M3 and DuckDuckGo search engine.

前置条件:
    1. 项目根目录有 secrets.toml，包含 MINIMAX_API_KEY 和 MINIMAX_API_BASE
    2. pip install -r requirements.txt 已完成

运行方式:
    python examples/storm_examples/run_storm_wiki_minimax.py \
        --retriever duckduckgo \
        --do-research \
        --do-generate-outline \
        --do-generate-article \
        --do-polish-article

输出结构 (args.output_dir/topic_name/):
    conversation_log.json           # 信息收集对话日志
    raw_search_results.json         # 原始搜索结果
    direct_gen_outline.txt          # LLM 凭参数知识直接生成的大纲
    storm_gen_outline.txt           # 结合搜索信息优化后的大纲
    url_to_info.json                # 最终文章中引用的信息来源
    storm_gen_article.txt           # 生成的文章正文
    storm_gen_article_polished.txt  # 润色后的最终文章
"""

import os
import re
import logging
from argparse import ArgumentParser

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import LitellmModel
from knowledge_storm.rm import DuckDuckGoSearchRM
from knowledge_storm.utils import load_api_key


def sanitize_topic(topic):
    """清理 topic 中的特殊字符，确保文件夹命名安全"""
    topic = topic.replace(" ", "_")
    topic = re.sub(r"[^a-zA-Z0-9_-]", "", topic)
    return topic if topic else "unnamed_topic"


def strip_invalid_unicode(text):
    """移除不能被 UTF-8 JSON 请求编码的孤立 surrogate 字符。"""
    return "".join(ch for ch in text if not 0xD800 <= ord(ch) <= 0xDFFF)


def get_topic_for_storm(topic, output_language="original"):
    """保留原始 topic，并可追加输出语言要求。"""
    topic = strip_invalid_unicode(topic).strip()
    if output_language == "zh":
        return (
            f"{topic}\n\n"
            "Write all research answers, outlines, the final article, and the polished "
            "article in Simplified Chinese. Keep citation markers such as [1] [2]."
        )
    return topic


def get_output_dir_name(topic):
    """生成安全的输出目录名；模型指令不应进入文件名。"""
    return sanitize_topic(strip_invalid_unicode(topic).strip())


def main(args):
    # 第1步: 从 secrets.toml 加载 API Key 到环境变量
    load_api_key(toml_file_path="secrets.toml")

    # 第2步: 检查必要的环境变量
    if not os.getenv("MINIMAX_API_KEY"):
        raise ValueError(
            "请在项目根目录的 secrets.toml 中设置 MINIMAX_API_KEY"
        )

    # 第3步: 创建 LM 配置容器（一个空的配置集，后面逐个填入）
    lm_configs = STORMWikiLMConfigs()

    # MiniMax M3 的 litellm 调用参数
    minimax_kwargs = {
        "api_key": os.getenv("MINIMAX_API_KEY"),
        "api_base": os.getenv("MINIMAX_API_BASE", "https://api.minimax.chat/v1"),
        "temperature": 1.0,
        "top_p": 0.9,
    }

    # 第4步: 为 STORM pipeline 的 5 个角色分别配置 LM
    # 说明: 不同角色对模型能力的需求不同:
    #   - conv_simulator_lm / question_asker_lm: 对话模拟，用快模型即可
    #   - outline_gen_lm / article_gen_lm: 大纲和正文，需要强模型
    #   - article_polish_lm: 润色，需要更长的输出
    # 这里全部使用 MiniMax M3，实际可根据成本和速度混合使用不同模型

    # MiniMax API 兼容 OpenAI 协议，所以用 "openai/" 前缀
    # litellm 会把 api_base 指向 MiniMax 的端点，实现透明切换
    MODEL_NAME = "openai/MiniMax-M3"

    conv_simulator_lm = LitellmModel(
        model=MODEL_NAME, max_tokens=500, **minimax_kwargs
    )
    question_asker_lm = LitellmModel(
        model=MODEL_NAME, max_tokens=500, **minimax_kwargs
    )
    outline_gen_lm = LitellmModel(
        model=MODEL_NAME, max_tokens=400, **minimax_kwargs
    )
    article_gen_lm = LitellmModel(
        model=MODEL_NAME, max_tokens=700, **minimax_kwargs
    )
    article_polish_lm = LitellmModel(
        model=MODEL_NAME, max_tokens=4000, **minimax_kwargs
    )

    # 将 5 个 LM 注册到配置容器
    lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    lm_configs.set_question_asker_lm(question_asker_lm)
    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)

    # 第5步: 配置 Engine 运行参数（控制 pipeline 行为）
    engine_args = STORMWikiRunnerArguments(
        output_dir=args.output_dir,
        max_conv_turn=args.max_conv_turn,      # 每个角色最多问几轮
        max_perspective=args.max_perspective,   # 最多生成几个研究视角
        search_top_k=args.search_top_k,         # 每次搜索取前几条
        max_thread_num=args.max_thread_num,     # 并发线程数
    )

    # 第6步: 配置检索后端 — DuckDuckGo（免费，无需 API Key）
    rm = DuckDuckGoSearchRM(
        k=engine_args.search_top_k,
        safe_search="On",
        region="us-en",
    )

    # 第7步: 组装 Runner 并执行
    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    topic = args.topic or input("Topic: ")
    topic_for_storm = get_topic_for_storm(
        topic, output_language=args.output_language
    )
    output_dir_name = get_output_dir_name(topic)

    try:
        runner.run(
            topic=topic_for_storm,
            output_dir_name=output_dir_name,
            do_research=args.do_research,
            do_generate_outline=args.do_generate_outline,
            do_generate_article=args.do_generate_article,
            do_polish_article=args.do_polish_article,
            remove_duplicate=args.remove_duplicate,
        )
        runner.post_run()
        runner.summary()
    except Exception as e:
        logging.exception(f"An error occurred: {str(e)}")
        raise


if __name__ == "__main__":
    parser = ArgumentParser()#参数接收器
    # === 全局参数 ===
    parser.add_argument(
        "--output-dir", type=str, default="./results/minimax",
        help="输出目录",
    )
    parser.add_argument(
        "--max-thread-num", type=int, default=3,
        help="最大并发线程数。遇到 API 限流时可以降低此值",
    )
    parser.add_argument(
        "--retriever", type=str, default="duckduckgo",
        help="检索后端（默认 duckduckgo，免费）",
    )
    # === Pipeline 阶段开关 ===
    parser.add_argument(
        "--do-research", action="store_true",
        help="执行信息收集阶段",
    )
    parser.add_argument(
        "--do-generate-outline", action="store_true",
        help="执行大纲生成阶段",
    )
    parser.add_argument(
        "--do-generate-article", action="store_true",
        help="执行文章生成阶段",
    )
    parser.add_argument(
        "--do-polish-article", action="store_true",
        help="执行文章润色阶段（添加摘要、去重）",
    )
    # === 研究阶段超参数 ===
    parser.add_argument(
        "--max-conv-turn", type=int, default=3,
        help="每个角色最大对话轮数",
    )
    parser.add_argument(
        "--max-perspective", type=int, default=3,
        help="最大研究视角数",
    )
    parser.add_argument(
        "--search-top-k", type=int, default=3,
        help="每次搜索返回的结果数",
    )
    # === 写作阶段超参数 ===
    parser.add_argument(
        "--retrieve-top-k", type=int, default=3,
        help="每个章节引用的最大参考文献数",
    )
    parser.add_argument(
        "--remove-duplicate", action="store_true",
        help="是否去除文章中重复内容",
    )
    parser.add_argument(
        "--topic", type=str, default=None,
        help="直接传入主题，避免通过终端交互输入",
    )
    parser.add_argument(
        "--output-language", choices=["original", "zh"], default="original",
        help="输出语言。zh 会要求模型用简体中文写调研回答、大纲和文章",
    )

    main(parser.parse_args())
