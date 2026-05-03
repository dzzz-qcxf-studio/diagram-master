const { analyzeRequirements, generate } = require('../skills/diagram-generator/handlers/architecture.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('architecture.js', () => {
  // 原有关键词分析测试
  const modules = analyzeRequirements('用STM32做声控开灯');
  assertEqual(modules.mcu, 'STM32', 'should detect STM32');
  assert(modules.inputModules.includes('语音模块'), 'should detect voice module');
  assert(modules.outputModules.includes('LED/灯泡'), 'should detect LED');

  // 新增：使用 requirements 数据（而非关键词猜测）
  const requirements = {
    projectName: '感应灯',
    mcu: 'STM32F103C8T6',
    inputs: [
      { module: 'PIR传感器', interface: 'GPIO', voltage: '3.3V', pin: 'PA0' }
    ],
    outputs: [
      { module: 'LED灯带', interface: 'PWM', voltage: '12V', pin: 'PA1', note: '需MOSFET驱动' }
    ],
    interfaces: [],
  };

  // generate 应该接受 requirements 参数
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
  const result = generate({ userMessage: '用STM32做感应灯', outputDir: tmpDir, projectName: '感应灯', requirements });
  assert(result.success, 'should generate successfully');
  assert(result.content.includes('PIR传感器'), 'should use requirements data for module names');
  assert(result.content.includes('STM32F103C8T6'), 'should use exact MCU from requirements');

  // 清理
  fs.rmSync(tmpDir, { recursive: true });
});
