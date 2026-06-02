#!/usr/bin/env python3
"""순차 처리 - 안정적인 SEO 업데이트"""
import psycopg2, json, re, os, yaml, requests, sys

with open(os.path.expanduser('~/.genspark_llm.yaml')) as f:
    cfg = yaml.safe_load(f)
API_KEY = cfg['openai']['api_key']
BASE_URL = cfg['openai']['base_url']
DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

CAT = {'headspa':'Head Spa','skincare':'Skincare Salon','clinic':'Dermatology Clinic',
       'makeup':'Makeup Studio','hair':'Hair Salon','nail':'Nail Salon','spa':'Spa'}

def safe_json(text):
    text = text.strip()
    text = re.sub(r'^```json\s*','',text)
    text = re.sub(r'^```\s*','',text)
    text = re.sub(r'\s*```$','',text)
    text = text.strip()
    if not text: return None
    try: return json.loads(text)
    except:
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            try: return json.loads(m.group())
            except: pass
    return None

def gen_seo(name, cat, area, rating, rc, svcs, rev_short):
    prompt = f"""Shop: {name}
Type: {CAT.get(cat,cat.title())} in {area}, Seoul
Rating: {rating}/5 ({rc}+ reviews)
Services: {svcs}
Customer reviews: {rev_short}

Return JSON (no markdown):
{{"description":"Write 2-3 engaging sentences (100-150 words) specifically about this shop. Mention actual customer experiences from reviews, specific treatments they loved. End with why foreigners enjoy it.","whyChoose":["emoji + specific strength customers mention in reviews, 65-85 chars","emoji + what makes this shop stand out, 65-85 chars","emoji + practical benefit for foreign visitors, 65-85 chars"]}}"""
    
    headers = {'Authorization':f'Bearer {API_KEY}','Content-Type':'application/json'}
    body = {'model':'gpt-5-mini',
            'messages':[{'role':'system','content':'Return valid JSON only, no markdown.'},
                        {'role':'user','content':prompt}],
            'max_tokens':3000}
    r = requests.post(f'{BASE_URL}/chat/completions',json=body,headers=headers,timeout=45)
    content = r.json()['choices'][0]['message']['content']
    return safe_json(content)

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("SELECT id,name,category,location,rating,review_count,description,why_choose,services,reviews FROM shops ORDER BY review_count DESC")
shops = cur.fetchall()

to_fix = []
for r in shops:
    desc = str(r[6] or '')
    wc = r[7]
    wc_list = wc if isinstance(wc,list) else (json.loads(wc) if isinstance(wc,str) and wc else [])
    is_t = 'is a premier' in desc and 'destination located in' in desc
    is_g = (not wc_list) or (wc_list and '🌐 English-friendly service and easy WhatsApp booking' in str(wc_list[0]))
    if is_t or is_g:
        to_fix.append({'id':r[0],'name':r[1],'cat':r[2],'loc':r[3],'rating':r[4],'rc':r[5],'svcs':r[8] or [],'revs':r[9] or []})

print(f'Fix target: {len(to_fix)} shops')

updated = 0
for i, s in enumerate(to_fix):
    print(f'[{i+1}/{len(to_fix)}] {s["name"]}...', end=' ', flush=True)
    
    revs = s['revs']
    rl = revs if isinstance(revs,list) else (json.loads(revs) if isinstance(revs,str) and revs else [])
    rv_texts = [str(rv.get('text',''))[:120] for rv in rl[:3] if rv.get('text')]
    rv_short = ' / '.join([f'"{t}"' for t in rv_texts]) if rv_texts else 'highly rated'
    
    area = s['loc'].split(',')[0].strip() if s['loc'] else 'Seoul'
    svcs = ', '.join(s['svcs'][:3]) if s['svcs'] else CAT.get(s['cat'], s['cat'])
    
    result = gen_seo(s['name'], s['cat'], area, s['rating'], s['rc'], svcs, rv_short)
    
    if result:
        desc = str(result.get('description','')).strip()
        wc = result.get('whyChoose',[])
        if desc and len(desc) > 60 and isinstance(wc,list) and len(wc)>=3:
            cur.execute('UPDATE shops SET description=%s, why_choose=%s WHERE id=%s',
                       (desc, json.dumps(wc[:3]), s['id']))
            conn.commit()
            updated += 1
            print(f'✅', flush=True)
            print(f'   {desc[:90]}...', flush=True)
            print(f'   {wc[0]}', flush=True)
        else:
            print(f'❌ incomplete', flush=True)
    else:
        print(f'❌ no result', flush=True)

print(f'\nDone: {updated}/{len(to_fix)}')
cur.close()
conn.close()
