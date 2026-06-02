#!/usr/bin/env python3
"""
업체별 구글 리뷰 기반으로 description + whyChoose를 고유하고 생생한 텍스트로 재생성
- 템플릿 패턴("is a premier X destination located in") 업체 대상
- generic whyChoose("🌐 English-friendly service and easy WhatsApp booking") 업체 대상
- 신규 등록 업체도 동일 로직 적용 (autoGenSeo 개선 힌트용)
"""

import psycopg2
import json
import time
import re
import os
import yaml
from openai import OpenAI

# ── OpenAI 설정 ──
with open(os.path.expanduser('~/.genspark_llm.yaml')) as f:
    cfg = yaml.safe_load(f)

client = OpenAI(
    api_key=cfg['openai']['api_key'],
    base_url=cfg['openai']['base_url'],
)

DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

def get_shops_to_fix(cur):
    cur.execute("""
        SELECT id, name, category, location, rating, review_count,
               description, why_choose, services, reviews, address
        FROM shops
        ORDER BY review_count DESC
    """)
    rows = cur.fetchall()
    need_fix = []
    for r in rows:
        desc = str(r[6] or '')
        wc = r[7]
        wc_list = []
        if wc:
            wc_list = wc if isinstance(wc, list) else (json.loads(wc) if isinstance(wc, str) else [])
        
        is_template_desc = ('is a premier' in desc and 'destination located in' in desc)
        is_generic_wc = (
            not wc_list or
            (wc_list and '🌐 English-friendly service and easy WhatsApp booking' in str(wc_list[0]))
        )
        
        if is_template_desc or is_generic_wc:
            need_fix.append({
                'id': r[0], 'name': r[1], 'category': r[2],
                'location': r[3], 'rating': r[4], 'review_count': r[5],
                'description': r[6], 'why_choose': wc_list,
                'services': r[8] or [], 'reviews': r[9] or [],
                'address': r[10],
                'fix_desc': is_template_desc,
                'fix_wc': is_generic_wc,
            })
    return need_fix

def extract_review_highlights(reviews, max_reviews=8):
    """리뷰에서 핵심 내용 추출"""
    if not reviews:
        return []
    revlist = reviews if isinstance(reviews, list) else json.loads(reviews) if isinstance(reviews, str) else []
    highlights = []
    for rv in revlist[:max_reviews]:
        text = str(rv.get('text', '') or '').strip()
        if text and len(text) > 20:
            highlights.append(text[:250])
    return highlights

