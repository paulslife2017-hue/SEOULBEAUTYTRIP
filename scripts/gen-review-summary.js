/**
 * Rule-based review summary generator
 * 영어 리뷰에서 핵심 테마를 추출 → 25자 이내 tagline 생성
 * AI 미사용, 크레딧 0
 */
const { Client } = require('pg');
const DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

// ── 테마별 키워드 & 우선순위 ──────────────────────────────
const THEMES = [
  { tag: 'natural-results',   kw: ['natural result', 'natural look', 'looks natural', 'natural effect', 'subtle result'],           label: 'Natural, glowing results'      },
  { tag: 'visible-results',   kw: ['visible result', 'dramatic result', 'significant result', 'amazing result', 'great result'],    label: 'Visible, lasting results'      },
  { tag: 'no-bruising',       kw: ['no bruising', 'no swelling', 'minimal swelling', 'no downtime', 'quick recovery'],              label: 'Minimal downtime & bruising'   },
  { tag: 'english-fluent',    kw: ['speak english', 'spoke english', 'fluent english', 'english speaking', 'english staff', 'great english', 'good english', 'speaks english'], label: 'English-speaking staff' },
  { tag: 'professional',      kw: ['very professional', 'highly professional', 'skilled doctor', 'experienced doctor', 'expert doctor', 'knowledgeable'],  label: 'Highly professional team'   },
  { tag: 'consultation',      kw: ['thorough consultation', 'detailed consultation', 'honest consultation', 'honest advice', 'no pressure', 'no upsell', 'honest doctor'], label: 'Honest, no-pressure consult' },
  { tag: 'laser',             kw: ['laser treatment', 'laser therapy', 'laser session', 'ipl', 'pico laser', 'co2 laser'],          label: 'Top-rated laser treatments'    },
  { tag: 'botox-filler',      kw: ['botox', 'filler', 'hyaluronic', 'lip filler', 'cheek filler'],                                  label: 'Expert Botox & filler'         },
  { tag: 'lifting',           kw: ['lifting', 'thread lift', 'ulthera', 'hifu', 'face lift', 'skin tightening'],                   label: 'Lift & skin tightening'        },
  { tag: 'acne',              kw: ['acne', 'pore', 'blackhead', 'whitehead', 'breakout', 'blemish'],                               label: 'Acne & pore care specialist'   },
  { tag: 'glow-brightening',  kw: ['glowing', 'brightening', 'radiant', 'luminous', 'glass skin', 'dewy', 'hydration'],           label: 'Glow & brightening expert'     },
  { tag: 'facial',            kw: ['facial', 'deep cleansing', 'cleansing facial', 'hydrafacial'],                                 label: 'Deep cleansing facials'        },
  { tag: 'hair-loss',         kw: ['hair loss', 'hair transplant', 'scalp treatment', 'hair growth', 'alopecia'],                  label: 'Hair loss & scalp care'        },
  { tag: 'plastic-surgery',   kw: ['rhinoplasty', 'nose job', 'eyelid', 'double eyelid', 'blepharoplasty', 'jaw', 'v-line'],       label: 'Precision plastic surgery'     },
  { tag: 'clean-clinic',      kw: ['very clean', 'super clean', 'spotless', 'hygienic', 'sanitized'],                             label: 'Spotlessly clean clinic'       },
  { tag: 'fast-service',      kw: ['quick', 'fast service', 'efficient', 'on time', 'no wait', 'no waiting'],                      label: 'Fast & efficient service'      },
  { tag: 'affordable',        kw: ['affordable', 'reasonable price', 'value for money', 'worth the price', 'great price', 'good price'], label: 'Great value for money'    },
  { tag: 'luxury',            kw: ['luxurious', 'luxury', 'premium', 'high-end', 'five star', '5-star'],                          label: 'Luxury clinic experience'      },
  { tag: 'caring-staff',      kw: ['caring staff', 'kind staff', 'warm staff', 'attentive', 'caring doctor', 'gentle', 'warm welcome', 'welcoming'], label: 'Warm, caring staff' },
  { tag: 'foreigner-friendly',kw: ['foreigner', 'tourist', 'international', 'foreign patient', 'foreigner friendly', 'expat'],     label: 'Foreigner-friendly clinic'     },
  { tag: 'head-spa',          kw: ['head spa', 'scalp massage', 'scalp care', 'head massage'],                                     label: 'Relaxing head spa'             },
  { tag: 'hair-treatment',    kw: ['hair treatment', 'hair color', 'highlights', 'balayage', 'keratin', 'hair repair', 'damaged hair'], label: 'Premium hair treatment'    },
];

function prepText(reviews) {
  if (!Array.isArray(reviews)) return '';
  return reviews
    .filter(rv => rv && rv.text)
    .map(rv => (rv.text || '').toLowerCase())
    .join(' ');
}

function scoreThemes(text) {
  const scores = {};
  for (const theme of THEMES) {
    let count = 0;
    for (const kw of theme.kw) {
      let idx = 0;
      while ((idx = text.indexOf(kw, idx)) !== -1) { count++; idx += kw.length; }
    }
    if (count > 0) scores[theme.tag] = { count, label: theme.label };
  }
  return scores;
}

function buildSummary(reviews) {
  const text = prepText(reviews);
  if (!text || text.length < 20) return null;

  const scores = scoreThemes(text);
  if (Object.keys(scores).length === 0) return null;

  const sorted = Object.entries(scores).sort((a, b) => b[1].count - a[1].count);
  const top = sorted[0][1].label;
  return top.length > 25 ? top.slice(0, 24) + '…' : top;
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  await client.connect();
  console.log('DB connected');

  // 한 번에 전체 데이터 가져오기
  const { rows } = await client.query('SELECT id, name, reviews FROM shops');
  console.log(`총 ${rows.length}개 업체`);

  // 로컬에서 summary 계산
  const updates = [];
  for (const shop of rows) {
    const summary = buildSummary(shop.reviews);
    updates.push({ id: shop.id, name: shop.name, summary });
  }

  // 업데이트 SQL 한 번에 실행 (unnest 방식)
  const ids = updates.map(u => u.id);
  const summaries = updates.map(u => u.summary);

  // review_summary가 jsonb 컬럼이므로 JSON 직렬화
  const summariesJson = summaries.map(s => s ? JSON.stringify(s) : null);

  await client.query(
    `UPDATE shops SET review_summary = data.summary::jsonb
     FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS summary) AS data
     WHERE shops.id = data.id`,
    [ids, summariesJson]
  );

  // 결과 출력
  updates.forEach(u => {
    if (u.summary) console.log(`  [OK] ${u.name.slice(0,30).padEnd(30)} → "${u.summary}"`);
    else console.log(`  [--] ${u.name.slice(0,30)} (리뷰 없음)`);
  });

  const okCount = updates.filter(u => u.summary).length;
  console.log(`\n완료: ${okCount}/${rows.length}개 업데이트`);
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
