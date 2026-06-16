/**
 * shops_ja / blog_posts_ja 일본어 번역 스크립트
 * - shops_ja: description, review_summary(jsonb→text→jsonb), meta_description 번역
 * - blog_posts_ja: title, excerpt, meta_description 번역 (전체)
 */
import { neon } from '@neondatabase/serverless'
import OpenAI from 'openai'

const DB = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
const sql = neon(DB)

// GSK_TOKEN 우선 사용 (OPENAI_API_KEY는 401 발생)
const apiKey = process.env.GSK_TOKEN || process.env.OPENAI_API_KEY || process.env.GENSPARK_TOKEN || ''
const baseURL = process.env.OPENAI_BASE_URL || 'https://www.genspark.ai/api/llm_proxy/v1'

console.log('API key prefix:', apiKey.slice(0,15)+'...', 'baseURL:', baseURL)

const client = new OpenAI({ apiKey, baseURL })

async function translate(text, type = 'shop') {
  if (!text || String(text).trim().length < 5) return text
  const sysPrompt = type === 'title'
    ? 'You are a professional Japanese translator. Translate the given English text to natural Japanese. Output ONLY the Japanese translation, nothing else. Keep proper nouns (clinic/salon names, Seoul area names) as-is.'
    : 'You are a professional Japanese translator specializing in K-beauty/medical tourism content. Translate the given English text to natural, friendly Japanese. Output ONLY the Japanese translation, nothing else. Keep proper nouns (clinic/salon names, Seoul area names, brand names) as-is.'
  
  const res = await client.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: String(text) }
    ],
    max_tokens: 2000,
    temperature: 0.3,
  })
  return res.choices[0].message.content?.trim() || text
}

// jsonb 값에서 텍스트 추출 (문자열이거나 JSON 객체일 수 있음)
function extractText(val) {
  if (!val) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    // { "text": "..." } 또는 { "summary": "..." } 형태
    return val.text || val.summary || val.content || JSON.stringify(val)
  }
  return String(val)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// 이미 일본어가 포함된 텍스트인지 확인 (재번역 방지)
function isJapanese(text) {
  if (!text) return false
  const jaRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/
  return jaRegex.test(String(text))
}

async function translateShops() {
  const shops = await sql`SELECT id, name, description, review_summary, meta_description FROM shops_ja WHERE active=true ORDER BY rating DESC`
  console.log(`\n[SHOPS] 총 ${shops.length}개 번역 시작...`)
  
  let done = 0
  let skipped = 0
  for (const s of shops) {
    try {
      const descText = s.description
      const summaryText = extractText(s.review_summary)
      const metaText = s.meta_description

      // 이미 일본어인 경우 스킵
      if (isJapanese(descText) && isJapanese(summaryText) && isJapanese(metaText)) {
        skipped++
        continue
      }

      const [desc, summary, meta] = await Promise.all([
        (descText && !isJapanese(descText)) ? translate(descText) : Promise.resolve(descText),
        (summaryText && !isJapanese(summaryText)) ? translate(summaryText, 'title') : Promise.resolve(summaryText),
        (metaText && !isJapanese(metaText)) ? translate(metaText) : Promise.resolve(metaText),
      ])

      // review_summary는 jsonb이므로 JSON 문자열로 변환
      const summaryJsonb = summary ? JSON.stringify(summary) : null
      
      await sql`UPDATE shops_ja SET 
        description = COALESCE(${desc}, description),
        review_summary = COALESCE(${summaryJsonb}::jsonb, review_summary),
        meta_description = COALESCE(${meta}, meta_description)
      WHERE id = ${s.id}`
      
      done++
      if (done % 5 === 0) console.log(`  [SHOPS] ${done}/${shops.length} 완료 (스킵: ${skipped})`)
      await sleep(100) // rate limit 방지
    } catch(e) {
      console.error(`  [SHOPS] ERROR ${s.name}:`, e.message)
      await sleep(500)
    }
  }
  console.log(`[SHOPS] 완료: ${done}/${shops.length} (스킵: ${skipped})`)
}

async function translateBlogs() {
  const posts = await sql`SELECT id, slug, title, excerpt, meta_description FROM blog_posts_ja WHERE status='published' ORDER BY created_at DESC`
  console.log(`\n[BLOGS] 총 ${posts.length}개 번역 시작...`)
  
  let done = 0
  let skipped = 0
  for (const p of posts) {
    try {
      // 이미 일본어인 경우 스킵
      if (isJapanese(p.title) && isJapanese(p.excerpt)) {
        skipped++
        continue
      }

      const [title, excerpt, meta] = await Promise.all([
        (p.title && !isJapanese(p.title)) ? translate(p.title, 'title') : Promise.resolve(p.title),
        (p.excerpt && !isJapanese(p.excerpt)) ? translate(p.excerpt) : Promise.resolve(p.excerpt),
        (p.meta_description && !isJapanese(p.meta_description)) ? translate(p.meta_description) : Promise.resolve(p.meta_description),
      ])
      
      await sql`UPDATE blog_posts_ja SET
        title = COALESCE(${title}, title),
        excerpt = COALESCE(${excerpt}, excerpt),
        meta_description = COALESCE(${meta}, meta_description)
      WHERE id = ${p.id}`
      
      done++
      if (done % 10 === 0) console.log(`  [BLOGS] ${done}/${posts.length} 완료 (스킵: ${skipped})`)
      await sleep(100)
    } catch(e) {
      console.error(`  [BLOGS] ERROR ${p.slug}:`, e.message)
      await sleep(500)
    }
  }
  console.log(`[BLOGS] 완료: ${done}/${posts.length} (스킵: ${skipped})`)
}

async function main() {
  console.log('=== shops_ja + blog_posts_ja 일본어 번역 시작 ===')
  await translateShops()
  await translateBlogs()
  console.log('\n=== 번역 완료 ===')
  
  // 결과 샘플 확인
  const shopSample = await sql`SELECT name, review_summary::text as rs, LEFT(description,80) as desc FROM shops_ja WHERE active=true LIMIT 3`
  console.log('\n[SHOPS 샘플]')
  for (const s of shopSample) {
    console.log(`${s.name}: ${s.rs} | ${s.desc}`)
  }

  const blogSample = await sql`SELECT title, LEFT(excerpt,80) as exc FROM blog_posts_ja WHERE status='published' LIMIT 3`
  console.log('\n[BLOGS 샘플]')
  for (const b of blogSample) {
    console.log(`${b.title} | ${b.exc}`)
  }
}

main().catch(console.error)
