"""
STORM 语言模型抽象层
====================

这是整个 STORM 系统中**最核心的基础设施模块之一**，负责将 LLM 调用抽象为统一接口。
理解这个文件是理解"Agent 系统为什么要抽象 LM 层"的关键。

整体架构:
┌──────────────────────────────────────────────────────────────┐
│  STORMWikiRunner (engine.py)                                │
│  需要调用 LLM 做：对话模拟、大纲生成、文章撰写、润色等           │
│  但它不关心底层是哪个 model / provider                         │
└────────────────────┬─────────────────────────────────────────┘
                     │ 只依赖一个接口: lm(prompt) → [completions]
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  LM 抽象层 (本文件)                                           │
│                                                              │
│  推荐方案: LitellmModel (v1.1.0+)                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ litellm 作为统一网关，支持 100+ providers:            │    │
│  │ openai/gpt-4    claude-3-opus    minimax/MiniMax-M3 │    │
│  │ 格式: "provider/model_name" 即可切换                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  旧方案 (deprecated): 每个 provider 一个类                     │
│  ┌──────────┬───────────┬──────────┬──────────┬────────┐    │
│  │OpenAI    │DeepSeek   │Claude    │Gemini    │Groq... │    │
│  └──────────┴───────────┴──────────┴──────────┴────────┘    │
│  这些类保留只为向后兼容，新代码请用 LitellmModel                 │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  两层缓存系统 (节省 API 费用，加速调试)                          │
│  第1层: LRU 内存缓存 (LM_LRU_CACHE_MAX_SIZE=3000)              │
│  第2层: litellm 磁盘缓存 (~/.storm_local_cache)                │
│  相同 prompt → 直接返回缓存，不发 API 请求                       │
└──────────────────────────────────────────────────────────────┘

设计模式:
- 策略模式: 每个 Model 类封装一种 API 调用策略，对外接口一致
- 装饰器模式: @backoff.on_exception 实现自动重试
- 模板方法: LM.__call__ 定义调用流程，子类实现具体请求细节

学习要点:
1. 为什么要把 LM 抽象成独立模块？因为 Agent 系统中 LLM 是"可替换的零件"，
   不同的任务可能用不同的模型（快模型做对话模拟，强模型做文章生成）
2. litellm 在这里的作用 = 多 provider 的统一适配层，就像 USB Hub 一样
3. 两层缓存在开发调试时极其重要，否则每次跑 pipeline 都是巨额 API 费用
"""

import backoff
import dspy
import functools
import logging
import os
import random
import requests
import threading
from typing import Optional, Literal, Any
import ujson
from pathlib import Path


from dsp import ERRORS, backoff_hdlr, giveup_hdlr
from dsp.modules.hf import openai_to_hf
from dsp.modules.hf_client import send_hftgi_request_v01_wrapped
from openai import OpenAI, AzureOpenAI
from transformers import AutoTokenizer

# Anthropic 的 SDK 可能未安装，用 try/except 做可选依赖
try:
    from anthropic import RateLimitError
except ImportError:
    RateLimitError = None

############################
# 以下代码从 dspy 官方 repo 复制 (dspy/clients/lm.py, Sep 29 2024)
# 用于提供基于 litellm 的缓存 + completion 基础函数
############################

import warnings

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=UserWarning)
    # LITELLM_LOCAL_MODEL_COST_MAP=True 让 litellm 在本地计算 token cost，
    # 而不是每次调 litellm 的远程 API 去查价格表（减少网络请求）
    if "LITELLM_LOCAL_MODEL_COST_MAP" not in os.environ:
        os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
    import litellm

    # drop_params=True: 如果传给 litellm 的参数某个 provider 不支持，
    # 自动丢弃而不是报错（提高兼容性）
    litellm.drop_params = True
    # 关闭 litellm 的遥测数据上报
    litellm.telemetry = False

from litellm.caching.caching import Cache

# 磁盘缓存目录: ~/.storm_local_cache
# 注意: 这是 litellm 层面的缓存，与下面的 LRU 内存缓存是两个独立层
disk_cache_dir = os.path.join(Path.home(), ".storm_local_cache")
litellm.cache = Cache(disk_cache_dir=disk_cache_dir, type="disk")

# 注释掉的代码是 litellm 未安装时的 fallback 处理
# 因为 litellm 已在 requirements.txt 中，所以直接 import
# except ImportError:
#     class LitellmPlaceholder:
#         def __getattr__(self, _):
#             raise ImportError(...)
# litellm = LitellmPlaceholder()

# LRU 内存缓存最大条目数: 3000
# 注意: LRU cache 的 key 是 request JSON 字符串，所以相同 prompt+参数会命中缓存
LM_LRU_CACHE_MAX_SIZE = 3000


# ====================================================================
# LM — 基础抽象类
# ====================================================================
# 这是所有语言模型类的基类。它定义了 LLM 调用的统一接口:
#   - __call__(prompt, messages, **kwargs) → [completions]
#   - history: 记录每次调用的 prompt/response/usage/cost
#   - cache: 控制是否使用缓存
#
# 关键设计: __call__ 中用 ujson.dumps 把请求参数序列化为字符串，
# 然后传给 cached_litellm_completion。这样做的好处是:
#   - LRU cache 可以直接用字符串当 key
#   - 确保完全相同的请求参数才能命中缓存
# ====================================================================

