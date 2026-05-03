const { orchestrate, loadState, saveState } = require('../orchestrator.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('orchestrator.js', () => {
  // 状态管理测试
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-test-'));

  const defaultState = { currentPhase: 0, context: {}, lastUpdated: null };
  saveState(tmpDir, defaultState);
  const loaded = loadState(tmpDir);
  assertEqual(loaded.currentPhase, 0, 'should save and load phase 0');

  // 更新状态
  const phase1State = {
    currentPhase: 1,
    context: {
      userMessage: '用STM32做感应灯',
      requirements: { projectName: '感应灯', mcu: 'STM32F103C8T6', inputs: [], outputs: [], constraints: {}, scenarios: [], risks: [] },
      requirementsPath: path.join(tmpDir, 'docs', 'diagrams', '感应灯', 'requirements.md'),
    },
    lastUpdated: new Date().toISOString(),
  };
  saveState(tmpDir, phase1State);
  const loaded2 = loadState(tmpDir);
  assertEqual(loaded2.currentPhase, 1, 'should save and load phase 1');
  assertEqual(loaded2.context.requirements.projectName, '感应灯', 'should persist requirements');

  // orchestrate 入口测试
  assert(typeof orchestrate === 'function', 'orchestrate should be a function');

  fs.rmSync(tmpDir, { recursive: true });
});
