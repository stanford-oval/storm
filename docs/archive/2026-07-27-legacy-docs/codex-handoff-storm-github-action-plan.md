# Codex Handoff: STORM GitHub 与行动纲领维护

更新时间：2026-07-21

这份文档给后续接手的 DeepSeek + Claude Code / Codex 使用。目标是：读完后不需要翻完整聊天记录，也能继续维护 Master 的 STORM / PaperStorm 项目、GitHub fork、行动纲领和学习文档。

## 0. 接手原则

Master 当前目标不是“读完 STORM 所有源码”，而是把 STORM 二次开发成一个可放进简历、能支撑 Agent Harness / Runtime 岗位面试的工程项目。

后续所有工作都围绕这条主线：

```text
PaperStorm：基于 Stanford STORM 二次开发的中文论文调研 Agent
重点能力：RAG、Tool Calling、MCP、Trace/Hook、Runtime Observability、Eval Harness
```

必须遵守：

- 用中文和 Master 沟通。
- 先看项目状态，再动手。
- 不要 `git reset --hard`。
- 不要 `git checkout -- .`。
- 不要把临时文件放到项目根目录。
- 跨项目缓存、临时 worktree、临时脚本统一放到 `C:\Users\yzy\Desktop\codex\`。
- 每次有实质改动，都要更新学习文档，写清“学到了什么、面试怎么讲”。

## 1. 关键路径

### STORM 项目

```text
D:\FILEEEEEEEEEEE\projects\storm
```

### 固定临时目录

```text
C:\Users\yzy\Desktop\codex\
```

推荐 worktree 组织方式：

```text
C:\Users\yzy\Desktop\codex\storm\<task-name>-<date>
```

### 行动纲领

```text
C:\Users\yzy\.claude\projects\C--Users-yzy\memory\action-plan.md
```

这是 Master 的长期职业规划文件。若能访问，阶段性工作完成后要追加更新；若不能访问，要明确告诉 Master。

### 主要学习文档

```text
docs/paperstorm-mvp-learning-plan.md
docs/paperstorm-runtime-observability-learning.md
docs/codex-handoff-storm-github-action-plan.md
```

## 2. GitHub 远程与分支状态

### 远程仓库

```text
origin  https://github.com/stanford-oval/storm.git
fork    https://github.com/yzy-151/storm.git
```

含义：

- `origin` 是 Stanford 官方仓库，不要 push。
- `fork` 是 Master 自己的 fork，可以 push feature 分支。

### 当前本地工作区状态

主工作区通常在：

```text
codex/minimax-agent-storm
```

但这个工作区经常有未提交学习注释、文档、本地规则和同步过来的功能文件。接手第一步必须运行：

```powershell
cd D:\FILEEEEEEEEEEE\projects\storm
git status -sb
git diff --stat
git remote -v
```

不要从主工作区直接全量提交。推荐新功能都在 `C:\Users\yzy\Desktop\codex\storm\...` 下开 git worktree。

### 已推送的重要分支

```text
fork/main
fork/feature/paperstorm-query-quality
fork/feature/paperstorm-runtime-tracing
fork/feature/paperstorm-tool-schema
fork/feature/paperstorm-mcp-server
```

截至 2026-07-21，重要提交：

```text
fork/main:
6d9df20 Merge PaperStorm runtime tracing

fork/feature/paperstorm-mcp-server:
4037d11 feat: add PaperStorm MCP server demo
16dc6ca feat: add PaperStorm tool schemas
6d9df20 Merge PaperStorm runtime tracing
```

如果网络 push 失败，可使用代理：

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7890'
$env:HTTPS_PROXY='http://127.0.0.1:7890'
```

## 3. 已完成的 PaperStorm 能力

### 3.1 MiniMax / DeepSeek Runner

文件：

```text
examples/storm_examples/run_paper_storm_minimax.py
```

已支持：

- `--llm-provider minimax`
- `--llm-provider deepseek`
- `--llm-model flash` 映射到 `deepseek/deepseek-chat`
- `--output-language zh`
- arXiv / local PDF 检索入口
- 运行日志降噪
- trace 默认开启
- 输出关键 artifact 路径

### 3.2 arXiv 与本地 PDF 检索

文件：

```text
knowledge_storm/rm.py
```

已完成：

- `ArxivRM`
- `LocalPDFRM`
- arXiv Atom XML 解析
- 本地 PDF 文本 chunk 检索
- 空 query 跳过
- 单条 arXiv query 失败降级
- PIM 领域消歧

