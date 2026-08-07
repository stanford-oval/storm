# PaperStorm Agent 更新计划

更新时间：2026-07-27

本文档是后续版本计划。每次项目更新都必须维护本文件，记录版本目标、完成情况、验收标准和下一步。

## 1. 项目长期目标

项目新定位：

```text
PaperStorm Agent：面向论文调研与知识库问答的 RAG + Memory + Multi-Agent 实验平台
```

与 `nonlinear-nn-agent` 的互补关系：

- `nonlinear-nn-agent`：从零实现轻量 Agent Harness，重点是 Runtime、ToolRegistry、Hook、Session、Trace、Async、Retry、实验自动化。
- `PaperStorm Agent`：基于成熟 STORM/RAG 框架二次开发，重点是论文 RAG、知识库、Memory、MCP、多 Agent 调研协作、评测和前端展示。

目标岗位能力映射：

- 企业级 AI 平台架构：AI 网关、Agent 构建平台、知识库平台、组件库。
- 生产级 Agent 系统：任务规划、工具调用、记忆管理、Multi-Agent 编排。
- 稳定性保障：响应延迟、并发、错误容灾、可观测性、评测指标。
- 文档能力：结构化技术文档、版本计划、简历/面试材料、指标驱动决策。

## 2. 已完成版本

### v0.1：PaperStorm MVP 与运行稳定性

状态：已完成。

核心能力：

- 基于 STORM 四阶段 pipeline：research -> outline -> article -> polish。
- 接入 DeepSeek / MiniMax。
- 接入 arXiv 和 Local PDF 检索。
- 支持中文输出。
- 修复 Windows UTF-8、surrogate、输出目录名、run_config 脱敏等问题。
- 修复 LLM 空 query、Markdown/JSON query 噪声。
- 修复空检索结果导致文章生成崩溃。
- 修复 Wikipedia 辅助抓取失败时日志过噪。
- PIM 缩写消歧：`passive intermodulation` vs `processing-in-memory`。

关键产物：

```text
examples/storm_examples/run_paper_storm_minimax.py
knowledge_storm/rm.py
tests/test_paperstorm_retrievers.py
tests/test_paperstorm_logging.py
tests/test_minimax_runtime_fixes.py
```

### v0.1.1：Runtime Trace / Tool Schema / MCP / Eval

状态：已完成。

核心能力：

- `paperstorm_trace.jsonl`：记录工具调用、耗时、失败和产物。
- `run_summary.json`：记录一次运行摘要。
- `PaperStormTool` / `RetrievalTool` / `ArxivSearchTool` / `LocalPDFSearchTool`。
- MCP-style stdio server：`tools/list`、`tools/call`、结构化错误返回。
- Eval Harness v1：输出 `scorecard.json`、`scorecard.md`。

关键产物：

```text
knowledge_storm/paperstorm_tools.py
knowledge_storm/paperstorm_eval.py
examples/storm_examples/paperstorm_mcp_server.py
examples/storm_examples/evaluate_paperstorm_run.py
examples/storm_examples/paperstorm_eval_cases.json
tests/test_paperstorm_mcp_server.py
tests/test_paperstorm_eval.py
```

### v0.1.2：文档归并与中文 README

状态：已完成。

核心能力：

- 保留官方 STORM README 为 `README_STORM_OFFICIAL.md`。
- 将项目 README 改为中文 `PaperStorm Agent` 首页。
- 将 `docs` 根目录收敛为三份主文档：
  - `OPERATION_GUIDE.md`
  - `VERSION_PLAN.md`
  - `RESUME_INTERVIEW_PLAN.md`
- 旧文档归档到 `docs/archive/2026-07-27-legacy-docs/`。
- 根据 Agent 岗 JD 和面试经历，明确后续版本主线：RAG、Memory、Multi-Agent、MCP、Eval、前端展示。

分支：

```text
version/v0.1.2-docs-roadmap
```

### v0.1.3：GitHub 改名与分支治理

状态：已完成。

已完成：

- GitHub 仓库从 `yzy-151/storm` 改名为 `yzy-151/paperstorm-agent`。
- 本地 `fork` remote 更新为 `https://github.com/yzy-151/paperstorm-agent.git`。
- `version/v0.1.2-docs-roadmap` 已合并进 `fork/main`。
- 已删除旧阶段远程分支：
  - `codex/minimax-agent-storm`
  - `feature/paperstorm-query-quality`
  - `feature/paperstorm-retrieval-quality`
  - `feature/paperstorm-runtime-tracing`
  - `feature/paperstorm-tool-schema`
  - `feature/paperstorm-mcp-server`

保留：

```text
main
version/v0.1.2-docs-roadmap
version/v0.1.3-github-rename
feature/paperstorm-eval-harness
```

已删除 Stanford 官方继承分支：

```text
NAACL-2024-code-backup
costorm-integration
dependabot/pip/litellm-1.61.15
dev-chinese
dev-code-formatter
dev-gemini
dev-multilingual
dev-python-pkg
yijia-patch-azuremodel
```

