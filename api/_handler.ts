import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../src/index'

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost'
  const url = `${proto}://${host}${req.url || '/'}`
  const method = req.method || 'GET'

  const body = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v: string) => headers.append(key, v))
      } else {
        headers.set(key, value)
      }
    }
  }

  const request = new Request(url, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : (body.length > 0 ? body : undefined),
  })

  try {
    const response = await app.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value)
    })
    const resBody = await response.arrayBuffer()
    res.end(Buffer.from(resBody))
  } catch (e: any) {
    res.statusCode = 500
    res.end('Internal Server Error: ' + (e.message || 'unknown'))
  }
}

module.exports = handler
module.exports.default = handler
