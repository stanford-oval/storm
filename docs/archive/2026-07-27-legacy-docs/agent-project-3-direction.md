# 第三个 Agent 项目方向：面向通信/无线算法资料的 Research-to-Experiment Agent

日期：2026-07-18

## 结论

第三个项目建议做：

```text
Wireless Paper-to-Simulation Agent
```

中文定位：

```text
面向通信论文和算法实验复现的 Agent：读取论文/笔记，抽取问题定义、系统模型、关键公式、实验参数，生成可执行的 MATLAB/Python 仿真骨架，并输出复现实验 checklist。
```

这个方向比泛泛做“聊天 Agent”更适合你，因为它同时利用了三类资产：

- 你的通信算法背景。
- 你正在转向 Agent 开发的工程目标。
- 你简历里需要一个能解释“AI + 通信交叉”的项目。

## 面向什么需求

目标用户不是普通聊天用户，而是通信算法工程师、研究生、算法实习生。

核心痛点：

1. 看论文慢：系统模型、变量、约束、公式散在不同章节。
2. 复现实验难：论文里参数不完整，仿真步骤不清楚。
3. MATLAB/Python 起步成本高：先搭信道、噪声、指标、循环，再验证曲线。
4. 结果不可追踪：不知道某个图对应哪些参数、哪版代码、哪次运行。

## 第一版功能

第一版不要做大而全平台，只做一个清晰闭环：

```text
PDF/Markdown 输入
  -> 结构化抽取
  -> 公式/变量/参数表
  -> 仿真计划
  -> 代码骨架
  -> 复现 checklist
```

必须有的功能：

- 上传或指定论文 PDF / Markdown。
- 抽取 title、problem、system model、assumptions、metrics。
- 抽取变量表：符号、含义、单位、默认值、来源页码。
- 生成实验配置 YAML。
- 生成 MATLAB 或 Python 仿真骨架。
- 给出“还缺哪些参数”的列表，不能假装论文信息完整。
- 输出引用页码，方便人工核查。

## 技术实现建议

第一版技术栈：

```text
Python
FastAPI
pdfplumber / pymupdf
Pydantic
LangGraph 或轻量状态机
YAML config
pytest
```

状态节点：

```text
ingest_document
extract_sections
extract_symbols
extract_experiment_plan
generate_code_skeleton
validate_missing_fields
write_report
```

不要第一版就接复杂公式 OCR。先处理可复制文本的 PDF 和 Markdown。

## 最小样例任务

用一个通信主题做 demo，例如：

```text
OFDM 信道估计
MIMO precoding
FDD massive MIMO CSI feedback
PIM suppression
```

建议优先选择与你当前研究更接近的：

```text
FDD / PIM suppression / wireless interference mitigation
```

这样面试时能自然解释为什么你能判断 Agent 输出对不对。

## 简历包装

可写：

```text
设计 Wireless Paper-to-Simulation Agent，面向通信算法论文复现实验，构建 PDF 解析、章节抽取、变量表生成、实验 YAML 配置、MATLAB/Python 仿真骨架生成和缺失参数校验流程。

使用 Pydantic 约束 Agent 结构化输出，保留页码引用和缺失字段列表，避免 LLM 编造实验参数；通过 pytest 覆盖变量抽取、配置生成和代码骨架生成等核心模块。
```

如果后续做出 Web/API：

```text
通过 FastAPI 暴露论文解析与复现实验规划接口，支持任务状态追踪、报告下载和代码骨架导出，形成通信算法研发场景下的垂直 Agent demo。
```

## 为什么这个比普通 Agent 更适合你

普通 Agent 项目容易同质化：RAG 聊天、知识库问答、网页总结，面试官很难判断你的壁垒。

这个项目的壁垒更明确：

- 需求来自真实通信算法学习和科研流程。
- 输出不是聊天，而是变量表、实验配置、代码骨架、缺失参数。
- 能体现你知道 Agent 不能乱编，必须有引用、结构约束和人工校验。
- 能和 Huawei 通信算法、AI for Network、Agent 平台岗位同时关联。

## 开发顺序

1. 先用 Markdown 论文笔记输入，做结构化抽取，不碰 PDF 复杂解析。
2. 加 PDF 文本解析和页码引用。
3. 生成 YAML 实验配置。
4. 生成 MATLAB/Python 仿真骨架。
5. 加缺失参数检查。
6. 加 FastAPI。
7. 加 2 到 3 个固定论文/笔记 benchmark。

第一版验收标准：

- 输入一份论文笔记。
- 输出变量表、实验计划、YAML、代码骨架、缺失参数列表。
- 所有输出可追溯到原文段落或页码。
- 不真实调用昂贵模型时，核心解析逻辑仍能用 fake LLM 测试。