### v0.1.4：远程分支清理记录

状态：已完成。

本次完成：

- 根据 Master 明确确认，删除 fork 中 9 个继承自 Stanford 官方仓库、与 PaperStorm Agent 无关的远程分支。
- 核对 GitHub 远程分支，当前仅保留：

```text
main
version/v0.1.2-docs-roadmap
version/v0.1.3-github-rename
feature/paperstorm-eval-harness
```

维护规则：

- 后续每次推送新功能都使用 `version/vX.Y-主题` 分支。
- 合并到 main 后，保留最近 1 到 2 个关键版本分支即可，历史过渡分支可在确认后删除。

### v0.1.5：知识库 QA 与并发能力规划

状态：已完成。

本次是计划更新，不是功能实现。

核心决策：

- 普通知识库 QA 要做，但不能做成“上传 PDF 后简单聊天”的低价值 demo。
- PaperStorm 的知识库方向要定位为企业内部文档 / 论文资料知识库 Agent，强调文档治理、检索审计、引用溯源、memory、评测和服务稳定性。
- 高并发能力放入后续实验计划，但分阶段推进，先做 task_id 和状态隔离，再做 worker、队列、限流和压测。

为什么要做普通知识库 QA：

- 企业内部文档知识库 Agent 是真实高频场景：制度文档、研发文档、接口文档、故障手册、产品手册、知识库平台。
- 面试中 RAG 全流程、知识库存储、chunk、metadata、BM25/向量混合检索、rerank、权限、评测、幻觉治理都是高频问题。
- PaperStorm 本身已有 arXiv / LocalPDF / Information schema / Eval Harness，适合自然演进到知识库平台。

边界：

- 不把普通 QA 当成最终亮点，而是作为企业知识库 Agent 的基础能力。
- 真正的项目亮点仍然是：RAG 审计、Memory、多 Agent、MCP、Eval、服务化和前端可视化。

## 3. v0.2：Memory / Context Compression / QA 闭环

状态：已完成第一阶段。

目标：把 PaperStorm 从“只生成调研文章”推进到“可基于调研产物做知识库问答，并能解释上下文、记忆、工具调用和 QA 评估”的 Agent 原型。

### 已完成能力

1. Memory Store v1
   - 新增 `knowledge_storm/paperstorm_memory.py`。
   - 提供 working / episodic / semantic 三层记忆。
   - 提供 preferences，用于保存输出语言、领域偏好等用户偏好。
   - 支持 JSON 持久化和按 query 检索相关记忆。

2. Context Compression v1
   - 新增 `compress_context`。
   - 输入多轮 message，输出结构化摘要、保留事实、约束和校验结果。
   - 支持 `expected_keywords` / `forbidden_keywords`，用于检查压缩后是否保留关键约束、是否混入跑题信息。
   - 面试表达重点：上下文压缩不是简单截断，而是带约束校验的结构化压缩。

3. Knowledge Base QA v0
   - 新增 `knowledge_storm/paperstorm_qa.py`。
   - 从一次 PaperStorm run directory 加载 `storm_gen_article*.txt` 和 `raw_search_results.json`。
   - 支持基于文章段落和检索结果的问答。
   - 输出 answer、citations、grounded、memory_context、evidence。
   - 回答会尽量引用已有证据，避免纯无来源生成。

4. Tool 封装
   - 新增 `KnowledgeBaseQATool`。
   - 工具名：`kb_qa`。
   - 输入：`run_dir`、`question`、`top_k`。
   - 输出：`answer`、`citations`、`grounded`、`memory_context`。
   - 已接入 `list_paperstorm_tools`，因此 MCP-style server 可以发现该工具。

5. 轻量 Runtime Session
   - 新增 `knowledge_storm/paperstorm_runtime.py`。
   - 提供 `PaperStormRuntimeSession`。
   - 负责 tool registry、tool call、trace event 写入、working memory 写入。
   - 当前保持轻量，不重构 STORM 主流程，作为 v0.3 Hook/Runtime 的基础。

6. Eval Harness v2 局部推进
   - 新增 `evaluate_qa_artifact`。
   - 对 `qa_answer.json` 检查 QA 是否存在、是否有引用、是否 grounded、关键词覆盖和跑题关键词。
   - 输出 qa_quality、forbidden_penalty、citation_count、chinese_char_ratio 等指标。

7. 测试
   - 新增 `tests/test_paperstorm_memory_qa.py`。
   - 覆盖三层记忆、上下文压缩、QA、QA tool、QA eval、runtime session trace。
   - 当前总测试数从 38 增加到 44。

### 本版没有强行做的内容

- 没有把 STORM 原主流程整体改成新 runtime 驱动，避免一次性重构风险过大。
- 没有实现完整 Query Planner，后续放到 v0.3/v0.4。
- 没有实现完整 retrieval_audit.json，后续和 Critic/Planner 一起做。
- 没有上数据库，memory 先保持 JSON 本地持久化，便于测试和面试讲清楚边界。

