/**
 * Flowchart Handler
 * 基于 requirements.json 生成详细的软件流程图（Mermaid 格式）
 */

const fs = require('fs');
const path = require('path');

// ─── 接口→初始化节点映射 ───

const INIT_MAP = {
  'SPI': (mod) => {
    const pins = parsePinStr(mod.pin);
    const sck = pins.SCK || 'SCK';
    const miso = pins.MISO || 'MISO';
    const mosi = pins.MOSI || 'MOSI';
    const cs = pins.CS || 'CS';
    return { label: `SPI 初始化<br/>${sck}, ${miso}, ${mosi}, ${cs}`, order: 30 };
  },
  'I2C': (mod) => {
    const pins = parsePinStr(mod.pin);
    const scl = pins.SCL || 'SCL';
    const sda = pins.SDA || 'SDA';
    return { label: `I2C 初始化<br/>${scl}, ${sda}`, order: 30 };
  },
  'UART': (mod) => {
    const pins = parsePinStr(mod.pin);
    const tx = pins.TX || 'TX';
    const rx = pins.RX || 'RX';
    return { label: `UART 初始化<br/>${tx}, ${rx}`, order: 30 };
  },
  'ADC': (mod) => {
    const ch = extractADCChannel(mod.pin);
    return { label: `ADC 初始化<br/>${ch}`, order: 40 };
  },
  'GPIO': (mod) => {
    const pin = extractFirstPin(mod.pin);
    return { label: `GPIO 初始化<br/>${pin}`, order: 20 };
  },
  'OneWire': (mod) => {
    const pin = extractFirstPin(mod.pin);
    return { label: `OneWire 初始化<br/>${pin}`, order: 30 };
  },
  'PWM': (mod) => {
    const pin = extractFirstPin(mod.pin);
    return { label: `PWM 初始化<br/>${pin}`, order: 30 };
  },
};

// ─── 辅助函数 ───

const PIN_KEYWORD_MAP = [
  [/SCK|CLK/i, 'SCK'], [/MISO/i, 'MISO'], [/MOSI/i, 'MOSI'],
  [/CS|NSS/i, 'CS'], [/IRQ|INT/i, 'IRQ'], [/SCL/i, 'SCL'],
  [/SDA/i, 'SDA'], [/TX/i, 'TX'], [/RX/i, 'RX'],
];

function parsePinStr(pinStr) {
  if (!pinStr) return {};
  const result = {};
  const parts = pinStr.split(',').map(s => s.trim());
  for (const part of parts) {
    const m = part.match(/PA(\d+)|PB(\d+)|PC(\d+)|PD(\d+)/i);
    if (!m) continue;
    const pinName = m[0].toUpperCase();
    const kw = part.match(/\(([^)]+)\)/)?.[1] ?? '';
    const match = PIN_KEYWORD_MAP.find(([re]) => re.test(kw));
    if (match) result[match[1]] = pinName;
  }
  return result;
}

function extractFirstPin(pinStr) {
  if (!pinStr) return 'PA0';
  const m = pinStr.match(/P[A-D]\d+/i);
  return m ? m[0].toUpperCase() : 'PA0';
}

function extractADCChannel(pinStr) {
  if (!pinStr) return 'CH0';
  const m = pinStr.match(/CH\d+/i);
  if (m) return m[0].toUpperCase();
  const pin = extractFirstPin(pinStr);
  const pinNum = pin.match(/\d+/);
  return pinNum ? `CH${pinNum[0]}` : 'CH0';
}

function extractIRQPin(pinStr) {
  if (!pinStr) return null;
  const parts = pinStr.split(',').map(s => s.trim());
  for (const part of parts) {
    if (/IRQ|INT/i.test(part)) {
      const m = part.match(/P[A-D]\d+/i);
      return m ? m[0].toUpperCase() : null;
    }
  }
  return null;
}

function hasIRQPin(mod) {
  return mod.pin && /IRQ|INT/i.test(mod.pin);
}

