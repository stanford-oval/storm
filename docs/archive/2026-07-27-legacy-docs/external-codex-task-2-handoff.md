# 给另一个工作区 Codex 的任务 2 交接说明

日期：2026-07-18

## 背景

当前工作区：

```text
D:\FILEEEEEEEEEEE\projects\storm
```

这是 Stanford STORM 的本地二次开发版本。已有改造包括 MiniMax M3 接入、ddgs/DuckDuckGo 检索适配、中文输出、配置脱敏、空 query 过滤、UTF-8 输出和 8 个 unittest 回归测试。

请不要把它当成从零项目，也不要重写主流程。任务 2 的目标是把现有命令行 Deep Research pipeline 扩展成更像 Agent 开发岗项目的工程形态。

## 任务 2 目标

建设一个最小可用的服务化 Agent 层：

```text
FastAPI Research Agent API
```

必须支持：

- 提交研究任务，返回 `task_id`。
- 查询任务状态：queued / running / succeeded / failed。
- 保存每次任务的输入、配置、阶段状态、错误信息和输出路径。
- 支持读取最终报告。
- 不把 API key 写入任务状态或日志。

先不要做复杂前端，先把后端 API 和测试做扎实。

## 建议文件结构

在现有仓库中新建：

```text
knowledge_storm/service/
  __init__.py
  schemas.py
  task_store.py
  research_service.py
  app.py

tests/
  test_research_service_api.py
```

职责：

- `schemas.py`：Pydantic 请求/响应模型。
- `task_store.py`：本地 JSON 文件任务状态存储，先不用数据库。
- `research_service.py`：封装调用现有 STORM runner 的服务逻辑。
- `app.py`：FastAPI 路由。
- `test_research_service_api.py`：用 `TestClient` 测 API 行为。

## API 设计

### 创建任务

```http
POST /research-tasks
```

请求：

```json
{
  "topic": "RAG",
  "output_language": "zh",
  "max_conv_turn": 1,
  "max_perspective": 2,
  "search_top_k": 3
}
```

响应：

```json
{
  "task_id": "20260718-xxxxxx",
  "status": "queued"
}
```

### 查询任务状态

```http
GET /research-tasks/{task_id}
```

响应：

```json
{
  "task_id": "20260718-xxxxxx",
  "status": "succeeded",
  "topic": "RAG",
  "output_language": "zh",
  "output_dir": "results/service/20260718-xxxxxx",
  "article_path": "results/service/20260718-xxxxxx/RAG/storm_gen_article_polished.txt",
  "error": null
}
```

### 读取报告

```http
GET /research-tasks/{task_id}/article
```

响应：

```json
{
  "task_id": "20260718-xxxxxx",
  "article": "..."
}
```

## 实现边界

第一版允许同步执行，即 POST 后直接跑任务并返回最终状态；如果运行时间太长，再改后台线程。

第一版不要求：

- 登录鉴权。
- 多用户。
- 数据库。
- Web 前端。
- 分布式队列。
- LangGraph 重写。

## 测试要求

必须先写测试，再实现。

建议测试：

1. `POST /research-tasks` 能创建任务并落盘状态。
2. `GET /research-tasks/{task_id}` 能返回状态。
3. `GET /research-tasks/{task_id}/article` 在报告存在时返回文本。
4. 错误任务不会泄露 `MINIMAX_API_KEY`。
5. `topic` 中含中文或非法文件名字符时，状态文件仍可正常保存。

测试不要真实调用 MiniMax。用 fake runner 或 monkeypatch 模拟生成文章。

## 必跑命令

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest tests.test_minimax_runtime_fixes -v
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest tests.test_research_service_api -v
```

## 简历目标

任务 2 完成后，简历可以从“脚本级二次开发”升级为：

```text
将命令行 Deep Research pipeline 服务化为 FastAPI Agent API，支持任务提交、状态追踪、报告读取、错误记录和敏感配置脱敏；通过 fake runner 解耦外部 LLM 调用，补充 API 层回归测试。
```

## 注意事项

- 不要提交 `secrets.toml`、`results/`、真实 API key。
- 不要删除当前未提交修改。
- 不要声称提升准确率，除非补了评测。
- 如果要公开 GitHub，先确认 `.gitignore` 覆盖敏感文件和运行产物。

