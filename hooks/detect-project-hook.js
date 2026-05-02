/**
 * Diagram Agent - 需求检测 Hook
 *
 * 拦截用户消息，检测项目需求关键词
 * 当检测到需求时，触发 diagram-agent 生成图表
 */

// 检测项目需求的关键词模式
const PROJECT_PATTERNS = [
  /实现\s*.+\s*项目/,
  /我要做\s*.+/,
  /帮我做\s*.+/,
  /新建项目/,
  /项目需求/,
  /实现.*的/,
  /要做.*项目/,
  /想做一个/,
  /打算做/,
  /开始.*项目/,
];

// 检测明确要求生成图片的指令
const IMAGE_PATTERNS = [
  /生成.*图片/,
  /生成.*图/,
  /生成.*图.*给我/,
  /给我.*图/,
  /画.*图/,
  /显示.*架构/,
  /显示.*流程/,
  /显示.*接线/,
];

/**
 * 检测用户消息是否包含项目需求
 * @param {string} message - 用户输入的消息
 * @returns {Object} { isProjectDemand: boolean, isImageRequest: boolean }
 */
function detectProjectDemand(message) {
  const normalized = message.trim();

  const isProjectDemand = PROJECT_PATTERNS.some(pattern => pattern.test(normalized));
  const isImageRequest = IMAGE_PATTERNS.some(pattern => pattern.test(normalized));

  return { isProjectDemand, isImageRequest };
}

/**
 * Hook 主函数
 * 当用户发送消息时调用此函数
 * @param {Object} params - 包含 message, context 等
 * @returns {Object|null} - 返回 null 表示不拦截，返回对象表示触发后续操作
 */
function onUserMessage({ message, ...context }) {
  const { isProjectDemand, isImageRequest } = detectProjectDemand(message);

  // 如果检测到项目需求或图片请求，返回触发信号
  if (isProjectDemand || isImageRequest) {
    return {
      trigger: 'diagram-agent',
      type: isProjectDemand ? 'project-demand' : 'image-request',
      message: message,
      shouldAutoGenerate: true,
    };
  }

  return null;
}

module.exports = {
  detectProjectDemand,
  onUserMessage,
};