// ─── 初始化序列生成 ───

const MODULE_INIT_MAP = [
  [/LD3320|语音/i, 'SPI 命令配置'],
  [/DHT|温湿度/i, '启动传感器'],
];
const OUTPUT_INIT_RE = /LED|灯|继电器/i;

function collectGPIOPins(requirements) {
  const pins = [];
  for (const mod of [...(requirements.inputs ?? []), ...(requirements.outputs ?? [])]) {
    if (mod.pin) pins.push(mod.pin);
  }
  return pins.flatMap(p => p.split(',').map(s => s.trim().split(/\s/)[0])).join(', ');
}

function generateInitSequence(requirements) {
  const items = [];
  const allModules = [...(requirements.inputs ?? []), ...(requirements.outputs ?? [])];

  // 系统时钟
  items.push({ label: `时钟配置<br/>${requirements.mcu}`, order: 10, id: 'ClockInit' });

  // GPIO
  const pinSummary = collectGPIOPins(requirements);
  if (pinSummary) items.push({ label: `GPIO 初始化<br/>${pinSummary}`, order: 20, id: 'GPIOInit' });

  // 外设初始化
  for (const mod of allModules) {
    const handler = INIT_MAP[(mod.interface ?? '').toUpperCase()];
    if (handler) {
      const { label, order } = handler(mod);
      items.push({ label, order, id: `${mod.interface}Init_${items.length}` });
    }
    // 模块特定初始化
    const entry = MODULE_INIT_MAP.find(([re]) => re.test(mod.module ?? ''));
    if (entry) items.push({ label: `${mod.module} 初始化<br/>${entry[1]}`, order: 50, id: 'ModuleInit' });
  }

  // 输出初始状态
  for (const out of requirements.outputs ?? []) {
    if (OUTPUT_INIT_RE.test(out.module)) {
      items.push({ label: `${out.module} 初始状态: 关闭<br/>${extractFirstPin(out.pin)} LOW`, order: 60, id: 'OutputInit' });
    }
  }

  // 按 order 排序
  items.sort((a, b) => a.order - b.order);

  // 生成 Mermaid
  let mmd = '';
  for (let i = 0; i < items.length; i++) {
    const node = items[i];
    if (i === 0) {
      mmd += `    SysInit --> ${node.id}["${node.label}"]\n`;
    } else {
      mmd += `    ${items[i - 1].id} --> ${node.id}["${node.label}"]\n`;
    }
  }

  return { mmd, lastNode: items.at(-1)?.id || 'SysInit' };
}

// ─── 主循环逻辑生成 ───

function appendVoiceCommands(mmd, lastNode, startNode, scenarios, outputs, nextId) {
  const voiceOn = scenarios.find(s => /开灯|点亮/i.test(s));
  const voiceOff = scenarios.find(s => /关灯|熄灭/i.test(s));
  if (!voiceOn && !voiceOff) return mmd;

  const cmdNode = nextId();
  mmd += `    ${lastNode} --> ${cmdNode}{"识别结果?"}\n`;
  const out = outputs[0];
  const pin = out ? extractFirstPin(out.pin) : 'PA1';

  if (voiceOn) {
    const n = nextId();
    mmd += `    ${cmdNode} -->|"开灯"| ${n}["${pin} HIGH<br/>点亮 ${out?.module || 'LED'}"]\n`;
    mmd += `    ${n} --> ${startNode}\n`;
  }
  if (voiceOff) {
    const n = nextId();
    mmd += `    ${cmdNode} -->|"关灯"| ${n}["${pin} LOW<br/>熄灭 ${out?.module || 'LED'}"]\n`;
    mmd += `    ${n} --> ${startNode}\n`;
  }
  const inv = nextId();
  mmd += `    ${cmdNode} -->|无效| ${inv}["忽略"]\n`;
  mmd += `    ${inv} --> ${startNode}\n`;
  return mmd;
}

