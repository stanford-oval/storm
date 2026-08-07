# 官方 STORM 中文说明

本文档是对 `README_STORM_OFFICIAL.md` 中官方 STORM 项目说明的中文整理。原文仍保留在仓库根目录，本文用于快速理解官方架构，以及 PaperStorm Agent 是在什么基础上做二次开发。

## 1. STORM 是什么

STORM 全称是：

```text
Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking
```

它是 Stanford OVAL 提出的长文生成系统，目标是从一个 topic 出发，通过检索、提问、知识整理和写作，生成类似 Wikipedia 风格的长文章。

官方强调：STORM 生成的文章不能直接等同于发表级或百科最终稿，但可以帮助人在正式写作前完成调研、资料组织和初稿搭建。

## 2. 官方 STORM 架构

官方 README 中的整体架构图：

```text
assets/overview.svg
```

官方 README 中的两阶段流程图：

```text
assets/two_stages.jpg
```

STORM 把长文章生成拆成两个大阶段：

1. Pre-writing stage
   - 围绕 topic 做检索。
   - 从不同视角提出问题。
   - 通过模拟对话收集带来源的信息。
   - 基于收集信息生成 outline。

2. Writing stage
   - 使用 outline 和 references 生成完整文章。
   - 在文章中插入引用。
   - 对文章做 polish，例如加入总结、去重、改善结构。

## 3. 核心机制

### Perspective-Guided Question Asking

直接让 LLM 针对 topic 提问，问题容易浅、散、重复。STORM 的做法是先从相似主题的文章中发现不同 perspective，再让这些 perspective 控制提问过程。

可以理解为：

```text
topic -> 发现相关视角 -> 每个视角提出不同问题 -> 检索补充信息
```

这个机制的价值是提升调研覆盖面，让系统不只问定义类问题，也能问历史、机制、应用、争议、评估等不同方向的问题。

### Simulated Conversation

STORM 会模拟 Wikipedia writer 和 topic expert 的对话。

- Writer 负责提出问题。
- Expert 基于检索结果回答。
- Writer 根据回答继续追问。
- 对话过程中收集有引用的信息。

这个机制让系统可以多轮更新对 topic 的理解，而不是一次性检索后直接写文章。

## 4. 官方 STORM Pipeline

官方 `STORMWikiRunner.run()` 主要包含四个开关：

```text
do_research
do_generate_outline
do_generate_article
do_polish_article
```

对应流程：

```text
research -> outline -> article -> polish
```

每一阶段都可以单独执行或复用已有产物。

## 5. 为什么官方示例会配置多个 LLM

STORM 是多模块系统，不同模块对模型能力、成本和上下文长度的要求不同。

- `conv_simulator_lm`：用于模拟对话和生成查询，适合较快较便宜模型。
- `question_asker_lm`：用于提出问题，适合较快模型。
- `outline_gen_lm`：用于生成结构，要求更强的组织能力。
- `article_gen_lm`：用于生成长文和引用，要求更强模型和更大输出。
- `article_polish_lm`：用于整篇润色、去重、总结，要求更大上下文。

所以官方不是“一个 LLM 做不了”，而是为了在质量、成本、速度之间做工程权衡。

## 6. Co-STORM

Co-STORM 是 STORM 的协作版本，支持 human-AI collaborative knowledge curation。

官方 README 中的 Co-STORM 图：

```text
assets/co-storm-workflow.jpg
```

它包含：

- Co-STORM LLM experts：基于外部知识回答问题或提出追问。
- Moderator：根据 discourse history 和检索发现提出推动讨论的问题。
- Human user：可以观察讨论，也可以主动插入信息改变讨论方向。
- Mind map：动态组织概念结构，降低长讨论中的认知负担。

## 7. PaperStorm Agent 在官方基础上的增强

PaperStorm Agent 没有替代官方 STORM，而是在官方 RAG/Deep Research pipeline 基础上做工程化增强：

- 中文论文调研。
- DeepSeek / MiniMax 接入。
- arXiv / Local PDF 检索。
- PIM 领域消歧。
- Query sanitizer。
- Runtime trace。
- Tool schema / MCP-style server。
- Memory / context compression。
- 知识库 QA。
- Eval / benchmark。
- Multi-Agent 编排。
- Task Service、并发 baseline 和前端 dashboard。

一句话：

```text
官方 STORM 解决“如何做多视角调研并生成文章”，PaperStorm Agent 进一步补齐“如何把它做成可观测、可评估、可服务化、可展示的 Agent 工程项目”。
```
