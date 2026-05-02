/**
 * Diagram Agent - 主调度器
 *
 * 分析用户需求，决定生成哪些图表
 * 并行调度 subagent 生成各类图表
 */

const path = require('path');
const fs = require('fs');

// 加载 handlers
const architecture = require('../skills/diagram-generator/handlers/architecture.js');
const wiring = require('../skills/diagram-generator/handlers/wiring.js');
const flowchart = require('../skills/diagram-generator/handlers/flowchart.js');

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
 * @returns {Object} 各图的生成配置
 */
function determineDiagramTypes(userMessage) {
  const message = userMessage.toLowerCase();

  // 总是生成架构图
  const needArchitecture = true;

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

  // 默认都生成
  return {
    architecture: needArchitecture,
    wiring: needWiring || true, // 默认生成接线图
    flowchart: needFlowchart || true, // 默认生成流程图
  };
}

/**
 * 生成输出目录路径
 * @param {string} projectName - 项目名称
 * @returns {string} 输出目录
 */
function getOutputDir(projectName) {
  // 获取用户当前工作目录或项目目录
  const workDir = process.cwd();

  // 创建 diagrams 目录
  const today = new Date().toISOString().slice(0, 10);
  const dirName = `${today}-${projectName}`;
  return path.join(workDir, 'docs', 'diagrams', dirName);
}

/**
 * 主入口函数 - 被 hook 触发时调用
 * @param {Object} params - 包含 message, projectPath 等
 * @returns {Object} 生成结果
 */
async function main({ message, projectPath }) {
  console.log('[Diagram Agent] 开始处理需求:', message);

  // 1. 解析需求
  const projectName = extractProjectName(message);
  const diagramTypes = determineDiagramTypes(message);
  const outputDir = projectPath
    ? path.join(projectPath, 'docs', 'diagrams', `${projectName}`)
    : getOutputDir(projectName);

  console.log('[Diagram Agent] 项目名称:', projectName);
  console.log('[Diagram Agent] 输出目录:', outputDir);
  console.log('[Diagram Agent] 需生成的图表:', diagramTypes);

  // 2. 生成各类图表（handlers 是同步的，直接调用）
  const results = {};

  if (diagramTypes.architecture) {
    results.architecture = architecture.generate({ userMessage: message, outputDir, projectName });
  }

  if (diagramTypes.wiring) {
    results.wiring = wiring.generate({ userMessage: message, outputDir, projectName });
  }

  if (diagramTypes.flowchart) {
    results.flowchart = flowchart.generate({ userMessage: message, outputDir, projectName });
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
    architecture,
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