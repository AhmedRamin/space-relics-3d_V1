/**
 * Parses every server source file. Run with `npm run verify`.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const root = path.resolve(__dirname, '..');
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'scripts'))];
let failed = 0;

files.forEach((file) => {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${path.relative(root, file)}\n${err.stderr?.toString() || err.message}`);
  }
});

console.log(`checked ${files.length} files, ${failed} failed`);
process.exit(failed ? 1 : 0);
