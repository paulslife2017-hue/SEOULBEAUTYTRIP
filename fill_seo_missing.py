#!/usr/bin/env python3
"""
Seoul Beauty Trip - SEO 자동 채우기 스크립트
- 1단계: 영상 48개 description + tags 자동 생성
- 2단계: 업체 누락 SEO(metaDescription/seoKeywords/seoText/description) 자동 생성
- 수정: OpenAI SDK + GSK_TOKEN 사용 (401 오류 해결)
"""

import json, os, time, requests, sys
from openai import OpenAI

# ── 설정 ──
GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = "https://seoulbeautytrip.com"

if not GSK_TOKEN:
    print("❌ GSK_TOKEN 환경변수가 없습니다!")
    sys.exit(1)

print(f"✅ 토큰 확인: {GSK_TOKEN[:20]}...")

# OpenAI SDK 클라이언트 (Genspark proxy)
client = OpenAI(
    api_key=GSK_TOKEN,
    base_url="https://www.genspark.ai/api/llm_proxy/v1"
)

headers_json = {
    "Content-Type": "application/json",
    "x-admin-token": GSK_TOKEN
}

# ── AI 호출 함수 ──
def call_ai(prompt: str, system: str = "You are a K-beauty SEO expert. Respond only with valid JSON.") -> dict:
    """OpenAI SDK로 AI 호출"""
    resp = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        timeout=40
    )
    content = resp.choices[0].message.content.strip()
    # JSON 블록 추출
    if '```json' in content:
        content = content.split('```json')[1].split('```')[0].strip()
    elif '```' in content:
        content = content.split('```')[1].split('```')[0].strip()
    return json.loads(content)

# ── 사이트 API 함수 ──
def api_put_video(video_id: str, full_data: dict) -> tuple:
    """영상 PUT 업데이트"""
    resp = requests.put(
        f"{SITE_URL}/api/videos/{video_id}",
        headers=headers_json,
        json=full_data,
        timeout=15
    )
    return resp.status_code, resp.text[:200]

def api_put_shop(shop_id: str, full_data: dict) -> tuple:
    """업체 PUT 업데이트"""
    resp = requests.put(
        f"{SITE_URL}/api/shops/{shop_id}",
        headers=headers_json,
        json=full_data,
        timeout=15
    )
    return resp.status_code, resp.text[:200]

# ── 영상 SEO 생성 ──
def generate_video_seo(video: dict, shop: dict) -> tuple:
    """영상 description + tags 생성"""
    name = shop.get('name', '')
    category = shop.get('category', '')
    location = shop.get('location', '')
    vid_title = video.get('title', name)

    # 업체 상세 정보 가져오기 (shop에 rating/reviews가 없을 수 있음)
    rating = shop.get('rating', '')
    reviews = shop.get('reviews', [])
    review_text = reviews[0].get('text', '') if reviews else ''

    # 카테고리별 태그 매핑
    cat_tags = {
        'Skin Care': ['#KoreanSkincare', '#SeoulFacial'],
        'Hair': ['#KoreanHairSalon', '#SeoulHair'],
        'Nail': ['#KoreanNails', '#SeoulNailArt'],
        'Massage': ['#KoreanMassage', '#SeoulSpa'],
        'Lash': ['#KoreanLash', '#SeoulLash'],
        'Brow': ['#KoreanBrows', '#SeoulBrows'],
        'Makeup': ['#KoreanMakeup', '#SeoulMakeup'],
        'Clinic': ['#KoreanClinic', '#SeoulBeautyClinic'],
        'Tattoo': ['#KoreanTattoo', '#SeoulTattoo'],
        'Waxing': ['#KoreanWaxing', '#SeoulWaxing'],
    }
    cat_default = cat_tags.get(category, [f'#{category.replace(" ","")}'])

    prompt = f"""Generate SEO content for a Korean beauty salon short video targeting foreign tourists in Seoul.

Shop: {name}
Category: {category}
Location: {location}, Seoul
Rating: {rating}
Video title: {vid_title}
Sample review: {review_text[:200] if review_text else 'Great experience!'}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "description": "2-3 sentence engaging video description for foreigners visiting Seoul. Mention the specific treatment, location, and what makes it special. 80-120 words. Write in English.",
  "tags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6"]
}}

Tag rules:
- Always include #SeoulBeautyTrip
- Include 1-2 category tags like {cat_default}
- Include location tag like #{location.replace(' ','')}
- Include treatment/service specific tag
- Include travel tag like #VisitSeoul or #KBeauty
- Total 5-6 tags"""

    result = call_ai(prompt)
    desc = result.get('description', '').strip()
    tags = result.get('tags', [])
    # #SeoulBeautyTrip 보장
    if '#SeoulBeautyTrip' not in tags:
        tags.append('#SeoulBeautyTrip')
    return desc, tags[:7]

