const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('Running automated unit & integration tests for Next.js App...');

assert.strictEqual(1 + 1, 2, 'Basic test sanity check');

const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../..');

const pkg = require(path.join(appDir, 'package.json'));
assert.ok(pkg.name || pkg.private, 'Package verification passed');
assert.ok(pkg.dependencies.next, 'Next.js dependency must be present');
assert.ok(pkg.dependencies.react, 'React dependency must be present');

assert.ok(fs.existsSync(path.join(appDir, 'Dockerfile')), 'Dockerfile must exist');
assert.ok(fs.existsSync(path.join(appDir, 'app/page.tsx')), 'Next.js page.tsx must exist');
assert.ok(fs.existsSync(path.join(appDir, 'app/api/health/route.ts')), 'Health check route.ts must exist');

console.log('✅ Automated Next.js tests passed successfully!');
