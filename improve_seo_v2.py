#!/usr/bin/env python3
"""
업체별 구글 리뷰 기반으로 description + whyChoose를 고유하게 재생성 (빠른 버전)
"""
import psycopg2, json, time, re, os, yaml, requests

with open(os.path.expanduser('~/.genspark_llm.yaml')) as f:
    cfg = yaml.safe_load(f)

API_KEY = cfg['openai']['api_key']
BASE_URL = cfg['openai']['base_url']
DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

def call_ai(prompt, max_tokens=2500):
    headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}
    data = {
        'model': 'gpt-5-mini',
        'messages': [
            {'role': 'system', 'content': 'You are a K-beauty SEO writer. Return only valid JSON, no markdown.'},
            {'role': 'user', 'content': prompt}
        ],
        'max_tokens': max_tokens,
    }
    resp = requests.post(f'{BASE_URL}/chat/completions', json=data, headers=headers, timeout=60)
    content = resp.json()['choices'][0]['message']['content'].strip()
    content = re.sub(r'^```json\s*', '', content)
    content = re.sub(r'^```\s*', '', content)
    content = re.sub(r'\s*```$', '', content)
    return json.loads(content)

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, category, location, rating, review_count,
               description, why_choose, services, reviews
        FROM shops ORDER BY review_count DESC
    """)
    all_shops = cur.fetchall()
    
    need_fix = []
    for r in all_shops:
        desc = str(r[6] or '')
        wc = r[7]
        wc_list = wc if isinstance(wc, list) else (json.loads(wc) if isinstance(wc, str) and wc else [])
        is_template = ('is a premier' in desc and 'destination located in' in desc)
        is_generic_wc = (not wc_list) or (wc_list and '🌐 English-friendly service and easy WhatsApp booking' in str(wc_list[0]))
        if is_template or is_generic_wc:
            need_fix.append({
                'id': r[0], 'name': r[1], 'category': r[2],
                'location': r[3], 'rating': r[4], 'review_count': r[5],
                'services': r[8] or [], 'reviews': r[9] or [],
            })
    
    print(f'개선 대상: {len(need_fix)}개 업체')
    
    CAT_LABELS = {
        'headspa': 'Head Spa', 'skincare': 'Skincare Salon', 'clinic': 'Dermatology Clinic',
        'makeup': 'Makeup Studio', 'hair': 'Hair Salon', 'nail': 'Nail Salon', 'spa': 'Spa'
    }
    
    updated = 0
    for i, shop in enumerate(need_fix):
        print(f'\n[{i+1}/{len(need_fix)}] {shop["name"]}')
        
        # 리뷰 추출
        revs = shop['reviews']
        revlist = revs if isinstance(revs, list) else (json.loads(revs) if isinstance(revs, str) and revs else [])
        highlights = [str(rv.get('text',''))[:200] for rv in revlist[:6] if rv.get('text')]
        
        area = (shop['location'] or 'Seoul').split(',')[0].strip()
        cat = shop['category'] or 'beauty'
        cat_label = CAT_LABELS.get(cat, cat.title())
        services_str = ', '.join((shop['services'] or [])[:5])
        review_block = '\n'.join([f'- "{h}"' for h in highlights]) if highlights else '(no reviews)'
        
        prompt = f"""Write unique SEO content for this Korean beauty salon based on real customer reviews.

SHOP: {shop['name']} | {cat_label} in {area}, Seoul
RATING: {shop['rating']}/5 ({shop['review_count']}+ reviews)
SERVICES: {services_str or cat_label}
REVIEWS:
{review_block}

Return JSON only:
{{
  "description": "2-3 sentences (120-160 words). Sentence1: what makes this place unique based on reviews. Sentence2: specific treatments customers love. Sentence3: why great for foreigners (English/WhatsApp/location). Be specific to THIS shop, not generic.",
  "whyChoose": [
    "emoji + what customers specifically rave about (treatment/staff/results) - 60-90 chars",
    "emoji + something unique about this shop (technique/specialty/experience) - 60-90 chars", 
    "emoji + practical benefit for foreigners (location/value/English/booking) - 60-90 chars"
  ]
}}

Rules: Each whyChoose bullet must be specific to THIS shop. NO generic phrases like 'English-friendly service and easy WhatsApp booking'."""
        
        try:
            result = call_ai(prompt)
            desc = result.get('description', '').strip()
            wc = result.get('whyChoose', [])
            
            if desc and len(wc) >= 3:
                cur.execute(
                    'UPDATE shops SET description=%s, why_choose=%s WHERE id=%s',
                    (desc, json.dumps(wc[:3]), shop['id'])
                )
                conn.commit()
                updated += 1
                print(f'  ✅ {desc[:80]}...')
                print(f'  → {wc[0]}')
            else:
                print(f'  ❌ 결과 불완전')
        except Exception as e:
            print(f'  ❌ 오류: {e}')
        
        if i < len(need_fix) - 1:
            time.sleep(2)
    
    print(f'\n\n✅ 완료: {updated}/{len(need_fix)}개 업데이트')
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
