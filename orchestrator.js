// orchestrator.js
/**
 * 嵌入式项目全流程编排器
 *
 * 专家团编排，负责：
 * 1. 调用顺序（Phase 1 → Phase 2 → Phase 3: 写代码↔审查→文档）
 * 2. 数据传递（requirements.json → software_design.md → 代码 → 文档）
 * 3. 状态持久化（workflow-state.json 支持断点续跑）
 * 4. Dev-QA Loop（代码审查不通过则回到写代码，最多 3 次）
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = 'workflow-state.json';
const PERSONAS_DIR = path.join(__dirname, 'agents', 'personas');
const MAX_REVIEW_RETRIES = 3;

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
 * 加载专家人格定义
 * @param {string} name - 人格文件名（不含 .md）
 * @returns {string} 人格定义的 Markdown 内容
 */
function loadPersona(name) {
  const personaPath = path.join(PERSONAS_DIR, `${name}.md`);
  if (fs.existsSync(personaPath)) {
    return fs.readFileSync(personaPath, 'utf8');
  }
  return '';
}

/**
 * 保存工作流状态到项目目录
 */
function saveState(projectPath, state) {
  const statePath = path.join(projectPath, STATE_FILE);
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * 加载工作流状态
 */
function loadState(projectPath) {
  const statePath = path.join(projectPath, STATE_FILE);
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  return {
    currentPhase: 0,
    currentSubPhase: null,
    reviewRetries: 0,
    context: {
      userMessage: null,
      requirements: null,
      requirementsPath: null,
      diagrams: null,
      diagramsPath: null,
      projectName: null,
      firmwareCode: null,
      reviewResult: null,
      documentation: null,
    },
    history: [],
  };
}

/**
 * 主编排函数
 *
 * Phase 0: 待启动
 * Phase 1: 需求澄清（requirements-master skill）
 * Phase 2: 图表生成（diagram-master）
 * Phase 3: 固件开发（专家团 Dev-QA Loop）
 *   - 3a: 嵌入式固件工程师写代码
 *   - 3b: 代码审查员审查（FAIL → 回到 3a，最多 3 次）
 *   - 3c: 技术文档工程师生成文档
 * Phase 4: 完成
 */
async function orchestrate({ message, projectPath }) {
  const state = loadState(projectPath);

  switch (state.currentPhase) {
    case 0:
      return runPhase1(message, projectPath, state);
    case 1:
      return runPhase2(projectPath, state);
    case 2:
      return runPhase3(projectPath, state);
    default:
      return {
        success: true,
        message: '所有阶段已完成。项目文档和固件代码已就绪。',
        state,
      };
  }
}

/**
 * Phase 1: 需求澄清
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
    nextStep: '请确认图表，然后进入 Phase 3 固件开发。',
    state,
  };
}

/**
 * Phase 3: 固件开发（Dev-QA Loop）
 *
 * 子阶段：
 * - 3a: 嵌入式固件工程师编写固件代码
 * - 3b: 代码审查员审查（FAIL → 回到 3a）
 * - 3c: 技术文档工程师生成项目文档
 */
async function runPhase3(projectPath, state) {
  const subPhase = state.currentSubPhase || '3a';

  switch (subPhase) {
    case '3a':
      return runPhase3a(projectPath, state);
    case '3b':
      return runPhase3b(projectPath, state);
    case '3c':
      return runPhase3c(projectPath, state);
    default:
      return completePhase3(projectPath, state);
  }
}

/**
 * Phase 3a: 嵌入式固件工程师写代码
 *
 * 提供 requirements.json + software_design.md + 人格定义，
 * 让 AI 以固件工程师身份编写代码。
 */
async function runPhase3a(projectPath, state) {
  const persona = loadPersona('embedded-firmware-engineer');
  const context = state.context;

  state.currentSubPhase = '3a';
  state.history.push({ subPhase: '3a', timestamp: new Date().toISOString() });
  saveState(projectPath, state);

  return {
    success: true,
    phase: '3a',
    message: '嵌入式固件工程师开始编写固件。',
    persona,
    input: {
      requirements: context.requirements,
      diagramsPath: context.diagramsPath,
      projectName: context.projectName,
    },
    instruction: '请以嵌入式固件工程师的身份，基于 requirements.json 和 software_design.md 编写固件代码。加载 persona 获取编码规范和铁律。',
    nextStep: '代码编写完成后，进入 3b 代码审查。',
    state,
  };
}

/**
 * Phase 3b: 代码审查员审查
 *
 * 审查固件代码，输出 PASS / FAIL / CONDITIONAL_PASS。
 * FAIL 时回到 3a 重写（附带审查反馈），最多 MAX_REVIEW_RETRIES 次。
 */
async function runPhase3b(projectPath, state) {
  const persona = loadPersona('code-reviewer');
  const context = state.context;

  state.currentSubPhase = '3b';
  state.history.push({ subPhase: '3b', timestamp: new Date().toISOString(), retry: state.reviewRetries });
  saveState(projectPath, state);

  return {
    success: true,
    phase: '3b',
    message: `代码审查员开始审查（第 ${state.reviewRetries + 1}/${MAX_REVIEW_RETRIES} 次）`,
    persona,
    input: {
      requirements: context.requirements,
      firmwareCode: context.firmwareCode,
    },
    instruction: '请以代码审查员的身份审查固件代码。按阻塞/建议/瑕疵三级输出审查报告。结论为 PASS、FAIL 或 CONDITIONAL_PASS。',
    reviewConfig: {
      maxRetries: MAX_REVIEW_RETRIES,
      currentRetry: state.reviewRetries,
    },
    state,
  };
}

/**
 * 处理审查结果，决定下一步
 * @param {string} projectPath
 * @param {Object} state
 * @param {Object} reviewResult - { verdict: 'PASS'|'FAIL'|'CONDITIONAL_PASS', feedback: '...' }
 */
async function handleReviewResult(projectPath, state, reviewResult) {
  state.context.reviewResult = reviewResult;
  state.history.push({ subPhase: '3b-result', timestamp: new Date().toISOString(), verdict: reviewResult.verdict });

  if (reviewResult.verdict === 'PASS' || reviewResult.verdict === 'CONDITIONAL_PASS') {
    // 审查通过，进入文档生成
    state.currentSubPhase = '3c';
    saveState(projectPath, state);
    return runPhase3c(projectPath, state);
  }

  // 审查不通过
  state.reviewRetries += 1;

  if (state.reviewRetries >= MAX_REVIEW_RETRIES) {
    // 超过重试上限，强制进入文档生成（附带审查警告）
    state.currentSubPhase = '3c';
    state.history.push({ subPhase: '3b-escalate', timestamp: new Date().toISOString(), message: '超过重试上限，强制推进' });
    saveState(projectPath, state);
    return {
      success: true,
      phase: '3b',
      message: `代码审查未通过（已重试 ${MAX_REVIEW_RETRIES} 次），将强制进入文档生成阶段。`,
      reviewResult,
      warning: '审查未完全通过，建议手动检查代码后再编译烧录。',
      nextStep: '进入 3c 文档生成。',
      state,
    };
  }

  // 回到 3a 重写，附带审查反馈
  state.currentSubPhase = '3a';
  saveState(projectPath, state);

  const persona = loadPersona('embedded-firmware-engineer');
  return {
    success: true,
    phase: '3a',
    message: `审查未通过（第 ${state.reviewRetries} 次），回到固件编写阶段。`,
    persona,
    input: {
      requirements: state.context.requirements,
      previousCode: state.context.firmwareCode,
      reviewFeedback: reviewResult.feedback,
    },
    instruction: '审查员发现了以下问题，请修复后重新编写固件。加载 persona 获取编码规范。',
    state,
  };
}

/**
 * Phase 3c: 技术文档工程师生成文档
 */
async function runPhase3c(projectPath, state) {
  const persona = loadPersona('technical-writer');
  const context = state.context;

  state.currentSubPhase = '3c';
  state.history.push({ subPhase: '3c', timestamp: new Date().toISOString() });
  saveState(projectPath, state);

  return {
    success: true,
    phase: '3c',
    message: '技术文档工程师开始生成项目文档。',
    persona,
    input: {
      requirements: context.requirements,
      diagramsPath: context.diagramsPath,
      firmwareCode: context.firmwareCode,
      projectName: context.projectName,
    },
    instruction: '请以技术文档工程师的身份，基于 requirements.json、software_design.md 和固件代码生成完整的项目文档（README.md、接线说明、引脚对照表、调试指南）。',
    nextStep: '文档生成完成后，项目交付物齐全。',
    state,
  };
}

/**
 * Phase 3 完成
 */
async function completePhase3(projectPath, state) {
  state.currentPhase = 3;
  state.currentSubPhase = null;
  state.history.push({ phase: 3, timestamp: new Date().toISOString(), status: 'complete' });
  saveState(projectPath, state);

  return {
    success: true,
    phase: 3,
    message: '固件开发全流程完成。',
    deliverables: {
      requirements: state.context.requirementsPath,
      diagrams: state.context.diagramsPath,
      firmware: state.context.firmwareCode ? '已生成' : '待确认',
      documentation: state.context.documentation ? '已生成' : '待确认',
    },
    nextStep: '所有文档和代码已就绪，可以进行编译烧录。使用 stm32_master skill。',
    state,
  };
}

module.exports = {
  orchestrate,
  loadState,
  saveState,
  loadPersona,
  handleReviewResult,
  completePhase3,
};
