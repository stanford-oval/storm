# STORM 学习进度与 PaperStorm MVP 计划

更新日期：2026-07-20

## 1. 当前目标

Master 的短期目标不是继续泛读 STORM 源码，而是把已经理解的 STORM 架构转化成一个可运行、可解释、可放进简历的 Agent 工程项目：

```text
PaperStorm：基于 STORM 架构改造的中文论文调研 Agent
```

项目定位：

```text
输入论文主题或本地 PDF 论文库，Agent 自动完成论文检索、资料整理、大纲生成、正文生成和润色，输出带引用来源的中文论文综述报告。
```

## 2. 已完成的 STORM 学习内容

### 2.1 入口脚本

已读：

```text
examples/storm_examples/run_storm_wiki_minimax.py
```

已理解：

- 入口脚本负责组装 `LMConfigs`、`RunnerArguments`、`Retriever` 和 `STORMWikiRunner`。
- STORM 配置 5 个 LLM 插槽，不是必须使用 5 个不同模型，而是把不同任务角色解耦。
- `--do-research`、`--do-generate-outline`、`--do-generate-article`、`--do-polish-article` 控制四阶段 pipeline。
- MiniMax M3 通过 `LitellmModel` 接入。
- 中文输出需要拆分模型 topic、输出目录名和终端编码边界。

### 2.2 Engine 编排层

已读：

```text
knowledge_storm/storm_wiki/engine.py
```

已理解：

- `STORMWikiRunner` 是 pipeline 编排器，不负责具体生成算法。
- 四阶段状态流为：

```text
topic
  -> information_table
  -> outline
  -> draft_article
  -> polished_article
```

- STORM 支持断点续跑：

```text
article 阶段依赖 conversation_log.json + storm_gen_outline.txt
polish 阶段依赖 storm_gen_article.txt + url_to_info.json
```

- `raw_search_results.json` 更偏检索审计，outline 断点续跑真正依赖 `conversation_log.json`。
- `url_to_info.json` 是正文引用来源映射，用于追溯 `[1] [2]` 等引用标记背后的 URL 和 snippets。

### 2.3 Retriever / Tool 层

已读：

```text
knowledge_storm/rm.py
knowledge_storm/interface.py 中的 Information / Retriever
```

已理解：

- `rm.py` 是具体检索工具适配层，负责把 DuckDuckGo、Bing、VectorDB 等外部来源统一成内部 dict 格式。
- `Retriever` 是 STORM 内部统一调度层，负责多 query 调用、去重、清洗、并发和转 `Information` 对象。
- Tool 输出统一格式是 Agent 稳定运行的关键：

```python
{
    "url": "...",
    "title": "...",
    "description": "...",
    "snippets": ["..."],
}
```

### 2.4 Knowledge Curation Agent Loop

已读：

```text
knowledge_storm/storm_wiki/modules/knowledge_curation.py
```

已理解：

```text
StormKnowledgeCurationModule.research()
  -> 生成 persona
  -> 每个 persona 进入 ConvSimulator
  -> WikiWriter 提问
  -> TopicExpert 把问题转 query
  -> Retriever 检索
  -> TopicExpert 基于资料回答
  -> DialogueTurn[]
  -> StormInformationTable
```

核心判断：

- `ConvSimulator` 控制单个 persona 下的多轮对话循环。
- `WikiWriter` 负责提出下一轮问题。
- `TopicExpert` 负责 query 生成、工具调用和 grounded answer。
- DSPy 在这里承担 LLM 子任务定义和调用抽象，不需要深入背 DSPy 内部实现。

### 2.5 Outline / Article / Polish

已读：

```text
knowledge_storm/storm_wiki/modules/outline_generation.py
knowledge_storm/storm_wiki/modules/article_generation.py
knowledge_storm/storm_wiki/modules/article_polish.py
knowledge_storm/lm.py
```

已理解：

- outline 有两类产物：

```text
direct_gen_outline.txt
  不看检索资料，基于模型先验生成初稿大纲

storm_gen_outline.txt
  结合 information_table 的调研资料生成 grounded outline
```

- article generation 不是重新联网检索，而是在 `StormInformationTable` 内部对 collected snippets 做 encoder + cosine similarity，按章节找相关资料。
- 一级章节之间基本独立，因此可以并发生成。
- `article.update_section()` 把章节正文和引用信息挂回文章树。
- polish 阶段把整篇草稿交给 LLM 做摘要、去重和润色，因此需要更大上下文。
- `lm.py` 是多 provider 兼容层，统一 OpenAI / MiniMax 等模型调用，并记录调用历史用于审计。

