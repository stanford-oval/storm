# STORM MiniMax M3 调试与改进开发日志

最后更新时间：2026-07-18  
维护位置：`docs/storm-minimax-debug-devlog.md`  
相关入口：`examples/storm_examples/run_storm_wiki_minimax.py`

## 1. 背景

本轮目标不是简单“跑通 STORM”，而是把 STORM 当作一个完整 Agent 工程来学习和改进：

- 使用 MiniMax M3 作为 LLM 后端。
- 使用 DuckDuckGo / ddgs 作为免费检索后端。
- 跑通 STORM 的完整链路：`research -> outline -> article -> polish`。
- 让输出不只是机器中间态 JSON，而是一份可读的中文调研文档。
- 保证运行日志不泄露 API Key。

项目说明中明确指出，STORM 的完整成品文章需要开启：

```text
--do-research
--do-generate-outline
--do-generate-article
--do-polish-article
```

之前只跑了 `research + outline`，所以只有：

- `conversation_log.json`
- `raw_search_results.json`
- `storm_gen_outline.txt`

这些属于中间产物，不是最终可读报告。

## 2. 最终成功结果

最终成功生成的中文调研文档在：

```text
results/minimax_zh/RAG/storm_gen_article_polished.txt
```

对应目录：

```text
results/minimax_zh/RAG/
```

关键产物：

| 文件 | 含义 | 是否适合直接阅读 |
|---|---|---|
| `storm_gen_article_polished.txt` | 最终润色后的中文调研文档 | 是 |
| `storm_gen_article.txt` | 未润色正文草稿 | 可以参考 |
| `storm_gen_outline.txt` | 基于调研信息生成的大纲 | 可以参考 |
| `conversation_log.json` | Agent 调研对话日志 | 不适合直接阅读 |
| `raw_search_results.json` | 原始检索结果 | 不适合直接阅读 |
| `url_to_info.json` | 文章引用来源映射 | 用于核查引用 |
| `run_config.json` | 本次运行配置 | 已脱敏 |
| `llm_call_history.jsonl` | LLM 调用历史 | 调试用 |

最终核验结果：

```text
最终文章字符数: 3534
中文字符数: 2398
引用标记数量: 50
调研对话轮数: 2
检索结果数量: 18
回归测试: 8 tests OK
```

## 3. 排查主线总览

整体排查不是一次成功，而是沿着以下链路逐步定位：

```text
运行命令
  |
  v
脚本参数是否正确
  |
  v
MiniMax API 是否可调用
  |
  v
检索工具是否有结果
  |
  v
STORM 是否把检索结果传进 research
  |
  v
是否生成 outline
  |
  v
是否生成 article / polished article
  |
  v
输出文件是否 UTF-8 且可读
  |
  v
日志是否泄露 API Key
```

这条链路是后续排查 Agent 系统的通用方法：不要只看最后报错，要逐层确认数据是否流过边界。

## 4. 问题一：没有指定 STORM 阶段开关

### 现象

最早运行脚本时报错：

```text
AssertionError: No action is specified.
Please set at least one of --do-research, --do-generate-outline,
--do-generate-article, --do-polish-article
```

### 根因

`STORMWikiRunner.run()` 不会默认执行任何阶段，必须显式传入至少一个阶段开关。

### 解决方式

最小调研命令：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_storm_wiki_minimax.py `
  --output-dir ./results/minimax `
  --do-research `
  --do-generate-outline `
  --max-conv-turn 1 `
  --max-perspective 1 `
  --search-top-k 2 `
  --max-thread-num 1
```

完整文档命令：

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

## 5. 问题二：环境解释器不一致

### 现象

我第一次用默认 `python` 跑脚本时失败：

```text
ModuleNotFoundError: No module named 'knowledge_storm'
```

### 根因

默认 `python` 不是 Master 的 `storm` 环境。实际可用环境在：

```text
D:\SOFTWARE\spyder\envs\storm\python.exe
```

### 结果

后续所有工程运行和测试都改用该解释器，避免环境漂移。

## 6. 问题三：Pydantic warning 容易误判成失败

### 现象

运行中出现大量 warning：

```text
Pydantic serializer warnings
PydanticSerializationUnexpectedValue(...)
```

### 判断

这些不是致命错误。MiniMax 通过 LiteLLM 返回的响应结构和 Pydantic 预期字段不完全一致，但并未阻断 LLM 调用。

### 证据

即使 warning 存在，统计仍显示 LLM token 使用正常：

```text
openai/MiniMax-M3: {'prompt_tokens': ..., 'completion_tokens': ...}
```

