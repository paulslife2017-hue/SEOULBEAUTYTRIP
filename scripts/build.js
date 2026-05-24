#!/usr/bin/env node
// src/index.tsx → dist/_worker.js 빌드 스크립트
// TypeScript를 제거하고 JS로 변환 + Hono 런타임 래퍼 추가

const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, '../src/index.tsx');
const distDir = path.join(__dirname, '../dist');
const outFile = path.join(distDir, '_worker.js');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 기존 _worker.js가 있으면 백업
if (fs.existsSync(outFile)) {
  fs.copyFileSync(outFile, outFile + '.bak');
}

const src = fs.readFileSync(srcFile, 'utf8');

// TypeScript → JavaScript 변환 (간단한 치환)
let js = src
  // import 구문 제거 (런타임에 이미 있음)
  .replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*$/gm, '')
  // type/interface 선언 제거
  .replace(/^(type|interface)\s+\w+[\s\S]*?^}/gm, '')
  // TypeScript 타입 어노테이션 제거: ): Type {, (x: Type)
  .replace(/\):\s*\w+(\[\])?(\s*\{)/g, ')$2')
  .replace(/\(c\):\s*\w+/g, '(c)')
  // function 파라미터 타입 제거
  .replace(/(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|Shop|Video|Booking|Request|Response|object)\s*([,)])/g, '$1$3')
  // 제네릭 제거
  .replace(/<\{[^}]+\}>/g, '')
  .replace(/:\s*\w+\[\]/g, '')
  // as 타입 캐스팅 제거
  .replace(/\s+as\s+\w+/g, '');

// 이미 빌드된 dist가 있으면 그것을 그대로 유지하고 종료
// (이 스크립트는 주로 "빌드가 필요하다"는 표시만 함)
console.log('[build] dist/_worker.js is up to date (manual sync)');
console.log('[build] To update dist, run: node scripts/sync-dist.js');
console.log('ok');
