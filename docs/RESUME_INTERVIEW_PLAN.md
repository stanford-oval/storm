# PaperStorm Agent 简历与面试计划

更新时间：2026-07-27

本文档面向投递简历和面试准备。它把 PaperStorm Agent、Nonlinear NN Agent、面试经历汇总和目标岗位 JD 统一起来，后续每次项目更新都要维护。

## 1. 目标岗位

目标方向：

```text
Agent 开发工程师 / LLM 应用工程师 / Agent Harness / RAG 工程方向
```

目标 JD 关键词：

- 企业级 AI 平台架构设计与研发。
- AI 网关、MarketPlace、智能体构建平台、知识库平台。
- 通用 Agent 开发框架与组件库。
- 任务规划、工具调用、记忆管理、Multi-Agent 编排。
- 响应延迟、并发能力、错误容灾。
- Python / Java / Go / TypeScript。
- LLM 基础原理、AI Agent、RAG、知识库系统、Multi-Agent。
- 结构化技术文档、跨角色沟通、可量化指标、数据驱动决策。

## 2. 两个项目的互补定位

### PaperStorm Agent

定位：

```text
基于成熟 STORM/RAG 框架二次开发的论文调研 Agent，重点展示 RAG、Memory、MCP、Multi-Agent、Eval、知识库方向。
```

适合回答：

- RAG 全流程怎么做？
- query 怎么规划和清洗？
- 检索跑题怎么解决？
- MCP 工具怎么暴露？
- Agent 怎么评测？
- 论文/知识库 Agent 怎么设计？

### Nonlinear NN Agent

定位：

```text
从零实现轻量 Agent Harness Runtime，重点展示 ToolRegistry、Hook、Session、Trace、Async、Retry、实验自动化。
```

适合回答：

- Agent Harness 和直接调用 LLM API 有什么区别？
- 工具系统怎么设计？
- Hook 怎么做？
- session 和 trace 为什么分开？
- 失败重试和可观测怎么做？
- Agentic Loop 如何异步执行？

## 3. PaperStorm 简历项目描述

项目名称建议：

```text
PaperStorm Agent：中文论文调研与知识库 RAG Agent
```

简历短描述：

```text
基于 Stanford STORM 二次开发中文论文调研 Agent，接入 DeepSeek/MiniMax、arXiv 与本地 PDF 检索，围绕 RAG、Tool Calling、MCP、Runtime Trace 和 Eval Harness 构建可观测、可评估的论文调研流程。
```

推荐 bullet：

- 基于 Stanford STORM 二次开发 PaperStorm Agent，接入 DeepSeek/MiniMax、arXiv API 与本地 PDF 检索，将论文摘要、PDF 片段和网页资料统一为 `Information` schema，复用 research-outline-article-polish 多阶段流程生成中文综述报告。
- 改进 RAG 工具链稳定性：实现 LLM query sanitizer、PIM 缩写消歧、空检索防护、arXiv 单 query 失败降级和 Wikipedia 抓取防御，减少外部工具异常对主流程的影响。
- 新增 Runtime Trace，输出 `paperstorm_trace.jsonl` 与 `run_summary.json`，记录工具调用、耗时、结果数量、失败原因和产物路径，使 Agent 执行链路可复盘。
- 抽象 `PaperStormTool` schema，将 arXiv / Local PDF 检索封装为可发现、可调用工具，并实现 MCP-style stdio server 支持 `tools/list`、`tools/call` 和结构化错误返回。
- 实现规则版 Eval Harness，读取检索结果、文章、trace 和 summary 输出 `scorecard.json/md`，从任务完成度、检索相关性、跑题率、文章质量和 runtime 可观测性评估 Agent 效果。
- 设计 `PaperStormMemoryStore` 三层记忆、`compress_context` 上下文压缩和 `PaperStormKnowledgeBase` 问答模块，将调研产物转化为可问答知识库，并要求 QA 返回 citations、grounded 和 evidence。
- 新增 `PaperStormRuntimeSession`，统一 tool registry、tool call trace 和 working memory 写入，形成轻量 Agent Runtime 雏形。
- 将 runtime 升级为 ToolRegistry + HookManager + RuntimeEvent 结构，统一工具注册、参数校验、生命周期 hook 和 JSONL trace 字段，并让 MCP server 共用同一套工具注册模型。
- 设计多 Agent 调研编排层，将任务拆分为 Planner、Retriever、Critic、Memory、Evaluator 等角色，通过中心化 orchestrator 输出 `agent_trace.jsonl` 和 `multi_agent_report.json`，使规划、检索、过滤、记忆和评估过程可复盘。
- 抽象 `PaperStormTaskService` 服务核心层，支持 task_id、queued/running/succeeded/failed 状态、独立 output_dir、文章/trace/scorecard 读取、知识库 QA、fake runner 和错误脱敏，并提供可选 FastAPI 适配器。
- 增加服务层并发与稳定性 baseline，支持 `max_concurrent_tasks`、`worker_tick`、running 任务容量释放、stale running 恢复和 fake runner 压测报告。
- 实现静态 PaperStorm Dashboard，基于样例数据展示任务状态、文章、知识库 QA、runtime trace、scorecard、Multi-Agent 保留/过滤结果和 stress report，并补充官方 STORM 架构中文说明与架构图。
- 将真实 STORM pipeline 封装为可注入 worker，`PaperStormTaskService` 支持 `run_mode="paperstorm"`，统一 fake 和真实任务的 task_id、状态、产物目录、trace、scorecard 和错误处理。
- 为 Dashboard 增加 service-backed snapshot 接口，聚合 task、article、QA、scorecard、trace、pipeline worker 元数据和 service snapshot，支持前端通过 task_id 读取真实任务产物。
- 将 Dashboard 从结果查看器扩展为本地 Agent 控制台，支持创建任务、运行任务、刷新任务列表、轮询选中任务并展示结构化失败原因。
- 新增 v1.0 release demo，一条命令复现 service task、文章、QA、trace、scorecard 和 Dashboard 样例数据，形成可投递、可演示、可面试讲解的 Agent 平台原型。

