# 工作区缓存归档规范

## 目标

保持 STORM 仓库根目录整洁，只存放项目源码、长期维护的文档、测试、配置和明确交付给用户的成果。Codex 工作过程中产生的临时文件统一放入一个可随时清理的位置。

## 固定缓存目录

今后所有与当前项目无关、由 Codex 产生的临时文件统一存放在：

```text
C:\Users\yzy\Desktop\codex\
```

该目录位于仓库之外，Master 可以定期清理。属于当前项目的正式交付物仍放在项目内的合适位置。

## 首次归档结构

```text
C:\Users\yzy\Desktop\codex\
└── storm-workspace-archive\2026-07-18\
    ├── storm-probes/
    ├── github-work/
    ├── overleaf-work/
    ├── tracker-work/
    ├── generated-build/
    └── helper-scripts/
```

各目录用途如下：

- `storm-probes/`：失败或仅用于诊断的 STORM 运行结果。
- `github-work/`：GitHub 审计、发布和认证过程产生的临时副本与输出。
- `overleaf-work/`：Overleaf 模板修改、上传和验证副本。
- `tracker-work/`：表格检查、截图和应用追踪器验证产物。
- `generated-build/`：安装或构建过程生成的包元数据。
- `helper-scripts/`：只为一次性操作编写的辅助脚本与行动计划。

## 移动范围

本次归档将移动以下与 STORM 无关的副产物：

- GitHub 审计、发布和认证相关的工作目录与辅助文件。
- Overleaf 模板验证副本。
- 应用追踪器检查结果和一次性处理脚本。
- Python 安装过程生成的包元数据。
- 其他仅服务于一次性任务的根目录辅助文件。

以下内容保留在当前项目位置：

- STORM 源码和示例代码。
- STORM 运行结果，包括诊断结果和成功报告。
- 测试与长期维护的开发文档。
- `CLAUDE.md` 和仓库配置文件。
- `results/minimax_zh/RAG/` 下成功生成的中文报告。
- `node_modules` 等正常的依赖目录。

## 长期维护规则

- 在项目 `CLAUDE.md` 和全局 Codex `AGENTS.md` 中加入工作区整洁规则，使后续会话继续遵守。
- 以后与当前项目无关的临时下载文件、截图、克隆仓库、预览文件和验证副本，必须从一开始就写入 `C:\Users\yzy\Desktop\codex\`。
- 明确交付给 Master 的成果应放入合适的项目目录，不得当作可删除缓存处理。
- 未经 Master 明确同意，不得把新的临时工作目录或一次性脚本放到仓库根目录。

## 执行后验证

归档完成后必须验证：

1. 成功生成的中文报告仍保留在原路径。
2. 源码、测试和长期维护文档没有被移动。
3. 所有归档分类均位于 `C:\Users\yzy\Desktop\codex\storm-workspace-archive\2026-07-18\` 下。
4. 仓库根目录不再残留本次列出的临时工作目录与一次性辅助脚本。
5. 项目级和全局 Codex 规则均记录了同一个固定缓存路径。
