#!/usr/bin/env python3
"""나머지 영상 + 업체 SEO 채우기"""
import json, os, time, requests
from openai import OpenAI

GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = "https://seoulbeautytrip.com"
headers_json = {"Content-Type": "application/json", "x-admin-token": GSK_TOKEN}

client = OpenAI(api_key=GSK_TOKEN, base_url="https://www.genspark.ai/api/llm_proxy/v1")

def call_ai(prompt):
    resp = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": "You are a K-beauty SEO expert. Respond only with valid JSON."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7, timeout=35
    )
    content = resp.choices[0].message.content.strip()
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()
    return json.loads(content)

def generate_video_seo(video, shop):
    name = shop.get('name', '')
    category = shop.get('category', '')
    location = shop.get('location', '')
    vid_title = video.get('title', name)
    reviews = shop.get('reviews', [])
    review_text = reviews[0].get('text', '') if reviews else ''
    cat_tags = {
        'Skin Care': '#KoreanSkincare', 'Hair': '#KoreanHairSalon',
        'Nail': '#KoreanNails', 'Massage': '#KoreanMassage',
        'Lash': '#KoreanLash', 'Brow': '#KoreanBrows',
        'Makeup': '#KoreanMakeup', 'Clinic': '#KoreanClinic',
        'Tattoo': '#KoreanTattoo', 'Waxing': '#KoreanWaxing',
    }
    cat_tag = cat_tags.get(category, f'#{category.replace(" ","")}')
    prompt = f"""Shop: {name}, Category: {category}, Location: {location} Seoul
Video title: {vid_title}, Review: {review_text[:150]}

Return ONLY valid JSON:
{{"description":"2-3 sentence engaging video description for foreign tourists in Seoul. Mention treatment, location, what makes it special. 80-120 words English.",
"tags":["#SeoulBeautyTrip","{cat_tag}","#{location.replace(' ','')}","#KBeauty","#VisitSeoul","#SeoulBeauty"]}}"""
    result = call_ai(prompt)
    desc = result.get('description', '').strip()
    tags = result.get('tags', [])
    if '#SeoulBeautyTrip' not in tags:
        tags.insert(0, '#SeoulBeautyTrip')
    return desc, tags[:6]

def generate_shop_seo(shop):
    name = shop.get('name', '')
    category = shop.get('category', '')
    location = shop.get('location', '')
    address = shop.get('address', '')
    rating = shop.get('rating', '')
    review_count = shop.get('reviewCount', 0)
    hours = shop.get('hours', '')
    desc = shop.get('description', '')
    reviews = shop.get('reviews', [])
    review_texts = ' '.join([r.get('text', '')[:80] for r in reviews[:3]])
    missing = []
    if not (shop.get('metaDescription') or '').strip(): missing.append('metaDescription')
    if not (shop.get('seoKeywords') or '').strip(): missing.append('seoKeywords')
    if not (shop.get('seoText') or '').strip(): missing.append('seoText')
    if not (shop.get('description') or '').strip(): missing.append('description')
    if not missing:
        return None
    prompt = f"""Korean beauty salon SEO for foreign tourists.
Shop: {name}, Category: {category}, Location: {location} Seoul
Address: {address}, Rating: {rating} ({review_count} reviews), Hours: {hours}
Description: {desc[:200]}, Reviews: {review_texts[:300]}
Missing: {missing}

Return ONLY valid JSON with ONLY these fields {missing}:
{{"metaDescription":"155 chars max: shop name, {category}, {location} Seoul, English-friendly foreign tourists",
"seoKeywords":"10-12 comma-separated keywords: brand, category, location, treatments, Seoul beauty tourist",
"seoText":"380-450 word SEO article for {name}. Include: intro, services, why foreigners love it, location access, WhatsApp booking. Natural English.",
"description":"2-3 sentences: rating {rating}, specialty, why foreigners choose it."}}"""
    return call_ai(prompt)

# ── 1단계: 영상 나머지 ──
print("=" * 55)
print("영상 나머지 처리")
print("=" * 55)

r = requests.get(f"{SITE_URL}/api/videos", timeout=15)
vids = r.json()
if not isinstance(vids, list):
    vids = vids.get('videos', vids.get('data', []))

no_desc = [v for v in vids if not (v.get('description') or '').strip()]
no_tags = [v for v in vids if not v.get('tags') or len(v.get('tags', [])) == 0]
targets = list({v['id']: v for v in (no_desc + no_tags)}.values())

print(f"desc없음: {len(no_desc)}개, tags없음: {len(no_tags)}개, 처리: {len(targets)}개\n")

