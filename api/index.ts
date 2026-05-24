import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../src/index'

// Vercel Node.js serverless function handler
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // IncomingMessage → Request 변환
  const url = `https://${req.headers.host || 'localhost'}${req.url || '/'}`
  const method = req.method || 'GET'

  // body 읽기
  const body = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v))
      } else {
        headers.set(key, value)
      }
    }
  }

  const request = new Request(url, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : body,
  })

  const response = await app.fetch(request)

  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  const resBody = await response.arrayBuffer()
  res.end(Buffer.from(resBody))
}
