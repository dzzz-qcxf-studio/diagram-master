# Diagram Agent

当用户提出嵌入式项目需求时（如"声控开灯"），自动生成可视化图表帮助理解和实现项目。

## 触发规则（最高优先级，必须严格执行）

当用户的输入**匹配以下任意模式**时，你必须立即启动完整工作流管道，不得跳过任何阶段：

### 触发模式

- 描述嵌入式项目需求："我要做个声控灯"、"用STM32做温度报警器"、"帮我分析一下智能浇花系统"
- 要求生成图表："生成架构图"、"帮我画接线图"、"生成流程图"
- 要求继续流程："继续"、"下一步"、"进入下一阶段"

### 管道执行协议（严格按顺序，不可跳步）

```
Step 1: Skill('embedded-pipeline')   ← 管线管理入口（确保管道连贯）
  → requirements-master              ← 需求分析 + 用户确认
  → diagram-master                   ← 图表生成
  → stm32_master                     ← 编译烧录
```

### 关键规则

1. **检测到嵌入式项目需求时** → 立即调用 `Skill('embedded-pipeline')`，不要自己写计划、不要直接写代码
2. **embedded-pipeline 会自动串联** requirements-master → diagram-master → stm32_master
3. **用户说"继续"时** → 检查 workflow-state.json，从当前阶段继续
4. **任何时候都不要跳过阶段** — 不要从"我要做个声控灯"直接跳到写代码

## 目录结构

```
diagram-master/
├── index.js                          # 主入口
├── orchestrator.js                   # 工作流编排器（专家团编排、Dev-QA Loop、断点续跑）
├── config.json                       # 用户配置（输出目录等）
├── skills/
│   └── diagram-generator/
│       ├── skill.md                  # Skill 定义
│       ├── wiring-editor.html        # 交互式接线图编辑器模板
│       └── handlers/
│           ├── wiring.js             # 硬件接线图 + 编辑器生成（HTML）
│           ├── flowchart.js          # 软件流程图生成（HTML，含 Mermaid 渲染）
│           └── software_design.js    # 软件设计文档生成（Markdown）
├── hooks/
│   └── detect-project-hook.js        # 需求检测 Hook
├── agents/
│   ├── diagram-agent.js              # 调度 Agent
│   └── personas/                     # 专家人格定义
│       ├── embedded-firmware-engineer.md  # 嵌入式固件工程师
│       ├── code-reviewer.md               # 代码审查员
│       └── technical-writer.md            # 技术文档工程师
└── tests/                            # 测试用例（84 个）
```

独立 skill（`~/.claude/skills/requirements-master/`）：

```text
requirements-master/
├── SKILL.md                          # Skill 定义（含 AskUserQuestion 集成）
├── index.js                          # API 入口
├── prompt.js                         # AI 推理提示词
└── parser.js                         # 需求解析器（支持结构化选项格式）
```

独立 skill（`~/.claude/skills/embedded-pipeline/`）：

```text
embedded-pipeline/
└── SKILL.md                          # 管线管理入口（串联三个阶段，确保管道不中断）
```

## 触发方式

### 自动触发（需配置 Hook）

在 `settings.json` 中配置 Hook：

```json
{
  "hooks": {
    "onUserMessage": [
      {
        "name": "detect-project-hook",
        "description": "检测项目需求并触发图表生成",
        "scriptPath": "C:/Users/ROG/.claude/skills/diagram-master/hooks/detect-project-hook.js"
      }
    ]
  }
}
```

### 手动触发

用户说："生成架构图" 或 "帮我生成图片" 等明确指令。

## 使用示例

用户输入：
```
我要实现一个声控开灯的项目
```

AI 自动生成，输出到 config.json 中指定的目录（默认 `C:/Users/ROG/Desktop/WORK/嵌入式大师工作流/`），按项目名分子目录：

