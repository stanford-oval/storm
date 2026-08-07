# STORM MiniMax Agent 岗项目展示说明

更新日期：2026-07-18

## 定位

本项目不应包装成“从零实现 STORM”。准确说法是：

> 基于 Stanford STORM 的二次开发，完成 MiniMax M3 接入、免费检索后端适配、中文调研输出、运行稳定性修复、配置脱敏和回归测试。

面向 Agent 开发岗时，它的价值不在“算法原创”，而在证明你理解一个真实 Agent 系统的工程边界：

- LLM 调用层如何接入非默认模型。
- Retriever / Tool 输出如何适配主流程。
- Agent 运行中间态与最终产物如何区分。
- LLM 生成的工具输入为什么必须清洗。
- 配置、日志、输出文件为什么要可复现、可审计、可脱敏。
- 修复问题后如何用回归测试固化。

## 当前已完成能力

### 1. MiniMax M3 接入

新增入口：

```text
examples/storm_examples/run_storm_wiki_minimax.py
```

通过 `LitellmModel` 使用 MiniMax M3，分别配置 STORM pipeline 的对话模拟、提问、大纲、正文和润色模型。

### 2. DuckDuckGo / ddgs 检索适配

修改：

```text
knowledge_storm/rm.py
requirements.txt
```

优先使用新版 `ddgs`，兼容现代 text search 返回格式，并保留旧包 fallback。

### 3. 中文输出链路

入口脚本支持：

```text
--topic
--output-language zh
```

避免通过终端管道传中文导致 surrogate 编码问题，同时把“模型研究主题”和“文件系统目录名”分离。

### 4. 安全与可维护性修复

已覆盖：

- `run_config.json` 递归脱敏 API key、access token、secret、password 等凭证字段。
- 文本输出统一 UTF-8。
- 空 search query 过滤，避免检索工具抛出 `query is mandatory`。
- 非法 Unicode 字符清洗。

### 5. 回归测试

测试文件：

```text
tests/test_minimax_runtime_fixes.py
```

覆盖 8 个运行时修复点，包括凭证脱敏、检索格式、中文输出、目录名、Unicode、空 query、UTF-8 输出。

## 可验证运行命令

测试命令：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest tests.test_minimax_runtime_fixes -v
```

完整中文报告生成命令：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_storm_wiki_minimax.py `
  --topic RAG `
  --output-language zh `
  --output-dir ./results/minimax_zh `
  --do-research `
  --do-generate-outline `
  --do-generate-article `
  --do-polish-article `
  --max-conv-turn 1 `
  --max-perspective 2 `
  --search-top-k 3 `
  --max-thread-num 1
```

最终产物：

```text
results/minimax_zh/RAG/storm_gen_article_polished.txt
```

## 简历写法

### 推荐版本

```text
基于 Stanford STORM 二次开发中文 Deep Research Agent，接入 MiniMax M3 与 ddgs/DuckDuckGo 检索，跑通 research、outline、article、polish 全流程，支持中文主题输入、中文报告生成和安全输出目录管理。

定位并修复 Agent 运行链路中的 8 类工程问题，包括空检索 query、中文 surrogate 编码、Windows 非 UTF-8 输出、topic 与文件名职责混用、检索结果格式兼容、run_config 凭证泄露等，并补充 8 个 unittest 回归测试。

完成端到端中文调研报告生成实验，输出 3000+ 字中文报告、40+ 引用标记和可审计中间态，沉淀 Agent 系统调试日志与复现命令。
```

### 面试展开逻辑

面试官问“你做了什么”时，按这个顺序回答：

1. 我没有从零造 STORM，而是把一个已有 Agent research framework 改造成可在本地稳定运行的中文 Deep Research pipeline。
2. 我先接入 MiniMax M3，再解决检索为空、中文输入、输出编码、配置泄密、文件命名等真实工程问题。
3. 最后我把每个修复点变成 unittest，保证后续再改模型或检索后端时不会退化。

## 不能夸大的点

不要写：

- 自研 STORM。
- 大幅提升准确率。
- 生产级 Deep Research 平台。
- 降低成本 xx%。
- 支持多用户并发服务。
- 企业级 Agent 编排平台。

除非后续真的完成评测、服务化、权限、任务队列、成本统计和并发压测。

## 下一步改造方向

当前项目已经适合放进简历，但还不够像“Agent 开发岗强项目”。下一阶段要补的是：

1. 服务化：FastAPI + streaming + task id + progress query。
2. 可恢复：checkpoint / resume / failed-stage retry。
3. 可评测：固定 topic benchmark，统计引用有效性、中文比例、运行时间、失败率。
4. Tool registry：检索工具超时、重试、fallback、结果去重和来源质量过滤。
5. 前端 demo：展示任务状态、中间态、引用来源和最终报告。

## 2026-07-20 更新：PaperStorm MVP

当前学习阶段已经完成 STORM 主链路研读，不建议继续泛读源码。下一阶段目标改为产出一个可放进简历的垂直 Agent 项目：

```text
PaperStorm：基于 STORM 架构改造的中文论文调研 Agent
```

MVP 范围：

- 主检索后端使用 arXiv，不优先接 IEEE。arXiv 免费、无需 key、结构化，适合 2 到 3 天内形成闭环；IEEE Xplore API 需要申请 key 和权限审核，作为后续增强项。
- 补充本地 PDF 论文读取能力，支持用户已有论文库。
- 复用 STORM 的 `research -> outline -> article -> polish` 四阶段，输出带引用来源的中文论文综述报告。
- 保留当前已修复的工程稳定性能力：空 query 清洗、UTF-8 输出、Unicode 清理、目录名与模型 topic 分离、配置脱敏、断点续跑。

下一步执行顺序：

```text
1. 实现 ArxivRM
2. 实现 LocalPDFRM
3. 新增 run_paper_storm_minimax.py
4. 跑通一个中文论文综述样例
5. 补单元测试、README、样例报告和简历表述
```

更完整的学习进度和项目计划见：

```text
docs/paperstorm-mvp-learning-plan.md
```