### 本版验收标准

- `PaperStormMemoryStore` 能保存 working / episodic / semantic / preferences。
- `compress_context` 能输出压缩摘要和关键词校验。
- `PaperStormKnowledgeBase` 能从 run artifacts 回答问题并返回引用。
- `kb_qa` 工具能通过统一 tool schema 暴露。
- `PaperStormRuntimeSession` 能调用工具并写入 trace。
- `evaluate_qa_artifact` 能给 QA 结果打分。
- 新增测试和既有测试全部通过。

### 简历价值

可写：

```text
为 PaperStorm Agent 增加三层记忆、上下文压缩、知识库问答和轻量 Runtime Session，将论文调研产物转化为可问答知识库；通过 Tool Schema 暴露 kb_qa 工具，并扩展 Eval Harness 检查回答引用、groundedness、关键词覆盖和跑题风险。
```

面试可讲：

```text
我没有把知识库问答做成一个假的聊天壳，而是复用了 PaperStorm 调研阶段沉淀的文章和检索结果，把它们转成可检索证据，再要求 QA 返回 citations 和 grounded 字段。同时把 tool call 通过轻量 runtime 记录到 JSONL trace，并写入 working memory，这样能解释一次回答是如何由工具、证据和记忆共同产生的。
```

## 4. v0.3：Runtime / Hook / Trace 标准化

状态：已完成。

目标：把 v0.2 的轻量 `PaperStormRuntimeSession` 扩展为更像 Agent Harness 的 runtime 层，为后续 Multi-Agent 和服务化做底座。

### 已完成能力

1. ToolRegistry
   - 新增 `ToolRegistry`。
   - 支持工具注册、查询、schema 列表和 required argument 校验。
   - `paperstorm_mcp_server.py` 已接入 `ToolRegistry`，MCP 工具发现和 runtime 工具调用共用同一注册模型。
   - 面试重点：工具不是散落函数，而是有统一生命周期和 schema 的组件。

2. HookManager
   - 新增 `HookManager`。
   - 支持 `before_tool_call`、`after_tool_call`、`on_tool_error`、`on_context_compress`。
   - 后续可继续扩展 `on_memory_write`、`on_eval_finish`、metrics、告警和调试面板。

3. Unified Trace
   - 新增 `RuntimeEvent`。
   - 统一事件字段：`run_id`、`task_id`、`stage`、`tool`、`status`、`duration_sec`、`input_summary`、`output_summary`、`error`。
   - trace 当前覆盖 tool call、tool error 和 context compression。
   - 输出仍采用 JSONL，便于流式查看和后续前端时间线展示。

4. RuntimeSession v2
   - 管理 run_id、task_id、tool registry、memory store、trace recorder。
   - 提供 `call_tool` 和 `compress_context` 统一入口。
   - 不要求一次性替换 STORM 内部 engine，先包住新增能力和外部工具。

5. 测试
   - 新增 `tests/test_paperstorm_runtime.py`。
   - 覆盖 ToolRegistry、HookManager、统一 trace、工具错误和压缩 hook。
   - MCP server 增加 ToolRegistry 兼容测试。

### 验收标准

- 所有 PaperStormTool 都能通过 ToolRegistry 注册和调用。
- Hook 能记录成功、失败、耗时和错误摘要。
- trace 字段统一，能按 run_id/task_id/stage/tool 追踪一次执行。
- QA 和 context compression 都能通过 runtime 入口完成单元测试 case。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
将 PaperStorm 的 RAG/QA 工具链抽象为轻量 Agent Runtime，设计 ToolRegistry、HookManager、RuntimeSession 和统一 JSONL trace，实现工具调用、记忆写入、上下文压缩和评估链路的可观测与可扩展。
```

### 本版没有强行做的内容

- 没有把完整 STORM engine 改造成 runtime 驱动，避免大范围侵入。
- 没有做 async、timeout、retry policy，后续和服务化/并发一起做更合适。
- 没有做完整 Multi-Agent，下一版在 runtime 底座上补 Planner/Retriever/Critic/Evaluator。

## 5. v0.4：Multi-Agent 论文调研协作

状态：已完成第一阶段。

目标：把 STORM 原有多视角对话思想显式工程化，形成可解释的 Multi-Agent 调研编排。

### 已完成能力

1. Agent 角色
   - `PlannerAgent`：拆解调研任务，生成带 intent 的 query plan。
   - `RetrieverAgent`：通过 v0.3 `PaperStormRuntimeSession` 调用检索工具。
   - `CriticAgent`：识别跑题、重复和领域关键词不足，输出保留/过滤理由。
   - `MemoryAgent`：把保留结果和过滤原因写入 episodic memory。
   - `EvaluatorAgent`：对 query plan、critic signal 和 agent trace 打分。

2. Orchestrator
   - 新增 `PaperStormResearchOrchestrator`。
   - 使用中心化编排方式串联 Planner -> Retriever -> Critic -> Memory -> Evaluator。
   - 输出 `multi_agent_report.json`。
   - 输出 `agent_trace.jsonl`，记录每个 Agent 的 start/end 和 payload summary。

3. PIM 跑题识别
   - 测试 case 中 `CriticAgent` 能保留 passive intermodulation / RF 结果。
   - 能拒绝 processing-in-memory / DRAM / RAM 结果。
   - 过滤理由写入 `reason`，便于面试讲“检索审计”和“幻觉/跑题防护”。

4. Eval
   - 新增 `evaluate_multi_agent_report`。
   - 指标包括 multi_agent_trace、query_planning、critic_signal、result_quality。
   - `paperstorm_eval.py` 提供桥接入口，方便后续 benchmark 统一调用。

5. 测试
   - 新增 `tests/test_paperstorm_multi_agent.py`。
   - 覆盖 Planner、Critic、Orchestrator、agent trace、memory 写入和 multi-agent eval。

### 验收标准

- 每个 Agent 的决策可在 trace 中复盘。
- Planner 能生成 query plan。
- Critic 能给检索结果打保留/过滤理由。
- MemoryAgent 能读写 semantic/episodic memory。
- EvaluatorAgent 能输出 scorecard 和改进建议。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
设计多角色论文调研 Agent 编排，将规划、检索、记忆、批判、写作和评估拆分为独立 Agent，并通过中心化 orchestrator 和统一 trace 记录 agent/tool 决策链路，实现多 Agent 协作过程可观测。
```

