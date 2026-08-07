# PaperStorm 运行可观测性与健壮性学习记录

## 背景

PaperStorm 的主流程已经能调用 DeepSeek、arXiv 和本地 PDF 检索，但实际运行时终端出现大量 warning/error，用户很难判断：

- 程序是否真的失败；
- 哪些只是第三方库噪声；
- 哪些是外部服务暂时失败；
- 结果文件到底在哪里；
- 为什么文章生成阶段会在检索结果为空时崩溃。

这次改动的目标不是单纯“隐藏日志”，而是把运行状态变得可解释、可诊断、可继续迭代。

## 问题 1：第三方库 warning 太吵

### 现象

运行中反复出现：

```text
Pydantic serializer warnings
LiteLLM completion() model=deepseek-chat
Provider List: https://docs.litellm.ai/docs/providers
```

这些信息数量很大，但多数不影响主流程生成结果。

### 根因

- LiteLLM 和 Pydantic 的对象序列化结构不完全匹配，会触发 `UserWarning`；
- LiteLLM 会通过 logging 或 stdout 打印 provider 信息；
- 这些信息不是业务错误，但挤占了用户对真正错误的注意力。

### 改进

- 在 PaperStorm runner 中增加统一日志配置；
- 过滤 Pydantic serializer warning；
- 压低 LiteLLM/httpx/sentence-transformers 等第三方 logger 的等级；
- 屏蔽 LiteLLM 直接写到 stdout 的 Provider List；
- 保留 PaperStorm 自己的关键 INFO。

### 学习点

日志不是越多越好。好的日志应该帮助用户判断系统状态，而不是把用户淹没。

面试表达：

> 我对 PaperStorm 做过 runtime observability 改进。原系统虽然能跑，但第三方库 warning 和 provider 日志刷屏。我把日志按影响面分类，过滤非业务噪声，同时保留模型、检索器、输出目录和关键产物路径，让运行状态更可诊断。

## 问题 2：Wikipedia 辅助页面抓取失败

### 现象

运行中出现：

```text
Error occurs when processing https://en.wikipedia.org/wiki/...:
'NoneType' object has no attribute 'text'
```

### 根因

STORM 的 persona 生成阶段会让 LLM 推荐相关 Wikipedia 页面，再抓取页面标题和目录作为专家视角参考。

原逻辑默认：

```python
soup.find("h1").text
```

但 Wikipedia 对没有 User-Agent 的默认 requests 请求可能返回 403。返回内容不是正常 HTML，自然没有 `<h1>`，于是触发 `NoneType.text`。

### 改进

- 给 Wikipedia 请求加 User-Agent；
- 加 timeout；
- 调用 `raise_for_status()` 明确处理 HTTP 错误；
- 检查 `h1` 是否存在；
- 旧的 Wikipedia 辅助页失败日志不再以 ERROR 干扰主流程。

### 学习点

外部网页结构和服务策略都不可靠，爬取类逻辑必须防御式编程。

面试表达：

> 我修复过 persona generation 里的 Wikipedia 抓取问题。原代码假设页面一定有 h1，但在 403 或页面结构异常时会触发 NoneType.text。我补了 User-Agent、timeout、HTTP 状态检查和结构检查，把隐式异常变成可解释的降级路径。

## 问题 3：LLM 生成的搜索 query 混入结构噪声

### 现象

arXiv 检索里出现了明显不该进入搜索引擎的 query：

