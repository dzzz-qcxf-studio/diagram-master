const { generate } = require('../skills/diagram-generator/handlers/wiring.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('wiring.js', () => {
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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
  const result = generate({ userMessage: '用STM32做感应灯', outputDir: tmpDir, projectName: '感应灯', requirements });

  // 基本功能
  assert(result.success, 'should generate successfully');
  assert(result.files.length === 3, 'should generate 3 files (editable, preview, editor)');

  // wiring.html 内容检查
  const wiringContent = result.files.find(f => f.filename === 'wiring.html').content;
  assert(wiringContent.includes('PIR传感器'), 'wiring should use requirements module names');
  assert(wiringContent.includes('STM32F103C8T6'), 'wiring should use exact MCU');
  assert(!wiringContent.includes('语音模块 TX'), 'wiring should NOT have hardcoded connection text');

  // wiring_preview.html 应与 wiring.html 不同
  const previewContent = result.files.find(f => f.filename === 'wiring_preview.html').content;
  assert(wiringContent !== previewContent, 'preview should differ from editable version');

  // HTML 结构验证（模块视图 + 接线说明）
  assert(wiringContent.includes('module-name'), 'should contain module boxes');
  assert(wiringContent.includes('PA0'), 'should contain pin PA0');
  assert(wiringContent.includes('connection-item'), 'should contain connection items');

  // 清理
  fs.rmSync(tmpDir, { recursive: true });
});
