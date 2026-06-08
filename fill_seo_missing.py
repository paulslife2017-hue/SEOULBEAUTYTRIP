#!/usr/bin/env python3
"""
1단계: 영상 48개 description + tags 자동 생성
2단계: 업체 누락 SEO(metaDescription/seoKeywords/seoText/description) 자동 생성
"""

import json, os, time, requests, sys
from pathlib import Path

# ── API 설정 ──
GENSPARK_TOKEN = os.environ.get('GENSPARK_TOKEN', '')
OPENAI_BASE_URL = "https://www.genspark.ai/api/llm_proxy/v1"
SITE_URL = "https://seoulbeautytrip.com"

headers_json = {"Content-Type": "application/json"}

def call_ai(prompt, system="You are a K-beauty SEO expert. Respond only with valid JSON."):
    """AI 호출"""
    resp = requests.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {GENSPARK_TOKEN}",
            "Content-Type": "application/json"
        },
        json={
            "model": "gpt-5-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        },
        timeout=30
    )
    resp.raise_for_status()
    content = resp.json()['choices'][0]['message']['content']
    # JSON 블록 추출
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()
    return json.loads(content)

def api_patch_video(video_id, data):
    """영상 업데이트 API 호출"""
    resp = requests.patch(
        f"{SITE_URL}/api/videos/{video_id}",
        headers={**headers_json, "x-admin-token": GENSPARK_TOKEN},
        json=data,
        timeout=15
    )
    return resp.status_code, resp.text[:200]

def api_patch_shop(shop_id, data):
    """업체 업데이트 API 호출"""
    resp = requests.patch(
        f"{SITE_URL}/api/shops/{shop_id}",
        headers={**headers_json, "x-admin-token": GENSPARK_TOKEN},
        json=data,
        timeout=15
    )
    return resp.status_code, resp.text[:200]

def generate_video_seo(video, shop):
    """영상 description + tags 생성"""
    name = shop.get('name', '')
    category = shop.get('category', '')
    location = shop.get('location', '')
    vid_title = video.get('title', name)
    rating = shop.get('rating', '')
    reviews = shop.get('reviews', [])
    review_text = reviews[0].get('text', '') if reviews else ''

    prompt = f"""Generate SEO content for a Korean beauty salon video.

Shop: {name}
Category: {category}
Location: {location}
Rating: {rating}
Video title: {vid_title}
Sample review: {review_text[:200]}

Return JSON:
{{
  "description": "2-3 sentence engaging video description for foreigners visiting Seoul. Mention the specific treatment/service, location, and what makes it special. 80-120 words.",
  "tags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}}

Tags should mix: category (e.g. #KoreanSkincare), location (e.g. #Gangnam), treatment type, and travel keywords (e.g. #SeoulBeauty #KBeauty).
Keep description natural and exciting for foreign tourists."""

    result = call_ai(prompt)
    return result.get('description', ''), result.get('tags', [])

def generate_shop_seo(shop):
    """업체 누락 SEO 필드 생성"""
    name = shop.get('name', '')
    category = shop.get('category', '')
    location = shop.get('location', '')
    address = shop.get('address', '')
    rating = shop.get('rating', '')
    review_count = shop.get('reviewCount', 0)
    hours = shop.get('hours', '')
    desc = shop.get('description', '')
    reviews = shop.get('reviews', [])
    review_texts = ' '.join([r.get('text','')[:100] for r in reviews[:3]])

    missing = []
    if not shop.get('metaDescription', '').strip(): missing.append('metaDescription')
    if not shop.get('seoKeywords', '').strip(): missing.append('seoKeywords')
    if not shop.get('seoText', '').strip(): missing.append('seoText')
    if not shop.get('description', '').strip(): missing.append('description')

    if not missing:
        return None

    prompt = f"""Generate SEO content for a Korean beauty salon page targeting foreign tourists.

Shop: {name}
Category: {category}
Location: {location}, Seoul
Address: {address}
Rating: {rating} ({review_count} reviews)
Hours: {hours}
Existing description: {desc[:300]}
Reviews: {review_texts[:400]}

Missing fields: {missing}

Return JSON with ONLY the missing fields:
{{
  "metaDescription": "155 chars max. Include shop name, category, location, foreign-friendly",
  "seoKeywords": "comma-separated 8-10 keywords mixing brand+generic+location",
  "seoText": "300-400 word SEO article about this shop. Include H2 headings naturally. Focus on foreign visitors, English-friendly service, what to expect, location, booking via WhatsApp.",
  "description": "2-3 sentences about the shop. Rating, specialty, why foreigners love it."
}}

Only include the fields listed in missing fields."""

    return call_ai(prompt)

# ════════════════════════════════════════
# 1단계: 영상 description + tags
# ════════════════════════════════════════
print("=" * 60)
print("1단계: 영상 description + tags 생성")
print("=" * 60)

videos_resp = requests.get(f"{SITE_URL}/api/videos", timeout=15)
videos = videos_resp.json()
if not isinstance(videos, list):
    videos = videos.get('videos', videos.get('data', []))

