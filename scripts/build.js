#!/usr/bin/env node
// esbuild로 두 가지 빌드:
// 1. Cloudflare Pages: src/index.tsx → dist/_worker.js (ESM, browser platform)
// 2. Vercel:          src/index.tsx → api/_app.js    (CJS, node platform)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// ── 1. Cloudflare Pages 빌드 ──────────────────────────────────────
console.log('[build] Building src/index.tsx → dist/_worker.js (Cloudflare ESM) ...');
try {
  execSync(
    `node_modules/.bin/esbuild src/index.tsx --bundle --outfile=dist/_worker.js --format=esm --platform=browser --external:node:* --define:process.env.NODE_ENV='"production"' --charset=ascii`,
    { stdio: 'inherit', cwd: root }
  );
  console.log('[build] ✅ Cloudflare build complete: dist/_worker.js');
} catch (e) {
  console.error('[build] ❌ Cloudflare esbuild failed:', e.message);
  process.exit(1);
}

// _routes.json
const routes = { version: 1, include: ['/*'], exclude: ['/static/*'] };
fs.writeFileSync(path.join(distDir, '_routes.json'), JSON.stringify(routes, null, 2));
console.log('[build] ✅ _routes.json written');

// ── 2. Vercel 빌드 ────────────────────────────────────────────────
// hono 포함 번들 (--external:@neondatabase/serverless 만 제외 → Vercel deps에서 제공)
console.log('[build] Building src/index.tsx → api/_app.js (Vercel CJS) ...');
try {
  execSync(
    `node_modules/.bin/esbuild src/index.tsx --bundle --outfile=api/_app.js --format=cjs --platform=node --external:@neondatabase/serverless --define:process.env.NODE_ENV='"production"' --charset=ascii`,
    { stdio: 'inherit', cwd: root }
  );
  console.log('[build] ✅ Vercel build complete: api/_app.js');
} catch (e) {
  console.error('[build] ❌ Vercel esbuild failed:', e.message);
  process.exit(1);
}
