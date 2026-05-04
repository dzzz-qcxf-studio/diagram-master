# Changelog

## 2026-05-03

### 移除架构图
- 删除 `handlers/architecture.js` 相关代码
- `diagram-agent.js` 从 4 种图表类型精简为 3 种（wiring, flowchart, softwareDesign）
- 不再生成 `architecture.mmd`

### 流程图改为 HTML 双图模式
- `flowchart.js` 输出从 `.mmd` 改为 `.html`
- `generateFlowchart()` 返回 `{ init, loop }` 对象
- `wrapAsHtml()` 渲染两个 Mermaid 图表卡片，含主题切换
- oklch 黑白蓝主题（hue 260），与编辑器一致

### 辅助元件自动检测
- `wiring.js` 新增 `parseCompanionComponents(note)` 函数
- 从 outputs 的 `note` 字段检测电阻/MOSFET 需求
- 自动创建紧凑模块并连线（MCU → 辅助元件 → 输出模块）

### 紧凑模块 + SVG 电路符号
- `wiring-editor.html` 新增"辅助元件"侧边栏类别（电阻、N-MOSFET）
- `COMPACT_SYMBOLS` 存储 SVG 电路符号（锯齿波电阻、晶体管 MOSFET）
- `.module-card.compact` CSS 模式：隐藏标题/引脚名/操作栏
- `renderModule()` 自动检测 `type === 'interface' && pins.length <= 3` 使用紧凑模式

### 需求大师交互式提问
- `requirements-master/SKILL.md` Step 3 改为使用 `AskUserQuestion` 工具
- `parseQuestions()` 支持结构化选项格式：`选项名(说明) / 选项名(说明)`
- 返回 `{ question, options?, header? }` 结构

### 软件设计文档
- 新增 `handlers/software_design.js`
- 生成 `software_design.md`：模块架构、初始化顺序、主循环伪代码、函数清单、中断处理、文件结构

### 测试更新
- 83 个测试全部通过
- 移除架构图相关断言
- 流程图测试更新为 HTML 输出检查
- 新增结构化问题解析测试

### CLAUDE.md 更新
- 移除 architecture.mmd 引用
- 更新输出文件列表和图表说明
- 新增辅助元件检测、紧凑模块、AskUserQuestion 等设计决策文档

### 记忆系统
- 新增 memory 目录，保存项目状态、设计决策、用户偏好
