# Diagram Agent - 设计文档

## 概述

当用户提出嵌入式项目需求时（如"声控开灯"），自动生成可视化图表（架构图、接线图、流程图）帮助理解和实现项目。

## 架构

```
用户需求消息
      ↓
┌─────────────┐
│   Hook      │  拦截用户输入，检测"项目需求"关键词
│ (触发器)     │  触发 Agent
└─────────────┘
      ↓
┌─────────────┐
│   Agent     │  解析需求，决定生成哪些图，并行调度 subagent
│ (调度器)     │  ┌──────────┐ ┌──────────┐ ┌──────────┐
└─────────────┘  │ Subagent │ │ Subagent │ │ Subagent │
                 │架构图生成│ │接线图生成│ │流程图生成│
                 └──────────┘ └──────────┘ └──────────┘
                       ↓            ↓            ↓
                 ┌─────────────────────────────────────┐
                 │            Skill                     │
                 │   (Mermaid/HTML 图源码生成逻辑)       │
                 └─────────────────────────────────────┘
```

## 目录结构

```
diagram-agent/
├── skills/
│   └── diagram-generator/
│       ├── skill.md              # Skill 定义
│       └── handlers/
│           ├── architecture.js    # 架构图生成
│           ├── wiring.js         # 接线图生成
│           └── flowchart.js      # 流程图生成
├── hooks/
│   └── detect-project-hook.js   # 需求检测 Hook
├── agents/
│   └── diagram-agent.js         # 调度 Agent
└── docs/
    └── plans/
        └── 2026-05-01-diagram-design.md
```

## 分工职责

| 组件 | 角色 | 职责 |
|------|------|------|
| **Hook** | 触发器 | 监听用户消息，检测需求关键词（如"实现"、"项目"），启动 Agent |
| **Agent** | 调度器 | 解析需求，判断需要生成哪些图，并行调度 subagent |
| **Skill** | 执行器 | 图源码生成逻辑（Mermaid/HTML），文件保存 |

## 支持的图类型

| 图类型 | 格式 | 示例 |
|--------|------|------|
| 系统架构图 | Mermaid | 语音模块 → STM32 → 继电器 → 灯 |
| 硬件接线图 | HTML+CSS | STM32 引脚 ↔ 模块引脚标注 |
| 软件流程图 | Mermaid | 录音 → 识别 → 判断 → 控制 |
| 模块关系图 | Mermaid | 电源、输入、输出、外设 |

## 触发方式

- **自动触发**：用户描述项目需求时，AI 自动检测并生成
- **手动触发**：用户说"生成架构图"等明确指令

## 输出文件

```
<用户项目目录>/docs/diagrams/<项目名>/
├── architecture.mmd        # Mermaid 图源码
├── wiring.html             # 接线图源码（AI 可改）
├── wiring_preview.html    # 浏览器预览版
└── flowchart.mmd          # 流程图源码
```

## 技术栈

- **Mermaid**：生成流程图、架构图（文本格式，AI 可改）
- **HTML+CSS**：生成接线图/原理图（带引脚标注，AI 可改）
- **纯 JavaScript**：无外部依赖

## 触发关键词检测

Hook 检测以下模式：
- "实现一个 XXX 项目"
- "我要做 XXX"
- "帮我做一个 XXX"
- "新建项目"
- "项目需求"
- "帮我生成图片"

## 实现计划

1. **Hook**：`detect-project-hook.js` - 拦截用户消息，检测需求关键词
2. **Skill**：`diagram-generator/skill.md` - 定义生成逻辑
3. **Handler**：
   - `architecture.js` - 生成 Mermaid 架构图
   - `wiring.js` - 生成 HTML 接线图
   - `flowchart.js` - 生成 Mermaid 流程图
4. **Agent**：`diagram-agent.js` - 调度 subagent 并行生成

## 示例输出

用户输入："我要实现一个声控开灯的项目"

生成文件：
- `docs/diagrams/声控开灯/architecture.mmd`
- `docs/diagrams/声控开灯/wiring.html`
- `docs/diagrams/声控开灯/flowchart.mmd`