```text
<outputDir>/声控开灯/
├── requirements.json       # 结构化需求数据
├── requirements.md         # 人类可读需求文档
├── wiring_editor.html      # 交互式接线图编辑器（预填充模块，可拖拽编辑）★主要输出
├── wiring.html             # 静态接线图（HTML，可编辑表格）
├── wiring_preview.html     # 接线图预览版
├── flowchart.html          # 软件流程图（HTML，含初始化 + 主循环双图渲染）
└── software_design.md      # 软件设计文档（模块架构、初始化、主循环、函数清单）
```

## 生成的图表

### 1. 交互式接线图编辑器 (wiring_editor.html) ★主要输出

完整的可视化编辑器，包含：
- 模块库侧边栏（MCU/输入/输出/通信/辅助元件五大类，30+ 模块）
- **辅助元件**：电阻（R）、N-MOSFET 等，以 SVG 电路符号紧凑显示
- 拖拽放置模块到画布，支持网格吸附（20px）
- 点击引脚自动连线，SVG 贝塞尔曲线渲染
- 撤销/重做（Ctrl+Z/Y），最多 50 步历史
- 连线验证（GND-GND、电源-信号检查）
- 属性面板（可编辑模块名、位置、引脚值）
- 接线总览面板（所有连接一目了然）
- 导出为 HTML / Mermaid / JSON / Markdown
- 离线可用（无外部依赖）
- 预填充：根据 requirements.json 自动放置模块并连线
- **自动检测辅助元件**：从 outputs 的 `note` 字段检测电阻/MOSFET 需求，自动创建紧凑模块并连线

主题：oklch 黑白蓝（hue 260），支持明暗切换

### 2. 软件流程图 (flowchart.html)

HTML 页面，内含两个 Mermaid 渲染的流程图：
- **初始化流程**：时钟配置 → GPIO 初始化 → 外设初始化（SPI/I2C/UART/ADC）→ 模块初始化
- **主循环流程**：读取输入 → 条件判断 → 执行动作 → 循环

从 requirements.json 的 scenarios 和 inputs/outputs 自动生成决策逻辑。

主题：oklch 黑白蓝（hue 260），与编辑器一致

### 3. 软件设计文档 (software_design.md)

Markdown 格式，包含：
- 模块架构表（软件模块 → 对应硬件 → 职责）
- 初始化顺序（带接口细节）
- 主循环伪代码
- 关键函数清单（函数名、文件、说明）
- 中断处理表
- 数据结构定义
- 推荐文件结构

## 完整工作流（专家团模式）

```
用户想法
  → embedded-pipeline（管线管理：确保管道连贯，不跳步）
    → Phase 1: 需求工程师（需求澄清 + AskUserQuestion）
    → Phase 2: 图表生成（接线图编辑器 + 流程图 + 软件设计文档）
    → Phase 3: 专家团 Dev-QA Loop
        3a: 嵌入式固件工程师（写代码）
        3b: 代码审查员（质量门控，FAIL → 回到 3a，最多 3 次）
        3c: 技术文档工程师（生成项目文档）
    → stm32_master（编译烧录）
```

### 专家团

| 角色 | 人格文件 | 介入时机 | 职责 |
| ---- | -------- | -------- | ---- |
| 需求工程师 | requirements-master (独立 skill) | Phase 1 | 需求分析、用户确认、输出 requirements.json |
| 嵌入式固件工程师 | `personas/embedded-firmware-engineer.md` | Phase 3a | 基于 requirements + software_design 编写 STM32 代码 |
| 代码审查员 | `personas/code-reviewer.md` | Phase 3b | 审查代码正确性/安全性/可维护性，三级标记（阻塞/建议/瑕疵） |
| 技术文档工程师 | `personas/technical-writer.md` | Phase 3c | 生成 README、接线说明、引脚对照表、调试指南 |

### Phase 1: 需求澄清（需求工程师）

- AI 内部推理 2 轮，通过 `AskUserQuestion` 向用户提 2-3 个关键问题（带具体选项）
- 输出 `requirements.md` + `requirements.json`

### Phase 2: 图表生成（diagram-master，编辑器优先）

