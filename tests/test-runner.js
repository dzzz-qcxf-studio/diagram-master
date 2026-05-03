// tests/test-runner.js
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];
const promises = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failed++;
    errors.push(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    console.log(`  FAIL: ${message}`);
  } else {
    passed++;
    console.log(`  PASS: ${message}`);
  }
}

function describe(name, fn) {
  console.log(`\n${name}`);
  const result = fn();
  // Support async describe callbacks
  if (result && typeof result.then === 'function') {
    promises.push(result.catch(err => {
      failed++;
      errors.push(`${name}: ${err.message}`);
      console.log(`  FAIL: ${name}: ${err.message}`);
    }));
  }
}

function run(testFile) {
  require(testFile);
}

// Global test functions
global.assert = assert;
global.assertEqual = assertEqual;
global.describe = describe;

// Run all test files
const testDir = __dirname;
const testFiles = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => path.join(testDir, f));

testFiles.forEach(run);

// Wait for all async describe blocks to complete
if (promises.length > 0) {
  Promise.all(promises).then(() => {
    console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
    if (failed > 0) {
      console.log('\nFailures:');
      errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }
  }).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
} else {
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    console.log('\nFailures:');
    errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
}