### 结论

这类 warning 可以暂时忽略。真正判断成功与否，应看：

- 是否生成目标文件。
- `conversation_log.json` 是否有 `search_results`。
- `storm_gen_article_polished.txt` 是否存在且可读。

## 7. 问题四：调研阶段初次“跑完但没资料”

### 现象

早期 `results/minimax/rag/conversation_log.json` 中出现：

```text
Sorry, I cannot find information for this question.
search_results: []
```

同时：

```text
raw_search_results.json = {}
```

### 根因

LLM 调用是通的，但检索结果没有有效进入 STORM 的 `research` 阶段。

### 排查过程

先确认 MiniMax 是否正常生成 query：

```text
what does RAG stand for
RAG acronym meaning in AI
what is RAG retrieval augmented generation
```

再确认 DuckDuckGo / 检索层是否能单独返回结果。

### 失败尝试

1. 只改 `backend="auto"`。
2. 传入 `region` / `safesearch`。
3. 继续使用旧包 `duckduckgo_search`。

结果并不稳定，有时返回乱码页面，有时返回空结果。

### 最终修复

优先使用新版 `ddgs`，旧 `duckduckgo_search` 仅作为 fallback。

修改位置：

```text
knowledge_storm/rm.py
requirements.txt
```

关键变化：

```text
优先 import ddgs.DDGS
fallback 到 duckduckgo_search.DDGS
默认 backend 从 api 改为 auto
requirements.txt 加入 ddgs
```

### 额外环境处理

第一次安装 `ddgs` 后发现 pip 装到了：

```text
D:\Python-packages
```

但 `storm` 解释器的 `sys.path` 不包含该目录。于是显式安装到：

```text
D:\SOFTWARE\spyder\envs\storm\lib\site-packages
```

验证后：

```text
import ddgs 成功
Retriever 返回 6 条结果
```

## 8. 问题五：`run_config.json` 泄露 API Key

### 现象

`run_config.json` 中原样写入了：

```text
api_key
```

这是安全问题，即使文件只在本地，也不应该把 key 写进结果目录。

### 根因

`LMConfigs.log()` 直接返回每个 LM 的 `.kwargs`：

```python
getattr(self, attr_name).kwargs
```

而 `.kwargs` 中包含 `api_key`。

### 失败尝试

第一次脱敏规则过宽，把包含 `token` 的字段都脱敏，导致：

```text
max_tokens -> <redacted>
```

这属于误伤正常配置。

### 最终修复

在 `knowledge_storm/interface.py` 中递归脱敏明确凭证字段：

```text
api_key
apikey
access_token
refresh_token
secret
password
```

并保留正常配置，例如：

```text
max_tokens
temperature
top_p
api_base
```

### 旧结果处理

已批量脱敏旧的：

```text
results/**/run_config.json
```

最终检查：

```text
unredacted_secret_files 0
max_tokens_redacted_files 0
```

## 9. 问题六：`conversation_log.json` 可读性差

### 现象

Master 打开 `conversation_log.json` 后觉得可读性很差。

### 判断

这是正常的。`conversation_log.json` 是 STORM 的机器中间态，用于记录：

- persona
- writer question
- expert answer
- search query
- search results

它不是最终报告。

### 正确理解

STORM 的产物分层如下：

```text
conversation_log.json
  调研过程日志，给程序和开发者看

storm_gen_outline.txt
  大纲

storm_gen_article.txt
  正文草稿

storm_gen_article_polished.txt
  最终可读文章
```

### 结果

后续改为完整跑四阶段，最终产出：

```text
results/minimax_zh/RAG/storm_gen_article_polished.txt
```

## 10. 问题七：中文 topic 被清洗掉

### 现象

原脚本中有：

```python
sanitized_topic = sanitize_topic(topic)
runner.run(topic=sanitized_topic, ...)
```

`sanitize_topic()` 只保留：

```text
a-z A-Z 0-9 _ -
```

如果输入中文主题，中文会被删掉，甚至变成：

```text
unnamed_topic
```

### 根因

脚本把“文件夹名清洗逻辑”和“模型研究主题”混为一谈。

### 最终修复

新增：

```python
get_topic_for_storm(topic, output_language="original")
get_output_dir_name(topic)
strip_invalid_unicode(text)
```

职责拆分：

```text
topic_for_storm
  给模型看的真实研究主题，可包含中文和输出语言要求

output_dir_name
  给文件系统用的安全目录名
```

### 重点理解

