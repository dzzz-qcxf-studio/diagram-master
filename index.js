/**
 * Diagram Master - 主入口
 *
 * 整合 Hook、Agent、Skill、Orchestrator
 * 提供统一的调用接口
 */

const { main } = require('./agents/diagram-agent.js');
const { detectProjectDemand } = require('./hooks/detect-project-hook.js');
const { orchestrate, loadState, saveState } = require('./orchestrator.js');

/**
 * 处理用户需求的主函数（向后兼容）
 * @param {Object} params - { message, projectPath }
 * @returns {Object} 生成结果
 */
async function processDemand({ message, projectPath }) {
  const { isProjectDemand, isImageRequest } = detectProjectDemand(message);

  if (!isProjectDemand && !isImageRequest) {
    return { triggered: false };
  }

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
  orchestrate,
  loadState,
  saveState,
};