# PaperStorm Agent

> 基于 Stanford STORM 二次开发的中文论文调研 Agent，面向 RAG、Memory、Tool Calling、MCP、Multi-Agent 与 Agent Eval 持续演进。

本仓库原始项目来自 Stanford STORM。官方 README 已保留在：

```text
README_STORM_OFFICIAL.md
```

官方中文说明：

```text
docs/STORM_OFFICIAL_CN.md
```

当前 GitHub 仓库：

```text
https://github.com/yzy-151/paperstorm-agent
```

当前 README 记录本 fork 的中文项目定位、运行方式、版本计划和求职展示重点。

## 1. 官方 STORM 基础架构

STORM 全称是：

```text
Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking
```

它是 Stanford OVAL 提出的长文调研与写作系统，目标是从一个 topic 出发，通过检索、多视角提问、模拟对话、知识整理和写作，生成类似 Wikipedia 风格的长文章。

官方整体架构图：

<p align="center">
  <img src="assets/overview.svg" style="width: 90%; height: auto;">
</p>

官方两阶段流程图：

<p align="center">
  <img src="assets/two_stages.jpg" style="width: 65%; height: auto;">
</p>

STORM 的核心流程：

```text
Pre-writing stage: research -> outline
Writing stage: article -> polish
```

在工程入口中，对应 `STORMWikiRunner.run()` 的四个开关：

```text
do_research
do_generate_outline
do_generate_article
do_polish_article
```

官方 STORM 的关键机制：

- `Perspective-Guided Question Asking`：先发现不同视角，再让不同视角控制问题生成，避免问题浅、散、重复。
- `Simulated Conversation`：模拟 Wikipedia writer 和 topic expert 的多轮对话，让 writer 追问、expert 基于检索结果回答。
- 模块化 `dspy` 实现：retriever、LM、runner、module 解耦，便于替换搜索引擎和语言模型。
- 多 LLM 配置：不同阶段可使用不同模型，在成本、速度、上下文长度和生成质量之间做权衡。

Co-STORM 是官方协作版本，加入 human-AI collaborative knowledge curation、Moderator、LLM experts 和动态 mind map：

<p align="center">
  <img src="assets/co-storm-workflow.jpg" style="width: 65%; height: auto;">
</p>

更详细的官方中文整理见：

```text
docs/STORM_OFFICIAL_CN.md
```

## 2. PaperStorm Agent 项目定位

PaperStorm Agent 的目标不是从零重写 STORM，而是在成熟 Deep Research / RAG 框架上做面向 Agent 开发岗的工程化改造：

- 中文论文调研报告生成。
- arXiv / 本地 PDF 检索。
- LLM query 清洗与领域消歧。
- Runtime Trace / Hook。
- Tool Schema 与 MCP-style 工具入口。
- Memory、Context Compression 与知识库问答。
- Eval Harness 量化评估 Agent 运行质量。
- 后续补 Multi-Agent、知识库服务化、高并发实验和前端展示。

与另一个项目 `nonlinear-nn-agent` 的分工：

- `nonlinear-nn-agent`：从零实现轻量 Agent Harness Runtime，突出 ToolRegistry、Hook、Session、Trace、Async、Retry。
- `PaperStorm Agent`：基于成熟 RAG/Deep Research 框架二次开发，突出 RAG、Memory、MCP、Multi-Agent、Eval、知识库与前端展示。

## 3. 当前已完成能力

### v0.1：PaperStorm MVP

- 支持 DeepSeek / MiniMax LLM 后端。
- 支持 arXiv 论文检索。
- 支持本地 PDF 论文片段检索。
- 支持中文输出。
- 复用 STORM 四阶段流程：

```text
research -> outline -> article -> polish
```

### 运行稳定性

- LLM query sanitizer：过滤空 query、Markdown、JSON、解释性句子。
- PIM 缩写消歧：将“PIM 神经网络抑制”指向 `passive intermodulation suppression`，过滤 `processing-in-memory / RAM / DRAM` 跑题结果。
- arXiv 单 query 失败降级，不中断主流程。
- 空检索结果防护，避免文章生成阶段崩溃。
- Wikipedia 辅助抓取增加 User-Agent、timeout 和结构检查。
- Windows UTF-8、surrogate、输出目录名、run_config 脱敏等修复。

### Agent Runtime 能力

- `paperstorm_trace.jsonl`：记录工具调用、耗时、结果数量、失败原因和产物路径。
- `run_summary.json`：记录一次运行摘要。
- `PaperStormTool`：统一工具 schema。
- `paperstorm_mcp_server.py`：MCP-style stdio server，支持 `tools/list` 和 `tools/call`。
- `paperstorm_eval.py`：规则版 Eval Harness，输出 `scorecard.json` 和 `scorecard.md`。