## 3. 已完成的工程改造

当前 STORM 二次开发已经完成：

- MiniMax M3 接入。
- DuckDuckGo / ddgs 检索适配。
- 中文输出参数 `--output-language zh`。
- 模型 topic 与输出目录名分离。
- 空 query 清洗。
- 非法 Unicode 清理。
- Windows UTF-8 输出修复。
- `run_config.json` 凭证脱敏。
- 8 个 unittest 回归测试。
- 成功生成中文报告：

```text
results/minimax_zh/RAG/storm_gen_article_polished.txt
```

## 4. PaperStorm MVP 范围

第一版不接 IEEE，优先实现：

```text
ArxivRM + LocalPDFRM + MiniMax 中文综述生成
```

原因：

- arXiv 官方 API 免费、无需 key、结构化、适合快速形成论文检索闭环。
- IEEE Xplore API 需要 key 申请和权限审核，不适合 2 到 3 天 MVP 主路径。
- 本地 PDF 读取能体现真实 paper-agent 场景：用户通常既要发现新论文，也要分析已有论文库。

## 5. 目标架构

```text
PaperStorm
  |
  +-- ArxivRM
  |     输入 topic/query
  |     返回 title / authors / abstract / published / pdf_url
  |
  +-- LocalPDFRM
  |     输入本地 PDF 文件夹
  |     解析文本、chunk、检索相关片段
  |
  +-- STORM pipeline
        research -> outline -> article -> polish
        输出中文论文综述报告
```

统一输出仍使用 STORM `Information` schema：

```python
{
    "url": paper_url_or_local_pdf_path,
    "title": paper_title,
    "description": abstract_or_summary,
    "snippets": [relevant_text],
    "meta": {
        "source_type": "arxiv" | "local_pdf",
        "authors": [...],
        "year": "...",
        "pdf_url": "...",
    },
}
```

## 6. 实施顺序

### 第 1 步：ArxivRM

- 在 `knowledge_storm/rm.py` 新增 `ArxivRM`。
- 调用 arXiv API 获取论文元数据。
- 解析 Atom XML。
- 输出 STORM 标准检索 dict。
- 增加无网络 fake response 单元测试。

### 第 2 步：LocalPDFRM

- 新增本地 PDF 读取 RM。
- 使用 PyMuPDF 或 pdfplumber 提取文本。
- 对文本 chunk。
- 使用现有 encoder 或轻量 embedding 做相关片段检索。
- 输出本地 PDF 来源、页码或 chunk id。

### 第 3 步：PaperStorm 示例入口

- 新增：

```text
examples/storm_examples/run_paper_storm_minimax.py
```

- 支持参数：

```text
--retriever arxiv
--retriever local-pdf
--retriever hybrid
--pdf-dir
--topic
--output-language zh
```

### 第 4 步：样例报告

固定主题建议：

```text
retrieval augmented generation evaluation
```

输出：

```text
results/paperstorm_zh/<topic>/storm_gen_article_polished.txt
```

### 第 5 步：测试与文档

至少补充：

- arXiv 结果格式测试。
- PDF 文本解析测试。
- LocalPDFRM 检索测试。
- hybrid retriever 配置测试。
- 中文输出目录测试。
- 引用来源 `url_to_info.json` 测试。

文档包括：

- README 运行命令。
- 样例输出路径。
- 架构图。
- 开发日志。
- 简历表述。

## 7. 简历表述草稿

```text
基于 Stanford STORM 二次开发 PaperStorm 中文论文调研 Agent，接入 MiniMax M3、arXiv API 与本地 PDF 检索后端，将论文摘要、PDF 片段和网页资料统一为 Information schema，支持 research-outline-article-polish 多阶段断点续跑并生成带引用来源的中文综述报告。

实现 LLM 工具输入清洗、Unicode/UTF-8 稳定输出、配置凭证脱敏和引用来源追踪，补充单元测试覆盖检索格式、PDF 解析、空 query、中文输出和断点产物，提升 Agent 运行的可复现性与可审计性。
```

## 8. 当前执行策略

为了尽快形成可展示项目，采取：

```text
Codex 主导 MVP 实现
Master 同步审阅关键代码和设计决策
每完成一个阶段就运行测试、更新文档、提交并 push 到 GitHub fork
```

Master 需要重点掌握：

- 新 Retriever 如何接入 STORM。
- 本地 PDF 如何转成统一 `Information`。
- Agent pipeline 如何复用 STORM 的四阶段。
- 简历和面试中如何解释设计边界、失败处理和评测方式。