# ── 업체 SEO 생성 ──
def generate_shop_seo(shop: dict) -> dict | None:
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
    review_texts = ' '.join([r.get('text', '')[:100] for r in reviews[:3]])

    # 누락 필드 확인
    missing = []
    if not (shop.get('metaDescription') or '').strip():
        missing.append('metaDescription')
    if not (shop.get('seoKeywords') or '').strip():
        missing.append('seoKeywords')
    if not (shop.get('seoText') or '').strip():
        missing.append('seoText')
    if not (shop.get('description') or '').strip():
        missing.append('description')

    if not missing:
        return None

    prompt = f"""Generate SEO content for a Korean beauty salon page targeting foreign tourists visiting Seoul.

Shop: {name}
Category: {category}
Location: {location}, Seoul
Address: {address}
Rating: {rating} ({review_count} reviews)
Hours: {hours}
Existing description: {desc[:300] if desc else 'N/A'}
Customer reviews: {review_texts[:400] if review_texts else 'Great service, highly recommended!'}
Missing fields needed: {missing}

Return ONLY valid JSON (no markdown) with ONLY these missing fields:
{{
  "metaDescription": "155 chars max. Include: shop name, {category}, {location} Seoul, foreign-friendly, English available",
  "seoKeywords": "10-12 keywords comma-separated: brand name, category, location, treatment types, Seoul beauty, foreign tourist keywords",
  "seoText": "350-450 word SEO article. Start with shop intro. Include H2-style section titles naturally in text. Cover: what services offered, why foreigners love it, location/access, booking via WhatsApp, what to expect during visit. Natural English for foreign tourists.",
  "description": "2-3 sentences. Mention rating {rating}, specialty services, why foreigners choose this place."
}}

IMPORTANT: Only include the fields listed in missing fields: {missing}"""

    return call_ai(prompt)

# ════════════════════════════════════════════════════════
# 1단계: 영상 description + tags
# ════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("1단계: 영상 description + tags 생성")
print("=" * 60)

videos_resp = requests.get(f"{SITE_URL}/api/videos", timeout=15)
videos = videos_resp.json()
if not isinstance(videos, list):
    videos = videos.get('videos', videos.get('data', []))

print(f"총 영상: {len(videos)}개")

no_desc = [v for v in videos if not (v.get('description') or '').strip()]
no_tags = [v for v in videos if not v.get('tags') or len(v.get('tags', [])) == 0]
# 중복 제거 (id 기준)
targets_map = {v['id']: v for v in (no_desc + no_tags)}
targets = list(targets_map.values())

print(f"description 없음: {len(no_desc)}개")
print(f"tags 없음: {len(no_tags)}개")
print(f"처리 필요 (합산): {len(targets)}개\n")

video_ok = 0
video_fail = 0

for i, video in enumerate(targets):
    shop = video.get('shop', {})
    name = shop.get('name', video.get('title', ''))
    print(f"[{i+1}/{len(targets)}] {name[:40]}", end=" ... ", flush=True)

    try:
        desc, tags = generate_video_seo(video, shop)

        # 업데이트할 데이터 구성 (누락된 필드만)
        update_data = dict(video)  # 기존 데이터 복사
        update_data.pop('shop', None)  # shop 관계 제거

        changed = False
        if not (video.get('description') or '').strip() and desc:
            update_data['description'] = desc
            changed = True
        if (not video.get('tags') or len(video.get('tags', [])) == 0) and tags:
            update_data['tags'] = tags
            changed = True

        if not changed:
            print("⏭ 이미 있음")
            video_ok += 1
            continue

        status, body = api_put_video(video['id'], update_data)
        if status in [200, 201, 204]:
            print(f"✅ desc:{len(desc)}자 / tags:{len(tags)}개")
            video_ok += 1
        else:
            print(f"❌ {status}: {body[:80]}")
            video_fail += 1

        time.sleep(0.8)  # API 부하 방지

    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        video_fail += 1
        time.sleep(1)
    except Exception as e:
        print(f"❌ 오류: {e}")
        video_fail += 1
        time.sleep(1.5)

print(f"\n✅ 영상 완료: 성공 {video_ok} / 실패 {video_fail}")

# ════════════════════════════════════════════════════════
# 2단계: 업체 누락 SEO
# ════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("2단계: 업체 누락 SEO 생성")
print("=" * 60)