这三个函数不是“用不同方法从 topic 里返回同一种内容”，而是把 topic 的不同使用场景拆开：

| 函数 | 面向对象 | 是否允许中文 | 是否允许模型指令 | 作用 |
|---|---|---:|---:|---|
| `get_topic_for_storm()` | LLM / STORM pipeline | 是 | 是 | 生成给模型看的真实研究任务 |
| `get_output_dir_name()` | Windows 文件系统 | 否 | 否 | 生成安全、稳定的输出目录名 |
| `strip_invalid_unicode()` | HTTP JSON / UTF-8 编码链路 | 不负责语言判断 | 不负责指令判断 | 删除无法 UTF-8 编码的孤立 surrogate |

例如：

```python
topic_for_storm = get_topic_for_storm("RAG", output_language="zh")
output_dir_name = get_output_dir_name("RAG")
```

结果不是“一个返回英文、一个返回中文”，而是：

```text
topic_for_storm
  RAG + 一段要求模型用简体中文输出的英文控制指令

output_dir_name
  RAG
```

关键点：

```text
模型输入可以复杂
文件夹名必须简单
HTTP 请求文本必须能 UTF-8 编码
```

## 11. 问题八：中文终端输入触发 surrogate 编码错误

### 现象

通过管道传中文主题时，LiteLLM / httpx 报错：

```text
UnicodeEncodeError:
'utf-8' codec can't encode characters ... surrogates not allowed
```

### 根因

中文字符串经当前终端管道进入 Python / LiteLLM 时，混入了孤立 surrogate 字符。HTTP JSON 请求必须能 UTF-8 编码，因此失败。

### 失败方式

直接这样传中文：

```powershell
"RAG：检索增强生成，请用中文撰写..." | python run_storm_wiki_minimax.py ...
```

### 最终修复

1. 新增 `--topic` 参数，避免通过终端管道传中文。
2. 新增 `--output-language zh` 参数，让脚本用稳定的英文控制指令要求模型输出简体中文。
3. 新增 `strip_invalid_unicode()`，移除孤立 surrogate 字符。

### 重点理解

这里不是简单“加三个参数就支持中文终端”，而是把中文输入风险从不稳定链路里移走。

原失败链路：

```text
PowerShell / MINGW 管道中文
  -> Python stdin
  -> LiteLLM
  -> httpx JSON body
  -> UTF-8 编码失败
```

最终成功链路：

```text
--topic RAG
  避免从管道传复杂中文

--output-language zh
  在 Python 内部追加稳定英文指令，让模型输出中文

strip_invalid_unicode()
  在入口处清理非法 surrogate，防止 HTTP 请求失败
```

所以这个修复的本质是：

```text
不要依赖终端管道承载长中文 prompt
用结构化参数表达“主题”和“输出语言”
在进入 LLM 请求前清理编码非法字符
```

最终命令：

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

## 12. 问题九：输出目录名混入模型指令

### 现象

加入中文输出指令后，STORM 用完整 topic 创建目录，导致 Windows 报错：

```text
WinError 123 文件名、目录名或卷标语法不正确
```

目录名里包含了换行和整段模型指令：

```text
RAG\n\nWrite all research answers...
```

### 根因

`STORMWikiRunner.run()` 原本用 `topic` 同时承担两个职责：

```text
给模型看的研究主题
给文件系统用的目录名
```

这在原作者的默认英文 Wiki 主题场景下通常不会出问题，例如：

```text
Computer vision
Albert Einstein
Retrieval-augmented generation
```

这些 topic 既能作为模型主题，也基本能被清洗成目录名。

但我们加入 `--output-language zh` 后，代码会把模型控制指令追加到 topic：

```text
RAG

Write all research answers, outlines, the final article, and the polished article in Simplified Chinese...
```

如果继续把这个完整字符串用于目录名，就会把换行和整段 prompt 指令也放进路径里，最终触发 Windows 文件名错误。

这不是 Master 额外输入了奇怪内容，而是脚本为了控制模型输出语言，主动把指令拼进了给模型看的 topic；问题出在原来的目录逻辑仍然复用了同一个 topic。

### 最终修复

给 `STORMWikiRunner.run()` 增加可选参数：

```python
output_dir_name: str = None
```

目录名逻辑改为：

```python
article_dir_source = output_dir_name or topic
```

MiniMax 示例脚本传入：

```python
runner.run(topic=topic_for_storm, output_dir_name=output_dir_name, ...)
```

结果：

```text
模型收到中文输出指令
文件夹仍安全命名为 RAG
```

### 重点理解

