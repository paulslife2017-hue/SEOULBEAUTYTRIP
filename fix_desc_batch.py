#!/usr/bin/env python3
"""
업체 description 전면 재생성 - 배치 처리 (빠른 버전)
START_IDX ~ END_IDX 범위만 처리
"""
import os, sys, time, requests, json
from openai import OpenAI

GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = 'https://seoulbeautytrip.com'
headers = {'Content-Type': 'application/json', 'x-admin-token': GSK_TOKEN}
client = OpenAI(api_key=GSK_TOKEN, base_url="https://www.genspark.ai/api/llm_proxy/v1")

START = int(sys.argv[1]) if len(sys.argv) > 1 else 0
END   = int(sys.argv[2]) if len(sys.argv) > 2 else 999

CAT_GUIDE = {
    'clinic':          'Korean skin clinic: laser toning, Botox, skin boosters, fillers, lifting procedures',
    'headspa':         '18-step Korean head spa: scalp massage, hair loss treatment, deep oil conditioning',
    'hair':            'Korean hair salon: color, perm, cut, treatment for all hair types',
    'tattoo':          'Korean PMU / tattoo: eyebrow microblading, lip blushing, semi-permanent makeup',
    'makeup':          'Korean makeup: personal color analysis, professional beauty consultation',
    'skincare':        'Korean skincare studio: facial, pore care, brightening, hydration treatment',
    'plastic_surgery': 'Korean cosmetic surgery: rhinoplasty, double eyelid, V-line, body contouring',
    'dental':          'Korean dental: teeth whitening, Invisalign, implants, smile makeover',
}

def get_area(location: str) -> str:
    if not location:
        return 'Seoul'
    return location.split(',')[0].strip()

def gen_desc(shop: dict) -> str:
    name     = shop.get('name', '')
    category = shop.get('category', 'clinic')
    location = shop.get('location', 'Seoul')
    rating   = shop.get('rating', 0)
    reviews  = shop.get('reviewCount', shop.get('review_count', 0))
    services = shop.get('services', [])
    seo_text = (shop.get('seoText') or '')[:250]

    area     = get_area(location)
    cat_hint = CAT_GUIDE.get(category, CAT_GUIDE['clinic'])
    svc_str  = ', '.join(services[:5]) if services else ''
    rating_s = f"★{rating}" if rating else ''
    review_s = f"{reviews}+ verified reviews" if reviews else ''
    seo_hint = f"\nAdditional context: {seo_text}" if seo_text else ''

    prompt = f"""Write a persuasive English description for this Seoul beauty business targeting international tourists.

Shop: {name}
Type: {category} — {cat_hint}
Area: {area}, Seoul
Rating: {rating_s}  Reviews: {review_s}
Key services: {svc_str}{seo_hint}

Rules:
1. 300–430 characters TOTAL (count carefully)
2. Do NOT start with the shop name
3. Mention "{area}" once naturally — never write "[area], Seoul, Seoul"
4. Be specific: name 1-2 actual treatments
5. End with a trust signal (English staff / easy booking / proven results)
6. Avoid clichés: "world-class", "best in Seoul", "state-of-the-art"
7. Warm but confident tone — like a knowledgeable friend recommending a spot

Output ONLY the description, no quotes, no labels."""

    try:
        r = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role":"system","content":"You are a K-beauty copywriter. Write specific, persuasive descriptions (300-430 chars) for international visitors."},
                {"role":"user","content":prompt}
            ],
            temperature=0.75, timeout=25
        )
        text = r.choices[0].message.content.strip().strip('"\'')
        return text
    except Exception as e:
        print(f"    AI err: {e}")
        return ''

def update(shop_id, desc):
    try:
        r = requests.put(f'{SITE_URL}/api/shops/{shop_id}',
            json={'description': desc}, headers=headers, timeout=15)
        return r.status_code == 200
    except:
        return False

def main():
    resp = requests.get(f'{SITE_URL}/api/shops?limit=200', headers=headers, timeout=20)
    all_shops = resp.json().get('shops', [])

    targets = [s for s in all_shops if (
        not s.get('description')
        or len(s.get('description','')) < 400
        or 'destination in' in s.get('description','')
        or ', Seoul, Seoul' in s.get('description','')
    )]

    batch = targets[START:END]
    print(f"총 대상 {len(targets)}개 중 [{START}:{END}] = {len(batch)}개 처리")

    ok = 0; fail = 0
    for i, shop in enumerate(batch, 1):
        name = shop.get('name','?')
        old  = shop.get('description','')
        print(f"[{START+i}/{len(targets)}] {name[:35]} (현재 {len(old)}자)", flush=True)

        new_desc = gen_desc(shop)
        if not new_desc:
            fail += 1; time.sleep(0.5); continue

        print(f"  → {len(new_desc)}자: {new_desc[:90]}…", flush=True)
        if update(shop['id'], new_desc):
            print(f"  ✅", flush=True); ok += 1
        else:
            print(f"  ❌", flush=True); fail += 1
        time.sleep(0.3)

    print(f"\n완료: ✅{ok}  ❌{fail}")

if __name__ == '__main__':
    main()
