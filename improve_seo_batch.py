#!/usr/bin/env python3
"""업체별 SEO 개선 - 한 번에 전체 처리"""
import psycopg2, json, re, os, yaml, requests, sys, time

with open(os.path.expanduser('~/.genspark_llm.yaml')) as f:
    cfg = yaml.safe_load(f)
API_KEY = cfg['openai']['api_key']
BASE_URL = cfg['openai']['base_url']
DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

CAT_LABELS = {
    'headspa':'Head Spa','skincare':'Skincare Salon','clinic':'Dermatology Clinic',
    'makeup':'Makeup Studio','hair':'Hair Salon','nail':'Nail Salon','spa':'Spa'
}

def call_ai(prompt):
    headers = {'Authorization':f'Bearer {API_KEY}','Content-Type':'application/json'}
    body = {
        'model':'gpt-5-mini',
        'messages':[
            {'role':'system','content':'Return only valid JSON, no markdown wrapping.'},
            {'role':'user','content':prompt}
        ],
        'max_tokens':2500,
    }
    r = requests.post(f'{BASE_URL}/chat/completions',json=body,headers=headers,timeout=30)
    content = r.json()['choices'][0]['message']['content'].strip()
    # strip markdown if any
    content = re.sub(r'^```json\s*','',content)
    content = re.sub(r'^```\s*','',content)
    content = re.sub(r'\s*```$','',content)
    return json.loads(content)

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("""
    SELECT id,name,category,location,rating,review_count,description,why_choose,services,reviews
    FROM shops ORDER BY review_count DESC
""")
all_shops = cur.fetchall()

need_fix = []
for r in all_shops:
    desc = str(r[6] or '')
    wc = r[7]
    wc_list = wc if isinstance(wc,list) else (json.loads(wc) if isinstance(wc,str) and wc else [])
    is_template = 'is a premier' in desc and 'destination located in' in desc
    is_generic_wc = (not wc_list) or (wc_list and '🌐 English-friendly service and easy WhatsApp booking' in str(wc_list[0]))
    if is_template or is_generic_wc:
        need_fix.append({'id':r[0],'name':r[1],'category':r[2],'location':r[3],
                         'rating':r[4],'review_count':r[5],'services':r[8] or [],
                         'reviews':r[9] or []})

print(f'개선 대상: {len(need_fix)}개', flush=True)
updated = 0

for i, shop in enumerate(need_fix):
    print(f'\n[{i+1}/{len(need_fix)}] {shop["name"]}', flush=True)
    sys.stdout.flush()
    
    revs = shop['reviews']
    revlist = revs if isinstance(revs,list) else (json.loads(revs) if isinstance(revs,str) and revs else [])
    highlights = [str(rv.get('text',''))[:180] for rv in revlist[:5] if rv.get('text')]
    
    area = (shop['location'] or 'Seoul').split(',')[0].strip()
    cat = shop['category'] or 'beauty'
    cat_label = CAT_LABELS.get(cat, cat.title())
    services_str = ', '.join((shop['services'] or [])[:4])
    review_block = '\n'.join([f'- "{h}"' for h in highlights]) if highlights else '(no reviews)'
    
    prompt = f"""Create unique SEO content for this Korean beauty salon.

SHOP: {shop['name']}
TYPE: {cat_label} in {area}, Seoul
RATING: {shop['rating']}/5 ({shop['review_count']}+ reviews)  
SERVICES: {services_str or cat_label}
REAL REVIEWS:
{review_block}

Return this exact JSON structure:
{{
  "description": "Write 2-3 sentences (120-160 words total). Must be SPECIFIC to this shop based on reviews - mention actual services customers loved, staff qualities mentioned in reviews, specific prices/treatments if mentioned. End with why foreigners love it (English support/WhatsApp/location convenience). Do NOT use generic phrases.",
  "whyChoose": [
    "Specific quality/treatment customers rave about in reviews - start with fitting emoji, 65-90 chars",
    "What makes this shop unique/special based on reviews - start with fitting emoji, 65-90 chars",
    "Practical foreigner benefit specific to this location/type - start with fitting emoji, 65-90 chars"
  ]
}}"""
    
    try:
        result = call_ai(prompt)
        desc = str(result.get('description','')).strip()
        wc = result.get('whyChoose',[])
        
        if desc and isinstance(wc,list) and len(wc)>=3:
            cur.execute(
                'UPDATE shops SET description=%s, why_choose=%s WHERE id=%s',
                (desc, json.dumps(wc[:3]), shop['id'])
            )
            conn.commit()
            updated += 1
            print(f'  ✅ {desc[:90]}', flush=True)
            print(f'  → {wc[0]}', flush=True)
        else:
            print(f'  ❌ 결과 불완전: desc={len(desc)}, wc={len(wc)}', flush=True)
    except Exception as e:
        print(f'  ❌ 오류: {e}', flush=True)
    
    if i < len(need_fix)-1:
        time.sleep(1)

print(f'\n\n완료: {updated}/{len(need_fix)}개 업데이트됨', flush=True)
cur.close()
conn.close()
