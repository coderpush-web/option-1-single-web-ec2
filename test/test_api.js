const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running automated unit & integration tests for Option 1...');

// 1. Basic test sanity check
assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

// 2. Package verification
const pkg = require(path.join(__dirname, '../app/package.json'));
assert.ok(pkg.name, 'Package name should exist');
assert.ok(pkg.dependencies.express, 'Express dependency must be present');
assert.ok(pkg.dependencies.react, 'React dependency must be present');

// 3. React build output verification
assert.ok(fs.existsSync(path.join(__dirname, '../app/dist/index.html')), 'React dist/index.html must exist after build');
assert.ok(fs.existsSync(path.join(__dirname, '../app/Dockerfile')), 'Dockerfile must exist');

console.log('✅ Option 1 tests passed successfully!');