function generateMainLoop(requirements) {
  const inputs = requirements.inputs ?? [];
  const outputs = requirements.outputs ?? [];
  const scenarios = requirements.scenarios ?? [];

  let mmd = '';
  let nodeCounter = 0;
  const nextId = () => `N${nodeCounter++}`;

  const sensorInputs = inputs.filter(i => /ADC|OneWire|GPIO/i.test(i.interface));
  const commInputs = inputs.filter(i => /SPI|I2C|UART/i.test(i.interface));
  const irqModules = inputs.filter(i => hasIRQPin(i));

  const startNode = nextId();
  mmd += `    ${startNode}(["主循环"])\n`;
  let lastNode = startNode;

  // 读取传感器
  for (const sensor of sensorInputs) {
    const readNode = nextId();
    mmd += `    ${lastNode} --> ${readNode}["读取 ${sensor.module}<br/>${extractADCChannel(sensor.pin)}"]\n`;
    lastNode = readNode;
  }

  // 光线判断
  const hasLDR = sensorInputs.some(s => /光敏|LDR|光照/i.test(s.module));
  const lightScenario = scenarios.find(s => /光线|白天|夜间|光照/i.test(s));
  if (hasLDR || lightScenario) {
    const checkNode = nextId();
    const skipNode = nextId();
    mmd += `    ${lastNode} --> ${checkNode}{"光线充足?<br/>ADC > 阈值"}\n`;
    mmd += `    ${checkNode} -->|是| ${skipNode}["忽略语音指令"]\n`;
    mmd += `    ${skipNode} --> ${startNode}\n`;
    lastNode = checkNode;
  }

  // 语音中断 / 轮询
  if (irqModules.length > 0) {
    const irqPin = extractIRQPin(irqModules[0].pin) || 'PB0';
    const waitNode = nextId();
    const triggerNode = nextId();
    mmd += `    ${lastNode} -->|否| ${waitNode}["等待语音中断<br/>${irqPin}"]\n`;
    mmd += `    ${waitNode} -->|IRQ 触发| ${triggerNode}["读取识别结果"]\n`;
    lastNode = triggerNode;
  } else if (commInputs.length > 0) {
    const pollNode = nextId();
    mmd += `    ${lastNode} -->|否| ${pollNode}["轮询 ${commInputs[0].module}"]\n`;
    lastNode = pollNode;
  }

  // 识别结果判断
  mmd = appendVoiceCommands(mmd, lastNode, startNode, scenarios, outputs, nextId);
  if (!scenarios.some(s => /开灯|点亮|关灯|熄灭/i.test(s))) {
    mmd += `    ${lastNode} --> ${startNode}\n`;
  }

  return mmd;
}

// ─── 主生成函数 ───

function generateFlowchart(requirements) {
  const { mmd: initMmd } = generateInitSequence(requirements);
  const loopMmd = generateMainLoop(requirements);

  // 初始化流程图
  let init = `graph TD\n`;
  init += `    Start([上电启动]) --> SysInit["系统初始化"]\n`;
  init += initMmd;
  init += `\n    style Start fill:#4ecca3,stroke:#333,stroke-width:2px\n`;
  init += `    style SysInit fill:#f9d71c,stroke:#333,stroke-width:2px\n`;

  // 主循环流程图
  let loop = `graph TD\n`;
  loop += loopMmd;

  return { init, loop };
}

/**
 * 生成简单流程图（无 requirements 时的回退）
 */
function generateSimpleFlowchart() {
  const init = `graph TD
    Start([上电启动]) --> Init["系统初始化<br/>时钟、GPIO"]
    Init --> InputInit["输入模块初始化"]
    style Start fill:#4ecca3,stroke:#333,stroke-width:2px
    style Init fill:#f9d71c,stroke:#333,stroke-width:2px`;

  const loop = `graph TD
    Loop(["主循环"])
    Loop --> ReadInput["读取输入状态"]
    ReadInput --> Check{"检测到变化?"}
    Check -->|是| Process["处理输入"]
    Process --> Output["控制输出"]
    Output --> Loop
    Check -->|否| Loop`;

  return { init, loop };
}

