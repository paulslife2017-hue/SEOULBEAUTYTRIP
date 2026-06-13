/**
 * generate_review_summaries.cjs
 * 
 * 56개 활성 업체의 영어 리뷰를 Gemini API로 분석해
 * 25~40자 영어 tagline을 생성하고 review_summary 컬럼에 저장합니다.
 * 
 * Usage: node scripts/generate_review_summaries.cjs [--force]
 *   --force : 이미 tagline이 있는 업체도 재생성
 */

const { neon } = require('/home/user/webapp/node_modules/@neondatabase/serverless/index.js')

const DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
// GSK_TOKEN (from .dev.vars) 또는 환경변수에서 읽기
const fs = require('fs')
const devVarsContent = fs.existsSync('/home/user/webapp/.dev.vars') 
  ? fs.readFileSync('/home/user/webapp/.dev.vars', 'utf8') 
  : ''
const GSK_TOKEN = devVarsContent.match(/GSK_TOKEN=(.+)/)?.[1]?.trim() || process.env.GSK_TOKEN
const OPENAI_API_KEY = GSK_TOKEN
const OPENAI_BASE_URL = 'https://www.genspark.ai/api/llm_proxy/v1'

const sql = neon(DATABASE_URL)
const FORCE = process.argv.includes('--force')

// OpenAI API 호출
async function callOpenAI(prompt) {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty response from OpenAI')
  return text
}

// 영어 리뷰 기반 tagline 생성 — "어떤 시술을 잘하는가" 중심
async function generateTagline(shopName, category, reviews) {
  // 영어 리뷰만 필터 (한글 30% 미만)
  const englishReviews = reviews.filter(r => {
    if (!r.text) return false
    const koreanChars = (r.text.match(/[\uAC00-\uD7A3]/g) || []).length
    return koreanChars / r.text.length < 0.3
  })

  if (englishReviews.length === 0) return null

  // 리뷰 전문 사용 (각 최대 300자)
  const reviewTexts = englishReviews
    .slice(0, 5)
    .map((r, i) => `Review ${i + 1}: "${r.text.slice(0, 300).replace(/\n/g, ' ')}"`)
    .join('\n')

  const prompt = `You help English-speaking tourists in Seoul choose a beauty clinic. 
A tourist is browsing clinic cards and needs ONE short line to decide if this place is right for them.

Clinic: ${shopName} (category: ${category})
Real visitor reviews:
${reviewTexts}

Write ONE tagline (30-50 characters) that tells tourists WHAT THIS PLACE IS KNOWN FOR — the specific treatment, procedure, or service it does best.

STRICT RULES:
- Focus on the TREATMENT/SERVICE (e.g. "rhinoplasty", "Rejuran", "liposuction", "hair coloring", "scalp care", "botox jawline", "skin boosters", "laser toning", "deep facelift")
- DO NOT mention staff personality, friendliness, or cleanliness
- DO NOT say "English-speaking staff", "professional team", "caring staff", "warm welcome" — these are useless for choosing
- DO include the specific procedure name from the reviews
- Natural English, no Korean
- No quotes, no trailing punctuation

Good examples:
✅ "Rhinoplasty & eyelid surgery for foreigners"
✅ "Rejuran & skin booster injection specialist"
✅ "Liposuction results trusted by Australians"
✅ "Natural botox & jawline slimming"
✅ "Scalp detox & hair loss treatment"
✅ "K-beauty color & cut for all hair types"
✅ "Deep facelift by renowned surgeon Dr. Kim"

Bad examples (DO NOT write these):
❌ "Warm, caring staff"
❌ "English-speaking staff"
❌ "Highly professional team"
❌ "Foreigner-friendly clinic"
❌ "Fast & efficient service"

Output ONLY the tagline, nothing else:`

  const raw = await callOpenAI(prompt)
  const tagline = raw.replace(/^["'`]|["'`]$/g, '').replace(/[.!]$/, '').trim()

  if (tagline.length < 10 || tagline.length > 70) {
    throw new Error(`Tagline length invalid: ${tagline.length} chars: "${tagline}"`)
  }

  return tagline
}

// 메인 실행
async function main() {
  console.log('🚀 review_summary tagline 일괄 생성 시작')
  console.log(`   모드: ${FORCE ? 'FORCE (전체 재생성)' : '신규만 생성 (NULL인 업체)'}`)

  // 처리할 업체 목록 조회
  let shops
  if (FORCE) {
    shops = await sql`
      SELECT id, name, category, reviews, review_summary
      FROM shops 
      WHERE active = true 
        AND reviews IS NOT NULL 
        AND jsonb_array_length(reviews) > 0
      ORDER BY name
    `
  } else {
    shops = await sql`
      SELECT id, name, category, reviews, review_summary
      FROM shops 
      WHERE active = true 
        AND reviews IS NOT NULL 
        AND jsonb_array_length(reviews) > 0
        AND (
          review_summary IS NULL 
          OR review_summary::text NOT LIKE '"%"'
        )
      ORDER BY name
    `
  }

  console.log(`\n📋 처리할 업체: ${shops.length}개\n`)

  if (shops.length === 0) {
    console.log('✅ 처리할 업체가 없습니다 (모든 업체에 tagline 존재)')
    return
  }

  let success = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i]
    const prefix = `[${i + 1}/${shops.length}]`
    
    // force 모드가 아닐 때만 스킵
    if (!FORCE && shop.review_summary && typeof shop.review_summary === 'string' && shop.review_summary.length > 10) {
      console.log(`${prefix} ⏭️  SKIP ${shop.name} (이미 tagline: "${shop.review_summary.slice(0, 40)}...")`)
      skipped++
      continue
    }

    try {
      const tagline = await generateTagline(shop.name, shop.category || 'clinic', shop.reviews)
      
      if (!tagline) {
        console.log(`${prefix} ⚠️  SKIP ${shop.name} (영어 리뷰 없음)`)
        skipped++
        continue
      }

      // DB 업데이트 - jsonb 컬럼이므로 JSON 문자열로 감싸서 저장
      const taglineJson = JSON.stringify(tagline)
      await sql`
        UPDATE shops 
        SET review_summary = ${taglineJson}::jsonb
        WHERE id = ${shop.id}
      `
      
      console.log(`${prefix} ✅ ${shop.name}`)
      console.log(`        → "${tagline}"`)
      success++
      
      // API rate limit 방지 (0.5초 딜레이)
      if (i < shops.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
      
    } catch (err) {
      console.error(`${prefix} ❌ FAIL ${shop.name}: ${err.message}`)
      failed++
      // 에러시 1초 대기
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  console.log('\n========================================')
  console.log(`✅ 완료: ${success}개 생성`)
  console.log(`⏭️  스킵: ${skipped}개`)
  console.log(`❌ 실패: ${failed}개`)
  console.log('========================================')

  // 결과 확인
  const finalCheck = await sql`
    SELECT COUNT(*) as total, 
      COUNT(CASE WHEN review_summary IS NOT NULL AND review_summary::text NOT LIKE '{%' THEN 1 END) as has_tagline
    FROM shops WHERE active = true
  `
  console.log(`\n📊 최종 현황: 전체 ${finalCheck[0].total}개 중 tagline ${finalCheck[0].has_tagline}개 보유`)
}

main().catch(err => {
  console.error('스크립트 오류:', err)
  process.exit(1)
})