### v0.2：Memory / Context Compression / QA

- `PaperStormMemoryStore`：提供 working / episodic / semantic 三层记忆和用户偏好保存。
- `compress_context`：把长上下文压缩为结构化摘要，并检查期望关键词和禁止关键词。
- `PaperStormKnowledgeBase`：从一次 PaperStorm 运行目录加载文章和检索结果，支持基于证据的问答。
- `KnowledgeBaseQATool`：将知识库问答封装为标准 `PaperStormTool`，可被 MCP-style server 发现和调用。
- `PaperStormRuntimeSession`：轻量 runtime session，统一管理 tool registry、trace 写入和 working memory。
- `evaluate_qa_artifact`：对 `qa_answer.json` 进行规则版 QA 评估，检查引用、groundedness、关键词覆盖和跑题内容。

### v0.3：Runtime / Hook / Trace 标准化

- `ToolRegistry`：统一注册、查询、列出和校验 PaperStorm 工具。
- `HookManager`：支持 `before_tool_call`、`after_tool_call`、`on_tool_error`、`on_context_compress` 等生命周期 hook。
- `RuntimeEvent`：统一 runtime trace 字段，包括 `run_id`、`task_id`、`stage`、`tool`、`status`、`duration_sec`、`input_summary`、`output_summary`、`error`。
- `PaperStormRuntimeSession` v2：统一 tool registry、hook、trace、memory 和 context compression。
- MCP-style server 已接入 `ToolRegistry`，工具发现和工具调用共享同一套注册模型。

### v0.4：Multi-Agent 论文调研协作

- `PlannerAgent`：根据 topic 和关键词生成带 intent 的 query plan。
- `RetrieverAgent`：通过 `PaperStormRuntimeSession` 调用检索工具，并保留 query 来源。
- `CriticAgent`：基于 expected / forbidden keywords 判断结果保留或过滤，并写明理由。
- `MemoryAgent`：把保留和过滤发现写入 episodic memory。
- `EvaluatorAgent`：给 query plan、critic signal 和 agent trace 打分。
- `PaperStormResearchOrchestrator`：中心化编排多 Agent，输出 `agent_trace.jsonl` 和 `multi_agent_report.json`。

### v0.5：知识库平台化与服务 API

- `PaperStormTaskService`：文件存储版服务核心，管理 task_id、状态、output_dir、trace、summary、scorecard。
- 支持任务状态：`queued / running / succeeded / failed`。
- 支持读取文章、scorecard、trace。
- 支持基于 task artifacts 的知识库 QA。
- 支持 fake runner，不依赖真实 API key 也能测试服务链路。
- 失败任务输出结构化 error，并对 secret / key / token 字段脱敏。
- `paperstorm_service_api.py`：可选 FastAPI 适配器，提供任务提交、运行、状态查询、文章读取、scorecard、trace 和知识库 QA 路由。

### v0.5.1：并发、恢复与压测 baseline

- `PaperStormTaskService(max_concurrent_tasks=...)`：支持可配置并发上限。
- `worker_tick()`：从 queued 任务中按容量启动任务，避免超过并发上限。
- `complete_task()`：手动完成 running 任务，释放后续任务容量。
- `recover_stale_running_tasks()`：将超时 running 任务恢复为 failed，避免任务永久卡住。
- `run_stress_benchmark()`：使用 fake runner 生成压测报告，包含成功数、失败数、失败率、平均延迟、P95 latency、最大观察并发和 retry 次数。
- `benchmark_paperstorm_service.py`：命令行压测入口。

### v0.6：前端 Dashboard 与官方中文文档

- 新增静态 Dashboard：`frontend/paperstorm_dashboard/index.html`。
- Dashboard 展示任务状态、文章、知识库 QA、runtime trace、scorecard、multi-agent 结果和 stress report。
- 新增 `build_paperstorm_demo_bundle.py`，可生成 `sample_data.json` 供前端离线展示。
- 新增 `docs/STORM_OFFICIAL_CN.md`，把官方 STORM 架构和核心机制整理为中文说明。
- README 补充官方 STORM 架构图、两阶段流程图和 Co-STORM 工作流图。

### v0.7：真实 Pipeline Worker 接入