class LM:
    def __init__(
        self,
        model,
        model_type="chat",  # "chat" 或 "text"，走 litellm 的不同 API 端点
        temperature=0.0,     # STORM 场景不需要创造性，默认 0.0
        max_tokens=1000,
        cache=True,          # 默认开启缓存（省钱 + 可复现）
        **kwargs,
    ):
        self.model = model
        self.model_type = model_type
        self.cache = cache
        self.kwargs = dict(temperature=temperature, max_tokens=max_tokens, **kwargs)
        self.history = []  # 调用历史，调试和 token 统计用

        # OpenAI o1 系列模型有特殊要求: 温度必须为 1.0，max_tokens >= 5000
        if "o1-" in model:
            assert (
                max_tokens >= 5000 and temperature == 1.0
            ), "OpenAI's o1-* models require passing temperature=1.0 and max_tokens >= 5000 to `dspy.LM(...)`"

    def __call__(self, prompt=None, messages=None, **kwargs):
        """
        LLM 调用的统一入口。

        调用流程:
        1. 组装 messages（如果传了 prompt 则包装为 user message）
        2. 根据 model_type 选择 chat/text completion 函数
        3. 根据 cache 标志选择是否走缓存
        4. 调用 litellm → 解析响应 → 记录 history → 返回 output 列表
        """
        # 第1行: dict.pop(key, default) — 从 kwargs 中取出 "cache" 并删除，
        # 如果调用者没传 cache 参数，则回退到实例默认值 self.cache
        cache = kwargs.pop("cache", self.cache)

        # 第2行: Python 的短路 or — 如果 messages 为 None/空列表等 falsy 值，
        # 就用 prompt 构造一个标准的 user message
        # 等价于: messages = messages if messages else [{"role": "user", "content": prompt}]
        messages = messages or [{"role": "user", "content": prompt}]

        # 第3行: ** 字典解包合并 — 把 self.kwargs（实例默认参数）和 kwargs（调用时传入的参数）
        # 合并成一个新字典，kwargs 的键会覆盖 self.kwargs 中的同名键
        # 例如 self.kwargs = {"temperature": 0.0, "max_tokens": 500}
        #      kwargs     = {"temperature": 1.0}  （调用时传入）
        # 合并后 → {"temperature": 1.0, "max_tokens": 500}
        kwargs = {**self.kwargs, **kwargs}

        # 选择缓存的或直接的 completion 函数，#一般用chat和cache，缓存命中省钱
        if self.model_type == "chat":
            completion = cached_litellm_completion if cache else litellm_completion
        else:
            completion = (
                cached_litellm_text_completion if cache else litellm_text_completion
            )

        # === 调用 LLM ===
        # ujson.dumps(dict(...)) 把请求参数序列化为 JSON 字符串，
        # 这个字符串同时充当 LRU 缓存的 key（相同参数 → 相同字符串 → 命中缓存）
        response = completion(
            ujson.dumps(dict(model=self.model, messages=messages, **kwargs))
        )

        # === 解析响应，提取文本 ===
        # response["choices"] 是一个列表，每个元素是一个候选回复
        # 列表推导式: 遍历每个 choice，提取里面的文本
        #
        # hasattr(c, "message") 区分两种响应格式:
        #   chat 模式   → c 是对象，文本在 c.message.content
        #   text 模式   → c 是字典，文本在 c["text"]
        # 这行代码保证无论用哪种 model_type，都能正确拿到文本
        outputs = [
            c.message.content if hasattr(c, "message") else c["text"]
            for c in response["choices"]
        ]

        # 记录调用历史（去掉 api_key 等敏感信息后再记录）
        kwargs = {k: v for k, v in kwargs.items() if not k.startswith("api_")}
        entry = dict(prompt=prompt, messages=messages, kwargs=kwargs, response=response)
        entry = dict(**entry, outputs=outputs, usage=dict(response["usage"]))
        entry = dict(
            **entry, cost=response.get("_hidden_params", {}).get("response_cost")
        )
        self.history.append(entry)

        return outputs

    def inspect_history(self, n: int = 1):
        """打印最近 n 次 LLM 调用的 prompt 和 completion，调试用"""
        _inspect_history(self, n)


# ====================================================================
# 缓存层实现
# ====================================================================
# 两层缓存设计:
#
# 第1层: @functools.lru_cache (内存)
#   - 快速，进程内共享
#   - key = request JSON 字符串
#   - 最多 3000 条 (LM_LRU_CACHE_MAX_SIZE)
#   - 注意: litellm 的 response 对象需要支持 hash，所以用 ujson.dumps 序列化
#
# 第2层: litellm.cache (磁盘)
#   - 跨进程持久化，重启后仍有效
#   - 存储目录: ~/.storm_local_cache
#   - litellm 原生支持，无需额外代码
#
# 当 cache=False 时，两级缓存都不走（直接调 API）
# ====================================================================

@functools.lru_cache(maxsize=LM_LRU_CACHE_MAX_SIZE)
def cached_litellm_completion(request):
    """
    第1层缓存: LRU 内存缓存
    request 是 ujson.dumps 序列化的参数字符串，相同参数一定会命中缓存
    缓存命中后不再调用 litellm，直接返回之前的 response 对象
    """
    return litellm_completion(request, cache={"no-cache": False, "no-store": False})


def litellm_completion(request, cache={"no-cache": True, "no-store": True}):
    """
    直接调用 litellm chat completion（不走 LRU 缓存时使用）
    cache={"no-cache": True} 的含义:
      - 不读 litellm 磁盘缓存
      - 但会把结果写入磁盘缓存（下次 LRU miss 时可以读到）
    """
    kwargs = ujson.loads(request)
    return litellm.completion(cache=cache, **kwargs)


@functools.lru_cache(maxsize=LM_LRU_CACHE_MAX_SIZE)
def cached_litellm_text_completion(request):
    """LRU 缓存的 text completion 版本"""
    return litellm_text_completion(
        request, cache={"no-cache": False, "no-store": False}
    )