def generate_unique_seo(shop: dict) -> dict:
    """OpenAI로 리뷰 기반 고유 description + whyChoose 생성"""
    reviews = extract_review_highlights(shop['reviews'])
    services = shop['services'][:6] if shop['services'] else []
    area = (shop['location'] or 'Seoul').split(',')[0].strip()
    cat = shop['category'] or 'beauty'
    cat_label = {
        'headspa': 'Head Spa', 'skincare': 'Skincare Salon', 'clinic': 'Dermatology Clinic',
        'makeup': 'Makeup Studio', 'hair': 'Hair Salon', 'nail': 'Nail Salon', 'spa': 'Spa'
    }.get(cat, cat.title())
    
    review_block = '\n'.join([f'- "{r}"' for r in reviews]) if reviews else '(no reviews available)'
    services_block = ', '.join(services) if services else cat_label + ' treatments'
    
    prompt = f"""You are a senior SEO content writer for seoulbeautytrip.com — a K-beauty booking platform for foreign tourists visiting Seoul, Korea.

Write compelling, authentic, Google-optimized content for this real beauty salon based on ACTUAL CUSTOMER REVIEWS.

=== SHOP INFO ===
Name: {shop['name']}
Category: {cat_label}
Location: {area}, Seoul
Rating: {shop['rating']}/5 ({shop['review_count']}+ reviews)
Services: {services_block}

=== REAL CUSTOMER REVIEWS (use these to make content specific and authentic) ===
{review_block}

=== YOUR TASK ===
Based on the actual reviews above, write TWO things:

1. description (2-3 sentences, 120-180 words):
   - Sentence 1: What makes this place unique/special — based on what reviewers actually say
   - Sentence 2: Specific treatments/services and what customers love about them
   - Sentence 3: Why it's ideal for foreign visitors — English support, WhatsApp booking, location
   - Must feel AUTHENTIC and SPECIFIC to THIS shop, NOT generic
   - Use natural language, not marketing fluff
   - Include the rating and review count naturally

2. whyChoose (exactly 3 bullet points, each 60-100 characters):
   - Each starts with a DIFFERENT relevant emoji
   - Must reflect REAL highlights from the reviews
   - Point 1: What customers specifically rave about (treatment quality/staff/results)
   - Point 2: Something unique about this shop (technique/specialty/ambiance)
   - Point 3: Practical reason for foreigners (English/location/booking/value)
   - NO generic phrases like "English-friendly service and easy WhatsApp booking"

Return ONLY valid JSON (no markdown, no extra text):
{{"description":"...","whyChoose":["...","...","..."]}}"""

    try:
        resp = client.chat.completions.create(
            model='gpt-5-mini',
            messages=[
                {'role': 'system', 'content': 'You are an expert K-beauty SEO writer. Return only valid JSON.'},
                {'role': 'user', 'content': prompt}
            ],
            temperature=0.75,
            max_tokens=3000,
        )
        raw = resp.choices[0].message.content.strip()
        # JSON 파싱
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'^```\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        data = json.loads(raw)
        
        desc = data.get('description', '').strip()
        wc = data.get('whyChoose', [])
        if isinstance(wc, list) and len(wc) >= 3:
            return {'description': desc, 'whyChoose': wc[:3]}
        return None
    except Exception as e:
        print(f'  ERROR generating: {e}')
        return None

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    shops = get_shops_to_fix(cur)
    print(f'개선 대상 업체: {len(shops)}개\n')
    
    updated = 0
    for i, shop in enumerate(shops):
        print(f'[{i+1}/{len(shops)}] {shop["name"]}')
        print(f'  fix_desc={shop["fix_desc"]}, fix_wc={shop["fix_wc"]}')
        
        result = generate_unique_seo(shop)
        
        if result:
            desc = result['description']
            wc = result['whyChoose']
            print(f'  ✅ description: {desc[:80]}...')
            print(f'  ✅ whyChoose[0]: {wc[0]}')
            
            # DB 업데이트
            if shop['fix_desc'] and shop['fix_wc']:
                cur.execute(
                    'UPDATE shops SET description=%s, why_choose=%s WHERE id=%s',
                    (desc, json.dumps(wc), shop['id'])
                )
            elif shop['fix_desc']:
                cur.execute(
                    'UPDATE shops SET description=%s WHERE id=%s',
                    (desc, shop['id'])
                )
            elif shop['fix_wc']:
                cur.execute(
                    'UPDATE shops SET why_choose=%s WHERE id=%s',
                    (json.dumps(wc), shop['id'])
                )
            
            conn.commit()
            updated += 1
        else:
            print(f'  ❌ 생성 실패 — 스킵')
        
        # API 레이트 리밋 방지
        if i < len(shops) - 1:
            time.sleep(1.5)
    
    print(f'\n완료: {updated}/{len(shops)}개 업체 업데이트됨')
    
    # 결과 확인
    print('\n=== 업데이트 결과 확인 ===')
    cur.execute("SELECT name, description, why_choose FROM shops ORDER BY review_count DESC LIMIT 5")
    for r in cur.fetchall():
        wc = r[2]
        if wc:
            wc_list = wc if isinstance(wc, list) else json.loads(wc)
            print(f'\n📍 {r[0]}')
            print(f'  DESC: {str(r[1])[:100]}...')
            print(f'  WC: {wc_list[0] if wc_list else "(empty)"}')
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
