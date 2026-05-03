// tests/requirements-prompt.test.js
const { getAnalysisPrompt, getQuestionPrompt, getOutputPrompt } = require('C:/Users/ROG/.claude/skills/requirements-master/prompt.js');

describe('requirements-master/prompt.js', () => {
  assert(typeof getAnalysisPrompt === 'function', 'getAnalysisPrompt should be a function');
  assert(typeof getQuestionPrompt === 'function', 'getQuestionPrompt should be a function');
  assert(typeof getOutputPrompt === 'function', 'getOutputPrompt should be a function');

  const analysisPrompt = getAnalysisPrompt('用STM32做感应灯');
  assert(analysisPrompt.includes('STM32'), 'analysis prompt should contain user input');
  assert(analysisPrompt.includes('硬件'), 'analysis prompt should mention hardware');

  const questionPrompt = getQuestionPrompt('用STM32做感应灯', { mcu: 'STM32', inputs: ['PIR'], outputs: ['LED'] });
  assert(questionPrompt.includes('PIR'), 'question prompt should contain parsed data');

  const outputPrompt = getOutputPrompt('用STM32做感应灯', { mcu: 'STM32' }, [{ q: '电压?', a: '3.3V' }]);
  assert(outputPrompt.includes('3.3V'), 'output prompt should contain user answers');
});
