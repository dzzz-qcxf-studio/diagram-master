// tests/requirements-parser.test.js
const { parseAnalysis, parseQuestions, parseRequirements } = require('C:/Users/ROG/.claude/skills/requirements-master/parser.js');

describe('requirements-master/parser.js', () => {
  // parseAnalysis 测试
  const analysisText = `
## 项目名称
感应灯

## 主控芯片
STM32F103C8T6

## 输入模块
PIR传感器 | GPIO | 3.3V

## 输出模块
LED灯带 | PWM | 12V

## 通信接口
无

## 电源方案
USB 5V 供电

## 初步接线方案
PIR OUT → PA0, LED → PA1
  `;

  const parsed = parseAnalysis(analysisText);
  assertEqual(parsed.mcu, 'STM32F103C8T6', 'should parse MCU');
  assert(parsed.inputs.length > 0, 'should parse input modules');
  assert(parsed.outputs.length > 0, 'should parse output modules');

  // parseQuestions 测试 - 简单格式
  const questionText = `
## 硬件兼容性
- LED 功率较大，STM32 GPIO 无法直接驱动

## 接口可行性
无重大问题
  `;

  const questions = parseQuestions(questionText);
  assert(Array.isArray(questions), 'should return array of questions');
  assert(questions.length > 0, 'should extract at least one question');
  assert(questions[0].question, 'should have question field');

  // parseQuestions 测试 - 结构化格式（带选项）
  const structuredText = `
- 传感器选型: DS18B20(精度高只测温度) / DHT11(温湿度一体) / DHT22(高精度温湿度)
- 蜂鸣器类型: 有源(GPIO直接驱动) / 无源(需PWM驱动)
  `;
  const structured = parseQuestions(structuredText);
  assert(structured.length === 2, 'should parse two structured questions');
  assert(structured[0].options.length === 3, 'should parse 3 options');
  assertEqual(structured[0].options[0].label, 'DS18B20', 'should parse option label');
  assert(structured[0].options[0].description.includes('精度'), 'should parse option description');

  // parseRequirements 测试
  const jsonText = `{
    "projectName": "感应灯",
    "mcu": "STM32F103C8T6",
    "inputs": [{ "module": "PIR", "interface": "GPIO", "voltage": "3.3V", "pin": "PA0" }],
    "outputs": [{ "module": "LED", "interface": "PWM", "voltage": "12V", "pin": "PA1", "note": "需MOSFET" }],
    "constraints": { "power": "USB 5V" },
    "scenarios": ["感应亮灯"],
    "risks": ["GPIO驱动能力不足"]
  }`;

  const req = parseRequirements(jsonText);
  assertEqual(req.projectName, '感应灯', 'should parse projectName');
  assertEqual(req.mcu, 'STM32F103C8T6', 'should parse mcu');
  assert(req.inputs.length === 1, 'should parse inputs');
  assert(req.risks.length === 1, 'should parse risks');

  // 错误处理
  const badReq = parseRequirements('not json');
  assertEqual(badReq, null, 'should return null for invalid JSON');
});