/**
 * 将两组 Mermaid 源码包装为可直接打开的 HTML 页面
 * 设计系统：oklch，hue 260（黑/白/蓝）
 */
function wrapAsHtml(charts, title) {
  const { init, loop } = charts;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><` + `/script>
    <style>
        :root {
            --hue: 260;
            --bg: oklch(0.13 0.015 var(--hue));
            --surface: oklch(0.17 0.02 var(--hue));
            --surface-raised: oklch(0.21 0.02 var(--hue));
            --border: oklch(0.3 0.02 var(--hue));
            --text: oklch(0.93 0.01 var(--hue));
            --text-muted: oklch(0.55 0.02 var(--hue));
            --accent: oklch(0.65 0.22 260);
            --accent-dim: oklch(0.45 0.15 260);
            --node-init: oklch(0.75 0.16 260);
            --node-loop: oklch(0.7 0.18 200);
            --node-decision: oklch(0.72 0.15 30);
            --node-action: oklch(0.68 0.2 260);
            --radius: 10px;
            --speed: 0.2s;
        }

        [data-theme="light"] {
            --bg: oklch(0.97 0.005 var(--hue));
            --surface: oklch(0.95 0.005 var(--hue));
            --surface-raised: oklch(0.92 0.008 var(--hue));
            --border: oklch(0.85 0.01 var(--hue));
            --text: oklch(0.18 0.015 var(--hue));
            --text-muted: oklch(0.5 0.015 var(--hue));
            --accent: oklch(0.5 0.22 260);
            --accent-dim: oklch(0.65 0.15 260);
            --node-init: oklch(0.45 0.18 260);
            --node-loop: oklch(0.42 0.16 200);
            --node-decision: oklch(0.45 0.18 30);
            --node-action: oklch(0.42 0.2 260);
        }

        @media (prefers-color-scheme: light) {
            :root:not([data-theme="dark"]) {
                --bg: oklch(0.97 0.005 var(--hue));
                --surface: oklch(0.95 0.005 var(--hue));
                --surface-raised: oklch(0.92 0.008 var(--hue));
                --border: oklch(0.85 0.01 var(--hue));
                --text: oklch(0.18 0.015 var(--hue));
                --text-muted: oklch(0.5 0.015 var(--hue));
                --accent: oklch(0.5 0.22 260);
                --accent-dim: oklch(0.65 0.15 260);
                --node-init: oklch(0.45 0.18 260);
                --node-loop: oklch(0.42 0.16 200);
                --node-decision: oklch(0.45 0.18 30);
                --node-action: oklch(0.42 0.2 260);
            }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: Consolas, 'Courier New', 'Noto Sans Mono CJK SC', monospace;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
            transition: background var(--speed) ease, color var(--speed) ease;
        }

        .header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 8px;
        }

        h1 {
            font-size: clamp(18px, 3vw, 26px);
            font-weight: 600;
            color: var(--text);
            letter-spacing: -0.02em;
        }

        .badge {
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 100px;
            background: var(--accent-dim);
            color: var(--text);
            font-weight: 500;
            letter-spacing: 0.03em;
        }

        .subtitle {
            font-size: 13px;
            color: var(--text-muted);
            margin-bottom: 32px;
        }

        .charts {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            max-width: 960px;
            width: 100%;
        }

        .chart-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            transition: background var(--speed) ease, border-color var(--speed) ease;
        }

        .chart-card h2 {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-muted);
            padding: 14px 20px;
            border-bottom: 1px solid var(--border);
            letter-spacing: 0.03em;
        }

        .mermaid-wrap {
            padding: clamp(16px, 3vw, 32px);
            overflow-x: auto;
        }

        .mermaid { background: transparent; }

        /* Mermaid node overrides */
        .mermaid .node rect,
        .mermaid .node polygon,
        .mermaid .node circle {
            stroke: var(--accent) !important;
            stroke-width: 1.5px !important;
        }

        .mermaid .edgePath .path {
            stroke: var(--accent-dim) !important;
            stroke-width: 1.5px !important;
        }

        .mermaid .edgeLabel {
            background: var(--surface-raised) !important;
            color: var(--text) !important;
            font-size: 12px !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
        }

        .mermaid .cluster rect {
            fill: var(--surface-raised) !important;
            stroke: var(--border) !important;
            rx: 8 !important;
            ry: 8 !important;
        }

        .mermaid .cluster .nodeLabel {
            color: var(--text-muted) !important;
            font-size: 12px !important;
        }

        /* Theme toggle */
        .theme-toggle {
            position: fixed;
            top: 16px;
            right: 16px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: all var(--speed) ease;
        }

        .theme-toggle:hover {
            background: var(--surface-raised);
            border-color: var(--accent);
        }
    </style>