- 接收 requirements.json
- **首先**生成交互式接线图编辑器（wiring_editor.html），预填充模块和连线
- **然后**生成流程图和软件设计文档
- 用户在编辑器中调整接线方案，导出确认

### Phase 3: 固件开发（专家团 Dev-QA Loop）

- **3a** — 嵌入式固件工程师读取 requirements.json + software_design.md，编写固件代码
- **3b** — 代码审查员审查，输出 PASS/FAIL/CONDITIONAL_PASS
  - PASS → 进入 3c
  - FAIL → 回到 3a（附带审查反馈），最多重试 3 次
  - 超过 3 次 → 强制进入 3c（附带警告）
- **3c** — 技术文档工程师生成完整项目文档
- 完成后交给 stm32_master 编译烧录

### 断点续跑
工作流状态保存在 `workflow-state.json`，支持从任意阶段和子阶段恢复。

## 关键设计决策

### 辅助元件自动检测
`wiring.js` 的 `parseCompanionComponents(note)` 从 outputs 的 `note` 字段检测：
- 电阻/限流/上拉/下拉 → 创建 Resistor 紧凑模块
- MOSFET/MOS管 → 创建 N-MOSFET 紧凑模块

紧凑模块使用 SVG 电路符号（电阻锯齿波、MOSFET 晶体管符号），不显示模块名和引脚名。

### requirements-master 交互式提问
`parseQuestions()` 支持两种格式：
- 简单格式：`- DS18B20 和 DHT11 你更倾向哪个？`
- 结构化格式：`- 传感器选型: DS18B20(精度高只测温度) / DHT11(温湿度一体)`

结构化格式自动转化为 `AskUserQuestion` 的选项。

### 流程图双图模式
`flowchart.js` 的 `generateFlowchart()` 返回 `{ init, loop }` 对象：
- init：初始化序列（时钟 → GPIO → 外设 → 模块初始化）
- loop：主循环逻辑（读取 → 判断 → 动作 → 循环）

两个图分别渲染为 HTML 页面中的两个 `.chart-card`。

## API

### `processDemand({ message, projectPath })`

处理用户需求，生成图表。

```javascript
const { processDemand } = require('./index.js');

const result = await processDemand({
  message: '我要实现一个声控开灯的项目',
  projectPath: 'F:/path/to/project'
});
```

### `orchestrate({ message, projectPath })`

编排完整工作流（Phase 1 → Phase 2 → Phase 3 Dev-QA Loop），支持断点续跑。

```javascript
const { orchestrate, handleReviewResult, completePhase3 } = require('./index.js');

const result = await orchestrate({
  message: '用STM32做感应灯',
  projectPath: 'F:/path/to/project'
});

// Phase 3b 审查结果处理
const next = await handleReviewResult(projectPath, state, {
  verdict: 'PASS', // PASS / FAIL / CONDITIONAL_PASS
  feedback: '...'
});
```

### `loadPersona(name)`

加载专家人格定义（Markdown 内容），用于注入 AI 上下文。

```javascript
const { loadPersona } = require('./index.js');
const persona = loadPersona('embedded-firmware-engineer');
```

## 与 stm32_master 的集成

完整工作流：

1. **Phase 1** — 需求工程师生成结构化需求文档
2. **Phase 2** — diagram-master 生成图表（接线图编辑器、流程图、软件设计文档）
3. **Phase 3** — 专家团 Dev-QA Loop（写代码 → 审查 → 文档）
4. **编译烧录** — stm32_master 编译/烧录/调试

使用 `orchestrate()` 自动编排所有阶段，支持从任意阶段恢复。

## 技术栈

- **Mermaid**：流程图渲染（通过 CDN 在 HTML 中渲染）
- **HTML+CSS+JS**：接线图编辑器、流程图页面（oklch 主题系统）
- **SVG**：电路符号（电阻、MOSFET）、接线图连线
- **纯 JavaScript**：无外部依赖，所有 handler 可独立调用