shops_resp = requests.get(f"{SITE_URL}/api/shops?limit=200", timeout=15)
shops_data = shops_resp.json()
if not isinstance(shops_data, list):
    shops_data = shops_data.get('shops', shops_data.get('data', []))

print(f"총 업체: {len(shops_data)}개")

# 누락 필드가 있는 업체만
targets_shop = [s for s in shops_data if not all([
    (s.get('metaDescription') or '').strip(),
    (s.get('seoKeywords') or '').strip(),
    (s.get('seoText') or '').strip(),
    (s.get('description') or '').strip()
])]

print(f"SEO 보완 필요: {len(targets_shop)}개\n")

shop_ok = 0
shop_fail = 0

for i, shop in enumerate(targets_shop):
    name = shop.get('name', '')
    missing = []
    if not (shop.get('metaDescription') or '').strip(): missing.append('metaDescription')
    if not (shop.get('seoKeywords') or '').strip(): missing.append('seoKeywords')
    if not (shop.get('seoText') or '').strip(): missing.append('seoText')
    if not (shop.get('description') or '').strip(): missing.append('description')

    print(f"[{i+1}/{len(targets_shop)}] {name[:38]} | 누락: {', '.join(missing)}", end=" ... ", flush=True)

    try:
        seo = generate_shop_seo(shop)
        if not seo:
            print("⏭ 이미 완성")
            shop_ok += 1
            continue

        # 업데이트할 데이터 구성 (기존 + 누락 필드만 추가)
        update_data = dict(shop)  # 기존 데이터 복사
        update_data.pop('reviews', None)  # reviews 제거 (너무 큼)
        update_data.pop('photos', None)   # photos 제거

        filled = []
        if 'metaDescription' in seo and not (shop.get('metaDescription') or '').strip():
            update_data['metaDescription'] = seo['metaDescription']
            filled.append('meta')
        if 'seoKeywords' in seo and not (shop.get('seoKeywords') or '').strip():
            update_data['seoKeywords'] = seo['seoKeywords']
            filled.append('keywords')
        if 'seoText' in seo and not (shop.get('seoText') or '').strip():
            update_data['seoText'] = seo['seoText']
            filled.append('seoText')
        if 'description' in seo and not (shop.get('description') or '').strip():
            update_data['description'] = seo['description']
            filled.append('desc')

        if not filled:
            print("⏭ 이미 완성")
            shop_ok += 1
            continue

        status, body = api_put_shop(shop['id'], update_data)
        if status in [200, 201, 204]:
            print(f"✅ ({', '.join(filled)})")
            shop_ok += 1
        else:
            print(f"❌ {status}: {body[:80]}")
            shop_fail += 1

        time.sleep(0.8)

    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        shop_fail += 1
        time.sleep(1)
    except Exception as e:
        print(f"❌ 오류: {e}")
        shop_fail += 1
        time.sleep(1.5)

print(f"\n✅ 업체 SEO 완료: 성공 {shop_ok} / 실패 {shop_fail}")

# ════════════════════════════════════════════════════════
# 최종 검증
# ════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("최종 검증")
print("=" * 60)

time.sleep(2)

v_resp = requests.get(f"{SITE_URL}/api/videos", timeout=15)
vids = v_resp.json()
if not isinstance(vids, list):
    vids = vids.get('videos', vids.get('data', []))

v_desc_ok = sum(1 for v in vids if (v.get('description') or '').strip())
v_tags_ok = sum(1 for v in vids if v.get('tags') and len(v.get('tags', [])) > 0)
print(f"영상 description: {v_desc_ok}/{len(vids)}")
print(f"영상 tags:        {v_tags_ok}/{len(vids)}")

s_resp = requests.get(f"{SITE_URL}/api/shops?limit=200", timeout=15)
shops_final = s_resp.json()
if not isinstance(shops_final, list):
    shops_final = shops_final.get('shops', shops_final.get('data', []))

s_meta = sum(1 for s in shops_final if (s.get('metaDescription') or '').strip())
s_kw = sum(1 for s in shops_final if (s.get('seoKeywords') or '').strip())
s_seo = sum(1 for s in shops_final if (s.get('seoText') or '').strip())
s_desc = sum(1 for s in shops_final if (s.get('description') or '').strip())
total = len(shops_final)
print(f"업체 metaDescription: {s_meta}/{total}")
print(f"업체 seoKeywords:     {s_kw}/{total}")
print(f"업체 seoText:         {s_seo}/{total}")
print(f"업체 description:     {s_desc}/{total}")
print("\n🎉 전체 완료!")
