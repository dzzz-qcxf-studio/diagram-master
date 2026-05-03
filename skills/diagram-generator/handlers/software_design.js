/**
 * Software Design Handler
 * 基于 requirements.json 生成软件设计文档（Markdown 格式）
 * 为代码实现阶段提供详细的设计指导
 */

const fs = require('fs');
const path = require('path');

// ─── 模块架构推断 ───

function inferModuleArchitecture(requirements) {
  const modules = [{ name: 'system_init', hw: requirements.mcu, desc: '时钟、GPIO、外设初始化' }];

  for (const inp of requirements.inputs ?? []) {
    const name = moduleName(inp.module, inp.interface);
    modules.push({ name, hw: `${inp.module} (${inp.pin})`, desc: `${inp.module} 驱动` });
  }

  for (const out of requirements.outputs ?? []) {
    const name = moduleName(out.module, out.interface);
    modules.push({ name, hw: `${out.module} (${out.pin})`, desc: `${out.module} 控制` });
  }

  return modules;
}

function moduleName(module, iface) {
  const map = {
    'LD3320': 'voice_module', '语音': 'voice_module',
    '光敏': 'ldr_sensor', 'LDR': 'ldr_sensor',
    'LED': 'led_control', '灯': 'led_control',
    'DS18B20': 'temp_sensor', 'DHT': 'dht_sensor',
    'PIR': 'pir_sensor', '红外': 'ir_sensor',
    '蜂鸣器': 'buzzer', '继电器': 'relay',
    'OLED': 'display', 'LCD': 'display',
    'MPU6050': 'imu_sensor', 'BMP280': 'baro_sensor',
  };
  for (const [key, val] of Object.entries(map)) {
    if (module.includes(key)) return val;
  }
  const ifaceMap = { 'ADC': 'analog_sensor', 'GPIO': 'gpio_device', 'SPI': 'spi_device', 'I2C': 'i2c_device', 'UART': 'uart_device' };
  return ifaceMap[(iface ?? '').toUpperCase()] ?? 'device';
}

// ─── 初始化顺序推断 ───

const MODULE_INIT_RE = [
  [/LD3320|语音/i, 'SPI 命令配置'],
  [/DHT/i, '启动传感器'],
];
const OUTPUT_INIT_RE = /LED|灯|继电器/i;
const IFACE_ORDER = ['SPI', 'I2C', 'UART', 'ADC', 'OneWire', 'PWM'];

function inferInitOrder(requirements) {
  const steps = ['系统时钟 → HSE 72MHz'];
  const allModules = [...(requirements.inputs ?? []), ...(requirements.outputs ?? [])];

  // GPIO 引脚
  const pinStr = allModules.filter(m => m.pin).flatMap(m => m.pin.split(',').map(s => s.trim().split(/\s/)[0])).join(', ');
  if (pinStr) steps.push(`GPIO → ${pinStr}`);

  // 外设初始化（按优先级顺序，去重）
  const seen = new Set();
  for (const iface of IFACE_ORDER) {
    if (allModules.some(m => (m.interface ?? '').toUpperCase() === iface) && seen.add(iface)) {
      steps.push(`${iface} 初始化`);
    }
  }

  // 模块特定初始化 + 输出初始状态
  for (const mod of allModules) {
    const entry = MODULE_INIT_RE.find(([re]) => re.test(mod.module ?? ''));
    if (entry) steps.push(`${mod.module} → ${entry[1]}`);
    if (OUTPUT_INIT_RE.test(mod.module ?? '')) steps.push(`${mod.module} → 初始关闭`);
  }

  return steps;
}

// ─── 主循环伪代码推断 ───

const SENSOR_READ_MAP = [
  [/ADC/i, (inp) => `    ${varName(inp.module)} = ADC_Read(${inp.pin?.match(/CH\d+/i)?.[0] ?? 'CH0'});`],
  [/OneWire/i, (inp) => `    ${varName(inp.module)} = OneWire_Read();`],
];

function inferMainLoop(requirements) {
  const inputs = requirements.inputs ?? [];
  const outputs = requirements.outputs ?? [];
  const scenarios = requirements.scenarios ?? [];

  const lines = ['while (1) {'];

  // 传感器读取
  for (const inp of inputs) {
    const entry = SENSOR_READ_MAP.find(([re]) => re.test(inp.interface ?? ''));
    if (entry) lines.push(entry[1](inp));
  }

  // 光线判断
  const sensor = inputs.find(i => /光敏|LDR|光照/i.test(i.module ?? ''));
  if (scenarios.some(s => /光线|白天|夜间|光照/i.test(s))) {
    const v = sensor ? varName(sensor.module) : 'light_value';
    const threshold = sensor ? varName(sensor.module).toUpperCase().replace('_VALUE', '') + '_THRESHOLD' : 'LIGHT_THRESHOLD';
    lines.push('', `    if (${v} > ${threshold}) continue;  // 白天跳过`);
  }

  // 语音指令处理
  const hasVoice = scenarios.some(s => /开灯|点亮|关灯|熄灭/i.test(s));
  if (hasVoice && inputs.some(i => /IRQ|INT/i.test(i.pin ?? ''))) {
    const out = outputs[0];
    const fn = funcName(out?.module ?? 'LED');
    lines.push('', '    if (voice_irq_flag) {', '        voice_irq_flag = 0;', '        result = SPI_ReadResult();');
    if (scenarios.some(s => /开灯|点亮/i.test(s))) lines.push(`        if (result == CMD_LIGHT_ON) ${fn}_On();`);
    if (scenarios.some(s => /关灯|熄灭/i.test(s))) lines.push(`        if (result == CMD_LIGHT_OFF) ${fn}_Off();`);
    lines.push('    }');
  }

  lines.push('}');
  return lines.join('\n');
}

