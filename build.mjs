import { build } from 'esbuild'

await build({
  entryPoints: ['api/_handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'api/index.js',
  external: ['node:*'],
  minify: false,
})

console.log('✅ Build complete: api/index.js')
