#!/usr/bin/env python3
"""업체별 SEO 개선 - 견고한 버전"""
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

def safe_json_parse(text):
    """JSON 파싱 - 여러 방법 시도"""
    text = text.strip()
    # 마크다운 제거
    text = re.sub(r'^```json\s*','',text)
    text = re.sub(r'^```\s*','',text)
    text = re.sub(r'\s*```$','',text)
    text = text.strip()
    
    if not text:
        return None
    
    # 직접 파싱
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # { } 사이 추출 시도
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass
    
    return None

def call_ai_simple(shop_name, cat_label, area, rating, review_count, services_str, review_short):
    """간단하고 짧은 프롬프트로 API 호출"""
    prompt = f"""Shop: {shop_name}
Type: {cat_label} in {area}, Seoul | Rating: {rating}/5 ({review_count}+ reviews)
Services: {services_str}
Key reviews: {review_short}

Return JSON only:
{{"description":"Write 2-3 sentences specifically about this shop based on reviews (120-150 words). Include what customers love, specific treatments, and why foreigners like it.","whyChoose":["emoji + specific quality customers praise (65-85 chars)","emoji + what makes this shop unique (65-85 chars)","emoji + practical foreigner benefit for this location (65-85 chars)"]}}"""

    headers = {'Authorization':f'Bearer {API_KEY}','Content-Type':'application/json'}
    body = {
        'model':'gpt-5-mini',
        'messages':[
            {'role':'system','content':'You are a K-beauty copywriter. Return only valid JSON.'},
            {'role':'user','content':prompt}
        ],
        'max_tokens':3000,
    }
    r = requests.post(f'{BASE_URL}/chat/completions',json=body,headers=headers,timeout=45)
    content = r.json()['choices'][0]['message']['content']
    return safe_json_parse(content)

def process_shop(shop):
    revs = shop['reviews']
    revlist = revs if isinstance(revs,list) else (json.loads(revs) if isinstance(revs,str) and revs else [])
    # 짧은 리뷰 요약만 (토큰 절약)
    highlights = []
    for rv in revlist[:4]:
        t = str(rv.get('text','')).strip()
        if t:
            highlights.append(t[:120])
    
    area = (shop['location'] or 'Seoul').split(',')[0].strip()
    cat_label = CAT_LABELS.get(shop['category'] or 'beauty', (shop['category'] or 'beauty').title())
    services_str = ', '.join((shop['services'] or [])[:3]) or cat_label
    review_short = ' / '.join([f'"{h}"' for h in highlights[:3]]) if highlights else 'highly rated'
    
    result = call_ai_simple(
        shop['name'], cat_label, area,
        shop['rating'], shop['review_count'],
        services_str, review_short
    )
    
    if not result:
        raise ValueError('API returned empty/invalid JSON')
    
    desc = str(result.get('description','')).strip()
    wc = result.get('whyChoose',[])
    
    if not desc or len(desc) < 50:
        raise ValueError(f'Description too short: {len(desc)}')
    if not isinstance(wc,list) or len(wc) < 3:
        raise ValueError(f'Invalid whyChoose: {wc}')
    
    return {'id':shop['id'],'name':shop['name'],'description':desc,'whyChoose':wc[:3]}

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

print(f'개선 대상: {len(need_fix)}개 업체', flush=True)

# 병렬 처리 (3개 동시)
results = {}
with ThreadPoolExecutor(max_workers=3) as executor:
    futures = {executor.submit(process_shop, shop): shop for shop in need_fix}
    for future in as_completed(futures):
        shop = futures[future]
        try:
            res = future.result()
            results[res['id']] = res
            print(f'✅ {res["name"]}', flush=True)
            print(f'   desc: {res["description"][:80]}...', flush=True)
            print(f'   wc1: {res["whyChoose"][0]}', flush=True)
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
print(f'\n완료: {updated}/{len(need_fix)}개 업데이트됨', flush=True)
cur.close()
conn.close()