print(f"총 영상: {len(videos)}개")
no_desc = [v for v in videos if not v.get('description','').strip()]
no_tags = [v for v in videos if not v.get('tags') or len(v.get('tags',[])) == 0]
targets = list({v['id']: v for v in (no_desc + no_tags)}.values())
print(f"처리 필요: {len(targets)}개\n")

video_ok = 0
video_fail = 0

for i, video in enumerate(targets):
    shop = video.get('shop', {})
    name = shop.get('name', video.get('title', ''))
    print(f"[{i+1}/{len(targets)}] 영상: {name[:40]}", end=" ... ")

    try:
        desc, tags = generate_video_seo(video, shop)
        update_data = {}
        if not video.get('description','').strip() and desc:
            update_data['description'] = desc
        if (not video.get('tags') or len(video.get('tags',[])) == 0) and tags:
            update_data['tags'] = tags

        if update_data:
            status, body = api_patch_video(video['id'], update_data)
            if status in [200, 204]:
                print(f"✅ (tags:{len(tags)}, desc:{len(desc)}자)")
                video_ok += 1
            else:
                # PATCH 안되면 PUT 시도
                resp2 = requests.put(
                    f"{SITE_URL}/api/videos/{video['id']}",
                    headers={**headers_json, "x-admin-token": GENSPARK_TOKEN},
                    json={**video, **update_data},
                    timeout=15
                )
                if resp2.status_code in [200, 204]:
                    print(f"✅ PUT (tags:{len(tags)})")
                    video_ok += 1
                else:
                    print(f"❌ {status} / {resp2.status_code}: {body[:80]}")
                    video_fail += 1
        else:
            print("⏭ 이미 있음")
            video_ok += 1

        time.sleep(0.5)  # API 부하 방지

    except Exception as e:
        print(f"❌ 오류: {e}")
        video_fail += 1
        time.sleep(1)

print(f"\n영상 완료: 성공 {video_ok} / 실패 {video_fail}\n")

# ════════════════════════════════════════
# 2단계: 업체 누락 SEO
# ════════════════════════════════════════
print("=" * 60)
print("2단계: 업체 누락 SEO 생성")
print("=" * 60)

shops_resp = requests.get(f"{SITE_URL}/api/shops?limit=200", timeout=15)
shops = shops_resp.json()
if not isinstance(shops, list):
    shops = shops.get('shops', shops.get('data', []))

# 누락된 업체만 필터
targets_shop = [s for s in shops if not all([
    s.get('metaDescription','').strip(),
    s.get('seoKeywords','').strip(),
    s.get('seoText','').strip(),
    s.get('description','').strip()
])]

print(f"총 업체: {len(shops)}개")
print(f"SEO 보완 필요: {len(targets_shop)}개\n")

shop_ok = 0
shop_fail = 0

for i, shop in enumerate(targets_shop):
    name = shop.get('name', '')
    missing = []
    if not shop.get('metaDescription','').strip(): missing.append('meta')
    if not shop.get('seoKeywords','').strip(): missing.append('keywords')
    if not shop.get('seoText','').strip(): missing.append('seoText')
    if not shop.get('description','').strip(): missing.append('desc')

    print(f"[{i+1}/{len(targets_shop)}] {name[:40]} (누락: {', '.join(missing)})", end=" ... ")

    try:
        seo = generate_shop_seo(shop)
        if not seo:
            print("⏭ 이미 완성")
            shop_ok += 1
            continue

        update_data = {}
        if 'metaDescription' in seo and not shop.get('metaDescription','').strip():
            update_data['metaDescription'] = seo['metaDescription']
        if 'seoKeywords' in seo and not shop.get('seoKeywords','').strip():
            update_data['seoKeywords'] = seo['seoKeywords']
        if 'seoText' in seo and not shop.get('seoText','').strip():
            update_data['seoText'] = seo['seoText']
        if 'description' in seo and not shop.get('description','').strip():
            update_data['description'] = seo['description']

        if update_data:
            status, body = api_patch_shop(shop['id'], update_data)
            if status in [200, 204]:
                print(f"✅ ({', '.join(update_data.keys())})")
                shop_ok += 1
            else:
                # PUT 시도
                resp2 = requests.put(
                    f"{SITE_URL}/api/shops/{shop['id']}",
                    headers={**headers_json, "x-admin-token": GENSPARK_TOKEN},
                    json={**shop, **update_data},
                    timeout=15
                )
                if resp2.status_code in [200, 204]:
                    print(f"✅ PUT")
                    shop_ok += 1
                else:
                    print(f"❌ {status} / {resp2.status_code}: {body[:80]}")
                    shop_fail += 1
        else:
            print("⏭ 이미 완성")
            shop_ok += 1

        time.sleep(0.5)

    except Exception as e:
        print(f"❌ 오류: {e}")
        shop_fail += 1
        time.sleep(1)

print(f"\n업체 SEO 완료: 성공 {shop_ok} / 실패 {shop_fail}")
print("\n전체 완료!")