```text
```json
queries": [
**Queries:**
以下是根据您的需求...
好的，作为理论基础专家...
```

这些 query 会浪费 arXiv 请求次数，也更容易触发 429。

### 根因

`QuestionToQuery` 期望 LLM 输出多行搜索词，但 DeepSeek 有时会输出 JSON、Markdown 代码块、说明性句子或角色扮演文本。旧的 `clean_search_queries` 只会去掉 `-` 和空行，无法过滤这些结构噪声。

### 改进

- 增加结构噪声过滤；
- 跳过代码块标记、JSON 字段、列表括号；
- 跳过“以下是...”“好的，作为...”这类说明性句子；
- 保留真正可用于检索的搜索词。

### 学习点

LLM 输出不能直接信任。只要 LLM 输出会进入工具调用，就必须做结构校验和清洗。

面试表达：

> 我发现 LLM 生成的 query 会混入 Markdown、JSON 字段和解释性中文句子，导致 arXiv API 收到无效搜索词。我增强了 query sanitizer，并用回归测试覆盖这些脏输出，减少无效外部请求和限流风险。

## 问题 4：arXiv 单条 query 失败不应中断主流程

### 现象

日志里出现：

```text
429 Too Many Requests
Read timed out
```

### 根因

arXiv 是公开 API，可能因为请求频率、网络、代理、服务状态或无效 query 失败。

这类失败通常只影响某一条 query，不代表整个 pipeline 崩溃。

### 改进

- 单条 arXiv query 失败时跳过；
- 日志从 ERROR 降级为 INFO；
- 主流程继续处理其它 query。

### 学习点

在多 query 检索系统里，单个外部请求失败应该被视为部分失败，而不是系统级失败。

面试表达：

> 我把 arXiv 单 query 失败从 ERROR 降为 INFO，因为它是部分外部请求失败，系统可以继续用其它 query 生成结果。这是把日志级别和真实故障严重性对齐。

## 问题 5：检索结果为空时文章生成崩溃

### 现象

文章生成阶段报错：

```text
ValueError: Expected 2D array, got 1D array instead: array=[].
```

### 根因

如果前面所有 arXiv query 都失败或没有有效结果，`StormInformationTable` 中没有 snippet。

旧逻辑仍然执行：

```python
cosine_similarity([encoded_query], self.encoded_snippets)
```

此时 `self.encoded_snippets` 是空数组，sklearn 期望二维矩阵，于是崩溃。

### 改进

- 如果没有 collected snippets，不加载 SentenceTransformer；
- `retrieve_information()` 直接返回空列表；
- 避免空资料表进入向量相似度计算。

### 学习点

RAG/Agent pipeline 的每个阶段都要考虑“上游没有产物”的情况。检索为空是正常边界条件，不应该导致下游崩溃。

面试表达：

> 我修复了文章生成阶段对空检索结果不健壮的问题。当前序阶段没有 snippet 时，原系统仍然做向量相似度计算，导致 sklearn 对空数组报错。我增加了空 information table 的边界处理，使检索为空时下游能优雅降级。

## 本次你应该掌握的工程能力

1. 区分致命错误、部分失败、第三方噪声。
2. 用日志等级表达真实严重性。
3. 对外部 API 和网页抓取做防御式编程。
4. 对 LLM 输出进入工具调用前做清洗。
5. 对 RAG pipeline 的空结果边界做保护。
6. 用回归测试锁住日志行为和异常边界。

## 简历/面试可总结为

> 基于 Stanford STORM 二次开发 PaperStorm 时，我重点改进了运行可观测性和检索链路健壮性。针对 DeepSeek/LiteLLM 运行中的 Pydantic warning、Provider List 刷屏、Wikipedia 辅助抓取失败、arXiv 单 query 失败和空检索结果导致文章生成崩溃等问题，我进行了日志分级、噪声过滤、User-Agent/timeout/HTTP 校验、LLM query sanitizer 和空 information table 防护，并补充单元测试覆盖这些边界。这个改动让项目从“能跑”变成“可诊断、可交付、可复现”。

## 后续维护约定

之后每次 PaperStorm 有实质改动时，都追加一节：

- 改了什么；
- 为什么改；
- 遇到了什么问题；
- 如何验证；
- 你应该学到什么；
- 面试中可以怎么讲。

## 2026-07-21：PIM 歧义消解与 arXiv 检索质量优化

### 现象

当 topic 是“PIM 神经网络抑制”时，用户真实意图是：

```text
Passive Intermodulation，中文是无源互调，属于射频/天线/通信系统问题。
```

但 arXiv 检索可能返回：

```text
Processing-in-Memory
RAM / DRAM system
Product Information Management
```

这些结果虽然也可能缩写为 PIM，但和“无源互调抑制”完全不是一个领域。

### 根因

PIM 是高度歧义缩写。LLM 生成 query 时如果只写：

```text
PIM neural network suppression
PIM system
PIM RAM
```

arXiv 并不知道这里的 PIM 是 passive intermodulation。搜索引擎会按统计相关性召回其它领域的 PIM 论文。

这不是单纯的“模型不聪明”，而是工具调用前缺少领域消歧。

### 改进

在 `ArxivRM` 层增加确定性的 query 规范化和结果过滤：

- 中文关键词英文化：
  - `无源互调` → `passive intermodulation`
  - `神经网络` → `neural network`
  - `抑制` → `suppression`
  - `射频` → `radio frequency`
- 当 query 中出现 PIM，并且上下文包含 suppression、RF、antenna、neural network 等词时，将 PIM 扩展为 `passive intermodulation`；
- 当 query 明确是 RAM、DRAM、processing-in-memory 方向时，直接跳过；
- 当 query 已经消歧为 passive intermodulation 时，过滤掉 title/abstract 中明显是 processing-in-memory、RAM、product information management 的结果。

### 验证

新增回归测试：

- `pim 神经网络抑制` 会被规范化为 `passive intermodulation neural network suppression`；
- 返回结果中保留 passive intermodulation 论文；
- 过滤 processing-in-memory / RAM 论文；
- `PIM RAM processing-in-memory system` 不再请求 arXiv。

测试结果：

```text
27 tests OK
```

### 你应该学到什么

1. 缩写词是检索系统里的高风险输入。
2. LLM 生成 query 后，不能直接丢给外部搜索 API。
3. 对专业领域缩写，要做 query expansion / disambiguation。
4. 检索质量不能只靠 prompt，要在工具层做确定性约束。
5. 结果端也要过滤，因为即使 query 正确，搜索引擎仍可能召回跑题文档。

### 面试可以怎么讲

> 我在 PaperStorm 里处理过专业缩写导致的检索跑题问题。比如 PIM 在通信领域指 passive intermodulation，但在计算机体系结构里也指 processing-in-memory。原系统直接把 LLM 生成的 PIM query 发给 arXiv，容易召回 RAM/DRAM 论文。我在 ArxivRM 层做了 query expansion 和领域消歧：在 RF、suppression、neural network 上下文中把 PIM 扩展为 passive intermodulation，并过滤 processing-in-memory、product information management 等跑题结果，同时用回归测试锁住这个行为。这个改动体现了 Agent 工具调用前的输入规范化和检索质量控制。

## 2026-07-21：PaperStorm Runtime Trace / Hook 雏形

### 为什么做

通用 Agent Harness 岗位关注的不只是“Agent 能跑”，而是：

- 一次 Agentic Loop 具体经历了哪些步骤；
- 哪个工具被调用；
- 每次工具调用耗时多久；
- 哪些 query 成功，哪些 query 失败；
- 最终写出了哪些产物；
- 出错时是否能从日志里复盘原因。

如果只有终端日志，信息很快会被刷掉，也不方便程序分析。因此需要结构化 trace。

### 本次改进

新增轻量运行时 trace 能力：

- 每次运行默认生成 `paperstorm_trace.jsonl`；
- 每次运行默认生成 `run_summary.json`；
- 增加 `PaperStormTraceRecorder`，统一记录事件；
- 增加 `TracedRetrievalModel`，包装底层检索器；
- 新增 `--disable-trace`，需要时可以关闭 trace。

当前记录的事件包括：

```text
run_start
retrieval_start
retrieval_end
retrieval_error
artifact_written
run_end
```

`paperstorm_trace.jsonl` 是逐行 JSON，每行一个事件，适合后续分析：

```json
{"event": "retrieval_start", "retriever": "ArxivRM", "queries": ["passive intermodulation"]}
{"event": "retrieval_end", "result_count": 3, "duration_sec": 1.25}
```

`run_summary.json` 汇总一次运行：

```json
{
  "success": true,
  "duration_sec": 42.1,
  "retrieval_queries": 6,
  "retrieval_success": 6,
  "retrieval_failed": 0,
  "artifacts": ["storm_gen_outline.txt"]
}
```

### 设计取舍

这次没有直接侵入 DSPy/LiteLLM 内部去追踪每一次 LLM 调用，而是先在 PaperStorm runner 和 retriever 边界做 trace。

原因：

- runner 边界稳定，风险低；
- retriever 是明确的 tool calling 边界；
- 先保证可用的 trace，再逐步深入 LLM 调用层；
- 这更符合工程里的渐进式 instrumentation。

### 验证

新增测试覆盖：

- trace recorder 能写 JSONL 事件；
- trace recorder 能写 summary；
- traced retriever 能记录 retrieval_start / retrieval_end；
- traced retriever 出错时能记录 retrieval_error；
- 原有日志、检索、query 清洗测试不回归。

测试结果：

```text
29 tests OK
```

### 你应该学到什么

1. Hook/Trace 是 Agent Runtime 的基础设施，不是普通 print。
2. Agent Harness 要能回答“这次执行发生了什么”。
3. 工具调用边界是最适合做 trace 的第一层。
4. JSONL 适合记录事件流，JSON summary 适合记录运行摘要。
5. 可观测性应该结构化，方便之后做自动分析和问题定位。

### 面试可以怎么讲

> 我在 PaperStorm 里补了轻量 Agent Runtime Trace。每次运行会生成 paperstorm_trace.jsonl 和 run_summary.json，记录 run_start、retrieval_start、retrieval_end、retrieval_error、artifact_written、run_end 等事件。检索器通过 wrapper 方式接入 trace，不侵入原有 ArxivRM/LocalPDFRM 逻辑。这样可以复盘一次 Agentic Loop 中工具调用了什么 query、耗时多久、返回多少结果、哪里失败，属于 Agent Harness 里的 Hook / Observability / Runtime Debugging 能力。

## 2026-07-21：PaperStorm Tool Schema 抽象

### 为什么做

Agent Harness 里的工具系统不能只是内部 Python 类。一个工具要能被 Agent Runtime 发现、描述、校验和调用，需要有稳定的 schema：

- 工具叫什么；
- 工具解决什么问题；
- 输入参数是什么；
- 输出结构是什么；
- 调用失败如何表示；
- 后续如何映射到 MCP Tool。

这一步是 MCP 前置工作。先有稳定 Tool Schema，后面 MCP server 只是把这些工具按协议暴露出去。

### 本次改进

新增 `knowledge_storm/paperstorm_tools.py`：

- `PaperStormTool`：统一工具基类；
- `RetrievalTool`：检索类工具适配器；
- `ArxivSearchTool`：把 `ArxivRM` 包成 schema tool；
- `LocalPDFSearchTool`：把 `LocalPDFRM` 包成 schema tool；
- `list_paperstorm_tools()`：后续给 MCP server 做工具发现。

每个工具都提供：

```python
tool.name
tool.description
tool.input_schema
tool.output_schema
tool.to_schema()
tool.run(arguments)
```

示例 schema：

```json
{
  "name": "arxiv_search",
  "description": "Search paper metadata from arXiv.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "top_k": {"type": "integer"}
    },
    "required": ["query"]
  }
}
```

### Trace 事件扩展

Runtime trace 原来只有检索专用事件：

```text
retrieval_start
retrieval_end
retrieval_error
```

这次补了更通用的工具事件：

```text
tool_start
tool_end
tool_error
```

这样后续不管是 arXiv、本地 PDF、MCP 工具、文件读取工具，还是其它工具，都可以走同一套 trace 语义。

### 你应该学到什么

1. Tool Calling 不只是“调一个函数”，还需要 schema。
2. Tool Schema 是 MCP、OpenAI function calling、LangGraph tool node 等机制的共同基础。
3. 工具层要和具体实现解耦：Agent Runtime 面对的是 tool schema，不应该直接依赖内部类。
4. Trace 事件应该从 retrieval 逐步抽象到 tool，更符合通用 Agent Harness。

### 面试可以怎么讲

> 我在 PaperStorm 里把内部检索器抽象成统一 Tool Schema。ArxivRM 和 LocalPDFRM 不再只是 Python 类，而是被适配成带 name、description、input_schema、output_schema 和 run(arguments) 的工具对象。这样后续可以直接映射到 MCP Tool 或其它 Agent Runtime 的 Function Calling 接口。同时我把 trace 从 retrieval_start/end 扩展到通用 tool_start/tool_end/tool_error，让工具调用可观测性不局限于检索器。

## 2026-07-21：PaperStorm MCP Server Demo

### 为什么做

岗位 JD 里提到 MCP，本质上是在问你是否理解“Agent Runtime 如何发现和调用外部能力”。上一阶段我们已经有了 `PaperStormTool` 和 schema，但那只是项目内部的 Python 抽象；这次补一个最小 MCP 风格 stdio server，把内部工具暴露成协议入口。

这一步的价值不是“炫协议”，而是把 PaperStorm 从普通脚本推进到 Agent Harness 方向：

- 工具可以被 runtime 列出来；
- 工具可以通过统一请求调用；
- 工具错误可以结构化返回；
- 后续可以接入 MCP client、Agent 框架或自研 runtime。

### 本次改进

新增 `examples/storm_examples/paperstorm_mcp_server.py`，提供一个轻量 MCP-style JSON-RPC stdio server：

- `tools/list`：返回当前可用工具 schema；
- `tools/call`：按工具名调用 `arxiv_search` 或 `local_pdf_search`；
- `build_tool_registry()`：从 `list_paperstorm_tools()` 构建工具注册表；
- `handle_jsonrpc_request()`：把 JSON-RPC 请求路由到具体工具；
- `serve_stdio()`：从标准输入读请求，从标准输出写响应。

调用形态大致如下：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

工具调用示例：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "arxiv_search",
    "arguments": {
      "query": "passive intermodulation suppression",
      "top_k": 2
    }
  }
}
```

