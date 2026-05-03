// orchestrator.js
/**
 * 嵌入式项目全流程编排器
 *
 * 薄编排层，只负责：
 * 1. 调用顺序（Phase 1 → Phase 2 → Phase 3）
 * 2. 数据传递（requirements.json 在 phase 间流转）
 * 3. 状态持久化（workflow-state.json 支持断点续跑）
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = 'workflow-state.json';

/**
 * 读取配置文件，获取用户指定的输出目录
 */
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return {};
}

/**
 * 保存工作流状态到项目目录
 * @param {string} projectPath - 项目路径
 * @param {Object} state - 状态对象
 */
function saveState(projectPath, state) {
  const statePath = path.join(projectPath, STATE_FILE);
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * 加载工作流状态
 * @param {string} projectPath - 项目路径
 * @returns {Object} 状态对象
 */
function loadState(projectPath) {
  const statePath = path.join(projectPath, STATE_FILE);
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return {
    currentPhase: 0,
    context: {
      userMessage: null,
      requirements: null,
      requirementsPath: null,
      diagrams: null,
      diagramsPath: null,
      projectName: null,
    },
    history: [],
  };
}

/**
 * 主编排函数
 *
 * 根据 workflow-state.json 决定从哪个阶段开始/恢复。
 * 每阶段完成后保存状态，等待用户确认后调用下一阶段。
 *
 * @param {Object} params - { message, projectPath }
 * @returns {Object} 当前阶段的结果和下一步提示
 */
async function orchestrate({ message, projectPath }) {
  const state = loadState(projectPath);

  if (state.currentPhase === 0) {
    return runPhase1(message, projectPath, state);
  } else if (state.currentPhase === 1) {
    return runPhase2(projectPath, state);
  } else if (state.currentPhase === 2) {
    return runPhase3(projectPath, state);
  } else {
    return {
      success: true,
      message: '所有阶段已完成。请使用 stm32_master 进行代码编写和烧录。',
      state,
    };
  }
}

/**
 * Phase 1: 需求澄清
 * 注意：实际的 AI 交互由 Claude Code 的 skill 系统处理，
 * 这里只负责保存状态和调用 diagram-master 的检测逻辑
 */
async function runPhase1(message, projectPath, state) {
  const { detectProjectDemand } = require('./hooks/detect-project-hook.js');

  const detection = detectProjectDemand(message);
  if (!detection.isProjectDemand && !detection.isImageRequest) {
    return {
      triggered: false,
      message: '未检测到项目需求，请描述您的嵌入式项目。',
    };
  }

  // Phase 1 的实际推理由 requirements-master skill 处理
  // 这里返回提示，告诉用户接下来会进行需求澄清
  return {
    triggered: true,
    phase: 1,
    message: '已检测到项目需求，即将进入需求澄清阶段。',
    userMessage: message,
    state,
  };
}

/**
 * Phase 2: 图表生成
 * 使用 Phase 1 产出的 requirements.json 调用 diagram-master
 */
async function runPhase2(projectPath, state) {
  const { main } = require('./agents/diagram-agent.js');
  const context = state.context;

  if (!context.requirements) {
    return {
      success: false,
      message: '缺少需求数据（requirements.json），请先完成 Phase 1。',
    };
  }

  const result = await main({
    message: context.userMessage,
    projectPath,
    requirements: context.requirements,
  });

  // 更新状态
  state.currentPhase = 2;
  state.context.diagrams = result.diagrams;
  state.context.diagramsPath = result.outputDir;
  state.history.push({ phase: 2, timestamp: new Date().toISOString(), result });
  saveState(projectPath, state);

  return {
    success: true,
    phase: 2,
    message: '图表生成完成。',
    diagrams: result.diagrams,
    outputDir: result.outputDir,
    nextStep: '请确认图表，然后连接硬件。完成后运行 orchestrator 进入 Phase 3。',
    state,
  };
}

/**
 * Phase 3: 交给 stm32_master
 */
async function runPhase3(projectPath, state) {
  state.currentPhase = 3;
  state.history.push({ phase: 3, timestamp: new Date().toISOString() });
  saveState(projectPath, state);

  return {
    success: true,
    phase: 3,
    message: '图表已确认，可以开始代码开发。',
    nextStep: '请使用 stm32_master skill 进行代码编写、编译和烧录。',
    diagramsPath: state.context.diagramsPath,
    state,
  };
}

module.exports = {
  orchestrate,
  loadState,
  saveState,
};
