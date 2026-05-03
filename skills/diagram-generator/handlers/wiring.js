/**
 * Wiring Diagram Handler
 * 生成硬件接线图（HTML + CSS 格式）
 */

const fs = require('fs');
const path = require('path');

/**
 * 从编辑器模板中提取模块库
 * @param {string} template - 编辑器 HTML 模板
 * @returns {Object} { 'STM32F103': { type: 'mcu', sidebarLabel: 'STM32F103' }, 'LDR': { type: 'input', sidebarLabel: '光敏电阻' }, ... }
 */
function extractModuleLibrary(template) {
  const library = {};

  // 从 moduleDefs 提取模块名和类型
  const defRegex = /'([^']+)':\s*\{\s*type:\s*'(mcu|input|output)'/g;
  let match;
  while ((match = defRegex.exec(template)) !== null) {
    library[match[1]] = { type: match[2], sidebarLabel: match[1] };
  }

  // 从侧边栏 HTML 提取中文标签（data-module 后的第一个 <div> 文字）
  const sidebarRegex = /data-module="([^"]+)"[^>]*>/g;
  while ((match = sidebarRegex.exec(template)) !== null) {
    const editorName = match[1];
    // 在 data-module 之后找第一个 <div>...</div> 的文字内容
    const afterMatch = template.slice(match.index + match[0].length);
    const labelMatch = afterMatch.match(/<div>([^<]+)<\/div>/);
    if (labelMatch && library[editorName]) {
      library[editorName].sidebarLabel = labelMatch[1].trim();
    }
  }

  return library;
}

/**
 * 在库中按名称查找模块（精确匹配 key 或 sidebarLabel）
 */
function findByName(name, library) {
  const lower = name.toLowerCase();
  for (const [key, info] of Object.entries(library)) {
    if (key.toLowerCase() === lower || info.sidebarLabel.toLowerCase() === lower) {
      return key;
    }
  }
  return null;
}

/**
 * 在库中按包含关系查找模块（sidebarLabel 包含 name 或反过来）
 */
function findByContains(name, library) {
  const lower = name.toLowerCase();
  for (const [key, info] of Object.entries(library)) {
    const label = info.sidebarLabel.toLowerCase();
    if (label.includes(lower) || lower.includes(label)) {
      return key;
    }
  }
  return null;
}

/**
 * 在库中按接口类型查找模块
 */
function findByInterface(interfaceType, moduleType, library) {
  if (!interfaceType) return null;
  const iface = interfaceType.toUpperCase();
  const patterns = {
    'SPI': /SCK|MISO|MOSI/,
    'I2C': /I2C|SCL|SDA/,
    'ADC': /ADC|LDR|MQ|LIGHT|SENSOR/,
  };
  const pattern = patterns[iface];
  if (!pattern) return null;
  for (const [key, info] of Object.entries(library)) {
    if (info.type !== moduleType) continue;
    if (pattern.test(key.toUpperCase())) return key;
  }
  return null;
}

/**
 * 匹配需求模块到编辑器模块库
 * @param {string} moduleName - 需求中的模块名（如 "LD3320 语音识别模块"）
 * @param {string} interfaceType - 接口类型（如 "SPI", "I2C", "ADC"）
 * @param {string} moduleType - 模块类型（"input" 或 "output"）
 * @param {Object} library - extractModuleLibrary 的返回值
 * @returns {{ matched: boolean, editorName: string }}
 */
function matchModule(moduleName, interfaceType, moduleType, library) {
  const hit = findByName(moduleName, library)
    || findByContains(moduleName, library)
    || findByInterface(interfaceType, moduleType, library);
  return hit ? { matched: true, editorName: hit } : { matched: false, editorName: '' };
}

/**
 * 根据接口类型生成模块定义
 * @param {string} name - 模块名
 * @param {string} interfaceType - 接口类型
 * @param {string} type - 'input' 或 'output'
 * @returns {{ name, type, pins }}
 */
