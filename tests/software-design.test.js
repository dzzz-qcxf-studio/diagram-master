const { generate } = require('../skills/diagram-generator/handlers/software_design.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('software_design.js', () => {
  const requirements = {
    projectName: '声控灯',
    mcu: 'STM32F103C8T6',
    inputs: [
      { module: 'LD3320 语音识别模块', interface: 'SPI', pin: 'PA5/PA6/PA7 (SPI1), PA4 (CS), PB0 (IRQ)' },
      { module: '光敏电阻模块', interface: 'ADC', pin: 'PA0 (ADC1_CH0)' },
    ],
    outputs: [{ module: 'LED', interface: 'GPIO', pin: 'PA1' }],
    scenarios: [
      '夜间检测到语音指令"开灯"时点亮 LED',
      '检测到语音指令"关灯"时熄灭 LED',
      '白天（光线充足）时忽略语音指令，LED 不响应',
    ],
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
  const result = generate({ userMessage: '声控灯', outputDir: tmpDir, projectName: '声控灯', requirements });

  assert(result.success, 'should generate successfully');
  assert(result.content.includes('# 声控灯 软件设计文档'), 'should have title');
  assert(result.content.includes('模块架构'), 'should have module architecture');
  assert(result.content.includes('初始化顺序'), 'should have init order');
  assert(result.content.includes('主循环逻辑'), 'should have main loop');
  assert(result.content.includes('关键函数清单'), 'should have function list');
  assert(result.content.includes('voice_module'), 'should have voice module');
  assert(result.content.includes('ldr_sensor'), 'should have ldr sensor');
  assert(result.content.includes('led_control'), 'should have led control');
  assert(result.content.includes('SPI'), 'should reference SPI');
  assert(result.content.includes('ADC'), 'should reference ADC');
  assert(result.content.includes('while'), 'should have pseudo-code loop');

  // 无 requirements 时应失败
  const result2 = generate({ userMessage: '声控灯', outputDir: tmpDir, projectName: '声控灯' });
  assert(!result2.success, 'should fail without requirements');

  fs.rmSync(tmpDir, { recursive: true });
});