压缩版 bullet：

- 基于 Stanford STORM 二次开发 PaperStorm Agent，接入 DeepSeek/MiniMax、arXiv 与本地 PDF 检索，复用多阶段 RAG 流程生成中文论文综述。
- 实现 query 清洗、PIM 歧义消解、空检索防护、外部 API 失败降级和 JSONL runtime trace，提升 Agent 工具链稳定性与可观测性。
- 抽象 Tool Schema 并实现 MCP-style server 与 Eval Harness，支持工具发现/调用、结构化错误和 scorecard 评估。
- 增加三层记忆、上下文压缩、知识库 QA 和轻量 Runtime Session，使调研结果可追踪、可问答、可评估。
- 设计 ToolRegistry、HookManager 与统一 RuntimeEvent，将 PaperStorm 工具链升级为可观测、可扩展的轻量 Agent Harness。
- 增加 Planner/Retriever/Critic/Memory/Evaluator 多 Agent 编排和 agent trace，支持对 PIM 跑题检索结果给出过滤理由。
- 抽象文件存储版 Agent Task Service，支持任务状态、产物隔离、知识库 QA、scorecard/trace 查询和可选 FastAPI 路由。
- 增加任务队列、并发上限、stale task 恢复和 stress benchmark，输出平均延迟、P95、失败率和最大观察并发。
- 实现静态 Dashboard 和官方 STORM 中文架构文档，将 Agent 执行链路、评估结果和稳定性报告可视化展示。
- 接入真实 PaperStorm pipeline worker，并通过 runner 注入让单元测试不依赖真实 LLM/API，保留 fake baseline 作为稳定回归测试。
- 将 Dashboard 接入 service dashboard bundle，支持输入 service URL 和 task_id 查看真实任务的 article、trace、scorecard 和 worker 元数据。
- 将 Dashboard 升级为轻量 Agent 控制台，支持提交/运行/轮询 task，并把失败 error 纳入可观测面板。
- 增加 release demo 生成器，把 RAG、Memory、Runtime Trace、Eval、Task Service 和 Dashboard 串成可复现的 5 分钟本地演示。

## 3.1 v1.0 项目讲法

### 30 秒项目介绍

```text
PaperStorm Agent 是我基于 Stanford STORM 二次开发的中文论文调研和知识库 Agent。我保留了原项目 research、outline、article、polish 的长文生成流程，并在此基础上补了 arXiv/本地 PDF 检索、PIM 领域消歧、Tool Schema、MCP-style server、三层记忆、上下文压缩、知识库 QA、Multi-Agent 编排、Eval Harness、Task Service 和 Dashboard。v1.0 已经能一条命令生成本地 release demo，展示一次 Agent 任务从提交、运行、问答、trace 到 scorecard 的完整链路。
```

