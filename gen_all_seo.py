#!/usr/bin/env python3
"""
31개 미완성 업체 SEO 일괄 생성 (description + seo_text + why_choose + reviews)
잘 된 업체(AB Plastic Surgery, Nohd Dermatology 등) 패턴 그대로 적용

실행: python3 gen_all_seo.py [--dry-run] [--id shop_id]
"""
import os, sys, json, time, re, psycopg2
from openai import OpenAI

DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
GENSPARK_TOKEN = os.environ.get('GSK_TOKEN') or os.environ.get('GENSPARK_TOKEN', '')

client = OpenAI(
    api_key=GENSPARK_TOKEN,
    base_url='https://www.genspark.ai/api/llm_proxy/v1'
)

# ── 카테고리별 서비스 키워드 ─────────────────────────────────
CAT_CONTEXT = {
    'clinic': {
        'type': 'aesthetic/skin/plastic surgery clinic',
        'treatments': 'Botox, fillers, laser skin treatments, Potenza RF microneedling, Rejuran, skin boosters, hydration therapy, Thermage, fat dissolving, thread lifting, rhinoplasty, double eyelid surgery, face contouring',
        'why_emojis': ['✨','💉','🌐','🏅','💊','🔬'],
    },
    'skincare': {
        'type': 'skincare studio / dermatology clinic',
        'treatments': 'deep cleansing facial, skin analysis, brightening treatments, LED therapy, microdermabrasion, pore care, anti-aging serums, hydration boosters',
        'why_emojis': ['✨','🧴','🌿','💆','🏅','🔬'],
    },
    'hair': {
        'type': 'hair salon',
        'treatments': 'cut, color, bleach, highlights, balayage, perm, keratin treatment, scalp care, K-beauty hair styling',
        'why_emojis': ['🎨','✂️','💇','🌈','⭐','🌟'],
    },
    'headspa': {
        'type': 'head spa & hair salon',
        'treatments': 'scalp analysis, head spa massage, deep scalp cleanse, hair growth care, aroma scalp massage, hair restoration treatment',
        'why_emojis': ['💆','🛁','🧴','✨','🌿','🏅'],
    },
    'makeup': {
        'type': 'personal color analysis & makeup studio',
        'treatments': 'personal color diagnosis, seasonal tone analysis, makeup coaching, color draping, styling consultation',
        'why_emojis': ['🎨','💄','✨','🌈','💅','🏅'],
    },
    'tattoo': {
        'type': 'eyebrow tattoo / microblading studio',
        'treatments': 'eyebrow microblading, powder brows, combo brows, ombre brows, hairstrokes, eyebrow design consultation',
        'why_emojis': ['✏️','🎨','💆','⭐','🏅','✨'],
    },
    'nail': {
        'type': 'nail salon',
        'treatments': 'gel nails, nail art, nail extensions, nail care, cuticle care, K-nail design',
        'why_emojis': ['💅','🎨','✨','⭐','🌸','🏅'],
    },
    'spa': {
        'type': 'spa & wellness',
        'treatments': 'full body massage, aromatherapy, deep tissue massage, facial massage, hot stone massage, relaxation therapy',
        'why_emojis': ['💆','🛁','🌿','✨','🏅','🌟'],
    },
}

# ── 잘 된 업체 예시 (few-shot 용) ─────────────────────────────
GOOD_EXAMPLE = {
    'description': 'D&A Dermatology Clinic in Gangnam is a doctor-led skin clinic with a 4.9/5.0 rating from over 404 verified reviews, praised by foreign visitors for kind staff and precise laser and injection treatments. Located steps from Gangnam station, D&A offers a full range of skin procedures including Potenza RF microneedling, Tuneface, and targeted anti-aging treatments — all supervised by experienced dermatologists. The clinic\'s English-friendly team and welcoming atmosphere make it a top choice for travelers seeking medical-grade skincare in Seoul.',
    'why_choose': [
        '✨ Targeted anti-aging options like Tuneface, Airjet and Potenza in one clinic.',
        '💉 Doctor personally explains each procedure before starting — no surprises.',
        '🌐 English-speaking staff make booking and consultations easy for foreign guests.',
        '🏅 4.9/5.0 from 404+ reviews; ranked among top Gangnam dermatology clinics.',
        '📍 1-min walk from Gangnam Station Exit 10 — easy for tourists and day visitors.'
    ],
    'reviews': [
        {'author': 'Alice Choe', 'rating': 5, 'text': 'The hospital staff were exceptionally kind, even beyond my expectations. Everything, from the registration at the front desk to the procedures, progressed smoothly and was perfectly handled.'},
        {'author': 'Mia Park', 'rating': 5, 'text': 'Really professional clinic. The doctor explained every step carefully in English. I had Potenza treatment and my skin looks amazing. Will definitely come back next trip to Seoul!'},
        {'author': 'Sarah L.', 'rating': 5, 'text': 'Booked via WhatsApp — super easy. Staff were warm and the results exceeded my expectations. Great value for the quality of care.'},
        {'author': 'Jamie T.', 'rating': 5, 'text': 'Best skin clinic I found in Gangnam. No pushy upselling, just honest advice and great results. The English service was a huge plus.'},
        {'author': 'Yuki S.', 'rating': 5, 'text': 'I was nervous coming alone as a tourist but the team made me feel completely at ease. The procedure was quick and results showed within days.'}
    ]
}