这次修复不是单纯“过滤特殊字符”，而是改了职责边界：

```text
topic
  用户输入的原始主题

topic_for_storm
  模型看到的完整任务，可包含输出语言要求

output_dir_name
  文件系统看到的安全目录名
```

原作者并不是“没想到输入 topic 后还会多输入东西”，而是默认 topic 就是干净的百科条目名称。我们把 STORM 改造成中文 Deep Research Agent 后，topic 承载了更多 prompt 控制信息，因此必须显式拆分。

这个问题对 Agent 工程很重要：用户任务、模型指令、文件路径、日志字段不能长期混用同一个字符串。短期看省事，后期一定会在编码、路径、安全或可读性上出问题。

## 13. 问题十：MiniMax 生成空 query，ddgs 报错

### 现象

完整运行时 `ddgs` 报：

```text
DDGSException: query is mandatory.
```

随后 backoff 的 `giveup_hdlr` 又报：

```text
'DDGSException' object has no attribute 'message'
```

### 根因

MiniMax 生成的 query 列表中包含空行或只有符号的行，原代码没有过滤，直接传给检索器。

原逻辑：

```python
queries = [
    q.replace("-", "").strip().strip('"').strip('"').strip()
    for q in queries.split("\n")
]
queries = queries[: self.max_search_queries]
```

如果其中有空字符串，就会进入检索。

### 重点理解

这里不是“遇到空行就检索上一个 query”，而是空行被处理成了一个独立的空字符串 query。

原设计期望模型稳定输出：

```text
- query 1
- query 2
- query 3
```

因此代码选择了最直接的解析方式：

```text
按换行 split
去掉项目符号 -
去掉前后空白和引号
取前 max_search_queries 条
```

但 LLM 的输出不是严格结构化数据，实际可能变成：

```text
- RAG 原理
-
  
- vector database
```

旧逻辑处理后得到：

```python
["RAG 原理", "", "", "vector database"]
```

随后 `list(set(queries))` 只负责去重，不负责删除空字符串，所以 `""` 仍可能被传给检索器。`ddgs` 收到空 query 后会认为参数非法，于是报：

```text
DDGSException: query is mandatory.
```

严格说，这是一个 LLM 工程鲁棒性缺陷。原作者的默认假设是模型会遵守 `- query` 格式，在英文主题和原始 provider 下可能很少触发；但 Agent 系统不能默认相信 LLM 生成的工具参数。凡是要交给外部工具执行的内容，都应该先做空值、长度、格式和业务约束检查。

### 最终修复

新增：

```python
clean_search_queries(queries: str, max_search_queries: int) -> List[str]
```

行为：

- 去掉 `-`
- strip 空白和引号
- 过滤空 query
- 达到 `max_search_queries` 后停止

接入位置：

```text
knowledge_storm/storm_wiki/modules/knowledge_curation.py
```

修复后的关键差异是“先判断有效，再计数”：

```text
旧逻辑
  空行也会占用 max_search_queries 名额，并可能进入检索

新逻辑
  只有非空 query 才加入列表，也只有有效 query 才计入 max_search_queries
```

同样的输入：

```text
- RAG 原理
-
  
- vector database
```

现在会得到：

```python
["RAG 原理", "vector database"]
```

## 14. 问题十一：中文最终文章不是 UTF-8

### 现象

完整生成后，`storm_gen_article_polished.txt` 在终端/VSCode 中显示乱码。

进一步用 Python 读取：

```python
Path(...).read_text(encoding="utf-8")
```

报错：

```text
UnicodeDecodeError: 'utf-8' codec can't decode byte ...
```

### 根因

`FileIOHelper.write_str()` 未指定 encoding：

```python
with open(path, "w") as f:
    f.write(s)
```

在 Windows 上会使用本地默认编码，而不是 UTF-8。

### 最终修复

修改：

```python
def write_str(s, path, encoding="utf-8"):
    with open(path, "w", encoding=encoding) as f:
        f.write(s)

def load_str(path, encoding="utf-8"):
    with open(path, "r", encoding=encoding) as f:
        return "\n".join(f.readlines())
```

同时 `llm_call_history.jsonl` 写入也指定：

```python
encoding="utf-8"
```

### 已生成文件处理

已经把本次生成的 `.txt` 文件从本地编码转换为 UTF-8：

```text
direct_gen_outline.txt
storm_gen_article.txt
storm_gen_article_polished.txt
storm_gen_outline.txt
```

最终 UTF-8 读取成功。

## 15. 测试与验证

新增回归测试文件：

