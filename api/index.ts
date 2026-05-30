import type { VercelRequest, VercelResponse } from '@vercel/node'

// Vercel 빌드 시 esbuild로 미리 번들된 app (api/_app.js)
// src/index.tsx를 런타임에 직접 ts-node 컴파일하지 않기 위해 분리
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: app } = require('./_app.js')

// multipart/form-data(파일 업로드)가 깨지지 않도록 Vercel 자동 파싱 비활성화
export const config = { api: { bodyParser: false } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost'
  const url = `${proto}://${host}${req.url || '/'}`
  const method = req.method || 'GET'

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) value.forEach(v => headers.append(key, v))
      else headers.set(key, value)
    }
  }

  let bodyInit: Buffer | undefined = undefined
  if (!['GET', 'HEAD'].includes(method)) {
    const raw = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
    })
    if (raw.length > 0) bodyInit = raw
  }

  const request = new Request(url, { method, headers, body: bodyInit })

  try {
    const response = await app.fetch(request)
    res.status(response.status)
    response.headers.forEach((v: string, k: string) => res.setHeader(k, v))
    const buf = await response.arrayBuffer()
    res.end(Buffer.from(buf))
  } catch (e: any) {
    res.status(500).end('Error: ' + (e?.message || 'unknown'))
  }
}
