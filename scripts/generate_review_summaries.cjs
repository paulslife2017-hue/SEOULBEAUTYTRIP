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

// 영어 리뷰 기반 tagline 생성
async function generateTagline(shopName, reviews) {
  // 영어 리뷰만 필터 (텍스트에 한글이 50% 미만인 것)
  const englishReviews = reviews.filter(r => {
    if (!r.text) return false
    const koreanChars = (r.text.match(/[\uAC00-\uD7A3]/g) || []).length
    return koreanChars / r.text.length < 0.3
  })

  if (englishReviews.length === 0) return null

  // 리뷰 텍스트 최대 3개, 각 150자
  const reviewTexts = englishReviews
    .slice(0, 5)
    .map((r, i) => `Review ${i + 1}: "${r.text.slice(0, 150).replace(/\n/g, ' ')}"`)
    .join('\n')

  const prompt = `You are writing a short tagline for a Korean beauty clinic card shown to English-speaking tourists.

Clinic: ${shopName}
English reviews from real visitors:
${reviewTexts}

Write ONE tagline (25-45 characters) that captures the clinic's KEY strength based on these reviews.
Rules:
- English only, no Korean
- No quotes, no punctuation at end
- Focus on what makes it special (e.g. results, staff, value, specialty)  
- Natural, conversational tone
- Examples: "Natural botox with English-speaking staff", "Top rhinoplasty for international patients", "Glowing skin results, warm welcoming staff"

Output ONLY the tagline text, nothing else:`

  const raw = await callOpenAI(prompt)
  // 따옴표 제거, 앞뒤 공백 제거
  const tagline = raw.replace(/^["']|["']$/g, '').trim()
  
  // 길이 검증
  if (tagline.length < 10 || tagline.length > 60) {
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
      SELECT id, name, reviews, review_summary
      FROM shops 
      WHERE active = true 
        AND reviews IS NOT NULL 
        AND jsonb_array_length(reviews) > 0
      ORDER BY name
    `
  } else {
    shops = await sql`
      SELECT id, name, reviews, review_summary
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
    
    // 이미 단순 string summary가 있는 경우 스킵 (force 아닌 경우)
    if (!FORCE && shop.review_summary && typeof shop.review_summary === 'string' && shop.review_summary.length > 10 && !shop.review_summary.startsWith('{')) {
      console.log(`${prefix} ⏭️  SKIP ${shop.name} (이미 tagline 존재: "${shop.review_summary.slice(0, 40)}...")`)
      skipped++
      continue
    }

    try {
      const tagline = await generateTagline(shop.name, shop.reviews)
      
      if (!tagline) {
        console.log(`${prefix} ⚠️  SKIP ${shop.name} (영어 리뷰 없음)`)
        skipped++
        continue
      }

      // DB 업데이트 - 단순 문자열로 저장
      await sql`
        UPDATE shops 
        SET review_summary = ${tagline}
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