PIM 特别处理：

```text
pim 神经网络抑制
  -> passive intermodulation neural network suppression
```

同时过滤：

```text
processing-in-memory
RAM
DRAM
product information management
```

### 3.3 Query 清洗与空检索防护

相关文件：

```text
knowledge_storm/storm_wiki/modules/knowledge_curation.py
knowledge_storm/storm_wiki/modules/storm_dataclass.py
```

已完成：

- 清洗 LLM 输出中的 JSON/Markdown/解释句噪声。
- 空 information table 不再触发 sklearn 2D array 错误。

### 3.4 Wikipedia 辅助抓取防御

文件：

```text
knowledge_storm/storm_wiki/modules/persona_generator.py
```

已完成：

- User-Agent
- timeout
- HTTP 状态检查
- h1 缺失检查
- 旧 Wikipedia 噪声日志过滤

### 3.5 Runtime Trace / Hook

文件：

```text
examples/storm_examples/run_paper_storm_minimax.py
tests/test_paperstorm_logging.py
```

运行后会生成：

```text
paperstorm_trace.jsonl
run_summary.json
```

关键事件：

```text
run_start
retrieval_start
retrieval_end
retrieval_error
tool_start
tool_end
tool_error
artifact_written
run_end
```

面试表述：

```text
我给 PaperStorm 补了轻量 Agent Runtime Trace，用 JSONL 记录一次 Agentic Loop 中的工具调用、耗时、结果数量、失败原因和产物路径，方便复盘和自动评估。
```

### 3.6 Tool Schema

文件：

```text
knowledge_storm/paperstorm_tools.py
tests/test_paperstorm_retrievers.py
```

已完成：

- `PaperStormTool`
- `RetrievalTool`
- `ArxivSearchTool`
- `LocalPDFSearchTool`
- `list_paperstorm_tools()`

每个工具提供：

```python
tool.name
tool.description
tool.input_schema
tool.output_schema
tool.to_schema()
tool.run(arguments)
```

### 3.7 MCP Server Demo

文件：

```text
examples/storm_examples/paperstorm_mcp_server.py
tests/test_paperstorm_mcp_server.py
```

已推送：

```text
fork/feature/paperstorm-mcp-server
4037d11 feat: add PaperStorm MCP server demo
```

支持：

- `tools/list`
- `tools/call`
- JSON-RPC 风格错误返回
- stdio 输入输出

手工验证示例：

```powershell
'{' + '"jsonrpc":"2.0","id":1,"method":"tools/list"' + '}' |
  D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\paperstorm_mcp_server.py
```

## 4. 当前测试命令

推荐回归：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest `
  tests.test_paperstorm_mcp_server `
  tests.test_paperstorm_logging `
  tests.test_paperstorm_retrievers `
  tests.test_minimax_runtime_fixes -v
```

最近验证结果：

```text
Ran 35 tests
OK
```

语法检查：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m py_compile `
  examples\storm_examples\paperstorm_mcp_server.py `
  knowledge_storm\paperstorm_tools.py
```

## 5. 推荐接手流程

### Step 1：检查当前状态

```powershell
cd D:\FILEEEEEEEEEEE\projects\storm
git status -sb
git diff --stat
git remote -v
git branch --show-current
```

### Step 2：读取核心文档

```powershell
Get-Content -Raw docs\paperstorm-mvp-learning-plan.md
Get-Content -Raw docs\paperstorm-runtime-observability-learning.md
Get-Content -Raw docs\codex-handoff-storm-github-action-plan.md
```

### Step 3：从 fork 分支创建隔离 worktree

示例：

```powershell
$base='C:\Users\yzy\Desktop\codex\storm\paperstorm-eval-harness-2026-07-21'
New-Item -ItemType Directory -Force -Path (Split-Path $base) | Out-Null
git fetch fork main feature/paperstorm-mcp-server
git worktree add -B feature/paperstorm-eval-harness $base fork/feature/paperstorm-mcp-server
```

### Step 4：按 TDD 开发

先写测试，确认失败，再实现最小代码。