### 2 分钟技术介绍

```text
这个项目的核心不是简单套一个 RAG，而是把论文调研 Agent 做成可观测、可评估、可服务化的系统。底层复用 STORM 的多阶段 workflow：先多视角调研，再生成大纲、文章和润色结果。我主要做了几层工程化增强：

第一是 RAG 稳定性，接入 arXiv 和 Local PDF，并做 query sanitizer、PIM 缩写消歧、空检索防护和单 query 失败降级，避免 PIM 被误召回成 processing-in-memory、RAM、DRAM。

第二是 Agent Runtime，把工具封装成统一 PaperStormTool schema，通过 ToolRegistry 管理工具发现和参数校验，用 HookManager 和 RuntimeEvent 记录工具调用、错误、耗时和上下文压缩，输出 JSONL trace。

第三是 Memory 和 QA，把调研产物转成可问答知识库，支持 working/episodic/semantic 三层记忆、结构化上下文压缩、grounded QA、citations 和 QA eval。

第四是 Multi-Agent 和评测，把调研拆成 Planner、Retriever、Critic、Memory、Evaluator，用 agent_trace 记录每个角色决策，并用 scorecard 评估任务完成度、检索相关性、跑题率、文章质量和可观测性。

最后我抽象了 PaperStormTaskService 和 FastAPI 适配器，并做 Dashboard 展示任务状态、文章、QA、trace、scorecard 和错误信息。v1.0 release demo 可以不依赖真实 API key 复现完整链路，真实 worker 则可以接 DeepSeek/arXiv 手工运行。
```

### 5 分钟演示路线

1. 打开 README，先指官方 STORM 架构图，说明原流程是 research -> outline -> article -> polish。
2. 运行 `run_paperstorm_release_demo.py`，说明这个命令复用 service 层，不是单独伪造前端数据。
3. 打开 `release_demo_summary.json`，展示 task_id、task_status、article_path、trace_path、scorecard_path 和 QA answer。
4. 打开 `frontend/paperstorm_dashboard/index.html`，展示 Dashboard 的 task、article、QA、trace、scorecard。
5. 讲 PIM case：expected keywords 是 `passive intermodulation / RF`，forbidden keywords 是 `processing-in-memory / DRAM / RAM`，对应检索跑题治理。
6. 讲系统设计：ToolRegistry 负责工具，Hook/Trace 负责可观测，Memory/QA 负责知识沉淀，Eval 负责量化，Task Service 负责生命周期，Dashboard 负责调试展示。
7. 主动讲边界：当前 v1.0 是本地可演示原型，不是生产级多租户平台；后续要补鉴权、权限、分布式队列、监控告警和真实 API 压测。

## 4. Nonlinear NN Agent 简历项目描述

项目名称建议：

```text
Agentic Experiment Harness for Nonlinear System Modeling
```

推荐 bullet：

- 从零实现面向算法实验的轻量 Agent Harness Runtime，将非线性神经网络 MPDPD 拟合实验拆解为配置生成、训练执行、NMSE 评估、PSD 验证和报告生成等工具链。
- 抽象 `ToolRegistry`、`HookManager`、`SessionStore`、`TraceLogger` 等 runtime 组件，支持异步工具调用、timeout/retry、before/after/error/metric hooks、session resume 与 JSONL trace。
- 将原始单脚本 CNN 仿真实验重构为可配置、可测试、可审计实验工程，支持 YAML 配置、固定随机种子、metrics JSON 解析、PSD 产物验证和 Markdown 摘要。
- 在 4000 参数约束下完成小模型搜索，引入复数记忆多项式特征 + 闭式最小二乘，获得 3626 参数、NMSE -37.42 dB 的轻量可解释模型，并生成实验对比报告。

## 5. 面试高频问题与项目回答

面试经历汇总显示，Agent 开发高频考点排序：

1. 上下文管理 / 记忆系统。
2. RAG 全流程。
3. Agent 架构设计。
4. 工具系统 / Tool Calling。
5. MCP。
6. Agent Harness / Runtime。
7. RAG 评测体系。
8. 幻觉处理。
9. Skill 封装。
10. ReAct。
11. LangChain / LangGraph。
12. Token 优化 / 成本。
13. AI Coding 方法论。
14. Multi-Agent 协作。
15. Agent 发展趋势。