</head>
<body>
    <button class="theme-toggle" onclick="toggleTheme()" title="切换主题"></button>
    <div class="header">
        <h1>${title}</h1>
        <span class="badge">auto-generated</span>
    </div>
    <p class="subtitle">基于 requirements.json 自动生成</p>
    <div class="charts">
        <div class="chart-card">
            <h2>初始化流程</h2>
            <div class="mermaid-wrap">
                <pre class="mermaid">
${init}
                </pre>
            </div>
        </div>
        <div class="chart-card">
            <h2>主循环逻辑</h2>
            <div class="mermaid-wrap">
                <pre class="mermaid">
${loop}
                </pre>
            </div>
        </div>
    </div>
    <script>
        function toggleTheme() {
            const root = document.documentElement;
            const curr = root.getAttribute('data-theme');
            const next = curr === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            localStorage.setItem('flowchart-theme', next);
            document.querySelector('.theme-toggle').textContent = next === 'light' ? '☾' : '☀';
        }
        (function() {
            const saved = localStorage.getItem('flowchart-theme');
            if (saved) document.documentElement.setAttribute('data-theme', saved);
            const isDark = (document.documentElement.getAttribute('data-theme') || '') === 'dark'
                || (!document.documentElement.getAttribute('data-theme')
                    && window.matchMedia('(prefers-color-scheme: dark)').matches);
            document.querySelector('.theme-toggle').textContent = isDark ? '☀' : '☾';
        })();
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            themeVariables: {
                primaryColor: 'oklch(0.25 0.08 260)',
                primaryTextColor: 'oklch(0.93 0.01 260)',
                primaryBorderColor: 'oklch(0.5 0.18 260)',
                lineColor: 'oklch(0.55 0.18 260)',
                secondaryColor: 'oklch(0.2 0.02 260)',
                tertiaryColor: 'oklch(0.17 0.02 260)',
                edgeLabelBackground: 'oklch(0.21 0.02 260)',
                fontFamily: 'Consolas, Courier New, monospace',
                fontSize: '13px',
            },
            flowchart: { curve: 'basis', padding: 20, htmlLabels: true },
        });
    <` + `/script>
</body>
</html>`;
}

/**
 * 生成流程图文件
 */
function generate({ userMessage, outputDir, projectName, requirements }) {
  // 无 requirements 时回退到简单流程图
  const charts = requirements?.mcu
    ? generateFlowchart(requirements)
    : generateSimpleFlowchart();

  const html = wrapAsHtml(charts, `${projectName || '项目'} - 软件流程图`);
  const filename = 'flowchart.html';
  const filepath = path.join(outputDir, filename);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filepath, html, 'utf8');

  return { success: true, filepath, filename, content: html };
}

module.exports = {
  generateFlowchart,
  generate,
  generateInitSequence,
  generateMainLoop,
  parsePinStr,
  extractADCChannel,
  extractIRQPin,
};