### 错误处理

这次没有让工具调用异常直接炸掉进程，而是返回 JSON-RPC 风格错误：

- 未知工具：`-32602 Invalid params`；
- 未知方法：`-32601 Method not found`；
- 请求格式错误：`-32600 Invalid request`；
- 工具内部异常：`-32603 Internal error`。

这是 Agent Runtime 很重要的一点：工具失败不应该等于整个 Agent 进程崩溃。runtime 要能把失败作为结构化事件交给上层策略处理，例如重试、换工具、压缩上下文后继续、或者向用户解释失败原因。

### 验证

新增测试 `tests/test_paperstorm_mcp_server.py`：

- `tools/list` 能返回注册工具 schema；
- `tools/call` 能调用注册工具；
- 未知工具返回结构化 JSON-RPC error；
- 默认工具注册表包含 `arxiv_search`。

测试过程按 TDD 做：

1. 先写测试；
2. 运行测试，确认因为 `paperstorm_mcp_server` 模块不存在而失败；
3. 再实现最小 server；
4. 重新运行测试通过；
5. 最后跑 PaperStorm 相关回归测试。

### 你应该学到什么

1. MCP 可以理解成“工具发现 + 工具调用 + 结构化协议”的组合。
2. Tool Schema 是静态描述，MCP server 是运行时入口。
3. Agent Harness 里工具系统至少要有 registry、schema、call dispatcher、error model。
4. stdio JSON-RPC 是很多本地工具协议的简单通信方式，适合做轻量集成。
5. 面向 Agent 的工具失败要结构化返回，不能只靠异常栈。

