const { determineDiagramTypes, extractProjectName, main } = require('../agents/diagram-agent.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

describe('determineDiagramTypes', () => {
  // 涉及硬件关键词时应生成接线图
  const typesHardware = determineDiagramTypes('STM32连接模块引脚');
  assertEqual(typesHardware.wiring, true, 'should generate wiring when hardware keywords present');

  // 涉及软件逻辑关键词时应生成流程图
  const typesLogic = determineDiagramTypes('控制流程处理');
  assertEqual(typesLogic.flowchart, true, 'should generate flowchart when logic keywords present');

  // 无匹配关键词时不应生成
  const typesExplicit = determineDiagramTypes('生成架构图');
  assertEqual(typesExplicit.wiring, false, 'wiring should be false when no hardware keywords');
  assertEqual(typesExplicit.flowchart, false, 'flowchart should be false when no logic keywords');
});

describe('extractProjectName', () => {
  assertEqual(extractProjectName('我要实现一个声控开灯的项目'), '声控开灯', 'should extract project name');
  assertEqual(extractProjectName('做个感应灯'), '感应灯', 'should handle short input');
  assertEqual(extractProjectName(''), '未命名项目', 'should handle empty input');
});

describe('diagram-agent main() with requirements', () => {
  // main() is async, so write a temp script and run with execSync
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
  const scriptFile = path.join(tmpDir, 'test-main.js');
  const agentPath = path.resolve(__dirname, '..', 'agents', 'diagram-agent.js').replace(/\\/g, '/');
  const tmpDirPath = tmpDir.replace(/\\/g, '/');

  const requirements = {
    projectName: '感应灯',
    mcu: 'STM32F103C8T6',
    inputs: [{ module: 'PIR传感器', interface: 'GPIO', voltage: '3.3V', pin: 'PA0' }],
    outputs: [{ module: 'LED灯带', interface: 'PWM', voltage: '12V', pin: 'PA1' }],
    interfaces: [],
    scenarios: ['感应亮灯'],
  };

  const scriptContent = [
    `const { main } = require('${agentPath}');`,
    `(async () => {`,
    `  const result = await main({`,
    `    message: '用STM32做感应灯',`,
    `    projectPath: '${tmpDirPath}',`,
    `    requirements: ${JSON.stringify(requirements)},`,
    `  });`,
    `  console.log(JSON.stringify(result));`,
    `})();`,
  ].join('\n');

  try {
    fs.writeFileSync(scriptFile, scriptContent, 'utf-8');
    const output = execSync(`node "${scriptFile}"`, { encoding: 'utf-8', timeout: 10000 });
    const result = JSON.parse(output.trim().split('\n').pop());
    assert(result.success === true, 'main should succeed with requirements');
    assert(result.diagrams.length === 3, 'should generate 3 diagram types');
    assert(result.projectName === '感应灯', 'should use projectName from requirements');
  } catch (e) {
    assert(false, 'main with requirements should not throw: ' + e.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
