/**
 * Diagram Agent - 主入口
 *
 * 整合 Hook、Agent、Skill
 * 提供统一的调用接口
 */

const { main } = require('./agents/diagram-agent.js');
const { detectProjectDemand } = require('./hooks/detect-project-hook.js');

/**
 * 处理用户需求的主函数
 * @param {Object} params - { message, projectPath }
 * @returns {Object} 生成结果
 */
async function processDemand({ message, projectPath }) {
  // 1. 检测是否触发
  const { isProjectDemand, isImageRequest } = detectProjectDemand(message);

  if (!isProjectDemand && !isImageRequest) {
    return { triggered: false };
  }

  // 2. 调用 agent 处理
  const result = await main({ message, projectPath });
  return {
    triggered: true,
    ...result,
  };
}

module.exports = {
  processDemand,
  detectProjectDemand,
  main,
};