function generateModuleDef(name, interfaceType, type) {
  const iface = (interfaceType || 'GPIO').toUpperCase();
  const defs = {
    'SPI':  { type: 'input', pins: ['SCK:output:SPI_CLK', 'MISO:input:SPI_MISO', 'MOSI:output:SPI_MOSI', 'CS:output:SPI_CS', 'IRQ:input:中断', 'VCC:input:3.3V', 'GND:input:GND'] },
    'I2C':  { type: 'input', pins: ['SCL:bidirectional:I2C', 'SDA:bidirectional:I2C', 'VCC:input:3.3V', 'GND:input:GND'] },
    'UART': { type: 'input', pins: ['TX:output:', 'RX:input:', 'VCC:input:3.3V', 'GND:input:GND'] },
    'ADC':  { type: 'input', pins: ['AOUT:output:ADC', 'VCC:input:3.3V', 'GND:input:GND'] },
    'GPIO': { type: 'input', pins: ['SIG:output:', 'VCC:input:3.3V', 'GND:input:GND'] },
  };
  const def = defs[iface] || defs['GPIO'];
  return {
    name,
    type: type || def.type,
    pins: def.pins.map(p => {
      const [pname, ptype, pvalue] = p.split(':');
      return `{ name: '${pname}', type: '${ptype}', value: '${pvalue}' }`;
    }),
  };
}

/**
 * 将新模块永久写入编辑器模板
 * @param {string} template - 编辑器 HTML 模板
 * @param {Object} moduleDef - generateModuleDef 的返回值
 * @returns {string} 修改后的模板
 */
