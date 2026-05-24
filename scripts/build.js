#!/usr/bin/env node
// esbuild로 src/index.tsx → dist/_worker.js 빌드

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('[build] Building src/index.tsx → dist/_worker.js ...');

try {
  execSync(
    `node_modules/.bin/esbuild src/index.tsx --bundle --outfile=dist/_worker.js --format=esm --platform=browser --external:node:* --define:process.env.NODE_ENV='"production"'`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
  );
  console.log('[build] ✅ Build complete: dist/_worker.js');
} catch (e) {
  console.error('[build] ❌ esbuild failed:', e.message);
  process.exit(1);
}

// _routes.json 생성
const routes = {
  "version": 1,
  "include": ["/*"],
  "exclude": ["/static/*"]
};
fs.writeFileSync(
  path.join(distDir, '_routes.json'),
  JSON.stringify(routes, null, 2)
);
console.log('[build] ✅ _routes.json written');
