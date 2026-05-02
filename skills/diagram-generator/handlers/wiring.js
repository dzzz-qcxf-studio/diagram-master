/**
 * Wiring Diagram Handler
 * 生成硬件接线图（HTML + CSS 格式）
 */

const fs = require('fs');
const path = require('path');

/**
 * 常用引脚定义
 */
const MCU_PINS = {
  'STM32': {
    'PA0': 'ADC1_IN0 / TIM2_CH1',
    'PA1': 'ADC1_IN1 / TIM2_CH2',
    'PA2': 'USART2_TX / ADC1_IN2',
    'PA3': 'USART2_RX / ADC1_IN3',
    'PA4': 'SPI1_NSS / ADC1_IN4',
    'PA5': 'SPI1_SCK',
    'PA6': 'SPI1_MISO',
    'PA7': 'SPI1_MOSI',
    'PA8': 'TIM1_CH1',
    'PA9': 'USART1_TX / TIM1_CH2',
    'PA10': 'USART1_RX / TIM1_CH3',
    'PA11': 'USB_D- / TIM1_CH4',
    'PA12': 'USB_D+',
    'PB0': 'ADC1_IN8 / TIM3_CH3',
    'PB1': 'ADC1_IN9 / TIM3_CH4',
    'PB5': 'I2C1_SMBA / SPI3_MOSI',
    'PB6': 'I2C1_SCL / USART1_TX',
    'PB7': 'I2C1_SDA / USART1_RX',
    'PB8': 'I2C1_SCL / TIM4_CH3',
    'PB9': 'I2C1_SDA / TIM4_CH4',
    'PB10': 'I2C2_SCL / USART3_TX',
    'PB11': 'I2C2_SDA / USART3_RX',
    'PC13': 'RTC_AF1',
  },
  'ESP32': {
    'GPIO0': 'Boot / ADC2_CH0',
    'GPIO1': 'UART0_TX',
    'GPIO2': 'ADC2_CH2 / LED_BUILTIN',
    'GPIO3': 'UART0_RX',
    'GPIO4': 'ADC2_CH0 / I2C_SDA',
    'GPIO5': 'I2C_SCL',
    'GPIO12': 'ADC2_CH5 / SPI_MISO',
    'GPIO13': 'ADC2_CH4 / SPI_MOSI',
    'GPIO14': 'ADC2_CH6 / SPI_SCK',
    'GPIO15': 'ADC2_CH3 / SPI_SS',
    'GPIO16': 'UART2_TX',
    'GPIO17': 'UART2_RX',
    'GPIO18': 'VSPI_SCK',
    'GPIO19': 'VSPI_MISO',
    'GPIO21': 'I2C_SDA',
    'GPIO22': 'I2C_SCL',
    'GPIO23': 'VSPI_MOSI',
    'GPIO25': 'ADC2_CH8 / DAC1',
    'GPIO26': 'ADC2_CH9 / DAC2',
  },
  'Arduino': {
    'A0': 'ADC0',
    'A1': 'ADC1',
    'A2': 'ADC2',
    'A3': 'ADC3',
    'A4': 'I2C_SDA',
    'A5': 'I2C_SCL',
    'D0': 'UART_RX',
    'D1': 'UART_TX',
    'D2': 'INT0',
    'D3': 'INT1 / PWM',
    'D4': 'PWM',
    'D5': 'PWM',
    'D6': 'PWM',
    'D9': 'PWM',
    'D10': 'PWM / SPI_SS',
    'D11': 'SPI_MOSI',
    'D12': 'SPI_MISO',
    'D13': 'SPI_SCK / LED',
  },
};

/**
 * 生成接线图 HTML
 * @param {Object} modules - 模块信息
 * @returns {string} HTML 源码
 */