- 新增 `knowledge_storm/paperstorm_pipeline.py`，把真实 STORM pipeline 封装为 service 可调用的 worker。
- `PaperStormTaskService` 支持 `run_mode="paperstorm"`，同一套 task_id、状态、output_dir、article、trace、scorecard 读取接口可承载 fake 和真实任务。
- `PaperStormTaskService(..., pipeline_runner=...)` 支持 runner 注入，单元测试可用本地 runner 验证状态机，不依赖真实 LLM/API/网络。
- 新增 `run_paperstorm_service_task.py`，可从命令行提交并运行单个 service task。
- FastAPI 请求模型补充真实 worker 参数：LLM provider/model、检索器、PDF 目录、阶段开关、trace 开关等。
- 修复领域关键词误脱敏问题：`expected_keywords` / `forbidden_keywords` 不再因为字段名包含 `key` 被错误替换。

### v0.8：Dashboard 读取 Service 产物

- `PaperStormTaskService.get_dashboard_bundle(task_id)`：聚合 task、article、QA、scorecard、trace、pipeline worker 和 service snapshot。
- FastAPI 新增 `GET /research-tasks/{task_id}/dashboard`，前端可一次请求拿到真实任务展示数据。
- Dashboard 增加 Service URL、Task ID、加载真实任务和加载样例数据控件。
- Dashboard 新增 Pipeline Worker 面板，展示真实 worker 的 runner、retriever、LLM 和 score 元数据。
- 静态 `sample_data.json/js` 升级到 v0.8，离线打开 HTML 仍可展示完整样例。
- Demo bundle 递归清理本机临时路径，静态数据中的运行目录统一展示为 `demo://paperstorm_dashboard/...`。

### v0.9：端到端本地 Demo 与任务轮询

- `PaperStormTaskService.list_tasks(status=None)`：支持 Dashboard 获取全部任务或按状态过滤任务。
- FastAPI 新增 `GET /research-tasks`，返回任务列表；同时加入 CORS middleware，方便本地 HTML 访问服务。
- Dashboard 新增任务控制台：topic、run mode、retriever、output language、expected/forbidden keywords。
- Dashboard 支持提交任务、运行选中任务、轮询选中任务、刷新任务列表。
- Dashboard 支持展示结构化任务 error，使失败任务可观察、可复盘。
- 静态 `sample_data.json/js` 升级到 v0.9，离线展示和服务控制台共存。

### v1.0 Release Demo：可投递、可演示的 Agent 平台原型

- 新增 `build_release_demo()`，复用 `PaperStormTaskService` 的 submit -> run -> QA -> dashboard bundle 链路生成稳定演示数据。
- 新增 `run_paperstorm_release_demo.py`，一条命令生成 release summary、文章、trace、scorecard、QA 和前端 `sample_data.json/js`。
- Dashboard 样例数据可升级为 v1.0，展示 RAG、Memory、Runtime Trace、Eval、Task Service 和 Dashboard 的闭环。
- README、版本计划、简历面试文档补充 5 分钟演示路线和面试讲法。
- v1.0 明确为本地可演示平台原型，不夸大为多租户、分布式或生产部署系统。

## 4. 关键文件

运行入口：

```text
examples/storm_examples/run_paper_storm_minimax.py
examples/storm_examples/paperstorm_mcp_server.py
examples/storm_examples/evaluate_paperstorm_run.py
examples/storm_examples/paperstorm_service_api.py
examples/storm_examples/benchmark_paperstorm_service.py
examples/storm_examples/build_paperstorm_demo_bundle.py
examples/storm_examples/run_paperstorm_service_task.py
examples/storm_examples/run_paperstorm_release_demo.py
```

核心模块：

```text
knowledge_storm/rm.py
knowledge_storm/paperstorm_tools.py
knowledge_storm/paperstorm_eval.py
knowledge_storm/paperstorm_memory.py
knowledge_storm/paperstorm_qa.py
knowledge_storm/paperstorm_runtime.py
knowledge_storm/paperstorm_agents.py
knowledge_storm/paperstorm_service.py
knowledge_storm/paperstorm_demo.py
knowledge_storm/paperstorm_pipeline.py
knowledge_storm/paperstorm_release.py
```

测试：

```text
tests/test_minimax_runtime_fixes.py
tests/test_paperstorm_retrievers.py
tests/test_paperstorm_logging.py
tests/test_paperstorm_mcp_server.py
tests/test_paperstorm_eval.py
tests/test_paperstorm_memory_qa.py
tests/test_paperstorm_runtime.py
tests/test_paperstorm_multi_agent.py
tests/test_paperstorm_service.py
tests/test_paperstorm_concurrency.py
tests/test_paperstorm_frontend_docs.py
tests/test_paperstorm_pipeline.py
tests/test_paperstorm_service_cli.py
tests/test_paperstorm_release_demo.py
tests/test_paperstorm_release_docs.py
```

