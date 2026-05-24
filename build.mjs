import { build } from 'esbuild'

await build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.mjs',
  external: ['node:*'],
  minify: false,
})

console.log('✅ Build complete: api/index.mjs')
