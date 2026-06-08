#!/usr/bin/env python3
"""
24개 업체 Google Places 사진 일괄 가져오기
사이트의 /api/places-photos 엔드포인트를 통해 사진 URL 배열 업데이트
"""
import os, time, requests, json

GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = 'https://seoulbeautytrip.com'
headers = {'Content-Type': 'application/json', 'x-admin-token': GSK_TOKEN}

# DB에서 가져온 실제 placeId 목록
TARGETS = [
    {'id': 's1780922890768', 'name': 'FittingClinic', 'placeId': 'ChIJawa5mCajfDURlcCl7lsudOc'},
    {'id': 's1780873111138', 'name': 'UPIC CLINIC MYEONGDONG', 'placeId': 'ChIJ80W3IBOjfDURzcGD8gE3QZs'},
    {'id': 's1780872778831', 'name': 'Glassy Skin Clinic', 'placeId': 'ChIJ91Wq5nukfDURtSppFkBrSvo'},
    {'id': 's1780827310980', 'name': 'Benjamin Clinic', 'placeId': 'ChIJm5EoyVqjfDURotEr2_uksuc'},
    {'id': 's1780826537638', 'name': 'YONGHADA CLINIC', 'placeId': 'ChIJ4bFXpiiZfDURpgRrPlQbBNk'},
    {'id': 's1780754508019', 'name': '(Seoul I Plastic Surgery)', 'placeId': 'ChIJD2TH6VihfDURnLJU7JdsScE'},
    {'id': 's1780753753273', 'name': 'Sugar Plastic Surgery', 'placeId': 'ChIJWRyVTiKjfDURX-kHBF1KAnU'},
    {'id': 's1780693001969', 'name': '21 Plastic Surgery', 'placeId': 'ChIJZcP1vvKhfDUROJ_brkuRRhY'},
    {'id': 's1780583257815', 'name': 'Reev Clinic Gangnam', 'placeId': 'ChIJN-hOkmujfDURvAN1yDF2CCw'},
    {'id': 's1780565651266', 'name': 'Arc Plastic Surgery Clinic', 'placeId': 'ChIJubPc80ajfDURV1PQhVjE9sE'},
    {'id': 's1780527403963', 'name': 'Glovi Plastic Surgery', 'placeId': 'ChIJBbwIL9KjfDURaApklSMyc_4'},
    {'id': 's1780527084893', 'name': 'GD Clinic', 'placeId': 'ChIJz_3FYFehfDURFCetWGu0YhE'},
    {'id': 's1780526808341', 'name': 'Barog Clinic Gangnam', 'placeId': 'ChIJhfB3LZChfDURu3aYZ7yVQAc'},
    {'id': 's1780525137360', 'name': 'Forena Clinic Hongdae Branch', 'placeId': 'ChIJkdRPMgCZfDURU4hzP3e3vUo'},
    {'id': 's1780516013117', 'name': 'UHCELL Seocho Clinic', 'placeId': 'ChIJPf5t33mhfDUR-gR9W5m9rMo'},
    {'id': 's1780515687183', 'name': 'DR.EVERS GANGNAM', 'placeId': 'ChIJ3c941UOjfDUReb0GDN2s4Kw'},
    {'id': 's1780515490654', 'name': 'Abijou Clinic Myeongdong', 'placeId': 'ChIJlYdc4PCifDURk6tmEFkH8xg'},
    {'id': 's1780515157329', 'name': 'GU Clinic', 'placeId': 'ChIJtS5avy2hfDURkzd5I0jpCR4'},
    {'id': 's1780430056171', 'name': 'POPO HAIR SALON Seongsu', 'placeId': 'ChIJITuK_vWlfDURSQXwmI3_kss'},
    {'id': 's1780316408989', 'name': 'COMO CLINIC', 'placeId': 'ChIJvYXYbVOjfDURQOgJBUnz0g4'},
    {'id': 's1780315558463', 'name': 'INKO Seoul', 'placeId': 'ChIJwbjxw4ejfDURTOr-rgUgtbg'},
    {'id': 's1780314888496', 'name': 'Reone Dermatology Clinic', 'placeId': 'ChIJrT1FV6Yp640RXxpa9iMwluk'},
    {'id': 's1780225557756', 'name': 'PPEUM Global Clinic Myeongdong', 'placeId': 'ChIJ9wcCYMijfDURNtvCO9ZwrZg'},
    {'id': 's1780220517054', 'name': 'Fleur Jardin Myeongdong', 'placeId': 'ChIJmYvAL-uIm6oRQsJI6orMKok'},
]

def fetch_photos_via_site(place_id: str) -> list:
    """사이트 API를 통해 사진 URLs 가져오기"""
    try:
        resp = requests.post(
            f'{SITE_URL}/api/places-photos',
            json={'placeId': place_id},
            headers=headers,
            timeout=40
        )
        if resp.status_code == 200:
            data = resp.json()
            photos = data.get('photos', [])
            return [p for p in photos if p]  # 빈 문자열 제거
        else:
            print(f"    ⚠️ API error {resp.status_code}: {resp.text[:200]}")
            return []
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return []

def update_shop_photos(shop_id: str, photos: list) -> bool:
    """업체 photos 업데이트"""
    try:
        resp = requests.put(
            f'{SITE_URL}/api/shops/{shop_id}',
            json={'photos': photos},
            headers=headers,
            timeout=20
        )
        if resp.status_code == 200:
            return True
        else:
            print(f"    ❌ Update error {resp.status_code}: {resp.text[:100]}")
            return False
    except Exception as e:
        print(f"    ❌ Update failed: {e}")
        return False

def main():
    print(f"🚀 사진 일괄 가져오기 시작 - {len(TARGETS)}개 업체")
    print(f"Site: {SITE_URL}\n")
    
    success_count = 0
    fail_count = 0
    no_photos = []
    
    for i, shop in enumerate(TARGETS, 1):
        print(f"[{i:2d}/{len(TARGETS)}] {shop['name']}")
        
        # 1. 사진 가져오기
        photos = fetch_photos_via_site(shop['placeId'])
        
        if not photos:
            print(f"    ⚠️ 사진 없음 (Places API에서 반환 안됨)")
            no_photos.append(shop['name'])
            fail_count += 1
            time.sleep(1)
            continue
        
        print(f"    📸 {len(photos)}장 가져옴")
        
        # 2. DB 업데이트
        if update_shop_photos(shop['id'], photos):
            print(f"    ✅ 업데이트 성공")
            success_count += 1
        else:
            print(f"    ❌ 업데이트 실패")
            fail_count += 1
        
        time.sleep(0.8)  # API rate limit
    
    print(f"\n{'='*50}")
    print(f"✅ 성공: {success_count}개")
    print(f"❌ 실패/사진없음: {fail_count}개")
    if no_photos:
        print(f"사진 없는 업체: {no_photos}")

if __name__ == '__main__':
    main()
