/**
 * Architecture Diagram Handler
 * 生成系统架构图（Mermaid 格式）
 */

const fs = require('fs');
const path = require('path');

/**
 * 分析用户需求，提取硬件模块
 * @param {string} userMessage - 用户需求描述
 * @returns {Object} 解析出的模块信息
 */
function analyzeRequirements(userMessage) {
  const message = userMessage.toLowerCase();

  // 检测主控芯片
  const mcu = message.includes('stm32') ? 'STM32' :
              message.includes('esp32') ? 'ESP32' :
              message.includes('arduino') ? 'Arduino' : 'MCU';

  // 检测输入模块
  const inputModules = [];
  if (message.includes('声控') || message.includes('语音')) inputModules.push('语音模块');
  if (message.includes('按键')) inputModules.push('按键');
  if (message.includes('红外')) inputModules.push('红外遥控');
  if (message.includes('蓝牙')) inputModules.push('蓝牙');
  if (message.includes('wifi')) inputModules.push('WiFi');
  if (message.includes('温度')) inputModules.push('温度传感器');
  if (message.includes('湿度')) inputModules.push('湿度传感器');
  if (message.includes('光敏')) inputModules.push('光敏传感器');

  // 检测输出模块
  const outputModules = [];
  if (message.includes('灯') || message.includes('灯光')) outputModules.push('LED/灯泡');
  if (message.includes('继电器')) outputModules.push('继电器');
  if (message.includes('电机')) outputModules.push('电机');
  if (message.includes('蜂鸣器')) outputModules.push('蜂鸣器');
  if (message.includes('显示') || message.includes('屏幕')) outputModules.push('显示模块');

  // 检测通信接口
  const interfaces = [];
  if (message.includes('i2c') || message.includes('I2C')) interfaces.push('I2C');
  if (message.includes('spi') || message.includes('SPI')) interfaces.push('SPI');
  if (message.includes('uart') || message.includes('串口')) interfaces.push('UART');

  return {
    mcu,
    inputModules: inputModules.length > 0 ? inputModules : ['输入模块'],
    outputModules: outputModules.length > 0 ? outputModules : ['输出模块'],
    interfaces,
  };
}

/**
 * 生成 Mermaid 架构图源码
 * @param {Object} modules - 模块信息
 * @returns {string} Mermaid 图源码
 */
function generateArchitectureDiagram(modules) {
  const { mcu, inputModules, outputModules, interfaces } = modules;

  let diagram = `graph TB
    subgraph 输入模块
`;

  inputModules.forEach((mod, idx) => {
    diagram += `        IN${idx + 1}["${mod}"]
`;
  });

  diagram += `    end

    subgraph 主控
        MCU["${mcu}"]
    end

    subgraph 输出模块
`;

  outputModules.forEach((mod, idx) => {
    diagram += `        OUT${idx + 1}["${mod}"]
`;
  });

  diagram += `    end

`;

  // 输入到 MCU
  inputModules.forEach((_, idx) => {
    diagram += `    IN${idx + 1} --> MCU
`;
  });

  // MCU 到输出
  outputModules.forEach((_, idx) => {
    diagram += `    MCU --> OUT${idx + 1}
`;
  });

  // 通信接口
  if (interfaces.length > 0) {
    diagram += `
    subgraph 通信接口
`;
    interfaces.forEach((iface, idx) => {
      diagram += `        IF${idx + 1}["${iface}"]
`;
    });
    diagram += `    end
`;
    interfaces.forEach((_, idx) => {
      diagram += `    MCU <--> IF${idx + 1}
`;
    });
  }

  diagram += `
    style MCU fill:#f9d71c,stroke:#333,stroke-width:2px
`;

  return diagram;
}

/**
 * 生成架构图文件
 * @param {string} userMessage - 用户需求描述
 * @param {string} outputDir - 输出目录
 * @param {string} projectName - 项目名称
 * @returns {Object} 生成结果
 */
function generate({ userMessage, outputDir, projectName }) {
  const modules = analyzeRequirements(userMessage);
  const diagram = generateArchitectureDiagram(modules);

  const filename = 'architecture.mmd';
  const filepath = path.join(outputDir, filename);

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filepath, diagram, 'utf8');

  return {
    success: true,
    filepath,
    filename,
    content: diagram,
    modules,
  };
}

module.exports = {
  analyzeRequirements,
  generateArchitectureDiagram,
  generate,
};