const MODULE_VAR_MAP = {
  '光敏': 'ldr', 'LDR': 'ldr',
  '语音': 'voice', 'LD3320': 'voice',
  'LED': 'led', '灯': 'led',
  '蜂鸣器': 'buzzer', '继电器': 'relay',
  'PIR': 'pir', '人体': 'pir',
  '红外': 'ir', '温度': 'temp',
  '湿度': 'humi', 'DS18B20': 'temp',
  'DHT': 'dht', 'OLED': 'oled',
};

function varName(module) {
  for (const [key, val] of Object.entries(MODULE_VAR_MAP)) {
    if ((module ?? '').includes(key)) return `${val}_value`;
  }
  return 'sensor_value';
}

function funcName(module) {
  for (const [key, val] of Object.entries(MODULE_VAR_MAP)) {
    if ((module ?? '').includes(key)) return val.charAt(0).toUpperCase() + val.slice(1);
  }
  return 'Device';
}

// ─── 关键函数清单推断 ───

const INPUT_IFACE_FUNCS = {
  SPI: (mod, file) => [
    { name: 'SPI_Init()', file, desc: 'SPI 主模式初始化' },
    { name: `${funcName(mod.module)}_Init()`, file, desc: `${mod.module} 命令集初始化` },
    { name: `${funcName(mod.module)}_ReadResult()`, file, desc: 'SPI 读取识别结果' },
  ],
  I2C: (mod, file) => [
    { name: 'I2C_Init()', file, desc: 'I2C 主模式初始化' },
    { name: `${funcName(mod.module)}_Read()`, file, desc: `读取 ${mod.module} 数据` },
  ],
  ADC: (mod, file) => {
    const ch = mod.pin?.match(/CH\d+/i)?.[0] ?? 'CH0';
    return [
      { name: 'ADC_Init()', file, desc: `ADC 初始化 (${ch})` },
      { name: 'ADC_Read()', file, desc: `读取 ADC 值` },
    ];
  },
  GPIO: (mod, file) => [
    { name: `${funcName(mod.module)}_Read()`, file, desc: `读取 ${mod.module} 状态` },
  ],
};

const OUTPUT_MODULE_FUNCS = [
  [/LED|灯/i, (mod, file) => [
    { name: 'LED_On()', file, desc: `${mod.module} 点亮` },
    { name: 'LED_Off()', file, desc: `${mod.module} 熄灭` },
  ]],
  [/继电器/i, (_mod, file) => [
    { name: 'Relay_On()', file, desc: '继电器闭合' },
    { name: 'Relay_Off()', file, desc: '继电器断开' },
  ]],
  [/蜂鸣器/i, (_mod, file) => [
    { name: 'Buzzer_Beep()', file, desc: '蜂鸣器鸣响' },
  ]],
  [/电机/i, (_mod, file) => [
    { name: 'Motor_SetSpeed()', file, desc: '设置电机转速' },
  ]],
];

function inferFunctions(requirements) {
  const funcs = [
    { name: 'SystemClock_Config()', file: 'system_init.c', desc: 'HSE 72MHz 时钟配置' },
    { name: 'GPIO_Init()', file: 'system_init.c', desc: '所有 GPIO 引脚配置' },
  ];

  for (const inp of requirements.inputs ?? []) {
    const iface = (inp.interface ?? '').toUpperCase();
    const file = `${moduleName(inp.module, inp.interface)}.c`;
    const gen = INPUT_IFACE_FUNCS[iface];
    if (gen) funcs.push(...gen(inp, file));
    if (hasIRQPin(inp)) {
      funcs.push({ name: 'EXTI_IRQHandler()', file, 'stm32f1xx_it.c': true, desc: `${inp.module} 中断处理` });
    }
  }

  for (const out of requirements.outputs ?? []) {
    const file = `${moduleName(out.module, out.interface)}.c`;
    const entry = OUTPUT_MODULE_FUNCS.find(([re]) => re.test(out.module));
    if (entry) funcs.push(...entry[1](out, file));
  }

  return funcs;
}

function hasIRQPin(mod) {
  return /IRQ|INT/i.test(mod.pin ?? '');
}

// ─── 中断处理推断 ───