### 本版没有强行做的内容

- 没有把 WriterAgent 接入真实文章生成，避免触碰 STORM engine 的大范围重构。
- 没有让多个 Agent 并发执行，因为当前目标是可审计链路，不是吞吐压测。
- 没有真实调用 LLM 生成 agent 决策，当前先用规则版 agent 保证可测试、可复现。
- 后续如果要增强，可以让 Planner/Critic 接 LLM，但保留当前规则版作为 fallback 和 benchmark baseline。

## 6. v0.5：知识库平台化、服务 API 与并发基础

状态：已完成第一阶段。

目标：靠近企业级知识库平台和 Agent 构建平台。

### 已完成能力

1. 服务核心层
   - 新增 `knowledge_storm/paperstorm_service.py`。
   - `PaperStormTaskService` 负责任务提交、状态查询、任务运行、文章读取、scorecard、trace 和知识库 QA。
   - 使用本地 JSON 文件保存任务状态，先不上数据库，降低复杂度。

2. 任务状态与路径隔离
   - 每个任务生成独立 `task_id`。
   - 每个任务有独立 output_dir。
   - 支持 `queued / running / succeeded / failed` 状态。
   - 多任务 fake run 的 `run_summary.json`、trace、scorecard 互不覆盖。

3. Fake Runner
   - 支持 `run_mode="fake"`。
   - 不依赖真实 LLM API key 也能跑完整服务链路。
   - 产出 `storm_gen_outline.txt`、`storm_gen_article_polished.txt`、`raw_search_results.json`、`run_summary.json`、`paperstorm_trace.jsonl`、`scorecard.json/md`。
   - 用于 API 测试、前端预览和后续压测 baseline。

4. 知识库 QA
   - 服务层支持 `query_knowledge_base(task_id, question)`。
   - 复用 v0.2 `PaperStormKnowledgeBase`。
   - 输出回答、引用、grounded 和 evidence。
   - 写入 `qa_answer.json`。

5. 错误与脱敏
   - 失败任务会写入结构化 `error`。
   - 对 secret / key / token 字段脱敏。
   - 对 `sk-...` 形式错误信息做脱敏。

6. 可选 FastAPI 适配器
   - 新增 `examples/storm_examples/paperstorm_service_api.py`。
   - 提供 `create_app(service_root=...)`。
   - 当前不强制新增 FastAPI 依赖，避免破坏原环境。
   - 如果安装 `fastapi` 和 `uvicorn`，可暴露：
     - `POST /research-tasks`
     - `POST /research-tasks/{task_id}/run`
     - `GET /research-tasks/{task_id}`
     - `GET /research-tasks/{task_id}/article`
     - `GET /research-tasks/{task_id}/scorecard`
     - `GET /research-tasks/{task_id}/trace`
     - `POST /knowledge-bases/{task_id}/query`

### 验收标准

