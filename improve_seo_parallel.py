#!/usr/bin/env python3
"""업체별 SEO 개선 - 병렬 처리로 빠르게"""
import psycopg2, json, re, os, yaml, requests, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

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
            {'role':'system','content':'Return only valid JSON, no markdown.'},
            {'role':'user','content':prompt}
        ],
        'max_tokens':2500,
    }
    r = requests.post(f'{BASE_URL}/chat/completions',json=body,headers=headers,timeout=45)
    content = r.json()['choices'][0]['message']['content'].strip()
    content = re.sub(r'^```json\s*','',content)
    content = re.sub(r'^```\s*','',content)
    content = re.sub(r'\s*```$','',content)
    return json.loads(content)

def process_shop(shop):
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

Return this exact JSON:
{{
  "description": "2-3 sentences (120-160 words). Specific to THIS shop based on reviews: mention actual services loved, staff qualities, real treatments. End with foreigner benefit (English/WhatsApp/location). NO generic phrases.",
  "whyChoose": [
    "Specific quality customers rave about - fitting emoji + 65-90 chars",
    "What makes this shop unique/special - fitting emoji + 65-90 chars",
    "Practical foreigner benefit specific to this shop - fitting emoji + 65-90 chars"
  ]
}}"""
    
    result = call_ai(prompt)
    desc = str(result.get('description','')).strip()
    wc = result.get('whyChoose',[])
    if not (desc and isinstance(wc,list) and len(wc)>=3):
        raise ValueError(f'Incomplete result: desc={len(desc)}, wc={len(wc)}')
    return {'id': shop['id'], 'name': shop['name'], 'description': desc, 'whyChoose': wc[:3]}

# DB에서 개선 필요 업체 조회
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

print(f'개선 대상: {len(need_fix)}개 업체 (병렬 처리)')
sys.stdout.flush()

# 병렬 처리 (최대 5개 동시)
results = {}
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(process_shop, shop): shop for shop in need_fix}
    for future in as_completed(futures):
        shop = futures[future]
        try:
            res = future.result()
            results[res['id']] = res
            print(f'✅ {res["name"]}: {res["description"][:70]}...', flush=True)
            print(f'   → {res["whyChoose"][0]}', flush=True)
        except Exception as e:
            print(f'❌ {shop["name"]}: {e}', flush=True)
        sys.stdout.flush()

# DB 업데이트
updated = 0
for shop_id, res in results.items():
    cur.execute(
        'UPDATE shops SET description=%s, why_choose=%s WHERE id=%s',
        (res['description'], json.dumps(res['whyChoose']), shop_id)
    )
    updated += 1
conn.commit()

print(f'\n✅ 완료: {updated}/{len(need_fix)}개 업데이트됨', flush=True)
cur.close()
conn.close()