维护文档：

```text
docs/OPERATION_GUIDE.md
docs/VERSION_PLAN.md
docs/RESUME_INTERVIEW_PLAN.md
docs/STORM_OFFICIAL_CN.md
```

前端：

```text
frontend/paperstorm_dashboard/index.html
frontend/paperstorm_dashboard/styles.css
frontend/paperstorm_dashboard/app.js
```

## 5. 环境

当前本地推荐解释器：

```text
D:\SOFTWARE\spyder\envs\storm\python.exe
```

不要用系统默认 `python` 直接运行，容易出现环境不一致。

## 6. 运行 PaperStorm

PowerShell 示例：

```powershell
cd D:\FILEEEEEEEEEEE\projects\storm

D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_paper_storm_minimax.py `
  --topic "pim 神经网络抑制" `
  --retriever arxiv `
  --output-language zh `
  --output-dir ./results/paperstorm_zh `
  --llm-provider deepseek `
  --llm-model flash `
  --do-research `
  --do-generate-outline `
  --do-generate-article `
  --do-polish-article `
  --max-conv-turn 1 `
  --max-perspective 1 `
  --search-top-k 2 `
  --max-thread-num 1
```

常见输出：

```text
storm_gen_outline.txt
storm_gen_article.txt
storm_gen_article_polished.txt
raw_search_results.json
conversation_log.json
url_to_info.json
paperstorm_trace.jsonl
run_summary.json
```

最终可读文章通常是：

```text
storm_gen_article_polished.txt
```

## 7. 运行 Dashboard Demo

生成前端样例数据：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\build_paperstorm_demo_bundle.py `
  --output-dir frontend\paperstorm_dashboard
```

然后打开：

```text
frontend/paperstorm_dashboard/index.html
```

Dashboard 展示：

- 任务状态。
- 调研文章。
- 知识库 QA。
- Runtime trace。
- Eval scorecard。
- Multi-Agent 保留/过滤结果。
- Stress benchmark。
- Pipeline Worker 元数据。
- 任务创建、运行和轮询控制。

连接本地 service 查看真实任务：

1. 启动 `paperstorm_service_api.py` 对应的 FastAPI 服务。
2. 在 Dashboard 顶部输入 service URL，例如 `http://127.0.0.1:8000`。
3. 输入 task_id。
4. 点击“加载真实任务”。

本地端到端 fake demo：

1. 启动 FastAPI service。
2. 打开 `frontend/paperstorm_dashboard/index.html`。
3. 保持 Run Mode 为 `fake`。
4. 点击“提交任务”。
5. 点击“运行选中任务”。
6. 点击“轮询选中任务”查看 article、trace、scorecard 和 error。

## 8. v1.0 Release Demo

一条命令生成可演示产物：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_paperstorm_release_demo.py `
  --topic "pim 神经网络抑制" `
  --service-root ./results/paperstorm_release_demo `
  --dashboard-dir frontend\paperstorm_dashboard
```

它会生成：

```text
results/paperstorm_release_demo/release_demo_summary.json
results/paperstorm_release_demo/results/<task_id>/storm_gen_article_polished.txt
results/paperstorm_release_demo/results/<task_id>/paperstorm_trace.jsonl
results/paperstorm_release_demo/results/<task_id>/scorecard.json
frontend/paperstorm_dashboard/sample_data.json
frontend/paperstorm_dashboard/sample_data.js
```

### 5 分钟演示路线

1. 用 README 的官方 STORM 架构图说明原项目的 research -> outline -> article -> polish。
2. 运行 `run_paperstorm_release_demo.py`，展示同一套 service task 如何生成文章、QA、trace 和 scorecard。
3. 打开 `frontend/paperstorm_dashboard/index.html`，展示 task 状态、文章、知识库 QA、trace timeline 和 eval scorecard。
4. 解释 PIM 消歧：本项目把 PIM 指向 `passive intermodulation`，并过滤 `processing-in-memory / RAM / DRAM` 跑题内容。
5. 讲工程化增强：Tool Schema / MCP-style server、Memory、Context Compression、Multi-Agent、Task Service、Dashboard、Benchmark。
6. 主动说明边界：当前是本地平台原型，生产级多租户、权限、分布式队列和云部署还在后续计划。

## 9. 通过 Service Worker 运行单个任务

fake 模式不需要真实 API key，适合验证 service 状态机：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_paperstorm_service_task.py `
  --topic "pim 神经网络抑制" `
  --run-mode fake `
  --output-dir ./results/paperstorm_service_demo `
  --expected-keyword "passive intermodulation" `
  --forbidden-keyword DRAM
```