- 不真实调用 LLM 的 API 层测试可通过。
- 支持 task_id、queued/running/succeeded/failed 状态。
- 支持读取 scorecard。
- 支持对样例知识库执行一次带引用 QA。
- 同时提交多个 fake task 时状态文件互不覆盖。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
将 PaperStorm 命令行 pipeline 抽象为文件存储版 Agent Task Service，支持 task_id、任务状态、产物隔离、文章/trace/scorecard 读取、知识库问答和错误脱敏，并提供可选 FastAPI 适配器，为企业知识库平台化和前端展示奠定基础。
```

### 本版没有强行做的内容

- 没有直接把真实 LLM pipeline 放入后台 worker，避免测试依赖外部 API。
- 没有引入数据库，状态先用本地 JSON 文件存储。
- 没有实现文档上传接口，后续和知识库导入一起做。
- 没有实现并发队列、timeout/retry/rate limit，这些放到 v0.5.1。

## 6.1 v0.5.1：并发、限流与稳定性实验

状态：已完成第一阶段。

目标：补齐企业级 Agent 系统中“多任务并发”和“稳定性保障”的面试素材。

### 已完成能力

1. 并发上限
   - `PaperStormTaskService(root_dir, max_concurrent_tasks=...)` 支持可配置并发数。
   - `worker_tick()` 按剩余容量从 queued 任务中启动任务。
   - worker 不会让 running 数量超过 `max_concurrent_tasks`。

2. 任务队列与容量释放
   - 超过并发上限的任务保持 queued。
   - `complete_task(task_id, success=True/False)` 可完成 running 任务。
   - running 任务完成后，下一次 `worker_tick()` 会启动后续 queued 任务。

3. Stale Running 恢复
   - `recover_stale_running_tasks(max_age_seconds)` 可把超时 running 任务标记为 failed。
   - 避免任务因为进程崩溃或 worker 中断永久卡在 running。

4. Stress Benchmark
   - `run_stress_benchmark(total_tasks, fail_every)` 使用 fake runner 创建并运行多任务。
   - 输出 `stress_report.json`。
   - 指标包括 total_tasks、succeeded、failed、failure_rate、avg_latency_sec、p95_latency_sec、max_observed_running、retry_count。

5. CLI 入口
   - 新增 `examples/storm_examples/benchmark_paperstorm_service.py`。
   - 可直接运行 fake stress benchmark，生成可展示的稳定性报告。

### 难点

- LLM API 和 arXiv 容易触发限流，不能无限并发。
- 多任务同时写 `results/`，必须做好任务路径隔离。
- trace、summary、scorecard 必须按 task_id 隔离。
- Python 线程、asyncio、阻塞式 LLM/检索调用混用时容易造成假并发。
- embedding 模型加载重，需要缓存和复用。
- 失败任务必须有结构化错误状态，不能卡在 running。

### 验收标准

- fake runner 并发测试可稳定通过。
- 多任务输出目录互不覆盖。
- 每个任务都有独立 trace 和 summary。
- 压测报告输出平均耗时、P95 latency、失败率和 retry 次数。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
为 PaperStorm Agent API 增加任务队列、并发数限制、timeout/retry、任务级 trace 与压测报告，使用 fake runner 验证多任务状态隔离、文件隔离和错误恢复，为生产级 Agent 稳定性保障提供实验依据。
```

### 本版没有强行做的内容

- 没有对真实 LLM / arXiv / embedding 调用做 timeout/retry/rate limit，因为当前还没有真实 worker 接入服务层。
- 没有实现异步 worker 或多进程队列，当前是可测试的单进程 worker tick 模型。
- 没有接 Redis/Celery/RQ 等外部队列，避免为了架构名词引入重依赖。
- 下一步做前端时会先展示任务队列、运行中任务、失败任务和 stress report；真实 worker 接入后再补外部 API 限流。

## 7. v0.6：前端展示 Demo

状态：已完成第一阶段。

目标：像 `nonlinear-nn-agent` 最后要做前端一样，PaperStorm 也需要可展示界面。

### 已完成能力

1. 静态 Dashboard
   - 新增 `frontend/paperstorm_dashboard/index.html`。
   - 新增 `frontend/paperstorm_dashboard/styles.css`。
   - 新增 `frontend/paperstorm_dashboard/app.js`。
   - 不引入 Node/Vite 依赖，第一阶段直接打开 HTML 即可查看。

2. Demo 数据生成
   - 新增 `knowledge_storm/paperstorm_demo.py`。
   - 新增 `examples/storm_examples/build_paperstorm_demo_bundle.py`。
   - 可生成 `sample_data.json`，供前端离线展示。
   - 样例数据包含 task、article、QA、scorecard、runtime trace、multi-agent report、agent trace、stress report。

3. Dashboard 展示内容
   - 任务状态。
   - 调研文章。
   - 知识库 QA。
   - Runtime trace。
   - Eval scorecard。
   - Multi-Agent 保留/过滤结果。
   - Stress benchmark 指标。

4. 官方中文文档
   - 新增 `docs/STORM_OFFICIAL_CN.md`。
   - README 补官方 STORM 架构图、两阶段流程图、Co-STORM 工作流图。
   - README 先讲官方 STORM 基础，再讲 PaperStorm Agent 增强。

### 验收标准