def litellm_text_completion(request, cache={"no-cache": True, "no-store": True}):
    """
    直接调用 litellm text completion（用于 model_type="text" 的场景）
    与 chat completion 的区别:
      - text completion 是老式 API，直接给 prompt 字符串
      - chat completion 是对话式 API，给 messages 列表
    """
    kwargs = ujson.loads(request)

    # 从 model 字符串解析 provider 和 model 名
    # 例如 "openai/gpt-4o" → provider="openai", model="gpt-4o"
    # 如果没有 "/" 则默认 provider 为 "openai"
    model = kwargs.pop("model").split("/", 1)
    provider, model = model[0] if len(model) > 1 else "openai", model[-1]

    # API key 优先级: kwargs 显式传入 > 环境变量 {PROVIDER}_API_KEY
    api_key = kwargs.pop("api_key", None) or os.getenv(f"{provider}_API_KEY")
    api_base = kwargs.pop("api_base", None) or os.getenv(f"{provider}_API_BASE")

    # text completion 需要把 messages 拼成纯文本 prompt
    prompt = "\n\n".join(
        [x["content"] for x in kwargs.pop("messages")] + ["BEGIN RESPONSE:"]
    )

    return litellm.text_completion(
        cache=cache,
        model=f"text-completion-openai/{model}",
        api_key=api_key,
        api_base=api_base,
        prompt=prompt,
        **kwargs,
    )


# ====================================================================
# 调试工具函数
# ====================================================================

def _green(text: str, end: str = "\n"):
    """终端绿色输出（用于显示 LLM 回复）"""
    return "\x1b[32m" + str(text).lstrip() + "\x1b[0m" + end


def _red(text: str, end: str = "\n"):
    """终端红色输出（用于显示 prompt）"""
    return "\x1b[31m" + str(text) + "\x1b[0m" + end


def _inspect_history(lm, n: int = 1):
    """打印最近 n 次 LLM 调用的完整 prompt 和 completion，用于调试"""

    for item in lm.history[-n:]:
        messages = item["messages"] or [{"role": "user", "content": item["prompt"]}]
        outputs = item["outputs"]

        print("\n\n\n")
        for msg in messages:
            print(_red(f"{msg['role'].capitalize()} message:"))
            print(msg["content"].strip())
            print("\n")

        print(_red("Response:"))
        print(_green(outputs[0].strip()))

        if len(outputs) > 1:
            choices_text = f" \t (and {len(outputs)-1} other completions)"
            print(_red(choices_text, end=""))

    print("\n\n\n")


############################


# ====================================================================
# LitellmModel — 推荐的 LLM 封装类 (v1.1.0+)
# ====================================================================
# 这是 STORM 当前推荐的 LLM 封装类，底层直接走 litellm。
#
# 为什么推荐用它而不是下面的旧类？
# 1. litellm 统一了 100+ provider 的接口差异，新增 provider 无需写新类
# 2. 支持所有 litellm 特性: 自动 fallback、cost tracking、streaming 等
# 3. 模型切换只需改 model 字符串: "minimax/MiniMax-M3" → 切到 MiniMax
#
# 使用方式:
#   lm = LitellmModel(model="openai/gpt-4o", api_key="...", temperature=0.0)
#   outputs = lm("What is AI?")  # → ["AI is ..."]
# ====================================================================