ok, fail = 0, 0
for i, video in enumerate(targets):
    shop = video.get('shop', {})
    name = shop.get('name', video.get('title', ''))
    print(f"[{i+1}/{len(targets)}] {name[:40]}", end=" ... ", flush=True)
    try:
        desc, tags = generate_video_seo(video, shop)
        update = dict(video)
        update.pop('shop', None)
        changed = False
        if not (video.get('description') or '').strip() and desc:
            update['description'] = desc; changed = True
        if (not video.get('tags') or len(video.get('tags', [])) == 0) and tags:
            update['tags'] = tags; changed = True
        if not changed:
            print("⏭"); ok += 1; continue
        s, b = requests.put(f"{SITE_URL}/api/videos/{video['id']}", headers=headers_json, json=update, timeout=15).status_code, ''
        if s in [200, 201, 204]:
            print(f"✅ {len(desc)}자/{len(tags)}태그"); ok += 1
        else:
            print(f"❌ {s}"); fail += 1
        time.sleep(0.8)
    except Exception as e:
        print(f"❌ {str(e)[:60]}"); fail += 1; time.sleep(1.5)

print(f"\n영상 완료: 성공 {ok} / 실패 {fail}")

# ── 2단계: 업체 SEO ──
print("\n" + "=" * 55)
print("업체 SEO 처리")
print("=" * 55)

r2 = requests.get(f"{SITE_URL}/api/shops?limit=200", timeout=15)
shops = r2.json()
if not isinstance(shops, list):
    shops = shops.get('shops', shops.get('data', []))

targets_s = [s for s in shops if not all([
    (s.get('metaDescription') or '').strip(),
    (s.get('seoKeywords') or '').strip(),
    (s.get('seoText') or '').strip(),
    (s.get('description') or '').strip()
])]
print(f"처리 필요: {len(targets_s)}개\n")

ok2, fail2 = 0, 0
for i, shop in enumerate(targets_s):
    name = shop.get('name', '')
    miss = [f for f in ['metaDescription','seoKeywords','seoText','description'] if not (shop.get(f) or '').strip()]
    print(f"[{i+1}/{len(targets_s)}] {name[:36]} | {','.join(miss)}", end=" ... ", flush=True)
    try:
        seo = generate_shop_seo(shop)
        if not seo:
            print("⏭"); ok2 += 1; continue
        update = dict(shop)
        update.pop('reviews', None); update.pop('photos', None)
        filled = []
        for field in ['metaDescription', 'seoKeywords', 'seoText', 'description']:
            if field in seo and not (shop.get(field) or '').strip():
                update[field] = seo[field]; filled.append(field[:4])
        if not filled:
            print("⏭"); ok2 += 1; continue
        resp = requests.put(f"{SITE_URL}/api/shops/{shop['id']}", headers=headers_json, json=update, timeout=15)
        if resp.status_code in [200, 201, 204]:
            print(f"✅ ({','.join(filled)})"); ok2 += 1
        else:
            print(f"❌ {resp.status_code}: {resp.text[:60]}"); fail2 += 1
        time.sleep(0.8)
    except Exception as e:
        print(f"❌ {str(e)[:60]}"); fail2 += 1; time.sleep(1.5)

print(f"\n업체 완료: 성공 {ok2} / 실패 {fail2}")

# ── 최종 검증 ──
print("\n" + "=" * 55)
print("최종 검증")
print("=" * 55)
time.sleep(2)

vr = requests.get(f"{SITE_URL}/api/videos", timeout=15)
vl = vr.json(); vl = vl if isinstance(vl, list) else vl.get('videos', [])
print(f"영상 description: {sum(1 for v in vl if (v.get('description') or '').strip())}/{len(vl)}")
print(f"영상 tags:        {sum(1 for v in vl if v.get('tags') and len(v.get('tags',[]))>0)}/{len(vl)}")

sr = requests.get(f"{SITE_URL}/api/shops?limit=200", timeout=15)
sl = sr.json(); sl = sl if isinstance(sl, list) else sl.get('shops', [])
t = len(sl)
print(f"업체 metaDescription: {sum(1 for s in sl if (s.get('metaDescription') or '').strip())}/{t}")
print(f"업체 seoKeywords:     {sum(1 for s in sl if (s.get('seoKeywords') or '').strip())}/{t}")
print(f"업체 seoText:         {sum(1 for s in sl if (s.get('seoText') or '').strip())}/{t}")
print(f"업체 description:     {sum(1 for s in sl if (s.get('description') or '').strip())}/{t}")
print("\n🎉 완료!")