- 运行 demo bundle 生成命令后，前端可加载 `sample_data.json`。
- 能展示一次已完成 run 的 report、trace、scorecard。
- 能展示一次知识库 QA 的召回来源与引用片段。
- 不依赖真实 API key 也能用样例数据预览。
- README 包含官方 STORM 架构和架构图。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
实现 PaperStorm Agent 前端 Demo，展示任务状态、检索审计、memory 摘要、工具调用 trace、最终报告和 scorecard，使 Agent 执行链路从黑盒变为可视化调试界面。
```

### 本版没有强行做的内容

- 没有做复杂 React/Vite 工程，避免前端依赖压过 Agent 项目本身。
- 没有做在线 API 调用，第一阶段先基于 `sample_data.json` 静态展示。
- 没有做真实 worker，下一版 v0.7 接入真实 PaperStorm pipeline worker。

## 8. v0.7：真实 Pipeline Worker 接入

状态：已完成第一阶段。

目标：把 v0.5 的 fake runner 扩展为真实 PaperStorm runner，让服务 API 能触发真实调研流程。

### 已完成能力

1. 真实 Pipeline Worker 模块
   - 新增 `knowledge_storm/paperstorm_pipeline.py`。
   - 提供 `PaperStormPipelineConfig`。
   - 提供 `build_pipeline_config_from_task_state(state)`。
   - 提供 `run_paperstorm_pipeline_task(state)`。
   - 将 service task state 映射为真实 STORM pipeline 所需配置。

2. Service Runner 接入
   - `PaperStormTaskService` 支持 `run_mode="paperstorm"`。
   - `run_mode="fake"` 保持原有测试和前端 baseline。
   - `run_mode="paperstorm"` 调用真实 pipeline worker。
   - `PaperStormTaskService(..., pipeline_runner=...)` 支持注入 runner，便于单元测试和未来替换为异步 worker / 队列 worker。

3. 统一产物接口
   - fake runner 和真实 worker 共用 task_id。
   - fake runner 和真实 worker 共用 `queued / running / succeeded / failed` 状态。
   - fake runner 和真实 worker 共用 output_dir。
   - 真实 worker 产物也能被 `get_article()`、`get_trace()`、`get_scorecard()` 读取。
   - 真实 worker 完成后写入 `pipeline_worker.json`，记录 runner、retriever、LLM provider/model 和 score。

4. 命令行入口
   - 新增 `examples/storm_examples/run_paperstorm_service_task.py`。
   - 支持 `--run-mode fake` 验证 service 状态机。
   - 支持 `--run-mode paperstorm` 触发真实 PaperStorm pipeline。
   - 支持 arXiv / local-pdf、DeepSeek / MiniMax、阶段开关、trace 开关、关键词评估配置。

5. FastAPI 适配器扩展
   - `ResearchTaskRequest` 补充真实 worker 需要的参数：`pdf_dir`、`llm_provider`、`llm_model`、并发/轮次/检索参数、四阶段执行开关、`remove_duplicate`、`disable_trace` 和 `verbose`。

6. 关键词脱敏修复
   - 修复 `expected_keywords` / `forbidden_keywords` 被错误脱敏的问题。
   - 原因是旧规则只要字段名包含 `key` 就脱敏，误伤了 `keywords`。
   - 新规则只脱敏真实敏感字段，例如 `api_key`、`secret_key`、`token`、`password`。

### 本版手工命令

fake service worker：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_paperstorm_service_task.py `
  --topic "pim 神经网络抑制" `
  --run-mode fake `
  --output-dir ./results/paperstorm_service_demo `
  --expected-keyword "passive intermodulation" `
  --forbidden-keyword DRAM
```

真实 PaperStorm worker：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_paperstorm_service_task.py `
  --topic "pim 神经网络抑制" `
  --run-mode paperstorm `
  --retriever arxiv `
  --output-language zh `
  --llm-provider deepseek `
  --llm-model flash `
  --output-dir ./results/paperstorm_service_real `
  --max-conv-turn 1 `
  --max-perspective 1 `
  --search-top-k 2 `
  --max-thread-num 1 `
  --expected-keyword "passive intermodulation" `
  --forbidden-keyword DRAM