def area_from_location(loc: str) -> str:
    """'Gangnam, Seoul' → 'Gangnam' / 'Seoul' → 'Seoul'"""
    if not loc: return 'Seoul'
    parts = [p.strip() for p in loc.split(',')]
    skip = {'south korea','korea','seoul'}
    for p in parts:
        pl = p.lower()
        if pl not in skip and pl:
            return p
    return 'Seoul'

def call_gpt(prompt: str, model: str = 'gpt-5-mini', max_tokens: int = 1800) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=[{'role': 'user', 'content': prompt}],
        max_tokens=max_tokens,
        temperature=0.75,
    )
    return resp.choices[0].message.content.strip()

def make_seo_text(name, cat, loc, area, rating, rcnt, why_list, rev_list, services_t) -> str:
    """잘 된 업체와 동일한 구조의 seo_text HTML 생성"""
    cat_info = CAT_CONTEXT.get(cat, CAT_CONTEXT['clinic'])
    ctype = cat_info['type']
    rev_preview = rev_list[0].get('text','')[:120] if rev_list else ''
    
    why_items = '\n'.join(f'<li>{w}</li>' for w in why_list)
    rev_items = ''
    for rv in rev_list[:3]:
        rev_items += f'<li><strong>{rv.get("author","Visitor")}</strong> — "{rv.get("text","")[:150]}"</li>\n'
    
    return f"""<h2>{name} — {ctype.title()} in {area}, Seoul</h2>
<p>{name} in {area} holds a <strong>{rating}/5.0 rating</strong> from over <strong>{rcnt:,} verified reviews</strong> and is consistently recommended by foreign visitors for its professional service and English-friendly atmosphere.</p>

<h2>Why Travelers Choose {name}</h2>
<ul>
{why_items}
</ul>

<h2>What Guests Are Saying</h2>
<ul>
{rev_items}</ul>

<h2>Treatments & Services at {name}</h2>
<p>The clinic offers a comprehensive menu of {ctype} services designed for both local and international clients. {f'Common services include: {services_t[:200]}.' if services_t and services_t != 'null' else f'Services include leading {cat_info["treatments"]}.'}</p>

<h2>Booking & Location</h2>
<p>{name} is located in {area}, making it easy to reach from major transport hubs in Seoul. International guests can book directly via WhatsApp or the online form — English consultations are available.</p>"""

def generate_seo_for_shop(shop: dict, dry_run: bool = False) -> dict:
    """단일 업체 SEO 전체 생성"""
    id_ = shop['id']
    name = shop['name']
    cat = shop['category']
    loc = shop['location'] or 'Seoul'
    area = area_from_location(loc)
    rating = shop['rating']
    rcnt = shop['review_count']
    cat_info = CAT_CONTEXT.get(cat, CAT_CONTEXT['clinic'])
    
    print(f"\n{'='*60}")
    print(f"▶ {name} [{cat}] | {area} | ⭐{rating} ({rcnt}개)")
    
    # ── 1. description + why_choose + reviews 생성 ─────────────
    prompt = f"""You are a Seoul beauty tourism SEO expert. Generate content for this shop listing.

Shop: {name}
Type: {cat_info['type']}
Location: {area}, Seoul
Rating: {rating}/5.0 ({rcnt} reviews)
Available treatments: {cat_info['treatments']}

Return ONLY valid JSON with these exact fields:
{{
  "description": "3-4 sentence description (400-550 chars). Start with shop name + location + rating. Include specific treatments, English-friendly note, and a compelling reason to visit.",
  "why_choose": [
    "emoji + specific unique reason 1 (max 90 chars)",
    "emoji + specific unique reason 2 (max 90 chars)", 
    "emoji + specific unique reason 3 (max 90 chars)",
    "emoji + specific unique reason 4 (max 90 chars)",
    "emoji + specific unique reason 5 (max 90 chars)"
  ],
  "reviews": [
    {{"author": "FirstName L.", "rating": 5, "text": "Authentic 2-3 sentence review mentioning specific treatment and results (80-150 chars)"}},
    {{"author": "FirstName M.", "rating": 5, "text": "Another authentic review with different angle (80-150 chars)"}},
    {{"author": "FirstName K.", "rating": 5, "text": "Third review focusing on English service or booking ease (80-150 chars)"}},
    {{"author": "FirstName T.", "rating": 5, "text": "Fourth review about value or specific technique (80-150 chars)"}},
    {{"author": "FirstName S.", "rating": 5, "text": "Fifth review about overall experience (80-150 chars)"}}
  ]
}}

Rules:
- description: mention {rating} rating, {rcnt}+ reviews, English-friendly, specific treatment
- why_choose: use emojis like {cat_info['why_emojis']}, be specific (not generic)
- reviews: use realistic Western/Asian tourist names, mention specific {cat_info['type']} treatments
- ALL text in English
- NO markdown, NO extra text outside JSON
- Each review text 80-150 characters

Example description style: "{GOOD_EXAMPLE['description'][:200]}..."
Example why_choose style: "{GOOD_EXAMPLE['why_choose'][0]}"
Example review style: "{GOOD_EXAMPLE['reviews'][0]['text'][:100]}"
"""
    
    if dry_run:
        print(f"  [DRY RUN] Would generate SEO for {name}")
        return None
    
    try:
        raw = call_gpt(prompt, max_tokens=1600)
        # JSON 추출
        m = re.search(r'\{[\s\S]*\}', raw)
        if not m:
            print(f"  ❌ JSON 파싱 실패: {raw[:200]}")
            return None
        data = json.loads(m.group())
        
        desc = data.get('description', '')
        why = data.get('why_choose', [])
        revs = data.get('reviews', [])
        
        # 검증
        if len(desc) < 200:
            print(f"  ⚠️ desc 너무 짧음 ({len(desc)}자), 재생성")
            return None
        if len(why) < 3:
            print(f"  ⚠️ why_choose 부족 ({len(why)}개)")
        
        print(f"  ✅ desc({len(desc)}자) | why({len(why)}개) | reviews({len(revs)}개)")
        print(f"     desc: {desc[:80]}...")
        print(f"     why[0]: {why[0] if why else 'NONE'}")
        
        # seo_text 생성 (HTML 구조)
        seo = make_seo_text(name, cat, loc, area, rating, rcnt, why, revs, shop.get('services',''))
        
        return {
            'id': id_,
            'description': desc,
            'why_choose': why,
            'reviews': revs,
            'seo_text': seo,
        }
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON 오류: {e}\n  Raw: {raw[:300]}")
        return None
    except Exception as e:
        print(f"  ❌ 오류: {e}")
        return None