### 面试可以怎么讲

> 我在 PaperStorm 里做了一个最小 MCP-style stdio server。原本 PaperStorm 的检索器只是内部 Python 类，我先把它们抽象成 Tool Schema，然后通过 `tools/list` 暴露工具发现，通过 `tools/call` 统一调用 arXiv 和本地 PDF 检索。server 使用 JSON-RPC 风格响应，并把未知工具、参数错误、内部异常结构化返回。这个改动让我理解了 Agent Harness 里的工具注册、schema 描述、dispatcher、错误模型和 MCP 接入边界。

## 2026-07-21：PaperStorm Eval Harness v1

### 为什么做

Agent 不能只靠“看起来还不错”来判断效果。PaperStorm 已经有检索、生成、trace 和 MCP 工具入口，但还缺一个问题：

```text
这次 Agent 做得好不好？改完以后有没有真的变好？
```

如果没有评估系统，每次优化 query、retriever、prompt、trace 或工具调用，只能凭主观感受判断。Eval Harness 的目标是把一次 PaperStorm 运行变成可量化、可复盘、可比较的 scorecard。

### 本次改进

新增规则评估模块：

```text
knowledge_storm/paperstorm_eval.py
examples/storm_examples/evaluate_paperstorm_run.py
examples/storm_examples/paperstorm_eval_cases.json
tests/test_paperstorm_eval.py
```