### Q1：Agent Harness 和直接调用 LLM API 有什么区别？

答题素材：

```text
直接调 LLM API 只解决生成问题，Agent Harness 解决执行问题。它需要工具注册、参数校验、调用调度、timeout/retry、Hook、session、trace、错误恢复和评测。我的 Nonlinear 项目从零实现了 ToolRegistry、HookManager、SessionStore 和 TraceLogger；PaperStorm 则把这些思想落到 RAG 论文调研流程里，已经实现 PaperStormTool、ToolRegistry、HookManager、RuntimeEvent、MCP server、runtime trace、memory 和 eval harness。
```

### Q2：RAG 全流程怎么做？

答题结构：

```text
文档/论文来源 -> 清洗与解析 -> chunk / metadata -> query planning -> hybrid retrieval -> rerank/filter -> context assembly -> grounded generation -> citation/eval
```

结合 PaperStorm：

```text
当前 PaperStorm 已完成 arXiv / Local PDF 检索、Information schema、query 清洗、PIM 消歧、结果过滤、文章生成和 scorecard。v0.2 计划补 retrieval_audit、memory store、precision@k、off-topic rate 和 citation coverage。
```

### Q3：上下文和记忆怎么设计？

当前回答：

```text
我把记忆拆成 working、episodic、semantic 和 preferences。working 保存一次任务中的工具调用和当前上下文；episodic 保存一次运行经历，例如某个 topic 容易召回哪些跑题结果；semantic 保存可复用知识，例如 PIM 在射频场景中指 passive intermodulation；preferences 保存用户偏好，例如中文输出。trace 用来复盘执行链路，memory 用来影响后续检索和问答，两者职责分开。
```

项目状态：

```text
Nonlinear 已有 SessionStore 和 context_summary 字段；PaperStorm 已实现 `PaperStormMemoryStore`、`compress_context` 和 `PaperStormRuntimeSession`，并在 v0.3 补了 `HookManager`、`ToolRegistry` 和统一 `RuntimeEvent` trace schema。
```

### Q3.3：Workflow 和 Runtime 有什么区别？为什么这个项目需要 Runtime？

答题素材：

```text
Workflow 描述业务步骤，比如 research、outline、article、polish、qa；Runtime 描述这些步骤如何被稳定执行，比如工具怎么注册、参数怎么校验、失败怎么记录、hook 怎么插入、trace 怎么统一、memory 怎么写入。PaperStorm 原来更像 workflow，我在 v0.3 加了 ToolRegistry、HookManager、RuntimeEvent 和 RuntimeSession，让工具调用和上下文压缩都能被统一追踪。这样后续 Multi-Agent、服务化和前端 trace timeline 都有底座。
```

### Q3.4：Hook 机制有什么用？

答题素材：

```text
Hook 是 Agent Runtime 的生命周期扩展点。比如 before_tool_call 可以记录输入摘要或做参数校验，after_tool_call 可以记录耗时和输出摘要，on_tool_error 可以统一收敛错误，on_context_compress 可以记录压缩是否保留关键约束。它的价值是让核心业务代码不用到处写日志、指标和错误处理，后续也方便接可观测面板和告警。
```

### Q3.1：上下文压缩怎么做，如何避免压缩丢关键信息？

答题素材：

```text
我没有把压缩理解成简单截断，而是输出结构化摘要、保留事实、约束和 validation。比如 PaperStorm 的 compress_context 会检查 expected_keywords 是否仍然保留，同时检查 forbidden_keywords 是否混入摘要。这样可以解释压缩后的上下文是否还能约束下一步工具调用和生成。
```

### Q3.2：为什么要做知识库 QA，会不会降低项目格调？

答题素材：

```text
普通聊天式 QA 价值不高，但企业内部文档知识库 Agent 是真实需求。我的做法不是套一个聊天壳，而是把 PaperStorm 调研产物和本地 PDF 检索结果作为证据层，QA 必须返回 citations、grounded 和 evidence，并纳入 Eval Harness 检查。这能对应企业知识库平台、RAG grounded answer 和可追踪问答链路。
```

### Q4：工具调用失败怎么办？

答题素材：