function addModuleToTemplate(template, moduleDef) {
  // 1. 在 moduleDefs 中添加引脚定义
  const pinsStr = moduleDef.pins.join(',\n                ');
  const defEntry = `            '${moduleDef.name}': { type: '${moduleDef.type}', pins: [\n                ${pinsStr}\n            ]},`;

  // 在 Rotary Encoder 定义之后插入（输入模块区域末尾）
  const insertAfter = template.indexOf("'Rotary Encoder':");
  if (insertAfter > -1) {
    const lineEnd = template.indexOf(']},', insertAfter) + 3;
    template = template.slice(0, lineEnd) + '\n' + defEntry + template.slice(lineEnd);
  }

  // 2. 在侧边栏 HTML 中添加模块项
  const categoryMap = { 'input': 'input', 'output': 'output', 'mcu': 'mcu' };
  const cat = categoryMap[moduleDef.type] || 'input';
  const pinNames = moduleDef.pins.map(p => p.split(':')[0]).join(', ');
  const sidebarEntry = `                    <div class="module-item" draggable="true" data-type="${cat}" data-module="${moduleDef.name}">
                        <div>${moduleDef.name}</div>
                        <div class="pin-count">${pinNames}</div>
                    </div>`;

  // 在对应类别的最后一个 module-item 之后插入
  const catMarker = `data-cat="${cat}"`;
  const catStart = template.indexOf(catMarker);
  if (catStart > -1) {
    // 找到该类别的最后一个 </div> 闭合标签
    const nextCatStart = template.indexOf('data-cat="', catStart + catMarker.length);
    const searchEnd = nextCatStart > -1 ? nextCatStart : template.indexOf('</div>\n', catStart + 500);
    const lastItemEnd = template.lastIndexOf('</div>', searchEnd > -1 ? searchEnd : template.length);
    if (lastItemEnd > -1) {
      template = template.slice(0, lastItemEnd + 6) + '\n' + sidebarEntry + template.slice(lastItemEnd + 6);
    }
  }

  return template;
}

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
function generateWiringDiagram(modules, requirements) {
  const { mcu, inputModules, outputModules, interfaces } = modules;
  const pins = MCU_PINS[mcu] || MCU_PINS['STM32'];

  // 从 requirements 获取模块详细信息
  const inputDetails = (requirements && requirements.inputs) || [];
  const outputDetails = (requirements && requirements.outputs) || [];

  let inputSections = '';
  inputModules.forEach((mod, idx) => {
    const detail = inputDetails.find(d => d.module === mod) || {};
    const sigLabel = detail.pin ? `${detail.pin} (${detail.interface || '信号'})` : '信号';
    const vccLabel = detail.voltage || '3.3V';
    inputSections += `
        <div class="module input">
            <div class="module-name">${mod}</div>
            <div class="pins">
                <div class="pin signal">${sigLabel}</div>
                <div class="pin vcc">${vccLabel}</div>
                <div class="pin gnd">GND</div>
            </div>
        </div>`;
  });

  let outputSections = '';
  outputModules.forEach((mod, idx) => {
    const detail = outputDetails.find(d => d.module === mod) || {};
    const sigLabel = detail.pin ? `${detail.pin} (${detail.interface || '信号'})` : '信号';
    const vccLabel = detail.voltage || '5V';
    outputSections += `
        <div class="module output">
            <div class="module-name">${mod}</div>
            <div class="pins">
                <div class="pin signal">${sigLabel}</div>
                <div class="pin vcc">${vccLabel}</div>
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

  // 从 requirements 构建接线说明
  const connectionItems = [];
  if (requirements && requirements.inputs) {
    requirements.inputs.forEach(input => {
      connectionItems.push(`${input.module} ${input.pin || '信号'} → ${mcu} ${input.pin || 'PA0'} (${input.interface || 'GPIO'})`);
      connectionItems.push(`${input.module} VCC → ${input.voltage || '3.3V'}`);
      connectionItems.push(`${input.module} GND → GND`);
    });
  }
  if (requirements && requirements.outputs) {
    requirements.outputs.forEach(output => {
      connectionItems.push(`${output.module} ${output.pin || '信号'} → ${mcu} ${output.pin || 'PA1'} (${output.interface || 'GPIO'})`);
      connectionItems.push(`${output.module} VCC → ${output.voltage || '5V'}`);
      connectionItems.push(`${output.module} GND → GND`);
    });
  }
  // 回退到默认接线说明
  if (connectionItems.length === 0) {
    connectionItems.push(`${inputModules[0] || '输入模块'} 信号 → ${mcu} PA0`);
    connectionItems.push(`${outputModules[0] || '输出模块'} 信号 → ${mcu} PA1`);
  }

  const connectionHtml = connectionItems.map(text =>
    `<div class="connection-item editable" contenteditable="true">${text}</div>`
  ).join('\n        ');

  // 构建 MCU 引脚列表（使用实际连接的引脚）
  const usedPins = [];
  if (requirements) {
    if (requirements.inputs) requirements.inputs.forEach(i => { if (i.pin) usedPins.push(i.pin); });
    if (requirements.outputs) requirements.outputs.forEach(o => { if (o.pin) usedPins.push(o.pin); });
  }
  const mcuPinHtml = usedPins.length > 0
    ? usedPins.map(p => `<div class="pin editable" contenteditable="true">${p} (${pins[p] || 'GPIO'})</div>`).join('\n                ')
    : `<div class="pin editable" contenteditable="true">PA2 (TX)</div>
                <div class="pin editable" contenteditable="true">PA3 (RX)</div>
                <div class="pin editable" contenteditable="true">PB6 (SCL)</div>
                <div class="pin editable" contenteditable="true">PB7 (SDA)</div>
                <div class="pin editable" contenteditable="true">PA0 (ADC)</div>`;

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
                ${mcuPinHtml}
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
        ${connectionHtml}
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
function generate({ userMessage, outputDir, projectName, requirements }) {
  const { analyzeRequirements } = require('./architecture.js');

  // 优先使用 requirements 数据
  let modules;
  if (requirements?.mcu) {
    modules = {
      mcu: requirements.mcu,
      inputModules: requirements.inputs?.map(i => i.module) || [],
      outputModules: requirements.outputs?.map(o => o.module) || [],
      interfaces: requirements.interfaces || [],
    };
  } else {
    modules = analyzeRequirements(userMessage);
  }

  // 生成可编辑版本（模块视图 + 接线说明）
  const editableHtml = generateWiringDiagram(modules, requirements);

  // 生成预览版本（纯展示，不可编辑）
  const previewHtml = generatePreviewWiringDiagram(modules, requirements);

  const files = {
    'wiring.html': editableHtml,
    'wiring_preview.html': previewHtml,
  };

  // 有 requirements 时生成编辑器版本
  let unmatched = [];
  if (requirements) {
    const result = generateEditor(modules, requirements);
    unmatched = result.unmatched;

    if (unmatched.length > 0) {
      // 将未匹配的模块永久写入模板
      const templatePath = path.join(__dirname, '..', 'wiring-editor.html');
      let baseTemplate = fs.readFileSync(templatePath, 'utf8');
      for (const mod of unmatched) {
        const moduleDef = generateModuleDef(mod.module, mod.interface, mod.type);
        baseTemplate = addModuleToTemplate(baseTemplate, moduleDef);
      }
      // 持久化到模板文件（以后所有项目都能用）
      fs.writeFileSync(templatePath, baseTemplate, 'utf8');

      // 用更新后的模板重新生成编辑器（所有模块现在都匹配了）
      const reResult = generateEditor(modules, requirements);
      files['wiring_editor.html'] = reResult.template;
    } else {
      files['wiring_editor.html'] = result.template;
    }
  }

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
    unmatched,
  };
}

/**
 * 生成 AI 可编辑的接线图（带详细注释）
 */
function generateEditableWiringDiagram(modules, requirements) {
  const { mcu, inputModules, outputModules, interfaces } = modules;
  const pins = MCU_PINS[mcu] || MCU_PINS['STM32'];

  // 从 requirements 构建接线表
  const connections = [];
  if (requirements && requirements.inputs) {
    requirements.inputs.forEach(input => {
      connections.push({
        module: input.module,
        pin: '信号',
        target: `${mcu} ${input.pin || 'PA0'}`,
        note: input.interface || 'GPIO',
      });
      connections.push({
        module: input.module,
        pin: 'VCC',
        target: input.voltage || '3.3V',
        note: '电源',
      });
      connections.push({
        module: input.module,
        pin: 'GND',
        target: 'GND',
        note: '地',
      });
    });
  }
  if (requirements && requirements.outputs) {
    requirements.outputs.forEach(output => {
      connections.push({
        module: output.module,
        pin: '信号',
        target: `${mcu} ${output.pin || 'PA1'}`,
        note: output.interface || 'GPIO',
      });
      connections.push({
        module: output.module,
        pin: 'VCC',
        target: output.voltage || '5V',
        note: '电源',
      });
      connections.push({
        module: output.module,
        pin: 'GND',
        target: 'GND',
        note: '地',
      });
    });
  }

  const connectionRows = connections.map(c => `
        <tr>
            <td><span class="editable" contenteditable="true">${c.module}</span></td>
            <td><span class="editable" contenteditable="true">${c.pin}</span></td>
            <td><span class="editable" contenteditable="true">${c.target}</span></td>
            <td><span class="editable" contenteditable="true">${c.note}</span></td>
        </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${mcu} 接线图 - AI 可编辑版</title>
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
        .editable { outline: none; background: #16213e; padding: 5px; border-radius: 3px; }
        .editable:focus { background: #1a3a5c; box-shadow: 0 0 0 2px #4ecca3; }
        table { border-collapse: collapse; margin: 20px 0; }
        td, th { border: 1px solid #333; padding: 8px; }
        th { background: #0f3460; }
    </style>
</head>
<body>
    <h1>${mcu} 接线图 - AI 可编辑版</h1>

    <h2>硬件清单</h2>
    <ul>
        <li>主控: ${mcu}</li>
        <li>输入: ${inputModules.join(', ')}</li>
        <li>输出: ${outputModules.join(', ')}</li>
        ${interfaces.length > 0 ? `<li>通信: ${interfaces.join(', ')}</li>` : ''}
    </ul>

    <h2>接线表</h2>
    <table>
        <tr>
            <th>模块</th>
            <th>引脚</th>
            <th>连接到</th>
            <th>说明</th>
        </tr>
        ${connectionRows}
    </table>

    <h2>${mcu} 引脚参考</h2>
    <pre>
${Object.entries(pins).slice(0, 10).map(([pin, func]) => `${pin}: ${func}`).join('\n')}
    </pre>
</body>
</html>`;
}

function generatePreviewWiringDiagram(modules, requirements) {
  const { mcu, inputModules, outputModules } = modules;

  let inputsHtml = inputModules.map(m => `<div class="module input">${m}</div>`).join('');
  let outputsHtml = outputModules.map(m => `<div class="module output">${m}</div>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${mcu} 接线图 - 预览</title>
    <style>
        body { font-family: sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
        .diagram { display: flex; justify-content: center; align-items: center; gap: 40px; flex-wrap: wrap; padding: 40px; }
        .module { background: #16213e; border: 2px solid #0f3460; border-radius: 10px; padding: 15px 20px; min-width: 120px; text-align: center; }
        .mcu { border-color: #f9d71c; background: #0f3460; font-weight: bold; font-size: 18px; }
        .input { border-color: #e94560; }
        .output { border-color: #4ecca3; }
        .arrow { color: #f9d71c; font-size: 24px; }
    </style>
</head>
<body>
    <h1 style="text-align:center">${mcu} 接线图预览</h1>
    <div class="diagram">
        <div>${inputsHtml}</div>
        <div class="arrow">&rarr;</div>
        <div class="module mcu">${mcu}</div>
        <div class="arrow">&rarr;</div>
        <div>${outputsHtml}</div>
    </div>
</body>
</html>`;
}

/**
 * 解析 requirements 中的引脚映射字符串
 * 如 "PA5/PA6/PA7 (SPI1), PA4 (CS), PB0 (IRQ)" → { SCK: 'PA5', MISO: 'PA6', MOSI: 'PA7', CS: 'PA4', IRQ: 'PB0' }
 */
function parsePinMapping(pinStr) {
  const result = {};
  if (!pinStr) return result;

  const parts = pinStr.split(/[,;]+/).map(s => s.trim());
  parts.forEach(part => {
    const pinMatch = part.match(/(P[A-Z]\d+)/g);
    const labelMatch = part.match(/\(([^)]+)\)/);
    if (pinMatch && labelMatch) {
      const label = labelMatch[1].trim();
      if (/^SPI\d*$/i.test(label)) {
        const spiNames = ['SCK', 'MISO', 'MOSI'];
        pinMatch.forEach((pin, pi) => { if (spiNames[pi]) result[spiNames[pi]] = pin; });
      } else {
        const key = label.replace(/SPI\d*_?/, '').replace(/CH\d+/, '').trim();
        if (key && pinMatch[0]) result[key] = pinMatch[0];
      }
    }
  });
  return result;
}

/**
 * 生成接线图编辑器（预填充 requirements 数据）
 *
 * 流程：读取模块库 → 匹配需求模块 → 匹配成功直接使用 → 匹配失败收集到 unmatched
 *
 * @param {Object} modules - 模块信息
 * @param {Object} requirements - 结构化需求
 * @returns {{ template: string, unmatched: Array<{ module, interface, type, pin }> }}
 */
function generateEditor(modules, requirements) {
  const { mcu } = modules;

  const inputs = (requirements && requirements.inputs) || modules.inputModules.map(m => ({ module: m }));
  const outputs = (requirements && requirements.outputs) || modules.outputModules.map(m => ({ module: m }));

  // 读取编辑器模板
  const templatePath = path.join(__dirname, '..', 'wiring-editor.html');
  let template = fs.readFileSync(templatePath, 'utf8');

  // 提取模块库，逐一匹配
  const library = extractModuleLibrary(template);
  const matchedInputs = [];
  const matchedOutputs = [];
  const unmatched = [];

  inputs.forEach(input => {
    const result = matchModule(input.module, input.interface, 'input', library);
    if (result.matched) {
      matchedInputs.push({ ...input, editorName: result.editorName });
    } else {
      unmatched.push({ ...input, type: 'input' });
    }
  });

  outputs.forEach(output => {
    const result = matchModule(output.module, output.interface, 'output', library);
    if (result.matched) {
      matchedOutputs.push({ ...output, editorName: result.editorName });
    } else {
      unmatched.push({ ...output, type: 'output' });
    }
  });

  // 构建预填充脚本（只包含匹配成功的模块）
  const presetScript = buildPresetScript(mcu, matchedInputs, matchedOutputs, requirements);

  // 注入预填充脚本
  template = template.replace(
    '        // ─── Init ───\n        loadDiagram();\n        saveSnapshot();',
    presetScript + '\n        // ─── Init ───\n        loadDiagram();\n        saveSnapshot();'
  );

  return { template, unmatched };
}

/**
 * 构建预填充脚本（注入到编辑器中执行）
 */
function buildPresetScript(mcu, matchedInputs, matchedOutputs, requirements) {
  const projectName = (requirements && requirements.projectName) || mcu;

  // MCU 映射
  const mcuMap = {
    'STM32F103C8T6': 'STM32F103', 'STM32F103': 'STM32F103',
    'STM32F407': 'STM32F103', 'STM32': 'STM32F103',
    'ESP32': 'ESP32', 'Arduino': 'Arduino', 'Arduino Uno': 'Arduino',
  };
  const mcuName = mcuMap[mcu] || 'STM32F103';

  // 输入模块连线逻辑
  let inputScript = '';
  matchedInputs.forEach((input, i) => {
    // 只有多引脚接口（SPI/I2C/UART）才解析引脚映射，单引脚接口（ADC/GPIO）直接用第一个引脚名
    const multiPinInterfaces = ['SPI', 'I2C', 'UART'];
    const isMultiPin = multiPinInterfaces.includes((input.interface || '').toUpperCase());
    const pinMap = isMultiPin ? parsePinMapping(input.pin) : {};
    const hasPinMap = Object.keys(pinMap).length > 0;

    inputScript += `
      addModule('${input.editorName}', 'input', 40, ${40 + i * 160});
      (function(inputMod) {
        setTimeout(function() {
          ${hasPinMap ? `
          // 多引脚模块（如 SPI）：逐一连接
          var pinMap = ${JSON.stringify(pinMap)};
          Object.keys(pinMap).forEach(function(pinName) {
            addWire(inputMod.id, pinName, mcuModule.id, pinMap[pinName]);
          });
          addWire(inputMod.id, 'VCC', mcuModule.id, '3.3V');
          addWire(inputMod.id, 'GND', mcuModule.id, 'GND');
          ` : `
          // 单引脚模块：找第一个信号引脚连到 requirements 指定的 MCU 引脚
          var sigPin = inputMod.pins.find(function(p) {
            return p.type !== 'input' && p.name !== 'VCC' && p.name !== 'GND';
          });
          var mcuPin = '${(input.pin || '').split(/\s/)[0] || 'PA' + i}';
          if (sigPin) {
            addWire(inputMod.id, sigPin.name, mcuModule.id, mcuPin);
            addWire(inputMod.id, 'VCC', mcuModule.id, '3.3V');
            addWire(inputMod.id, 'GND', mcuModule.id, 'GND');
          }
          `}
        }, ${100 + i * 50});
      })(state.modules[state.modules.length - 1]);
    `;
  });

  // 输出模块连线逻辑
  let outputScript = '';
  matchedOutputs.forEach((output, i) => {
    const mcuPin = (output.pin || '').split(/\s/)[0] || 'PA' + (matchedInputs.length + i);
    outputScript += `
      addModule('${output.editorName}', 'output', 580, ${40 + i * 130});
      (function(outputMod) {
        setTimeout(function() {
          var sigPin = outputMod.pins.find(function(p) {
            return p.type !== 'input' && p.name !== 'VCC' && p.name !== 'GND';
          }) || outputMod.pins.find(function(p) {
            return p.name !== 'VCC' && p.name !== 'GND';
          });
          if (sigPin) {
            addWire(outputMod.id, sigPin.name, mcuModule.id, '${mcuPin}');
            addWire(outputMod.id, 'VCC', mcuModule.id, '3.3V');
            addWire(outputMod.id, 'GND', mcuModule.id, 'GND');
          }
        }, ${200 + i * 50});
      })(state.modules[state.modules.length - 1]);
    `;
  });

  return `
    // === 预填充模块（由 diagram-agent 生成） ===
    // 标记有预填充数据，跳过 loadDiagram()
    state._hasPreset = true;
    (function() {
      // 添加 MCU
      addModule('${mcuName}', 'mcu', 300, 160);
      var mcuModule = state.modules[state.modules.length - 1];

      // 输入模块
      ${inputScript}

      // 输出模块
      ${outputScript}

      // 更新标题
      document.querySelector('.toolbar-title').textContent = '${projectName} 接线图编辑器';
      if (typeof saveSnapshot === 'function') saveSnapshot();
    })();
  `;
}

module.exports = {
  generateWiringDiagram,
  generate,
  generateEditor,
  extractModuleLibrary,
  matchModule,
  addModuleToTemplate,
  generateModuleDef,
  parsePinMapping,
};