class LitellmModel(LM):
    """基于 litellm 的统一 LLM 封装，支持所有 litellm 兼容的 provider。

    用法: LitellmModel(model="provider/model_name", api_key="...")
    参考: https://docs.litellm.ai/docs/providers
    """

    def __init__(
        self,
        model: str = "openai/gpt-4o-mini",
        api_key: Optional[str] = None,
        model_type: Literal["chat", "text"] = "chat",
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, model_type=model_type, **kwargs)
        # token 统计: 线程安全的计数器（因为 STORM 可能多线程并发调 LLM）
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """从 litellm 响应中提取 token 用量并累加到计数器"""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """
        获取累计 token 用量并重置计数器。
        这个方法在 STORM pipeline 每个阶段结束时被调用，用于统计各阶段消耗。
        返回格式: {"model_name": {"prompt_tokens": N, "completion_tokens": M}}
        """
        usage = {
            self.model
            or self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(self, prompt=None, messages=None, **kwargs):
        """
        调用 LLM 并返回 completion 列表。
        与父类 LM.__call__ 的区别:
        - 额外调用 log_usage() 统计 token
        - 解析 response.json() 而不是直接使用 response 对象
        """
        # dict.pop(key, default) — 取出并删除 "cache" 键，未传入则用实例默认值
        cache = kwargs.pop("cache", self.cache)

        # 短路 or — messages 为空时用 prompt 构造 user message
        messages = messages or [{"role": "user", "content": prompt}]

        # ** 字典合并 — 实例默认参数(左) + 调用参数(右)，调用参数覆盖同名键
        kwargs = {**self.kwargs, **kwargs}

        if self.model_type == "chat":
            completion = cached_litellm_completion if cache else litellm_completion
        else:
            completion = (
                cached_litellm_text_completion if cache else litellm_text_completion
            )

        response = completion(
            ujson.dumps(dict(model=self.model, messages=messages, **kwargs))
        )
        response_dict = response.json()
        self.log_usage(response_dict)
        outputs = [
            c.message.content if hasattr(c, "message") else c["text"]
            for c in response["choices"]
        ]

        kwargs = {k: v for k, v in kwargs.items() if not k.startswith("api_")}
        entry = dict(
            prompt=prompt, messages=messages, kwargs=kwargs, response=response_dict
        )
        entry = dict(**entry, outputs=outputs, usage=dict(response_dict["usage"]))
        entry = dict(
            **entry, cost=response.get("_hidden_params", {}).get("response_cost")
        )
        self.history.append(entry)

        return outputs


# ========================================================================
# 以下所有模型类在 v1.1.0 后均已废弃 (deprecated)
# ========================================================================
# 保留仅为了向后兼容，不再维护。新代码请使用上面的 LitellmModel。
#
# 每看一个类时思考:
# 1. 为什么这个类要自己实现 _create_completion / basic_request？
#    答: 因为每个 provider 的 API 协议有细微差异
#       - OpenAI/DeepSeek 兼容 OpenAI 协议 → 继承 dspy.OpenAI
#       - Claude 用 Anthropic SDK → 直接用 anthropic.Anthropic client
#       - Gemini 用 Google genai → 直接用 google.generativeai
#       - vLLM/Ollama 是本地部署 → 用 OpenAI client 连本地 endpoint
# 2. 这正好说明了 LitellmModel 的价值: 一套接口覆盖所有这些差异
# 3. 注意每个类都有 token 统计 (_token_usage_lock + log_usage + get_usage_and_reset)
#    这是 STORM 在原始 dspy 类上额外添加的功能，用于监控 API 成本
# ========================================================================


# -------------------------------------------------------------------
# OpenAIModel — 继承 dspy.OpenAI，添加 token 统计
# -------------------------------------------------------------------
# 设计: 继承 dspy.OpenAI → 复用其 request() 方法（含 backoff 重试）
#       重写 __call__ 添加 log_usage 和 completion 过滤逻辑
# -------------------------------------------------------------------

class OpenAIModel(dspy.OpenAI):
    """OpenAI 模型封装 (deprecated, 请用 LitellmModel)。
    继承 dspy.OpenAI，额外添加了 token 用量统计功能。
    """

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        model_type: Literal["chat", "text"] = None,
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, model_type=model_type, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """从 OpenAI API 响应中记录 token 用量"""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[dict[str, Any]]:
        """
        调用 OpenAI API 生成 completion。
        复用了 dspy.OpenAI 的 request() 方法（内置 backoff 重试），
        额外添加 token 统计和 completion 过滤。
        """

        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        response = self.request(prompt, **kwargs)

        self.log_usage(response)

        choices = response["choices"]

        # 过滤掉因为 max_tokens 不够而被截断的回复
        completed_choices = [c for c in choices if c["finish_reason"] != "length"]

        if only_completed and len(completed_choices):
            choices = completed_choices

        completions = [self._get_choice_text(c) for c in choices]
        # 按 avg logprob 排序（很少启用）
        if return_sorted and kwargs.get("n", 1) > 1:
            scored_completions = []

            for c in choices:
                tokens, logprobs = (
                    c["logprobs"]["tokens"],
                    c["logprobs"]["token_logprobs"],
                )

                if "<|endoftext|>" in tokens:
                    index = tokens.index("<|endoftext|>") + 1
                    tokens, logprobs = tokens[:index], logprobs[:index]

                avglog = sum(logprobs) / len(logprobs)
                scored_completions.append((avglog, self._get_choice_text(c)))

            scored_completions = sorted(scored_completions, reverse=True)
            completions = [c for _, c in scored_completions]

        return completions


# -------------------------------------------------------------------
# DeepSeekModel — 用自己的 HTTP 请求而不是走 dspy.OpenAI
# -------------------------------------------------------------------
# 设计: 继承 dspy.OpenAI 但不复用其 request()，
#       而是自己用 requests.post 直接调 DeepSeek API
# 为什么不用 dspy 内置的请求方法？
#   因为 DeepSeek 的 API 虽然兼容 OpenAI 协议，但 dspy 的 OpenAI client
#   会额外做一些 OpenAI 特定的处理（如 Azure 格式转换），可能不兼容
# -------------------------------------------------------------------

class DeepSeekModel(dspy.OpenAI):
    """DeepSeek API 封装 (deprecated, 请用 LitellmModel)。
    直接用 HTTP POST 调 DeepSeek 的 /v1/chat/completions 端点。
    继承 dspy.OpenAI 但自己实现了 _create_completion 方法。
    """

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        api_base: str = "https://api.deepseek.com",
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, api_base=api_base, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.model = model
        # api_key 优先级: 构造函数参数 > 环境变量 DEEPSEEK_API_KEY
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        self.api_base = api_base
        if not self.api_key:
            raise ValueError(
                "DeepSeek API key must be provided either as an argument "
                "or as an environment variable DEEPSEEK_API_KEY"
            )

    def log_usage(self, response):
        """从 DeepSeek API 响应中记录 token 用量"""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0
        return usage

    @backoff.on_exception(
        backoff.expo,       # 指数退避: 1s → 2s → 4s → 8s ...
        ERRORS,             # 哪些异常触发重试
        max_time=1000,      # 最大重试总时间 (秒)
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def _create_completion(self, prompt: str, **kwargs):
        """
        直接通过 HTTP POST 调用 DeepSeek API。
        不用 dspy 的 OpenAI client，因为 DeepSeek 有一些参数差异。
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs,
        }
        response = requests.post(
            f"{self.api_base}/v1/chat/completions", headers=headers, json=data
        )
        response.raise_for_status()
        return response.json()

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[dict[str, Any]]:
        """调用 DeepSeek API 生成 completion"""
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        response = self._create_completion(prompt, **kwargs)

        self.log_usage(response)

        choices = response["choices"]
        completions = [choice["message"]["content"] for choice in choices]

        history = {
            "prompt": prompt,
            "response": response,
            "kwargs": kwargs,
        }
        self.history.append(history)

        return completions


# -------------------------------------------------------------------
# AzureOpenAIModel — 使用 Azure 版本的 OpenAI API
# -------------------------------------------------------------------
# 设计: 直接继承 dspy.LM（不走 dspy.OpenAI）
#       因为 Azure 的认证和端点格式与标准 OpenAI 完全不同
#       需要用 azure_endpoint + api_version 而不是 openai 的 api_base
# -------------------------------------------------------------------

class AzureOpenAIModel(dspy.LM):
    """Azure OpenAI 端点封装 (deprecated, 请用 LitellmModel)。

    注意: model 参数要填 Azure 平台的 deployment_id
    (不是标准的 OpenAI 模型名如 gpt-4o)
    """

    def __init__(
        self,
        azure_endpoint: str,
        api_version: str,
        model: str,
        api_key: str,
        model_type: Literal["chat", "text"] = "chat",
        **kwargs,
    ):
        super().__init__(model=model)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.model = model
        self.provider = "azure"
        self.model_type = model_type

        # Azure 需要专用的 AzureOpenAI client（不同于 openai.OpenAI）
        self.client = AzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            api_version=api_version,
        )

        self.kwargs = {
            "model": model,
            "temperature": 0.0,
            "max_tokens": 150,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "n": 1,
            **kwargs,
        }

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def basic_request(self, prompt: str, **kwargs) -> Any:
        """
        发送请求到 Azure OpenAI 端点。
        根据 model_type 选择 chat.completions.create 或 completions.create。
        """
        kwargs = {**self.kwargs, **kwargs}

        try:
            if self.model_type == "chat":
                messages = [{"role": "user", "content": prompt}]
                response = self.client.chat.completions.create(
                    messages=messages, **kwargs
                )
            else:
                response = self.client.completions.create(prompt=prompt, **kwargs)

            self.log_usage(response)

            history_entry = {
                "prompt": prompt,
                "response": dict(response),
                "kwargs": kwargs,
            }
            self.history.append(history_entry)

            return response

        except Exception as e:
            logging.error(f"Error making request to Azure OpenAI: {str(e)}")
            raise

    def _get_choice_text(self, choice: Any) -> str:
        """从 Azure 响应中提取文本，chat 和 text 的字段路径不同"""
        if self.model_type == "chat":
            return choice.message.content
        return choice.text

    def log_usage(self, response):
        """从 Azure OpenAI 响应中记录 token 用量"""
        usage_data = response.usage
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.prompt_tokens
                self.completion_tokens += usage_data.completion_tokens

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0
        return usage

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[str]:
        """调用 Azure OpenAI 生成 completion"""
        response = self.basic_request(prompt, **kwargs)

        choices = response.choices
        # 过滤截断的回复
        completed_choices = [c for c in choices if c.finish_reason != "length"]

        if only_completed and completed_choices:
            choices = completed_choices

        completions = [self._get_choice_text(c) for c in choices]

        return completions


# -------------------------------------------------------------------
# GroqModel — 高速推理 API
# -------------------------------------------------------------------
# Groq 提供基于 LPU（语言处理单元）的超快推理
# API 基本兼容 OpenAI 协议，但有一些限制（如只支持 N=1）
# -------------------------------------------------------------------

class GroqModel(dspy.OpenAI):
    """Groq API 封装 (deprecated, 请用 LitellmModel)。
    Groq: https://console.groq.com/

    自己实现 _create_completion 原因: Groq 有一些特殊限制
    - 只支持 N=1
    - 不支持 logprobs/logit_bias/top_logprobs 参数
    - temperature=0 需要改为 1e-8（Groq 不接受严格的 0）
    """

    def __init__(
        self,
        model: str = "llama3-70b-8192",
        api_key: Optional[str] = None,
        api_base: str = "https://api.groq.com/openai/v1",
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, api_base=api_base, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.model = model
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.api_base = api_base
        if not self.api_key:
            raise ValueError(
                "Groq API key must be provided either as an argument "
                "or as an environment variable GROQ_API_KEY"
            )

    def log_usage(self, response):
        """从 Groq API 响应中记录 token 用量"""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0
        return usage

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def _create_completion(self, prompt: str, **kwargs):
        """
        调用 Groq API。与 DeepSeek 类似，直接 HTTP POST。
        额外处理了 Groq 特有的参数兼容问题:
        1. 移除不支持的 logprobs/logit_bias/top_logprobs
        2. temperature=0 → 1e-8（Groq API 限制）
        3. 移除 message 中的 name 字段
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        # 移除 Groq 不支持的参数
        kwargs.pop("logprobs", None)
        kwargs.pop("logit_bias", None)
        kwargs.pop("top_logprobs", None)

        if "n" in kwargs and kwargs["n"] != 1:
            raise ValueError("Groq API only supports N=1")

        if kwargs.get("temperature", 1) == 0:
            kwargs["temperature"] = 1e-8  # Groq 不允许精确的 0

        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs,
        }

        # Groq 不允许 message 带 name 字段
        for message in data["messages"]:
            message.pop("name", None)

        response = requests.post(
            f"{self.api_base}/chat/completions", headers=headers, json=data
        )
        response.raise_for_status()
        return response.json()

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[dict[str, Any]]:
        """调用 Groq API 生成 completion"""
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        response = self._create_completion(prompt, **kwargs)
        self.log_usage(response)

        choices = response["choices"]
        completions = [choice["message"]["content"] for choice in choices]

        history = {
            "prompt": prompt,
            "response": response,
            "kwargs": kwargs,
        }
        self.history.append(history)

        return completions


# -------------------------------------------------------------------
# ClaudeModel — Anthropic Claude API
# -------------------------------------------------------------------
# 设计: 继承 dspy.dsp.modules.lm.LM（最底层的 dspy LM 基类）
#       使用 Anthropic 官方 SDK (anthropic.Anthropic client)
#       因为 Claude API 的消息格式和 OpenAI 完全不同，无法复用 dspy.OpenAI
#
# 关键差异:
# - Claude 用 Messages API: messages.create(model=..., messages=[...])
# - Token 统计字段名不同: input_tokens / output_tokens (OpenAI 叫 prompt/completion)
# - 限流异常类型不同: anthropic.RateLimitError (OpenAI 是 openai.RateLimitError)
# -------------------------------------------------------------------

class ClaudeModel(dspy.dsp.modules.lm.LM):
    """Claude API 封装 (deprecated, 请用 LitellmModel)。
    从 dspy/dsp/modules/anthropic.py 复制，额外添加了 token 统计。
    """

    def __init__(
        self,
        model: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(model)
        try:
            from anthropic import Anthropic
        except ImportError as err:
            raise ImportError("Claude requires `pip install anthropic`.") from err

        self.provider = "anthropic"
        self.api_key = api_key = (
            os.environ.get("ANTHROPIC_API_KEY") if api_key is None else api_key
        )
        self.api_base = (
            "https://api.anthropic.com/v1/messages" if api_base is None else api_base
        )
        # Claude API 参数限制: max_tokens ≤ 4096，top_k 是 Claude 独有参数
        self.kwargs = {
            "temperature": kwargs.get("temperature", 0.0),
            "max_tokens": min(kwargs.get("max_tokens", 4096), 4096),
            "top_p": kwargs.get("top_p", 1.0),
            "top_k": kwargs.get("top_k", 1),
            "n": kwargs.pop("n", kwargs.pop("num_generations", 1)),
            **kwargs,
            "model": model,
        }
        self.history: list[dict[str, Any]] = []
        self.client = Anthropic(api_key=api_key)
        self.model = model

        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """从 Claude API 响应中记录 token 用量。
        注意: Claude 的字段名是 input_tokens/output_tokens，
        与 OpenAI 的 prompt_tokens/completion_tokens 不同。
        """
        usage_data = response.usage
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.input_tokens
                self.completion_tokens += usage_data.output_tokens

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def basic_request(self, prompt: str, **kwargs):
        """
        直接使用 Anthropic SDK 发送请求。
        历史记录需要 JSON 序列化，所以把 response 拆成 dict 保存
        （Anthropic 的 response 对象不能直接 json.dumps）
        """
        raw_kwargs = kwargs
        kwargs = {**self.kwargs, **kwargs}
        # Claude Messages API 需要 messages 参数
        kwargs["messages"] = [{"role": "user", "content": prompt}]
        kwargs.pop("n")  # Claude 不支持 n 参数
        response = self.client.messages.create(**kwargs)
        # 手动构造 JSON 可序列化的历史记录
        json_serializable_history = {
            "prompt": prompt,
            "response": {
                "content": response.content[0].text,
                "model": response.model,
                "role": response.role,
                "stop_reason": response.stop_reason,
                "stop_sequence": response.stop_sequence,
                "type": response.type,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
            },
            "kwargs": kwargs,
            "raw_kwargs": raw_kwargs,
        }
        self.history.append(json_serializable_history)
        return response

    @backoff.on_exception(
        backoff.expo,
        (RateLimitError,),  # Claude 特有的限流异常类型
        max_time=1000,
        max_tries=8,        # 最多重试 8 次
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        """带重试的请求方法，处理 Claude API 限流错误"""
        return self.basic_request(prompt, **kwargs)

    def __call__(self, prompt, only_completed=True, return_sorted=False, **kwargs):
        """
        调用 Claude API 生成 completion。
        注释掉的代码: 原本 dspy 里如果 stop_reason="max_tokens"，
        会跳过该 completion 继续请求。但这会导致 IndexError，
        STORM 团队注释掉了这个逻辑以提高透明度。
        """
        assert only_completed, "for now"
        assert return_sorted is False, "for now"
        n = kwargs.pop("n", 1)
        completions = []
        for _ in range(n):
            response = self.request(prompt, **kwargs)
            self.log_usage(response)
            # 原本 dspy 会检查 response.stop_reason == "max_tokens" 并跳过
            # 但这可能导致 "IndexError: list index out of range"
            # 为了错误透明化，这里直接保留所有 completions
            # if only_completed and response.stop_reason == "max_tokens":
            #     continue
            completions = [c.text for c in response.content]
        return completions


# -------------------------------------------------------------------
# VLLMClient — 连接本地 vLLM 推理服务器
# -------------------------------------------------------------------
# 使用场景: 用自己 GPU 跑开源模型（LLaMA, Qwen, Mistral 等）
# vLLM 暴露了兼容 OpenAI 的 HTTP API，所以用 openai.OpenAI client 连接
# -------------------------------------------------------------------

class VLLMClient(dspy.dsp.LM):
    """vLLM 本地推理服务器客户端 (deprecated, 请用 LitellmModel)。

    vLLM 的 HTTP server 兼容 OpenAI API 格式，
    所以直接复用 openai.OpenAI client，只改 base_url 到 localhost。
    文档: https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html
    """

    def __init__(
        self,
        model,
        port,
        model_type: Literal["chat", "text"] = "text",
        url="http://localhost",
        api_key="null",  # vLLM 本地部署不需要真实 API Key
        **kwargs,
    ):
        super().__init__(model=model)
        self.kwargs = {**self.kwargs, **kwargs}
        self.model = model
        # 拼接 vLLM 兼容的 base_url: http://localhost:{port}/v1/chat/
        self.base_url = f"{url}:{port}/v1/"
        if model_type == "chat":
            self.base_url += "chat/"
        self.client = OpenAI(base_url=self.base_url, api_key=api_key)
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self._token_usage_lock = threading.Lock()

    def basic_request(self, prompt, **kwargs):
        """发送请求到本地 vLLM 服务器"""
        completion = self.client.chat.completions.create(
            **kwargs,
            messages=[{"role": "user", "content": prompt}],
        )
        return completion

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        """带重试的请求方法"""
        return self.basic_request(prompt, **kwargs)

    def log_usage(self, response):
        """记录 token 用量"""
        usage_data = response.usage
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.prompt_tokens
                self.completion_tokens += usage_data.completion_tokens

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(self, prompt: str, **kwargs):
        """调用本地 vLLM 推理"""
        kwargs = {**self.kwargs, **kwargs}

        try:
            response = self.request(prompt, **kwargs)
        except Exception as e:
            print(f"Failed to generate completion: {e}")
            raise Exception(e)

        self.log_usage(response)

        choices = response.choices
        completions = [choice.message.content for choice in choices]

        history = {
            "prompt": prompt,
            "response": response,
            "kwargs": kwargs,
        }
        self.history.append(history)

        return completions


# -------------------------------------------------------------------
# OllamaClient — 连接本地 Ollama 推理服务
# -------------------------------------------------------------------

class OllamaClient(dspy.OllamaLocal):
    """Ollama 本地推理客户端 (deprecated, 请用 LitellmModel)。
    继承 dspy.OllamaLocal，仅额外存储了 kwargs。
    """

    def __init__(self, model, port, url="http://localhost", **kwargs):
        # Ollama 默认不要求 http:// 前缀，这里做兼容处理
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "http://" + url
        super().__init__(model=model, base_url=f"{url}:{port}", **kwargs)
        self.kwargs = {**self.kwargs, **kwargs}


# -------------------------------------------------------------------
# TGIClient — HuggingFace TGI (Text Generation Inference) 客户端
# -------------------------------------------------------------------

class TGIClient(dspy.HFClientTGI):
    """HuggingFace TGI 推理服务器客户端 (deprecated, 请用 LitellmModel)。
    TGI 是 HuggingFace 的高性能推理框架，常用于部署开源模型。
    """

    def __init__(self, model, port, url, http_request_kwargs=None, **kwargs):
        super().__init__(
            model=model,
            port=port,
            url=url,
            http_request_kwargs=http_request_kwargs,
            **kwargs,
        )

    def _generate(self, prompt, **kwargs):
        """
        调用 TGI 的 /generate 端点。
        与 dspy 原版的区别: 注释掉了硬编码的 temperature 下限 (原版强制 ≥0.1)，
        这样 STORM 可以设 temperature=0.0 获得确定性输出。
        """
        kwargs = {**self.kwargs, **kwargs}

        payload = {
            "inputs": prompt,
            "parameters": {
                "do_sample": kwargs["n"] > 1,
                "best_of": kwargs["n"],
                "details": kwargs["n"] > 1,
                **kwargs,
            },
        }

        # openai_to_hf: 把 OpenAI 风格的参数名转换为 HuggingFace 风格
        payload["parameters"] = openai_to_hf(**payload["parameters"])

        # STORM 需要确定性输出，所以注释掉这个强制 temperature ≥ 0.1 的逻辑
        # payload["parameters"]["temperature"] = max(
        #     0.1, payload["parameters"]["temperature"],
        # )

        response = send_hftgi_request_v01_wrapped(
            f"{self.url}:{random.Random().choice(self.ports)}" + "/generate",
            url=self.url,
            ports=tuple(self.ports),
            json=payload,
            headers=self.headers,
            **self.http_request_kwargs,
        )

        try:
            json_response = response.json()
            completions = [json_response["generated_text"]]

            # TGI 可能返回多个 best_of 序列
            if (
                "details" in json_response
                and "best_of_sequences" in json_response["details"]
            ):
                completions += [
                    x["generated_text"]
                    for x in json_response["details"]["best_of_sequences"]
                ]

            response = {"prompt": prompt, "choices": [{"text": c} for c in completions]}
            return response
        except Exception:
            print("Failed to parse JSON response:", response.text)
            raise Exception("Received invalid JSON response from server")


# -------------------------------------------------------------------
# TogetherClient — Together AI 云推理平台
# -------------------------------------------------------------------
# Together AI 提供按需的 GPU 推理服务，兼容 OpenAI API 格式
# 额外支持: 可以用 HuggingFace tokenizer 自动套 chat template
# -------------------------------------------------------------------

class TogetherClient(dspy.HFModel):
    """Together AI API 封装 (deprecated, 请用 LitellmModel)。
    Together: https://api.together.xyz/

    特色功能: apply_tokenizer_chat_template
    - 当启用时，会自动下载 HuggingFace tokenizer
    - 用 tokenizer.apply_chat_template() 把 prompt 格式化为模型训练时的格式
    - 这对开源模型（LLaMA, Mistral 等）很重要，因为不同模型的 chat template 不同
    """

    def __init__(
        self,
        model,
        api_key: Optional[str] = None,
        apply_tokenizer_chat_template=False,
        hf_tokenizer_name=None,
        model_type: Literal["chat", "text"] = "chat",
        **kwargs,
    ):
        super().__init__(model=model, is_client=True)
        self.session = requests.Session()
        self.api_key = api_key = (
            os.environ.get("TOGETHER_API_KEY") if api_key is None else api_key
        )
        self.model = model
        self.model_type = model_type
        if os.getenv("TOGETHER_API_BASE") is None:
            if self.model_type == "chat":
                self.api_base = "https://api.together.xyz/v1/chat/completions"
            else:
                self.api_base = "https://api.together.xyz/v1/completions"
        else:
            self.api_base = os.getenv("TOGETHER_API_BASE")

        # 如果启用 chat template，加载 HuggingFace tokenizer
        # 这样 prompt 会被自动格式化为对应模型的 chat 格式
        self.apply_tokenizer_chat_template = apply_tokenizer_chat_template
        if self.apply_tokenizer_chat_template:
            logging.info("Loading huggingface tokenizer.")
            if hf_tokenizer_name is None:
                hf_tokenizer_name = self.model
            self.tokenizer = AutoTokenizer.from_pretrained(
                hf_tokenizer_name, cache_dir=kwargs.get("cache_dir", None)
            )

        stop_default = "\n\n---"

        self.kwargs = {
            "temperature": kwargs.get("temperature", 0.0),
            "max_tokens": min(kwargs.get("max_tokens", 4096), 4096),
            "top_p": kwargs.get("top_p", 1.0),
            "top_k": kwargs.get("top_k", 1),
            "repetition_penalty": 1,
            "n": kwargs.pop("n", kwargs.pop("num_generations", 1)),
            "stop": stop_default if "stop" not in kwargs else kwargs["stop"],
            **kwargs,
        }
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """记录 token 用量"""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
    )
    def _generate(self, prompt, **kwargs):
        """发送请求到 Together AI 平台"""
        kwargs = {**self.kwargs, **kwargs}

        stop = kwargs.get("stop")
        temperature = kwargs.get("temperature")
        max_tokens = kwargs.get("max_tokens", 150)
        top_p = kwargs.get("top_p", 0.7)
        top_k = kwargs.get("top_k", 50)
        repetition_penalty = kwargs.get("repetition_penalty", 1)
        if self.apply_tokenizer_chat_template:
            prompt = self.tokenizer.apply_chat_template(
                [{"role": "user", "content": prompt}], tokenize=False
            )

        if self.model_type == "chat":
            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant. You must continue "
                    "the user text directly without *any* additional interjections.",
                },
                {"role": "user", "content": prompt},
            ]
            body = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "top_k": top_k,
                "repetition_penalty": repetition_penalty,
                "stop": stop,
            }
        else:
            body = {
                "model": self.model,
                "prompt": prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "top_k": top_k,
                "repetition_penalty": repetition_penalty,
                "stop": stop,
            }

        headers = {"Authorization": f"Bearer {self.api_key}"}

        with self.session.post(self.api_base, headers=headers, json=body) as resp:
            resp_json = resp.json()
            self.log_usage(resp_json)
            if self.model_type == "chat":
                completions = [
                    resp_json.get("choices", [])[0]
                    .get("message", {})
                    .get("content", "")
                ]
            else:
                completions = [resp_json.get("choices", [])[0].get("text", "")]
            response = {"prompt": prompt, "choices": [{"text": c} for c in completions]}
            return response