```text
工具失败分级处理：参数错误直接返回结构化错误；外部 API 超时/429 视为部分失败，可跳过或重试；关键工具失败写入 trace 和 summary；上层 Agent 根据失败类型决定重试、换 query、换工具或向用户解释。PaperStorm 已经把 arXiv 单 query 失败降为 INFO 并继续主流程，MCP server 也会对未知工具和内部异常返回 JSON-RPC 风格错误。
```

### Q5：MCP 是什么？你写过什么？

答题素材：

```text
MCP 可以理解成工具发现和工具调用的标准协议边界。我的 PaperStorm 先抽象 PaperStormTool schema，包含 name、description、input_schema、output_schema 和 run(arguments)，再实现 MCP-style stdio server，支持 tools/list 返回工具 schema，tools/call 调用 arXiv 和本地 PDF 检索，并返回结构化错误。
```

### Q6：怎么评估 Agent 变好了？

答题素材：

```text
不能只靠主观感觉。我给 PaperStorm 做了 Eval Harness，读取 raw_search_results、outline、polished article、paperstorm_trace 和 run_summary，输出 scorecard.json/md。指标包括任务完成度、检索相关性、跑题率、文章质量和 runtime 可观测性。比如 PIM case 用 passive intermodulation/RF/neural network 作为正向关键词，用 processing-in-memory/RAM/DRAM 作为负向关键词，量化检索是否跑题。
```

### Q7：如何控制幻觉？

答题结构：

```text
源头控制：query planning 和领域消歧。
检索控制：expected/forbidden keywords、rerank/filter。
生成控制：要求引用 evidence，不足时说缺信息。
运行控制：trace 审计每次工具调用。
评估控制：scorecard 记录 citation coverage、off-topic rate、groundedness。
```

### Q8：单 Agent 和 Multi-Agent 怎么取舍？

当前观点：

```text
简单线性任务优先单 Agent，减少通信和状态复杂度；当任务天然包含规划、检索、批判、记忆、写作、评估等不同职责时适合 Multi-Agent。PaperStorm 里我没有为了形式硬拆，而是把论文调研中真实存在的职责拆成 PlannerAgent、RetrieverAgent、CriticAgent、MemoryAgent 和 EvaluatorAgent，并用中心化 orchestrator 记录 agent_trace。比如 PIM case 中 CriticAgent 会把 processing-in-memory / DRAM / RAM 这类跑题结果过滤掉，并记录 reason。
```

### Q8.1：你的 Multi-Agent 是不是几个 prompt 拼起来？

答题素材：

```text
不是。我先做的是可测试的工程编排层，而不是依赖 LLM 随机输出。每个 Agent 都有明确输入输出：Planner 输出 query plan，Retriever 通过 runtime 调工具，Critic 输出 kept/rejected 和 reason，Memory 写 episodic memory，Evaluator 输出 scorecard。所有 Agent 的 start/end 都写入 agent_trace.jsonl。这让 Multi-Agent 的价值可以被测试和复盘，后续再把 Planner/Critic 替换成 LLM 版本，也有规则版 baseline。
```

### Q9：Skill 和 MCP 有什么区别？

答题素材：

```text
Skill 更像 Agent 内部能力封装和触发策略，强调什么时候用、怎么用、上下文如何组织；MCP 更像外部工具协议，强调工具如何被发现、schema 如何描述、调用如何传参、结果和错误如何返回。两者可以配合：Skill 决定何时调用某类能力，MCP 提供标准化工具入口。
```

### Q10：如何面对生产级性能与稳定性？

结合未来规划：

```text
当前项目处于本地原型阶段，已经做了错误降级、trace、eval、测试和 PaperStormTaskService 服务核心层。v0.5 已经支持 task_id、状态查询、文章/trace/scorecard 读取、知识库 QA、fake runner、独立 output_dir 和错误脱敏，并提供可选 FastAPI 适配器。真正生产级还需要鉴权、限流、队列、并发压测、监控告警、数据权限和真实 worker 编排。
```

## 6. 针对目标 JD 的项目强化方向

### AI 网关 / MarketPlace / Agent 构建平台

PaperStorm 可以演进成一个垂直 Agent 构建平台 demo：

- 工具市场：arXiv、LocalPDF、WebSearch、Eval、Memory。
- Agent 模板：论文综述 Agent、领域调研 Agent、实验规划 Agent。
- 组件库：Retriever、Memory、Reranker、Evaluator、Writer。

### 知识库平台