真实 PaperStorm worker 示例：

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

真实 worker 会复用 service 的任务状态、产物目录、trace 和 scorecard 读取接口。真实模式需要可用网络和对应 LLM API key。

## 10. 运行 Eval Harness

示例：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\evaluate_paperstorm_run.py `
  --run-dir .\results\paperstorm_zh\PIM `
  --case-file examples\storm_examples\paperstorm_eval_cases.json `
  --topic "pim 神经网络抑制"
```

输出：

```text
scorecard.json
scorecard.md
```

当前评分维度：

- 任务完成度。
- 检索相关性。
- 跑题惩罚。
- 文章质量。
- Runtime 可观测性。

## 11. 运行 MCP-style Server

手工 `tools/list` 验证：

```powershell
'{' + '"jsonrpc":"2.0","id":1,"method":"tools/list"' + '}' |
  D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\paperstorm_mcp_server.py
```

当前工具：

```text
arxiv_search
local_pdf_search
kb_qa
```

其中 `local_pdf_search` 需要传入 `--pdf-dir` 后启用。

## 12. 测试

推荐回归测试：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest `
  tests.test_paperstorm_frontend_docs `
  tests.test_paperstorm_concurrency `
  tests.test_paperstorm_service `
  tests.test_paperstorm_pipeline `
  tests.test_paperstorm_service_cli `
  tests.test_paperstorm_release_demo `
  tests.test_paperstorm_release_docs `
  tests.test_paperstorm_multi_agent `
  tests.test_paperstorm_runtime `
  tests.test_paperstorm_memory_qa `
  tests.test_paperstorm_eval `
  tests.test_paperstorm_mcp_server `
  tests.test_paperstorm_logging `
  tests.test_paperstorm_retrievers `
  tests.test_minimax_runtime_fixes -v
```

最近目标结果：

```text
Ran 78 tests
OK
```

语法检查：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m py_compile `
  knowledge_storm\paperstorm_eval.py `
  knowledge_storm\paperstorm_tools.py `
  knowledge_storm\paperstorm_demo.py `
  knowledge_storm\paperstorm_service.py `
  knowledge_storm\paperstorm_pipeline.py `
  knowledge_storm\paperstorm_release.py `
  examples\storm_examples\evaluate_paperstorm_run.py `
  examples\storm_examples\build_paperstorm_demo_bundle.py `
  examples\storm_examples\run_paperstorm_service_task.py `
  examples\storm_examples\run_paperstorm_release_demo.py `
  examples\storm_examples\paperstorm_service_api.py `
  examples\storm_examples\paperstorm_mcp_server.py
```

## 13. 后续版本路线

详见：

```text
docs/VERSION_PLAN.md
```

当前建议路线：

- v0.2：RAG 质量与 Memory 模块。
- v0.4：Multi-Agent 论文调研协作。
- v0.5：知识库平台化与服务 API。
- v0.6：前端展示 Demo。
- v0.7：真实 Pipeline Worker 接入。
- v0.8：Dashboard 读取真实 service 产物。
- v0.9：端到端本地 Demo 与任务轮询。
- v1.0：可投递、可演示的 Agent 平台化 Demo。

## 14. 求职与面试材料

详见：

```text
docs/RESUME_INTERVIEW_PLAN.md
```

项目可覆盖的面试关键词：

- Agentic Loop。
- RAG 全流程。
- Tool Calling。
- MCP。
- Memory。
- Multi-Agent。
- Runtime Trace。
- Eval / Benchmark。
- 错误容灾。
- 结构化技术文档。

## 15. 当前边界

已经完成：

- 本地命令行 Agent pipeline。
- RAG 检索与中文报告生成。
- Tool Schema / MCP-style server。
- Runtime Trace。
- Eval Harness v1。
- Memory / Context Compression / QA。
- Multi-Agent 调研编排。
- 文件存储版 Task Service。
- 静态 Dashboard。
- 真实 PaperStorm pipeline worker 接口。
- Dashboard 轻量读取真实 service task 产物。
- Dashboard 提交、运行和轮询本地 service task。
- v1.0 release demo 一键生成本地演示产物和前端样例数据。

尚未完成：

- 生产级 API 网关。
- 多用户和权限系统。
- 分布式高并发任务队列。
- 企业级监控告警。
- 生产级前端构建、鉴权、自动轮询调度和部署。
- 真实 LLM/API 环境下的大规模压测。

这些内容会按版本计划逐步补齐。