function inferInterrupts(requirements) {
  const irqs = [];
  for (const inp of requirements.inputs ?? []) {
    if (hasIRQPin(inp)) {
      const pin = inp.pin?.match(/P[A-D]\d+/i)?.[0] ?? 'PB0';
      const line = pin.match(/\d+/)?.[0] ?? '0';
      irqs.push({ source: `${pin} 下降沿`, handler: `EXTI${line}_IRQHandler`, desc: `${inp.module} 识别完成信号` });
    }
  }
  return irqs;
}

// ─── 数据结构推断 ───

function inferDataStructures(requirements) {
  const vars = [];
  const inputs = requirements.inputs ?? [];

  // IRQ 标志位
  if (inputs.some(i => hasIRQPin(i))) {
    vars.push('volatile uint8_t voice_irq_flag;  // 语音中断标志');
  }

  // ADC 变量
  for (const inp of inputs) {
    if (/ADC/i.test(inp.interface)) {
      vars.push(`uint16_t ${varName(inp.module)};  // ${inp.module} ADC 值`);
      vars.push(`#define ${varName(inp.module).toUpperCase().replace('_VALUE', '')}_THRESHOLD 2000  // 阈值`);
    }
  }

  return vars;
}

// ─── 文件结构推断 ───

function inferFileStructure(requirements) {
  const files = ['main.c'];
  const headers = [];

  // 为每个输入/输出模块生成独立文件
  const allModules = [...(requirements.inputs ?? []), ...(requirements.outputs ?? [])];
  for (const mod of allModules) {
    const name = moduleName(mod.module, mod.interface);
    if (!files.includes(`${name}.c`)) {
      files.push(`${name}.c`);
      headers.push(`${name}.h`);
    }
  }

  headers.unshift('system_init.h');
  files.unshift('system_init.c');

  let tree = 'project/\n├── Core/\n│   ├── Src/\n';
  for (let i = 0; i < files.length; i++) {
    const prefix = i === files.length - 1 ? '│   │   └── ' : '│   │   ├── ';
    tree += `${prefix}${files[i]}\n`;
  }
  tree += '│   └── Inc/\n';
  for (let i = 0; i < headers.length; i++) {
    const prefix = i === headers.length - 1 ? '│       └── ' : '│       ├── ';
    tree += `${prefix}${headers[i]}\n`;
  }

  return tree;
}

// ─── 主生成函数 ───

function generateSoftwareDesign(requirements) {
  const arch = inferModuleArchitecture(requirements);
  const initOrder = inferInitOrder(requirements);
  const mainLoop = inferMainLoop(requirements);
  const funcs = inferFunctions(requirements);
  const irqs = inferInterrupts(requirements);
  const vars = inferDataStructures(requirements);
  const fileTree = inferFileStructure(requirements);

  let md = `# ${requirements.projectName} 软件设计文档\n\n`;

  // 1. 模块架构
  md += `## 1. 模块架构\n\n`;
  md += `| 软件模块 | 对应硬件 | 职责 |\n`;
  md += `|----------|---------|------|\n`;
  for (const m of arch) md += `| ${m.name} | ${m.hw} | ${m.desc} |\n`;

  // 2. 初始化顺序
  md += `\n## 2. 初始化顺序\n\n`;
  initOrder.forEach((s, i) => { md += `${i + 1}. ${s}\n`; });

  // 3. 主循环逻辑
  md += `\n## 3. 主循环逻辑\n\n`;
  md += '```c\n' + mainLoop + '\n```\n';

  // 4. 关键函数清单
  md += `\n## 4. 关键函数清单\n\n`;
  md += `| 函数 | 文件 | 说明 |\n`;
  md += `|------|------|------|\n`;
  for (const f of funcs) md += `| \`${f.name}\` | ${f.file} | ${f.desc} |\n`;

  // 5. 中断处理
  if (irqs.length > 0) {
    md += `\n## 5. 中断处理\n\n`;
    md += `| 中断源 | 处理函数 | 说明 |\n`;
    md += `|--------|---------|------|\n`;
    for (const irq of irqs) md += `| ${irq.source} | ${irq.handler} | ${irq.desc} |\n`;
  }

  // 6. 数据结构
  if (vars.length > 0) {
    md += `\n## 6. 数据结构\n\n`;
    md += '```c\n' + vars.join('\n') + '\n```\n';
  }

  // 7. 文件结构
  md += `\n## 7. 文件结构\n\n`;
  md += '```\n' + fileTree + '```\n';

  return md;
}

/**
 * 生成软件设计文档文件
 */
function generate({ userMessage, outputDir, projectName, requirements }) {
  if (!requirements?.mcu) {
    return { success: false, error: '需要结构化需求数据 (requirements.json)' };
  }

  const content = generateSoftwareDesign(requirements);
  const filename = 'software_design.md';
  const filepath = path.join(outputDir, filename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filepath, content, 'utf8');

  return { success: true, filepath, filename, content };
}

module.exports = {
  generateSoftwareDesign,
  generate,
  inferModuleArchitecture,
  inferInitOrder,
  inferMainLoop,
  inferFunctions,
};