# -------------------------------------------------------------------
# GoogleModel — Gemini API
# -------------------------------------------------------------------
# 设计: 继承 dspy.dsp.modules.lm.LM（最底层基类）
#       使用 Google 官方 SDK (google.generativeai)
#       因为 Gemini 的 API 设计（GenerationConfig, GenerativeModel）与 OpenAI 完全不同
# -------------------------------------------------------------------

class GoogleModel(dspy.dsp.modules.lm.LM):
    """Google Gemini API 封装 (deprecated, 请用 LitellmModel)。

    可以用 genai.list_models() 获取可用模型列表。
    Gemini API 限制: candidate_count 只能为 1。
    """

    def __init__(
        self,
        model: str,
        api_key: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(model)
        try:
            import google.generativeai as genai
        except ImportError as err:
            raise ImportError(
                "GoogleModel requires `pip install google-generativeai`."
            ) from err

        api_key = os.environ.get("GOOGLE_API_KEY") if api_key is None else api_key
        genai.configure(api_key=api_key)

        # Gemini 用 GenerationConfig 对象来管理参数（不同于 OpenAI 的 kwargs 方式）
        kwargs = {
            "candidate_count": 1,  # Gemini API 目前只支持单个候选
            "temperature": (
                0.0 if "temperature" not in kwargs else kwargs["temperature"]
            ),
            "max_output_tokens": kwargs["max_tokens"],
            "top_p": 1,
            "top_k": 1,
            **kwargs,
        }

        # GenerationConfig 不接受 max_tokens 参数名（用 max_output_tokens）
        kwargs.pop("max_tokens", None)

        self.model = model
        self.config = genai.GenerationConfig(**kwargs)
        self.llm = genai.GenerativeModel(
            model_name=model, generation_config=self.config
        )

        self.kwargs = {
            "n": 1,
            **kwargs,
        }

        self.history: list[dict[str, Any]] = []

        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """从 Gemini API 响应中记录 token 用量。
        注意: Gemini 的字段名是 prompt_token_count / candidates_token_count。
        """
        usage_data = response.usage_metadata
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.prompt_token_count
                self.completion_tokens += usage_data.candidates_token_count

    def get_usage_and_reset(self):
        """获取累计 token 用量并清零"""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def basic_request(self, prompt: str, **kwargs):
        """使用 Gemini SDK 的 generate_content 发送请求"""
        raw_kwargs = kwargs
        kwargs = {
            **self.kwargs,
            **kwargs,
        }

        # Gemini 不接受 n 参数
        n = kwargs.pop("n", None)

        response = self.llm.generate_content(prompt, generation_config=kwargs)

        history = {
            "prompt": prompt,
            "response": [response.to_dict()],
            "kwargs": kwargs,
            "raw_kwargs": raw_kwargs,
        }
        self.history.append(history)

        return response

    @backoff.on_exception(
        backoff.expo,
        (Exception,),  # Gemini 没有特定限流异常，捕获所有异常
        max_time=1000,
        max_tries=8,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        """带重试的请求方法"""
        return self.basic_request(prompt, **kwargs)

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ):
        """调用 Gemini API 生成 completion"""
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        n = kwargs.pop("n", 1)

        completions = []
        for _ in range(n):
            response = self.request(prompt, **kwargs)
            self.log_usage(response)
            # Gemini 的响应结构: response.parts[0].text
            completions.append(response.parts[0].text)

        return completions


# ========================================================================
