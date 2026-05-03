const { generate } = require('../skills/diagram-generator/handlers/flowchart.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('flowchart.js', () => {
  const requirements = {
    projectName: '感应灯',
    mcu: 'STM32F103C8T6',
    inputs: [
      { module: 'PIR传感器', interface: 'GPIO', pin: 'PA0' },
      { module: '光敏电阻', interface: 'ADC', pin: 'PA1 (ADC1_CH1)' },
    ],
    outputs: [{ module: 'LED灯带', interface: 'GPIO', pin: 'PA2' }],
    scenarios: [
      '光线充足时忽略PIR信号',
      '检测到人体时点亮LED',
      '无人30秒后自动熄灭',
    ],
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
  const result = generate({ userMessage: '用STM32做感应灯', outputDir: tmpDir, projectName: '感应灯', requirements });

  assert(result.success, 'should generate successfully');
  assert(result.filename === 'flowchart.html', 'should output HTML');
  assert(result.content.includes('graph TD'), 'should contain Mermaid in HTML');
  assert(result.content.includes('PIR') || result.content.includes('GPIO'), 'should reference modules');
  assert(result.content.includes('初始化'), 'should have init section');
  assert(result.content.includes('主循环'), 'should have main loop');
  assert(result.content.includes('mermaid'), 'should load mermaid library');

  // 不使用 requirements 时应回退到简单流程图
  const result2 = generate({ userMessage: '声控开灯', outputDir: tmpDir, projectName: '声控开灯' });
  assert(result2.success, 'fallback should succeed');
  assert(result2.content.includes('graph TD'), 'fallback should contain Mermaid');

  fs.rmSync(tmpDir, { recursive: true });
});