```text
tests/test_minimax_runtime_fixes.py
```

覆盖内容：

| 测试 | 目的 |
|---|---|
| `test_lm_config_log_redacts_api_credentials` | 确认 API Key 脱敏，正常参数保留 |
| `test_duckduckgo_forward_accepts_modern_text_results` | 确认检索结果格式可解析 |
| `test_minimax_example_keeps_original_topic_for_storm_by_default` | 确认默认不破坏原始 topic |
| `test_minimax_example_can_request_simplified_chinese_output` | 确认可请求简体中文输出 |
| `test_strip_invalid_unicode_removes_surrogates` | 确认非法 Unicode 被清理 |
| `test_minimax_example_uses_safe_output_dir_name` | 确认模型主题和目录名分离 |
| `test_clean_search_queries_removes_empty_queries` | 确认空 query 被过滤 |
| `test_write_str_uses_utf8` | 确认文本输出是 UTF-8 |

最终测试命令：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest tests.test_minimax_runtime_fixes -v
```

最终结果：

```text
Ran 8 tests
OK
```

## 16. 本轮改动文件

本轮核心改动涉及：

```text
examples/storm_examples/run_storm_wiki_minimax.py
knowledge_storm/interface.py
knowledge_storm/rm.py
knowledge_storm/storm_wiki/engine.py
knowledge_storm/storm_wiki/modules/knowledge_curation.py
knowledge_storm/utils.py
requirements.txt
tests/test_minimax_runtime_fixes.py
```

说明：

- `knowledge_storm/lm.py` 和 `examples/storm_examples/README.md` 在工作区中也显示有改动，但其中大部分不是本轮最后修复链路的核心新增点；后续提交前需要单独 review。
- `results/` 目录中有多次调试运行产物，最终推荐阅读 `results/minimax_zh/RAG/storm_gen_article_polished.txt`。

## 17. 最终成功路径

最终成功不是靠单点修复，而是靠把 STORM 的几个边界理顺：

```text
环境边界
  使用 D:\SOFTWARE\spyder\envs\storm\python.exe

参数边界
  显式开启四阶段

模型边界
  MiniMax M3 通过 LitellmModel 调用

检索边界
  ddgs 返回可用搜索结果

主题边界
  模型 topic 与输出目录名分离

语言边界
  --output-language zh 统一要求中文输出

文件边界
  所有文本输出用 UTF-8

安全边界
  run_config.json 不写明文 API Key
```

最终生成命令：

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

最终阅读文件：

```text
results/minimax_zh/RAG/storm_gen_article_polished.txt
```

## 18. 后续维护建议

### 每次运行后检查

1. `conversation_log.json` 中 `search_results` 是否非空。
2. `raw_search_results.json` 是否不是 `{}`。
3. `storm_gen_article_polished.txt` 是否存在。
4. `storm_gen_article_polished.txt` 是否能按 UTF-8 打开。
5. `run_config.json` 是否没有明文 key。

### 如果要换主题

推荐命令格式：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe examples\storm_examples\run_storm_wiki_minimax.py `
  --topic "你的主题" `
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

### 如果检索又为空

优先排查：

1. `ddgs` 是否能 import。
2. `DuckDuckGoSearchRM.forward()` 是否单独返回结果。
3. MiniMax 生成的 query 是否为空或格式怪异。
4. 网络是否能访问搜索后端。

### 如果输出又乱码

优先检查：

```python
Path("storm_gen_article_polished.txt").read_text(encoding="utf-8")
```

如果失败，说明某处又绕过了 `FileIOHelper.write_str()` 或未指定 `encoding="utf-8"`。

## 19. 对 Agent 工程学习的启发

这次排查对应了一个完整 Agent 系统常见的工程边界：

```text
LLM 不是全部
检索不是全部
运行成功也不是全部
最终用户需要的是可读产物
```

对后续 paper-agent 项目，建议复用这些设计原则：

- LLM 调用层独立封装。
- Tool / Retriever 有统一输入输出格式。
- 中间态和最终态分开保存。
- 配置日志必须脱敏。
- 文件输出统一 UTF-8。
- topic、prompt 指令、文件名三者不要混用。
- 对 LLM 生成的工具输入做严格清洗。
- 每次修 bug 都补一个最小回归测试。

## 20. 维护记录模板

后续继续追加时，可以按这个格式写：

```markdown
## YYYY-MM-DD 主题

### 现象

### 根因

### 尝试过的方法

### 失败原因

### 最终修复

### 验证命令

### 验证结果

### 后续注意
```