```

### 验收标准

- fake runner 测试不受影响。
- 不需要真实 API key 的单元测试仍可通过。
- service 可通过注入 runner 验证真实模式的状态机、产物读取和失败处理。
- 有一个手工命令可以用 DeepSeek/arXiv 触发真实任务。
- 真实任务产物能被 service 层统一读取。
- 关键词配置不会被误脱敏。

### 简历价值

可写：

```text
将 PaperStorm Task Service 从 fake runner 扩展到真实 pipeline worker，统一真实调研与测试 baseline 的 task_id、状态、trace、scorecard 和产物读取接口，使 Agent 服务从演示数据推进到真实可运行任务。
```

### 本版没有强行做的内容

- 没有在单元测试中真实调用 DeepSeek 或 arXiv，避免 CI / 本地测试依赖网络、余额和模型波动。
- 没有引入 Celery / Redis / RQ 等外部队列，当前先完成可注入 worker 接口。
- 没有让 Dashboard 在线请求 service，下一版 v0.8 再接前端。
- 没有做真实 LLM/API 的大规模压测，后续需要在稳定网络和可控额度下执行。

## 9. v0.8：Dashboard 读取真实 Service 产物

状态：已完成第一阶段。

目标：把 v0.6 的静态 Dashboard 和 v0.7 的真实 service worker 接起来。

### 已完成能力

1. Service Dashboard Bundle
   - `PaperStormTaskService.get_dashboard_bundle(task_id)` 聚合单个任务的展示数据。
   - bundle 包含 project、tasks、article、QA、scorecard、trace、pipeline_worker 和 service_snapshot。
   - 前端不需要分别请求 task/article/trace/scorecard/QA 多个接口，降低展示页耦合。

2. FastAPI 聚合接口
   - 新增 `GET /research-tasks/{task_id}/dashboard`。
   - 真实 service task 可被 Dashboard 一次性读取。
   - 保留原 article、trace、scorecard、QA 细粒度接口。

3. Dashboard 在线读取模式
   - 页面顶部新增 Service URL 输入框。
   - 页面顶部新增 Task ID 输入框。
   - 新增“加载真实任务”按钮。
   - 新增“加载样例数据”按钮。
   - 默认仍加载 `sample_data.js/json`，避免演示时必须启动服务。

4. Pipeline Worker 展示
   - Dashboard 新增 Pipeline Worker 面板。
   - 展示 runner、run_mode、retriever、llm_provider、llm_model、status、score。
   - 对 fake / paperstorm 两种任务都能展示有意义的 worker 元数据或 service snapshot。

5. Demo Bundle v0.8
   - `build_demo_bundle()` 输出 project version `v0.8`。
   - `sample_data.json/js` 增加 pipeline_worker 和 service_snapshot。
   - 递归替换本机临时路径为 `demo://paperstorm_dashboard/...`，避免把 `%TEMP%` 路径写进正式样例数据。

### 验收标准

- 不启动服务时，Dashboard 仍能显示 sample data。
- 启动 FastAPI service 后，Dashboard 能读取一个真实 task 的状态和产物。
- 前端不会展示 API key、token 或本机敏感路径。
- 文档包含本地端到端 demo 步骤。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
将 PaperStorm 的静态可观测 Dashboard 接入本地 Task Service，支持读取真实任务状态、文章、trace、scorecard 和 pipeline worker 元数据，形成端到端 Agent 平台演示闭环。
```

### 本版没有强行做的内容

- 没有引入 React/Vite，当前仍保持零构建静态 Dashboard。
- 没有做鉴权、跨域配置模板和生产部署。
- 没有做前端创建任务、运行任务、轮询任务的完整交互；当前先做 task_id 读取真实产物。
- 没有把 Dashboard 变成复杂后台管理系统，避免偏离 Agent 能力主线。

## 10. v0.9：端到端本地 Demo 与任务轮询

状态：已完成第一阶段。

目标：从“输入 task_id 看结果”推进到“前端提交任务、运行任务、轮询状态、查看结果”的本地闭环。

### 已完成能力

1. Service 任务列表
   - `PaperStormTaskService.list_tasks(status=None)` 返回所有任务或按状态过滤任务。
   - 任务按 `queue_index` 和 `created_at` 保持稳定顺序。
   - 支撑 Dashboard 刷新任务列表和后续轮询。

2. FastAPI 控制接口
   - 新增 `GET /research-tasks`。
   - 保留 `POST /research-tasks` 创建任务。
   - 保留 `POST /research-tasks/{task_id}/run` 运行任务。
   - 保留 `GET /research-tasks/{task_id}/dashboard` 聚合读取任务产物。
   - 增加 CORS middleware，方便本地 HTML 直接访问 `http://127.0.0.1:8000`。

3. Dashboard 任务控制台
   - 新增 topic 输入。
   - 新增 run mode 选择：`fake` / `paperstorm`。
   - 新增 retriever 选择：`arxiv` / `local-pdf`。
   - 新增 output language 选择。
   - 新增 expected / forbidden keyword 输入。
   - 新增“提交任务”“运行选中任务”“轮询选中任务”“刷新任务列表”。

4. 失败可观测
   - Dashboard 增加 `task-error-panel`。
   - 任务失败时展示 service 返回的结构化 error。
   - 成功或未失败任务显示无结构化错误。

5. Demo Bundle v0.9
   - `build_demo_bundle()` 输出 project version `v0.9`。
   - 静态样例仍可离线打开。
   - 前端控制台和静态展示共存，演示时可选择是否启动服务。

### 验收标准

- 不依赖真实 API key 的 fake 端到端 demo 可以完整跑通。
- 真实 worker 仍然通过手工参数和 API key 控制，不在测试中真实调用。
- 前端能提交 task、运行 task、轮询 task 并展示结果。
- 前端能展示 task 的结构化失败信息。
- 文档能支持 5 分钟面试演示。
- 新增和既有测试全部通过。