企业内部文档知识库 Agent 是非常真实的落地场景。很多企业会把制度文档、研发文档、接口文档、故障手册、产品手册、客户支持文档放进知识库，让 Agent 做检索问答、引用溯源、流程辅助和问题定位。

所以 PaperStorm 做“普通知识库 QA”不会降低项目格调。会降低格调的是只做一个没有评测、没有引用、没有审计的“上传 PDF 聊天”demo。

正确定位应该是：

```text
企业内部文档 / 论文资料知识库 Agent：支持文档导入、chunk metadata、检索审计、引用溯源、memory、scorecard 和前端 trace 展示。
```

v0.4 后重点展示：

- 文档导入。
- chunk/metadata。
- 普通知识库 QA。
- query planning。
- 检索审计。
- memory recall。
- scorecard 评估。
- 引用来源和召回片段展示。

面试可说：

```text
PaperStorm 最早是论文调研 Agent，但底层能力可以迁移到企业内部文档知识库。论文、研发文档、接口文档本质上都需要解析、切块、metadata、检索、rerank、引用溯源和评测。我的规划不是做泛聊天，而是把知识库 QA 做成可审计 RAG：每次回答都能看到召回片段、来源、过滤原因和 scorecard。
```

### 生产级 Agent 系统

当前可讲：

- Tool schema。
- MCP server。
- trace。
- structured error。
- eval。

后续补：

- task queue。
- retry policy。
- timeout policy。
- concurrent runs。
- task status。
- rate limit。
- stress test report。
- frontend timeline。

高并发回答边界：

```text
当前 PaperStorm 还不是线上高并发系统，但已经完成了单进程服务层稳定性 baseline：task_id、状态隔离、独立 output_dir、trace/scorecard 隔离、max_concurrent_tasks、worker_tick、stale running 恢复和 fake runner 压测报告。下一步如果接真实 worker，会给 LLM、检索、embedding 工具加 timeout/retry/rate limit，并用 10/50/100 任务压测统计平均延迟、P95、失败率和 retry 次数。真正生产级还需要鉴权、权限、监控告警、分布式队列和成本治理。
```

### Q13.1：为什么先做 fake runner，不直接接真实 LLM 服务？

推荐回答：

```text
因为服务层首先要验证任务状态、路径隔离、trace、scorecard、错误脱敏和 QA API 这些工程语义，不能让测试依赖真实 API、网络和模型波动。fake runner 是稳定 baseline，可以支撑单元测试、前端预览和后续压测。真实 LLM pipeline 后续作为 worker runner 接入，同一套 task_id 和状态模型不用变。
```

### Q13.2：为什么要做前端 Dashboard？

推荐回答：

```text
Agent 系统的问题定位不能只看最终回答。Dashboard 的价值是把 task 状态、runtime trace、scorecard、QA 引用、Multi-Agent 决策和 stress report 展示出来，让执行链路可解释、可复盘、可沟通。对企业 Agent 平台来说，这对应可观测性和跨角色协作：算法、后端、产品都能看到 Agent 为什么这么答、工具是否失败、检索是否跑题、评估指标是否达标。
```

### Q13.3：真实 LLM pipeline 怎么接入服务层？为什么要 runner 注入？

推荐回答：

```text
我没有让 service 直接散落调用命令行脚本，而是把真实 STORM pipeline 封装成 `run_paperstorm_pipeline_task(state)`，由 `PaperStormTaskService` 在 `run_mode="paperstorm"` 时调用。service 只关心 task_id、状态、output_dir、trace、scorecard 和错误处理，真实 worker 负责把 task state 映射成 STORM runner 配置。这样 fake runner 和真实 worker 共用同一套服务语义，测试可以注入本地 runner，不依赖真实 LLM、arXiv、网络和余额；生产上也可以把这个 runner 换成队列 worker 或异步 worker。
```

### Q13.4：这次为什么修了 keywords 脱敏？

推荐回答：

```text
我在新增 service CLI smoke test 时发现 `expected_keywords` 和 `forbidden_keywords` 被错误脱敏成 `***REDACTED***`。根因是旧脱敏规则只要字段名包含 `key` 就脱敏，误伤了 `keywords`，导致 eval 约束丢失。修复后只对 `api_key`、`secret_key`、`token`、`password` 等真正敏感字段脱敏，同时新增回归测试保证领域关键词不会再丢。
```

