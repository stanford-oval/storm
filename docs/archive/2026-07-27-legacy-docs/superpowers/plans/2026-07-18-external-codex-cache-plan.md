# Codex 外部缓存迁移执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 清理 STORM 仓库根目录，将与 STORM 无关的 Codex 工作产物迁移到桌面固定缓存目录，并让全局 Codex 后续持续遵守该位置约定。

**架构：** `C:\Users\yzy\Desktop\codex` 是所有跨项目临时工作的固定根目录；本次内容进入带日期的 `storm-workspace-archive\2026-07-18` 子目录。项目级 `CLAUDE.md` 与全局 `C:\Users\yzy\.codex\AGENTS.md` 同时记录规则，分别约束当前仓库和后续 Codex 会话。

**技术栈：** PowerShell 文件系统操作、Markdown 指令文件、Git 忽略规则。

---

### 任务 1：更新书面归档规范

**文件：**
- 修改：`docs/superpowers/specs/2026-07-18-workspace-cache-design.md`

- [x] **步骤 1：把固定缓存位置改为桌面目录**

将缓存根目录改为 `C:\Users\yzy\Desktop\codex`，并明确只有与 STORM 无关的产物迁出仓库。

- [x] **步骤 2：复核规范**

运行：

```powershell
rg -n "\.codex-cache|TBD|TODO" docs/superpowers/specs/2026-07-18-workspace-cache-design.md
```

预期：没有旧缓存路径、占位符或待办项。

### 任务 2：迁移与 STORM 无关的副产物

**目录：**
- 创建：`C:\Users\yzy\Desktop\codex\storm-workspace-archive\2026-07-18\`
- 移动：GitHub、Overleaf、tracker 工作目录和根目录一次性辅助脚本

- [x] **步骤 1：创建分类目录**

创建 `github-work`、`overleaf-work`、`tracker-work`、`generated-build` 和 `helper-scripts`。

- [x] **步骤 2：逐项移动并防止覆盖**

只移动已盘点的非 STORM 目录和文件；如果目标已存在则停止，不覆盖旧归档。

- [x] **步骤 3：核对迁移结果**

确认源路径已不存在、目标路径存在，并确认 `results/minimax_zh/RAG/storm_gen_article_polished.txt` 仍在原处。

### 任务 3：持久化项目级与全局规则

**文件：**
- 修改：`CLAUDE.md`
- 创建或修改：`C:\Users\yzy\.codex\AGENTS.md`

- [x] **步骤 1：更新当前仓库规则**

在 `CLAUDE.md` 中说明非 STORM 临时任务必须使用 `C:\Users\yzy\Desktop\codex`，禁止在仓库根目录产生一次性工作目录。

- [x] **步骤 2：创建全局 Codex 规则**

在全局 `AGENTS.md` 中说明跨项目缓存、临时克隆、截图、验证副本和一次性脚本统一写入桌面 `codex` 目录；项目交付物仍放在项目内的正式位置。

- [x] **步骤 3：验证规则可读**

读取两个文件并确认固定路径完全一致。

### 任务 4：最终验证

**检查范围：**
- STORM 根目录
- 桌面归档目录
- Git 状态

- [x] **步骤 1：检查根目录**

确认 GitHub、Overleaf、tracker 辅助目录和一次性脚本不再位于仓库根目录。

- [x] **步骤 2：检查归档目录**

列出分类目录、文件数量和总大小，确认迁移完整。

- [x] **步骤 3：检查项目状态**

运行 `git status --short`，确认没有误移动已跟踪源码，并报告原有修改仍被保留。
