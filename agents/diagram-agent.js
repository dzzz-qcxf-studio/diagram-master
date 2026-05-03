/**
 * Diagram Master - 主调度器
 *
 * 分析用户需求，决定生成哪些图表
 * 并行调度 subagent 生成各类图表
 */

const path = require('path');
const fs = require('fs');

// 读取配置（用户指定的输出目录）
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

// 加载 handlers
const wiring = require('../skills/diagram-generator/handlers/wiring.js');
const flowchart = require('../skills/diagram-generator/handlers/flowchart.js');
const softwareDesign = require('../skills/diagram-generator/handlers/software_design.js');

/**
 * 解析项目名称
 * @param {string} userMessage - 用户需求
 * @returns {string} 项目名称
 */
function extractProjectName(userMessage) {
  // 去掉常见前缀，提取核心需求
  let name = userMessage
    .replace(/我要实现/gi, '')
    .replace(/实现/gi, '')
    .replace(/一个/gi, '')
    .replace(/做个/gi, '')
    .replace(/项目/gi, '')
    .replace(/的/gi, '')
    .trim();

  // 如果太长，截取前20个字符
  if (name.length > 20) {
    name = name.substring(0, 20);
  }

  return name || '未命名项目';
}

/**
 * 确定需要生成哪些图
 * @param {string} userMessage - 用户需求
 * @param {Object} [requirements] - 可选的结构化需求，提供时生成所有图表类型
 * @returns {Object} 各图的生成配置
 */
function determineDiagramTypes(userMessage, requirements) {
  // 当有结构化需求时，生成所有图表类型
  if (requirements) {
    return { wiring: true, flowchart: true };
  }

  const message = userMessage.toLowerCase();

  // 涉及硬件连接时生成接线图
  const needWiring = message.includes('接线') ||
                     message.includes('连接') ||
                     message.includes('硬件') ||
                     message.includes('引脚') ||
                     message.includes('模块');

  // 涉及软件逻辑时生成流程图
  const needFlowchart = message.includes('流程') ||
                        message.includes('控制') ||
                        message.includes('处理') ||
                        message.includes('工作') ||
                        message.includes('启动');

  return {
    wiring: needWiring,
    flowchart: needFlowchart,
  };
}

/**
 * 生成输出目录路径
 * @param {string} projectName - 项目名称
 * @returns {string} 输出目录
 */
function getOutputDir(projectName) {
  const config = loadConfig();
  // 优先使用 config 中用户指定的输出目录
  const baseDir = config.outputDir || path.join(process.cwd(), 'docs', 'diagrams');
  return path.join(baseDir, projectName);
}

/**
 * 主入口函数 - 被 hook 触发时调用
 * @param {Object} params - 包含 message, projectPath 等
 * @returns {Object} 生成结果
 */
async function main({ message, projectPath, requirements }) {
  console.log('[Diagram Agent] 开始处理需求:', message);

  // 1. 解析需求（优先使用 requirements 中的项目名）
  const projectName = requirements
    ? requirements.projectName
    : extractProjectName(message);
  const diagramTypes = determineDiagramTypes(message, requirements);
  // 优先用 projectPath，其次用 config 中的输出目录
  const outputDir = projectPath
    ? path.join(projectPath, 'docs', 'diagrams', projectName)
    : getOutputDir(projectName);

  console.log('[Diagram Agent] 项目名称:', projectName);
  console.log('[Diagram Agent] 输出目录:', outputDir);
  console.log('[Diagram Agent] 需生成的图表:', diagramTypes);

  // 2. 生成各类图表（编辑器优先，然后是参考图）
  const results = {};
  const genParams = { userMessage: message, outputDir, projectName, requirements };

  // 接线图编辑器（主要输出）
  if (diagramTypes.wiring) {
    results.wiring = wiring.generate(genParams);
  }

  // 软件流程图 + 设计文档
  if (diagramTypes.flowchart) {
    results.flowchart = flowchart.generate(genParams);
    results.softwareDesign = softwareDesign.generate(genParams);
  }

  // 3. 返回结果给用户
  return {
    success: true,
    projectName,
    outputDir,
    diagrams: Object.entries(results).map(([type, data]) => ({
      type,
      files: data.files || [{ filepath: data.filepath, filename: data.filename }],
    })),
  };
}

/**
 * 直接生成单个图表（供 subagent 调用）
 */
async function generateSingle({ type, userMessage, outputDir, projectName }) {
  const handlers = {
    wiring,
    flowchart,
  };

  const handler = handlers[type];
  if (!handler) {
    throw new Error(`未知图表类型: ${type}`);
  }

  return handler.generate({ userMessage, outputDir, projectName });
}

module.exports = {
  main,
  generateSingle,
  extractProjectName,
  determineDiagramTypes,
};