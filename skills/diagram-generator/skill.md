# Diagram Generator Skill

自动生成可视化图表（接线图编辑器、流程图、软件设计文档）。

## 触发条件

**本 skill 由 `requirements-master` 通过工作流链自动调用，或用户明确要求"生成图片"时触发。**

当用户描述嵌入式项目需求时，应由 `embedded-pipeline` 作为入口统一调度。

## 输入

- `userMessage`: 用户的需求描述
- `projectPath`: 用户项目路径（可选）
- `requirements`: requirements.json 数据（来自 requirements-master）

## 输出

生成以下文件到 `<用户项目>/docs/diagrams/<项目名>/` 目录：

| 文件 | 格式 | 内容 |
| ---- | ---- | ---- |
| `wiring_editor.html` | HTML | 交互式接线图编辑器（预填充模块，可拖拽编辑）★主要输出 |
| `wiring.html` | HTML | 静态接线图（可编辑表格） |
| `wiring_preview.html` | HTML | 接线图预览版 |
| `flowchart.html` | HTML | 软件流程图（含初始化 + 主循环双图渲染） |
| `software_design.md` | Markdown | 软件设计文档（模块架构、初始化、主循环、函数清单） |

## 使用方式

1. 读取 requirements.json（由 requirements-master 生成）
2. 调用 `agents/diagram-agent.js` 的 `main()` 函数
3. 生成 5 个文件，展示给用户确认

## 工作流链（强制指令）

**本 skill 是管道的第二步。完成后你必须：**

1. 展示生成的图表给用户确认
2. 等待用户确认后，提示用户连接硬件
3. 完成后调用 stm32_master 进行编译烧录

**禁止**：图表生成完成后跳过用户确认直接写代码。