### Step 5：验证、提交、推送

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest <相关测试> -v
git status -sb
git diff --stat
git add <本次明确文件>
git commit -m "<message>"
git push fork HEAD:<branch>
```

### Step 6：同步回主工作区

如果 Master 正在 VS Code 主工作区查看文件，需要把已验证文件从 worktree 复制回：

```text
D:\FILEEEEEEEEEEE\projects\storm
```

只复制本次目标文件，不复制整个目录。

## 6. 下一步：PaperStorm Eval Harness v1

这是当前最推荐继续做的任务。

目标：让 PaperStorm 不再只靠“肉眼感觉文章还行”，而是能输出可解释分数。

推荐新增文件：

```text
knowledge_storm/paperstorm_eval.py
examples/storm_examples/evaluate_paperstorm_run.py
examples/storm_examples/paperstorm_eval_cases.json
tests/test_paperstorm_eval.py
```

输入运行目录：

```text
results/paperstorm_zh/<topic>/
```

读取：

```text
conversation_log.json
raw_search_results.json
storm_gen_outline.txt
storm_gen_article_polished.txt
paperstorm_trace.jsonl
run_summary.json
```

输出：

```text
scorecard.json
scorecard.md
```

第一版不要用 LLM Judge。用规则打分，稳定、便宜、可解释。

建议 100 分制：

```text
任务完成度 20
检索相关性 30
跑题惩罚 15
文章可用性 20
Runtime 可观测性 15
```

PIM case 示例：

```json
{
  "topic": "pim 神经网络抑制",
  "expected_keywords": [
    "passive intermodulation",
    "intermodulation",
    "RF",
    "radio frequency",
    "neural network",
    "suppression",
    "cancellation"
  ],
  "forbidden_keywords": [
    "processing-in-memory",
    "DRAM",
    "RAM",
    "product information management"
  ],
  "expected_language": "zh",
  "min_sources": 3
}
```

面试表述：

```text
我没有只靠主观判断 Agent 生成结果，而是给 PaperStorm 做了一个 Eval Harness。它读取一次运行的检索结果、文章、trace 和 summary，从任务完成度、检索相关性、跑题率、文章可用性和运行可观测性打分。比如 PIM 主题会把 passive intermodulation 作为正向关键词，把 processing-in-memory/RAM/DRAM 作为负向关键词，从而量化检索是否跑题。
```

## 7. 学习文档维护规则

每次完成实质改动，都追加到：

```text
docs/paperstorm-runtime-observability-learning.md
```

格式：

```markdown
## YYYY-MM-DD：改动主题

### 为什么做
### 本次改进
### 验证
### 你应该学到什么
### 面试可以怎么讲
```

不要只写“做了优化”。要写清楚：

- 问题现象；
- 根因；
- 修改点；
- 测试命令；
- 测试结果；
- 对 Agent Harness 岗位的对应能力。

## 8. 行动纲领维护规则

行动纲领文件：

```text
C:\Users\yzy\.claude\projects\C--Users-yzy\memory\action-plan.md
```

如果后续工作区能访问，阶段性更新时按这个模板追加：

```markdown
## YYYY-MM-DD PaperStorm 阶段更新

### 已完成

- ...

### 证据路径

- ...

### 测试结果

- ...

### 简历/面试沉淀

- ...

### 下一步

- ...
```

如果不能访问，不要假装已经更新，直接告诉 Master：

```text
我当前无法访问行动纲领文件，需要你提供内容或授权读取。
```

## 9. 不要踩的坑

- 不要说“我从零实现了 STORM”。正确说法是“基于 Stanford STORM 二次开发 PaperStorm”。
- 不要为了漂亮分数一开始就上 LLM Judge。先做规则评估，保证可解释。
- 不要把 GitHub 官方仓库 `origin` 当成自己的 fork。
- 不要把 `.agents/`、`.claude/`、`CLAUDE.md`、`docs/superpowers/` 混进功能提交。
- 不要把 API key 写进代码或文档。
- 不要因为 arXiv 单条 query 失败就判断整个 Agent 失败。
- 不要忽略 Windows PowerShell 换行：PowerShell 多行命令用反引号 `` ` ``，不是 Linux 的 `\`。

## 10. 给后续 Agent 的一句话任务

```text
先读本文件、paperstorm-mvp-learning-plan.md、paperstorm-runtime-observability-learning.md，再检查 git status。后续优先做 PaperStorm Eval Harness v1：读取一次运行产物，输出 scorecard.json/scorecard.md，用规则指标评估任务完成度、检索相关性、跑题率、文章可用性和 runtime 可观测性。完成后写测试、更新学习记录，并推送到 fork 的 feature 分支。
```