def update_shop(cur, result: dict):
    """DB 업데이트"""
    cur.execute("""
        UPDATE shops SET
            description = %s,
            why_choose = %s,
            reviews = %s,
            seo_text = %s,
            updated_at = NOW()
        WHERE id = %s
    """, (
        result['description'],
        json.dumps(result['why_choose']),
        json.dumps(result['reviews']),
        result['seo_text'],
        result['id']
    ))

def main():
    dry_run = '--dry-run' in sys.argv
    target_id = None
    if '--id' in sys.argv:
        idx = sys.argv.index('--id')
        if idx + 1 < len(sys.argv):
            target_id = sys.argv[idx + 1]
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # 처리 대상 조회
    if target_id:
        cur.execute("""
            SELECT id, name, slug, category, location, rating, review_count,
                   services::text,
                   LENGTH(COALESCE(description,'')) as dl,
                   COALESCE(reviews,'[]')::text as rev_t
            FROM shops WHERE id = %s AND active = true
        """, (target_id,))
    else:
        cur.execute("""
            SELECT id, name, slug, category, location, rating, review_count,
                   services::text,
                   LENGTH(COALESCE(description,'')) as dl,
                   COALESCE(reviews,'[]')::text as rev_t
            FROM shops
            WHERE active = true AND (
                LENGTH(COALESCE(description,'')) < 100
                OR LENGTH(COALESCE(seo_text,'')) < 200
                OR COALESCE(reviews,'[]')::text = '[]'
            )
            ORDER BY category, name
        """)
    
    rows = cur.fetchall()
    print(f"\n처리 대상: {len(rows)}개 업체\n")
    
    ok_count = 0
    fail_count = 0
    
    for i, row in enumerate(rows):
        id_, name, slug, cat, loc, rating, rcnt, svcs_t, dl, rev_t = row
        shop = {
            'id': id_, 'name': name, 'slug': slug,
            'category': cat, 'location': loc or 'Seoul',
            'rating': float(rating or 4.8),
            'review_count': int(rcnt or 0),
            'services': svcs_t or '',
        }
        
        print(f"\n[{i+1}/{len(rows)}] {name}")
        
        result = generate_seo_for_shop(shop, dry_run=dry_run)
        
        if result and not dry_run:
            try:
                update_shop(cur, result)
                conn.commit()
                ok_count += 1
                print(f"  💾 DB 저장 완료")
            except Exception as e:
                conn.rollback()
                print(f"  ❌ DB 오류: {e}")
                fail_count += 1
        elif result:
            ok_count += 1
        else:
            fail_count += 1
        
        # Rate limit 방지
        if not dry_run and i < len(rows) - 1:
            time.sleep(1.2)
    
    cur.close()
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"완료: ✅ {ok_count}개 성공 | ❌ {fail_count}개 실패")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