### 简历价值

可写：

```text
将 PaperStorm Dashboard 从结果查看器扩展为本地端到端 Agent 控制台，支持提交任务、运行任务、轮询状态、展示失败原因和查看 trace/scorecard，形成可演示的轻量 Agent 平台原型。
```

### 本版没有强行做的内容

- 没有做自动定时轮询，避免静态页面误触发真实 API 成本。
- 没有做复杂前端状态管理，当前保持零构建原生 JS。
- 没有做登录、鉴权、用户隔离和生产部署。
- 没有在测试中真实调用 `paperstorm` worker，真实 API 仍由手工命令控制。

## 11. v1.0：Agent 平台化 Demo

状态：已完成第一阶段。

目标：形成可投递、可演示、可面试讲 5 分钟的完整项目。

### 本次完成

1. Release Demo 生成器
   - 新增 `knowledge_storm/paperstorm_release.py`。
   - `build_release_demo(service_root, dashboard_dir, topic)` 复用 `PaperStormTaskService`。
   - 固定走 submit -> run fake task -> query KB -> collect dashboard bundle -> write summary 的链路。
   - 不依赖真实 LLM/API key，适合作为面试和本地演示 baseline。

2. 命令行入口
   - 新增 `examples/storm_examples/run_paperstorm_release_demo.py`。
   - 一条命令生成 `release_demo_summary.json`、文章、trace、scorecard、QA 和前端 `sample_data.json/js`。
   - 默认 topic 是 `pim 神经网络抑制`，用于展示 PIM 领域消歧。

3. 前端样例数据
   - release demo 写入 Dashboard 可直接加载的 `sample_data.json` 和 `sample_data.js`。
   - project version 升级为 `v1.0`。
   - bundle 内增加 `release_demo` 字段，标注演示入口、场景和面试关键词。

4. 文档收口
   - README 增加 `v1.0 Release Demo`、一键命令和 5 分钟演示路线。
   - 本文档标记 v1.0 第一阶段完成。
   - `docs/RESUME_INTERVIEW_PLAN.md` 增加 30 秒、2 分钟、5 分钟项目讲法。

### 验证标准

- release demo 功能测试能验证文章、trace、scorecard、QA、dashboard sample data 均存在。
- 文档测试能验证 README、版本计划和简历文档都包含 v1.0 演示信息。
- 既有 PaperStorm 回归测试继续通过。

### 本版验收命令

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest `
  tests.test_paperstorm_release_demo `
  tests.test_paperstorm_release_docs -v
```

完整回归见 README 的测试章节。

### 能力边界

做到：

- RAG 知识库。
- 普通知识库 QA。
- Memory。
- 多 Agent 编排。
- Tool Schema / MCP。
- Runtime Trace。
- Eval Harness。
- API 服务化。
- 并发任务队列与压测报告。
- 前端展示。
- README 中文文档。
- 简历问答文档。
- 一键生成本地 release demo。

暂不承诺：

- 多租户。
- 权限系统。
- 真正高并发线上服务。
- 云部署。
- 企业级监控告警。

## 11.1 v1.1：本地演示链路打磨

状态：已完成第一阶段。

目标：让面试官或自己按 README 能稳定复现本地 Agent 平台演示，而不是只看静态截图。

### 本次完成

1. Service 启动入口
   - 新增 `examples/storm_examples/start_paperstorm_service.py`。
   - 支持 `--service-root`、`--host`、`--port`、`--reload`、`--log-level`。
   - 启动时打印 service URL、Dashboard 文件位置和 task 生命周期提示。

2. README Demo Runbook
   - 新增 `v1.1 Demo Runbook`。
   - 明确启动 service、生成 release demo、打开 Dashboard、提交任务、运行任务、轮询任务的顺序。
   - 明确生命周期：`submit -> queued -> running -> succeeded/failed -> artifacts -> trace/scorecard`。

3. 求职表达
   - `docs/RESUME_INTERVIEW_PLAN.md` 补充 v1.1 面试讲法。
   - 强调演示不是只给静态截图，而是展示 Agent task lifecycle 和 observability。

### 验收标准

- 新增 CLI parser 测试通过。
- README、版本计划和简历文档均包含 v1.1 本地演示链路。
- 完整回归测试继续通过。

### 简历价值

```text
为 PaperStorm Agent 补齐本地演示 runbook 和 service 启动入口，使项目能稳定展示从任务提交、状态流转、产物生成到 trace/scorecard 可观测的 Agent 生命周期。
```

## 12. 每次版本更新模板

```markdown
## vX.Y：版本名称

### 状态

计划中 / 开发中 / 已完成

### 本次完成

- ...

### 验证命令

```powershell
...
```

### 验证结果

```text
...
```

### 文档更新

- README.md
- docs/VERSION_PLAN.md
- docs/RESUME_INTERVIEW_PLAN.md

### 下一步

- ...
```