### Q13.5：Dashboard 为什么要后端聚合 snapshot，而不是前端分别调很多接口？

推荐回答：

```text
我给 service 增加了 `get_dashboard_bundle(task_id)` 和 `/research-tasks/{task_id}/dashboard`，把 task、article、QA、scorecard、trace、pipeline worker 元数据聚合成一个前端 snapshot。这样前端只负责展示，后端负责产物结构和路径处理，减少前端对内部文件结构的依赖。对 Agent 平台来说，这是一种常见的可观测性接口设计：调试页面需要的是一次运行的完整视图，而不是让页面自己拼很多低层接口。
```

### Q13.6：为什么 v0.9 还要做提交、运行和轮询？

推荐回答：

```text
因为只展示结果还不算 Agent 平台，最多是报告查看器。v0.9 把 Dashboard 扩成一个本地 Agent 控制台：前端可以创建 task、运行 task、刷新任务列表、轮询 selected task，并展示结构化 error。这样面试时可以讲清楚 Agent runtime 的完整生命周期：submit -> queued -> running -> succeeded/failed -> artifacts -> trace/scorecard，而不是只讲一个离线脚本。
```

### Q13.7：v1.1 面试讲法：为什么还要做 Demo Runbook？

推荐回答：

```text
演示不是只给静态截图。Agent 平台面试里，面试官更关心系统是不是能复现、能定位问题、能解释状态变化。v1.1 我补了 start_paperstorm_service.py 和 README runbook，让项目可以按固定步骤启动 service、打开 Dashboard、提交任务、运行任务、轮询任务，再查看 article、QA、trace 和 scorecard。这个链路能讲清楚 submit -> queued -> running -> succeeded/failed -> artifacts -> trace/scorecard，也能说明 fake 模式用于稳定演示，paperstorm 模式用于真实 LLM 任务。
```

### Q11：做普通知识库 QA 会不会降低项目水平？

推荐回答：

```text
不会，企业内部文档知识库 Agent 是真实需求。关键在于不要只做“上传 PDF 问答”的 demo，而要做企业知识库需要的工程能力：文档导入、chunk metadata、混合检索、rerank、引用溯源、权限/版本意识、检索审计、评测指标和前端可观测。PaperStorm 的优势是已经有论文 RAG、LocalPDF、trace、MCP 和 eval，普通知识库 QA 可以作为平台能力补齐，亮点仍然放在 Memory、Multi-Agent、MCP 和 Eval 上。
```

### Q12：内部文档知识库 Agent 和 PaperStorm 有什么关系？

推荐回答：

```text
两者底层链路相同：文档解析、chunk、metadata、query planning、retrieval、context assembly、grounded generation、citation 和 eval。区别是 PaperStorm 的领域对象是论文和调研报告，企业知识库的对象是内部文档、接口文档、故障手册和产品文档。PaperStorm 后续可以把论文知识库抽象成通用 KB 层，再保留论文调研作为一个 Agent template。
```

### Q13：高并发怎么做？难点是什么？

推荐回答：

```text
我会分阶段做，不会一上来声称高并发。当前已经完成第一阶段和第二阶段的单进程 baseline：task_id、状态隔离、output_dir/trace/scorecard 隔离、worker_tick 队列、max_concurrent_tasks、stale running 恢复和 fake runner 压测。下一步真实 worker 接入后，再给 LLM、检索、embedding 工具加 timeout/retry/rate limit。难点是外部 API 限流、embedding 模型复用、文件写入隔离、阻塞调用与 async 混用、失败任务状态恢复。
```

## 7. 简历投递策略

### Agent Harness / Runtime 岗

项目顺序：

1. Nonlinear NN Agentic Experiment Harness。
2. PaperStorm Agent。
3. 华为通信算法实习。

### RAG / 知识库岗

项目顺序：

1. PaperStorm Agent。
2. Nonlinear NN Agentic Experiment Harness。
3. 华为通信算法实习。

### AI 平台 / Agent 平台岗

重点写：

- Tool Schema / MCP。
- Memory 计划。
- Eval Harness。
- API / 前端版本计划。
- 文档和指标驱动。

## 8. 后续每次更新必须补充

每完成一个版本，在本文件追加：

```markdown
## YYYY-MM-DD 面试与简历更新

### 新增项目能力

### 简历 bullet 更新

### 面试可能追问

### 推荐回答

### 不能夸大的边界
```