评估脚本读取一次运行目录：

```text
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

第一版没有引入 LLM Judge，而是使用规则评分。原因是规则评估更稳定、便宜、可解释，也更适合先做工程闭环。

### 评分维度

当前总分 100 分，主要由这些部分组成：

- `task_completion`：是否有文章、大纲、检索结果、成功 summary；
- `retrieval_quality`：期望关键词覆盖率和来源数量；
- `offtopic_penalty`：跑题结果占比惩罚；
- `article_quality`：文章长度、关键词覆盖、中文比例；
- `runtime_observability`：是否有 trace、run_start/run_end、retrieval/tool 事件。

PIM case 中，正向关键词包括：

```text
passive intermodulation
intermodulation
RF
radio frequency
neural network
suppression
cancellation
```

负向关键词包括：

```text
processing-in-memory
DRAM
RAM
product information management
```

这样可以量化 “PIM 神经网络抑制” 是否被正确理解成无源互调，而不是跑到内存系统方向。

### 一个重要细节

跑题惩罚不是简单按负向关键词数量扣分，而是按“跑题结果占比”扣分。

原因：一篇 processing-in-memory 论文里可能同时出现 RAM、DRAM、processing-in-memory。如果按关键词重复扣分，一篇跑题结果就会被扣满，不利于衡量整体检索质量。因此 v1 使用：

```text
offtopic_penalty = 15 * 跑题结果数 / 检索结果数
```

这更符合检索评估里 precision / off-topic rate 的直觉。

### 如何运行

示例：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\evaluate_paperstorm_run.py `
  --run-dir .\results\paperstorm_zh\PIM `
  --case-file examples\storm_examples\paperstorm_eval_cases.json `
  --topic "pim 神经网络抑制"
