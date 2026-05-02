# Diagram Generator Skill

当用户提出嵌入式项目需求时，自动生成可视化图表（架构图、接线图、流程图）。

## 触发条件

用户描述项目需求时自动触发，或用户明确要求"生成图片"时触发。

## 输入

- `userMessage`: 用户的需求描述
- `projectPath`: 用户项目路径（可选）

## 输出

生成以下文件到 `<用户项目>/docs/diagrams/<项目名>/` 目录：

| 文件 | 格式 | 内容 |
|------|------|------|
| `architecture.mmd` | Mermaid | 系统架构图 |
| `wiring.html` | HTML+CSS | 硬件接线图（AI 可编辑） |
| `wiring_preview.html` | HTML | 浏览器预览版 |
| `flowchart.mmd` | Mermaid | 软件流程图 |

## 使用方式

用户说："我要实现一个声控开灯的项目"

AI 自动：
1. 分析需求中的硬件模块
2. 生成对应的图表文件
3. 展示给用户

## 示例输入

"我要实现一个声控开灯的项目"

## 示例输出

生成的图表展示：
- 系统架构：语音模块 → STM32 → 继电器 → 灯
- 硬件接线：STM32 引脚与各模块的连接
- 软件流程：录音 → 语音识别 → 指令解析 → 继电器控制

## 技术实现

- **Mermaid**：生成流程图、架构图（文本格式，AI 可改）
- **HTML+CSS**：生成接线图/原理图（带引脚标注）

## Handlers

| Handler | 职责 |
|---------|------|
| `architecture.js` | 生成系统架构图（Mermaid） |
| `wiring.js` | 生成硬件接线图（HTML） |
| `flowchart.js` | 生成软件流程图（Mermaid） |

## 保存路径

默认保存到用户当前项目的 `docs/diagrams/` 目录。