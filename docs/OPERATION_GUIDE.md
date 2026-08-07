# PaperStorm Agent 操作规范

更新时间：2026-07-27

这份文档给 Codex / Claude Code / DeepSeek 接手项目时阅读，Master 不需要日常细看。目标是保证后续每次改动都可追踪、可验证、可回滚，不污染工作区。

## 1. 项目定位

当前项目建议统一称为：

```text
PaperStorm Agent
```

准确表述：

```text
基于 Stanford STORM 二次开发的中文论文调研 Agent，面向 RAG、Memory、Tool Calling、MCP、Multi-Agent 和 Agent Eval 方向持续演进。
```

禁止夸大：

- 不要说“从零实现 STORM”。
- 不要说“生产级 Agent 平台”，除非后续真的完成鉴权、队列、并发压测、监控告警和线上部署。
- 不要说“准确率提升 xx%”，除非有固定 benchmark 和前后对比数据。

## 2. 固定路径

主项目：

```text
D:\FILEEEEEEEEEEE\projects\storm
```

固定缓存和临时 worktree：

```text
C:\Users\yzy\Desktop\codex\
```

Nonlinear NN Agent 项目：

```text
D:\FILEEEEEEEEEEE\projects\nonlinear-nn-agent
```

面试经历汇总：

```text
C:\Users\yzy\Desktop\面经收集\面试经历汇总.md
```

简历工作区指导：

```text
C:\Users\yzy\Desktop\简历类\HITSZ_Resume\claude.md
```

## 3. Git 规则

远程：

```text
origin  https://github.com/stanford-oval/storm.git
fork    https://github.com/yzy-151/paperstorm-agent.git
```

规则：

- `origin` 是官方仓库，只拉取，不推送。
- `fork` 是 Master 的 fork，功能分支推这里。
- 主工作区经常是 dirty 状态，不要直接全量提交。
- 新功能优先从最新版本分支创建 worktree。
- 不要使用 `git reset --hard`。
- 不要使用 `git checkout -- .`。
- 不要把 `.agents/`、`.claude/`、`docs/superpowers/`、真实 API key、`results/` 运行产物混入提交。

每次开始工作先执行：

```powershell
cd D:\FILEEEEEEEEEEE\projects\storm
git status -sb
git remote -v
git branch --all --verbose --no-abbrev
```

如果网络 push 失败，可临时设置代理：

```powershell
$env:HTTP_PROXY='http://127.0.0.1:7890'
$env:HTTPS_PROXY='http://127.0.0.1:7890'
```

## 4. GitHub 仓库与分支规范

当前 GitHub fork 已改名为：

```text
https://github.com/yzy-151/paperstorm-agent
```

当前保留的 PaperStorm 主线分支：

```text
main
version/v0.1.2-docs-roadmap
version/v0.1.3-github-rename
feature/paperstorm-eval-harness
```

已删除的历史阶段远程分支：

```text
codex/minimax-agent-storm
feature/paperstorm-query-quality
feature/paperstorm-retrieval-quality
feature/paperstorm-runtime-tracing
feature/paperstorm-tool-schema
feature/paperstorm-mcp-server
```

已删除的 Stanford 官方继承远程分支：

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

后续 GitHub 上应只保留 PaperStorm Agent 相关分支。若再次出现无关分支，删除前仍需向 Master 列明分支名并获得确认。

## 5. 分支命名规范

后续每次功能更新都建新分支，带版本号：

```text
version/v0.2-memory-rag
version/v0.3-multi-agent
version/v0.4-knowledge-base
version/v0.5-frontend-demo
version/v1.0-agent-platform-demo
```

不要继续随意创建 `feature/xxx` 分支，除非只是很小的修复。版本型功能统一用 `version/`。

## 6. 文档维护规则

后续只维护三份核心文档：

```text
docs/OPERATION_GUIDE.md
docs/VERSION_PLAN.md
docs/RESUME_INTERVIEW_PLAN.md
```

职责：

- `OPERATION_GUIDE.md`：给 Agent 看的操作规范，Master 不需要细看。
- `VERSION_PLAN.md`：项目版本计划，每次迭代都维护。
- `RESUME_INTERVIEW_PLAN.md`：简历、投递、面试问答和项目介绍材料。

官方 README 保留为：

```text
README_STORM_OFFICIAL.md
```

当前项目 README 使用中文维护：

```text
README.md
```

## 7. 每次更新必须做什么

每次代码或文档有实质更新，必须同步维护：

1. `README.md`
   - 当前能力
   - 运行方式
   - 最新版本状态
   - 重要输出文件

2. `docs/VERSION_PLAN.md`
   - 当前版本完成了什么
   - 下一版本计划
   - 验收标准
   - 风险和未解决问题

3. `docs/RESUME_INTERVIEW_PLAN.md`
   - 新能力怎么写进简历
   - 面试可能怎么问
   - 应该怎么回答
   - 不该夸大的边界

## 8. 必跑测试

当前推荐回归：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m unittest `
  tests.test_paperstorm_eval `
  tests.test_paperstorm_mcp_server `
  tests.test_paperstorm_logging `
  tests.test_paperstorm_retrievers `
  tests.test_minimax_runtime_fixes -v
```

最近目标结果：

```text
Ran 38 tests
OK
```

语法检查：

```powershell
D:\SOFTWARE\spyder\envs\storm\python.exe -m py_compile `
  knowledge_storm\paperstorm_eval.py `
  knowledge_storm\paperstorm_tools.py `
  examples\storm_examples\evaluate_paperstorm_run.py `
  examples\storm_examples\paperstorm_mcp_server.py
```

## 9. 当前已有核心能力

已完成：

- DeepSeek / MiniMax 接入。
- arXiv 检索。
- 本地 PDF 检索。
- 中文输出。
- LLM query 清洗。
- PIM 缩写消歧。
- 空检索结果防护。
- Wikipedia 抓取降级。
- Runtime Trace / Hook 雏形。
- Tool Schema。
- MCP-style stdio server。
- Eval Harness v1。

## 10. GitHub 清理注意

远程已有较多分支。删除远程分支前必须先给 Master 列出：

- 建议保留分支。
- 建议删除分支。
- 删除理由。
- 是否已经合并进主线。

未经 Master 明确确认，不要执行：

```powershell
git push fork --delete <branch>
```

GitHub 仓库已按 Master 确认改名为：

```text
paperstorm-agent
```

## 11. 安全边界

- 不要写入真实 API key。
- 不要把 `run_config.json` 中的敏感字段恢复成明文。
- 不要提交 `results/` 中的大量运行产物。
- 临时数据和 smoke test 目录放到 `C:\Users\yzy\Desktop\codex\`。
- 文档可以写“计划支持”，但不能写成“已完成”。
