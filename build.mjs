import { build } from 'esbuild'
import { writeFileSync } from 'fs'

// 1단계: src/index.tsx + _handler.ts 를 번들링
const result = await build({
  entryPoints: ['api/_handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  write: false,
  external: ['node:*'],
  minify: false,
})

// 2단계: module.exports = handler 가 확실히 동작하도록 래핑
const bundled = result.outputFiles[0].text

const wrapped = `
${bundled}

// Vercel CJS handler export
if (typeof handler === 'function') {
  module.exports = handler;
}
`

writeFileSync('api/index.js', wrapped, 'utf8')
console.log('✅ Build complete: api/index.js')