```

运行后查看：

```text
scorecard.json
scorecard.md
```

### 验证

新增测试覆盖：

- 完整运行目录能得到较高分数；
- 缺少大纲、trace、检索结果时会被扣分；
- `scorecard.json` 和 `scorecard.md` 能正确写出；
- 跑题关键词会进入 `forbidden_hits`；
- 中文文章允许保留英文专业术语，不强行要求纯中文。

测试过程仍按 TDD：

1. 先写 `tests/test_paperstorm_eval.py`；
2. 运行测试，确认 `knowledge_storm.paperstorm_eval` 模块不存在；
3. 实现最小规则评分模块；
4. 发现跑题惩罚过粗，改成按跑题结果占比；
5. 调整中文比例测试，使其适配论文中英文术语混写。

### 你应该学到什么

1. Agent Eval 要结合任务定义，不能盲套通用 benchmark。
2. 论文调研 Agent 的评价要同时看检索、生成和运行链路。
3. 第一版 eval 不一定要 LLM Judge，规则指标更稳定可解释。
4. `expected_keywords` 和 `forbidden_keywords` 可以把领域知识注入评估。
5. Trace 不只是日志，也可以作为 benchmark 输入。
6. 评估指标本身也需要调试，不能让一个坏指标误导优化方向。

### 面试可以怎么讲

> 我给 PaperStorm 做了一个规则版 Eval Harness。它读取一次 Agent 运行产物，包括 raw_search_results、outline、polished article、paperstorm_trace 和 run_summary，然后输出 scorecard.json 与 scorecard.md。评分维度包括任务完成度、检索相关性、跑题率、文章可用性和 runtime 可观测性。比如 PIM 任务中，我把 passive intermodulation/RF/neural network 作为正向关键词，把 processing-in-memory/RAM/DRAM 作为负向关键词，用跑题结果占比量化检索偏题问题。这样每次改 retriever、prompt 或 tool runtime，都能通过 benchmark 判断是否真的变好。