function generateWiringDiagram(modules) {
  const { mcu, inputModules, outputModules, interfaces } = modules;
  const pins = MCU_PINS[mcu] || MCU_PINS['STM32'];

  let inputSections = '';
  inputModules.forEach((mod, idx) => {
    inputSections += `
        <div class="module input">
            <div class="module-name">${mod}</div>
            <div class="pins">
                <div class="pin signal">信号</div>
                <div class="pin vcc">VCC</div>
                <div class="pin gnd">GND</div>
            </div>
        </div>`;
  });

  let outputSections = '';
  outputModules.forEach((mod, idx) => {
    outputSections += `
        <div class="module output">
            <div class="module-name">${mod}</div>
            <div class="pins">
                <div class="pin signal">信号</div>
                <div class="pin vcc">VCC</div>
                <div class="pin gnd">GND</div>
            </div>
        </div>`;
  });

  let interfaceSections = '';
  interfaces.forEach((iface, idx) => {
    interfaceSections += `
        <div class="module interface">
            <div class="module-name">${iface}</div>
            <div class="pins">
                <div class="pin signal">SCL/SDA</div>
                <div class="pin vcc">VCC</div>
                <div class="pin gnd">GND</div>
            </div>
        </div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mcu} 接线图</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            background: #1a1a2e;
            min-height: 100vh;
            padding: 20px;
            color: #eee;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            color: #fff;
        }
        .wiring-container {
            display: flex;
            justify-content: space-around;
            align-items: center;
            flex-wrap: wrap;
            gap: 40px;
        }
        .module {
            background: #16213e;
            border-radius: 10px;
            padding: 15px;
            min-width: 150px;
            border: 2px solid #0f3460;
        }
        .module-name {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 5px;
            border-radius: 5px;
        }
        .input .module-name { background: #e94560; }
        .output .module-name { background: #4ecca3; color: #1a1a2e; }
        .interface .module-name { background: #f9d71c; color: #1a1a2e; }
        .mcu {
            background: #0f3460;
            border: 2px solid #f9d71c;
        }
        .mcu .module-name {
            background: #f9d71c;
            color: #1a1a2e;
        }
        .pins {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .pin {
            padding: 8px 15px;
            border-radius: 5px;
            font-size: 12px;
            text-align: center;
        }
        .signal { background: #e94560; color: #fff; }
        .vcc { background: #ff6b6b; color: #fff; }
        .gnd { background: #333; color: #fff; }
        .connections {
            margin-top: 40px;
            padding: 20px;
            background: #16213e;
            border-radius: 10px;
        }
        .connections h3 {
            margin-bottom: 15px;
            color: #4ecca3;
        }
        .connection-item {
            padding: 8px;
            margin: 5px 0;
            background: #0f3460;
            border-radius: 5px;
            font-family: monospace;
            font-size: 13px;
        }
        .editable {
            outline: none;
            display: block;
        }
        .editable:focus {
            background: #1a3a5c;
            box-shadow: 0 0 0 2px #4ecca3;
        }
    </style>
</head>
<body>
    <h1>${mcu} 硬件接线图</h1>
    <div class="wiring-container">
        <div class="module input">${inputSections}
        </div>
        <div class="module mcu">
            <div class="module-name">${mcu}</div>
            <div class="pins">
                <div class="pin editable" contenteditable="true">PA2 (TX)</div>
                <div class="pin editable" contenteditable="true">PA3 (RX)</div>
                <div class="pin editable" contenteditable="true">PB6 (SCL)</div>
                <div class="pin editable" contenteditable="true">PB7 (SDA)</div>
                <div class="pin editable" contenteditable="true">PA0 (ADC)</div>
                <div class="pin vcc">3.3V</div>
                <div class="pin gnd">GND</div>
            </div>
        </div>
        <div class="module output">${outputSections}
        </div>
        ${interfaces.length > 0 ? `<div class="module interface">${interfaceSections}</div>` : ''}
    </div>
    <div class="connections">
        <h3>接线说明</h3>
        <div class="connection-item editable" contenteditable="true">语音模块 TX → ${mcu} PA3 (USART_RX)</div>
        <div class="connection-item editable" contenteditable="true">语音模块 RX → ${mcu} PA2 (USART_TX)</div>
        <div class="connection-item editable" contenteditable="true">继电器 IN → ${mcu} PA0 (GPIO)</div>
        <div class="connection-item editable" contenteditable="true">LED + → ${mcu} PA1 (PWM)</div>
        <div class="connection-item editable" contenteditable="true">LED - → GND</div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * 生成接线图文件
 * @param {string} userMessage - 用户需求描述
 * @param {string} outputDir - 输出目录
 * @param {string} projectName - 项目名称
 * @returns {Object} 生成结果
 */
function generate({ userMessage, outputDir, projectName }) {
  // 复用 architecture.js 的分析逻辑
  const { analyzeRequirements } = require('./architecture.js');
  const modules = analyzeRequirements(userMessage);

  const wiringHtml = generateWiringDiagram(modules);
  const wiringPreviewHtml = generateWiringDiagram(modules);

  // 生成 AI 可编辑版本（带注释，便于修改）
  const editableHtml = generateEditableWiringDiagram(modules);

  const files = {
    'wiring.html': editableHtml,
    'wiring_preview.html': wiringPreviewHtml,
  };

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];
  for (const [filename, content] of Object.entries(files)) {
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    results.push({ filepath, filename, content });
  }

  return {
    success: true,
    files: results,
    modules,
  };
}

/**
 * 生成 AI 可编辑的接线图（带详细注释）
 */
function generateEditableWiringDiagram(modules) {
  const { mcu, inputModules, outputModules, interfaces } = modules;
  const pins = MCU_PINS[mcu] || MCU_PINS['STM32'];

  const inputStr = inputModules.join(', ');
  const outputStr = outputModules.join(', ');
  const interfacesStr = interfaces.join(', ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${mcu} 接线图 - AI 可编辑版</title>
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
        .editable { outline: none; background: #16213e; padding: 5px; border-radius: 3px; }
        .editable:focus { background: #1a3a5c; box-shadow: 0 0 0 2px #4ecca3; }
        .comment { color: #6a9955; } /* 绿色注释 */
        .keyword { color: #569cd6; } /* 蓝色关键词 */
        table { border-collapse: collapse; margin: 20px 0; }
        td, th { border: 1px solid #333; padding: 8px; }
        th { background: #0f3460; }
    </style>
</head>
<body>
    <h1><!-- ${mcu} ${inputStr} → ${outputStr} --></h1>

    <h2>硬件清单</h2>
    <ul>
        <li>主控: <span class="editable" contenteditable="true">${mcu}</span></li>
        <li>输入: <span class="editable" contenteditable="true">${inputStr}</span></li>
        <li>输出: <span class="editable" contenteditable="true">${outputStr}</span></li>
        ${interfacesStr ? `<li>通信: <span class="editable" contenteditable="true">${interfacesStr}</span></li>` : ''}
    </ul>

    <h2>接线表</h2>
    <!-- ========================================== -->
    <!-- AI 可编辑区域 - 修改引脚连接时请保持格式 -->
    <!-- ========================================== -->

    <table>
        <tr>
            <th>模块</th>
            <th>引脚</th>
            <th>连接到</th>
            <th>说明</th>
        </tr>
        <tr>
            <td><span class="editable" contenteditable="true">${inputModules[0] || '输入模块'}</span></td>
            <td><span class="editable" contenteditable="true">TX</span></td>
            <td><span class="editable" contenteditable="true">${mcu} PA3</span></td>
            <td><span class="editable" contenteditable="true">串口接收</span></td>
        </tr>
        <tr>
            <td><span class="editable" contenteditable="true">${inputModules[0] || '输入模块'}</span></td>
            <td><span class="editable" contenteditable="true">RX</span></td>
            <td><span class="editable" contenteditable="true">${mcu} PA2</span></td>
            <td><span class="editable" contenteditable="true">串口发送</span></td>
        </tr>
        <tr>
            <td><span class="editable" contenteditable="true">${outputModules[0] || '输出模块'}</span></td>
            <td><span class="editable" contenteditable="true">IN</span></td>
            <td><span class="editable" contenteditable="true">${mcu} PA0</span></td>
            <td><span class="editable" contenteditable="true">控制信号</span></td>
        </tr>
        <tr>
            <td><span class="editable" contenteditable="true">${outputModules[0] || '输出模块'}</span></td>
            <td><span class="editable" contenteditable="true">VCC</span></td>
            <td><span class="editable" contenteditable="true">3.3V</span></td>
            <td><span class="editable" contenteditable="true">电源</span></td>
        </tr>
        <tr>
            <td><span class="editable" contenteditable="true">${outputModules[0] || '输出模块'}</span></td>
            <td><span class="editable" contenteditable="true">GND</span></td>
            <td><span class="editable" contenteditable="true">GND</span></td>
            <td><span class="editable" contenteditable="true">地</span></td>
        </tr>
    </table>

    <h2>${mcu} 引脚参考</h2>
    <pre>
    <!-- AI 可根据需要修改引脚分配 -->
${Object.entries(pins).slice(0, 10).map(([pin, func]) => `${pin}: ${func}`).join('\n')}
    </pre>

    <h2>注意事项</h2>
    <!-- 请根据实际硬件调整 -->
    <!-- 1. 确认电压兼容 (3.3V vs 5V) -->
    <!-- 2. 检查 I2C 地址是否冲突 -->
    <!-- 3. 确认串口波特率设置 -->
</body>
</html>`;
}

module.exports = {
  generateWiringDiagram,
  generate,
};