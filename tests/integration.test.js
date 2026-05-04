// tests/integration.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { orchestrate, saveState } = require('../orchestrator.js');
const { main } = require('../agents/diagram-agent.js');

describe('Integration: 完整工作流', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'integration-test-'));

  // 模拟 Phase 1 完成后的需求数据
  const requirements = {
    projectName: '感应灯',
    mcu: 'STM32F103C8T6',
    inputs: [
      { module: 'PIR传感器', interface: 'GPIO', voltage: '3.3V', pin: 'PA0' },
    ],
    outputs: [
      { module: 'LED灯带', interface: 'PWM', voltage: '12V', pin: 'PA1', note: '需MOSFET驱动' },
    ],
    interfaces: [],
    constraints: { power: 'USB 5V供电', size: '尽量小', cost: '低成本' },
    scenarios: ['人体靠近时自动亮灯', '无人30秒后自动熄灭'],
    risks: ['LED功率较大，STM32 GPIO无法直接驱动'],
  };

  // 保存 Phase 1 状态
  saveState(tmpDir, {
    currentPhase: 1,
    context: {
      userMessage: '用STM32做一个感应灯',
      requirements,
      requirementsPath: path.join(tmpDir, 'docs', 'diagrams', '感应灯', 'requirements.md'),
    },
    history: [],
  });

  // 执行 Phase 2
  const result = await orchestrate({ message: '继续', projectPath: tmpDir });

  assert(result.success, 'Phase 2 should succeed');
  assert(result.phase === 2, 'should be at phase 2');
  assert(result.diagrams.length === 3, 'should generate 3 diagrams');

  // 验证生成的文件存在
  const wiringFile = path.join(result.outputDir, 'wiring.html');
  assert(fs.existsSync(wiringFile), 'wiring.html should exist');

  const flowFile = path.join(result.outputDir, 'flowchart.html');
  assert(fs.existsSync(flowFile), 'flowchart.html should exist');

  // 验证接线图使用了实际数据
  const wiringContent = fs.readFileSync(wiringFile, 'utf8');
  assert(wiringContent.includes('PIR传感器'), 'wiring should reference PIR from requirements');
  assert(!wiringContent.includes('语音模块 TX'), 'wiring should NOT have hardcoded text');

  // 验证状态已更新到 Phase 2
  const state = JSON.parse(fs.readFileSync(path.join(tmpDir, 'workflow-state.json'), 'utf8'));
  assertEqual(state.currentPhase, 2, 'state should be at phase 2');

  // 执行 Phase 3（专家团 Dev-QA Loop）
  const result3 = await orchestrate({ message: '继续', projectPath: tmpDir });
  assert(result3.phase === '3a', 'should advance to phase 3a (firmware writing)');
  assert(result3.persona, 'should provide embedded firmware engineer persona');
  assert(result3.nextStep.includes('3b'), 'should hint at next sub-phase (code review)');

  // 清理
  fs.rmSync(tmpDir, { recursive: true });
});
