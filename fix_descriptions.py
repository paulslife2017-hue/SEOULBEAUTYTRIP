#!/usr/bin/env python3
"""
업체 description 전면 재생성
- 300자 미만 또는 템플릿 패턴("destination in") 업체 대상
- 카테고리별 실제 시술/서비스 특성 반영
- FittingClinic 수준의 설득력 있는 300-450자 설명 생성
"""
import os, time, requests, json
from openai import OpenAI

GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = 'https://seoulbeautytrip.com'
headers = {'Content-Type': 'application/json', 'x-admin-token': GSK_TOKEN}

client = OpenAI(
    api_key=GSK_TOKEN,
    base_url="https://www.genspark.ai/api/llm_proxy/v1"
)

# 카테고리별 설명 가이드
CAT_GUIDE = {
    'clinic': 'skin treatments (laser, Botox, fillers, skin booster), dermatology procedures, anti-aging',
    'headspa': '18-step Korean head spa, scalp massage, hair loss treatment, deep conditioning',
    'hair': 'Korean hair styling, coloring, perm, treatment, cut for foreigners',
    'tattoo': 'Korean tattoo, microblading, PMU (permanent makeup), eyebrow tattoo',
    'makeup': 'Korean makeup, personal color analysis, beauty consultation',
    'skincare': 'Korean skincare, facial treatment, pore care, brightening',
    'plastic_surgery': 'Korean cosmetic surgery, rhinoplasty, eye surgery, V-line, body contouring',
    'dental': 'Korean dental care, teeth whitening, implant, orthodontics',
}

def clean_location(location: str) -> str:
    """'Gangnam, Seoul' → 'Gangnam' (Seoul 중복 방지)"""
    if not location:
        return 'Seoul'
    # 이미 Seoul이 들어있는 경우 첫번째 부분만 사용
    parts = [p.strip() for p in location.split(',')]
    # Seoul이 아닌 첫 번째 부분
    area = parts[0] if parts else 'Seoul'
    return area

def generate_description(shop: dict) -> str:
    name = shop.get('name', '')
    category = shop.get('category', 'clinic')
    location = shop.get('location', 'Seoul')
    rating = shop.get('rating', 0)
    review_count = shop.get('reviewCount', shop.get('review_count', 0))
    services = shop.get('services', [])
    seo_text = shop.get('seoText', '')
    
    # 위치 정리 (Seoul 중복 방지)
    area = clean_location(location)
    location_str = location if location else 'Seoul'
    
    # 카테고리 가이드
    cat_desc = CAT_GUIDE.get(category, CAT_GUIDE.get('clinic'))
    
    # 실제 서비스 목록
    services_str = ', '.join(services[:6]) if services else ''
    
    # 기존 seoText 참고 (있는 경우)
    seo_context = f"\n- Existing info: {seo_text[:300]}" if seo_text else ''
    
    # rating/review 문구
    rating_str = f"Rated {rating}/5" if rating else ""
    review_str = f"with {review_count}+ verified reviews" if review_count else ""
    
    prompt = f"""Write a compelling English description for a Korean beauty business for international visitors.

Business details:
- Name: {name}
- Category: {category} ({cat_desc})
- Location: {area}, Seoul
- Rating: {rating_str} {review_str}
- Services: {services_str}{seo_context}

Requirements:
1. Length: EXACTLY 300-420 characters (including spaces)
2. Tone: Confident, warm, persuasive — like a trusted travel guide
3. Structure: [What they specialize in] + [Why it's special / what makes it unique] + [Who it's for / why book now]
4. Must mention the specific area ({area}) naturally, NOT "Seoul, Seoul" or "[area], Seoul, Seoul"
5. Include 1-2 specific treatment types from the category
6. End with a benefit for the visitor (e.g., "English-friendly staff", "easy online booking", "results you'll notice right away")
7. No generic phrases like "world-class" or "best in Seoul" — be specific
8. DO NOT start with the business name — start with what they offer

Output: ONLY the description text, nothing else."""

    try:
        resp = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": "You are a K-beauty copywriter. Write compelling, specific descriptions for international visitors to Korean beauty shops. Be persuasive but honest."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.75,
            timeout=35
        )
        text = resp.choices[0].message.content.strip()
        # 따옴표 제거
        text = text.strip('"\'')
        return text
    except Exception as e:
        print(f"    ❌ AI error: {e}")
        return ''

def update_shop(shop_id: str, description: str) -> bool:
    try:
        resp = requests.put(
            f'{SITE_URL}/api/shops/{shop_id}',
            json={'description': description},
            headers=headers,
            timeout=20
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"    ❌ Update error: {e}")
        return False

def main():
    # 전체 업체 가져오기
    resp = requests.get(f'{SITE_URL}/api/shops?limit=200', headers=headers, timeout=30)
    shops = resp.json().get('shops', [])
    print(f"총 업체 수: {len(shops)}개")
    
    # 재생성 대상: 400자 미만 OR 템플릿 패턴 OR 설명 없음
    targets = [
        s for s in shops
        if (not s.get('description') 
            or len(s.get('description', '')) < 400 
            or 'destination in' in s.get('description', '')
            or ', Seoul, Seoul' in s.get('description', ''))
    ]
    
    print(f"재생성 대상: {len(targets)}개 업체")
    print()
    
    success = 0
    fail = 0
    
    for i, shop in enumerate(targets, 1):
        name = shop.get('name', 'Unknown')
        old_desc = shop.get('description', '')
        print(f"[{i:2d}/{len(targets)}] {name} (현재 {len(old_desc)}자)")
        
        new_desc = generate_description(shop)
        
        if not new_desc:
            fail += 1
            time.sleep(1)
            continue
        
        print(f"    📝 {len(new_desc)}자: {new_desc[:80]}...")
        
        if update_shop(shop['id'], new_desc):
            print(f"    ✅ 업데이트 성공")
            success += 1
        else:
            print(f"    ❌ 업데이트 실패")
            fail += 1
        
        time.sleep(0.5)
    
    print(f"\n{'='*60}")
    print(f"✅ 성공: {success}개")
    print(f"❌ 실패: {fail}개")

if __name__ == '__main__':
    main()
