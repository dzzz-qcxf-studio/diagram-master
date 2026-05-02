/**
 * Flowchart Handler
 * 生成软件流程图（Mermaid 格式）
 */

const fs = require('fs');
const path = require('path');

/**
 * 根据需求生成流程图
 * @param {string} userMessage - 用户需求描述
 * @returns {string} Mermaid 流程图源码
 */
function generateFlowchart(userMessage) {
  const message = userMessage.toLowerCase();

  // 基础流程（适用于大多数嵌入式项目）
  let flowchart = `graph TD
    Start([上电启动]) --> Init["系统初始化<br/>时钟、GPIO、UART"]

`;

  // 检测特定功能模块
  if (message.includes('语音') || message.includes('声控')) {
    flowchart += `    Init --> VoiceInit["语音模块初始化"]
    VoiceInit --> VoiceLoop["等待语音指令"]
    VoiceLoop -->|收到指令| VoiceParse["解析语音指令"]
    VoiceParse --> Command{"命令有效?"}
    Command -->|是| Execute["执行动作"]
    Command -->|否| VoiceLoop
`;
  } else if (message.includes('红外')) {
    flowchart += `    Init --> IRInit["红外接收初始化"]
    IRInit --> IRLoop["等待红外信号"]
    IRLoop -->|收到信号| IRDecode["解码红外数据"]
    IRDecode --> IRCmd{"指令有效?"}
    IRCmd -->|是| Execute["执行动作"]
    IRCmd -->|否| IRLoop
`;
  } else if (message.includes('按键')) {
    flowchart += `    Init --> ButtonInit["按键初始化<br/>外部中断"]
    ButtonInit --> ButtonLoop["等待按键事件"]
    ButtonLoop -->|按键按下| ButtonDebounce["消抖处理"]
    ButtonDebounce --> ButtonAction{"执行动作"}
`;
  } else {
    // 通用输入处理
    flowchart += `    Init --> InputInit["输入模块初始化"]
    InputInit --> InputLoop["读取输入状态"]
    InputLoop -->|检测到变化| InputProcess["处理输入"]
    InputProcess --> Execute
`;
  }

  // 检测输出类型
  if (message.includes('灯') || message.includes('继电器')) {
    flowchart += `    Execute --> Output["控制继电器/LED"]
`;
  } else if (message.includes('电机')) {
    flowchart += `    Execute --> Motor["控制电机转速/方向"]
`;
  } else if (message.includes('显示') || message.includes('屏幕')) {
    flowchart += `    Execute --> Display["更新显示内容"]
`;
  } else {
    flowchart += `    Execute --> Output["控制输出设备"]
`;
  }

  // 循环回到等待状态
  if (message.includes('语音') || message.includes('声控')) {
    flowchart += `    Output --> VoiceLoop
`;
  } else if (message.includes('红外')) {
    flowchart += `    Output --> IRLoop
`;
  } else if (message.includes('按键')) {
    flowchart += `    ButtonAction --> ButtonLoop
    Output --> ButtonLoop
`;
  } else {
    flowchart += `    Output --> InputLoop
`;
  }

  // 添加状态显示和错误处理
  flowchart += `
    subgraph 状态监控
        Display["显示当前状态"]
        Log["记录日志"]
    end

    subgraph 错误处理
        Error{"检测到错误?"}
        Error -->|是| Handle["错误处理"]
        Handle --> Reset["系统复位"]
        Reset --> Init
    end
`;

  // 样式
  flowchart += `
    style Start fill:#4ecca3,stroke:#333,stroke-width:2px
    style Init fill:#f9d71c,stroke:#333,stroke-width:2px
    style Execute fill:#e94560,stroke:#333,stroke-width:2px
    style Error fill:#ff6b6b,stroke:#333,stroke-width:2px
`;

  return flowchart;
}

/**
 * 生成流程图文件
 * @param {string} userMessage - 用户需求描述
 * @param {string} outputDir - 输出目录
 * @param {string} projectName - 项目名称
 * @returns {Object} 生成结果
 */
function generate({ userMessage, outputDir, projectName }) {
  const flowchart = generateFlowchart(userMessage);

  const filename = 'flowchart.mmd';
  const filepath = path.join(outputDir, filename);

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filepath, flowchart, 'utf8');

  return {
    success: true,
    filepath,
    filename,
    content: flowchart,
  };
}

module.exports = {
  generateFlowchart,
  generate,
};