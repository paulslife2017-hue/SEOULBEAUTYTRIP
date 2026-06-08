#!/usr/bin/env python3
"""
삭제된 29개 업체 복구 스크립트
- 24개: fetch_photos.py에서 id/name/placeId 확보 → Google Places로 상세정보 조회
- 5개: placeId 없음 → 이름으로 Google Places 검색 후 복구
"""
import json, os, time, urllib.request, urllib.parse, psycopg2, re
from datetime import datetime

DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
GOOGLE_KEY   = 'AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY'
SITE_URL     = 'https://seoulbeautytrip.vercel.app'

# ── 복구 대상 24개 (fetch_photos.py에서) ──────────────────
SHOPS_24 = [
    {'id': 's1780922890768', 'name': 'FittingClinic',                  'placeId': 'ChIJawa5mCajfDURlcCl7lsudOc'},
    {'id': 's1780873111138', 'name': 'UPIC CLINIC MYEONGDONG',         'placeId': 'ChIJ80W3IBOjfDURzcGD8gE3QZs'},
    {'id': 's1780872778831', 'name': 'Glassy Skin Clinic',             'placeId': 'ChIJ91Wq5nukfDURtSppFkBrSvo'},
    {'id': 's1780827310980', 'name': 'Benjamin Clinic',                'placeId': 'ChIJm5EoyVqjfDURotEr2_uksuc'},
    {'id': 's1780826537638', 'name': 'YONGHADA CLINIC',                'placeId': 'ChIJ4bFXpiiZfDURpgRrPlQbBNk'},
    {'id': 's1780754508019', 'name': 'Seoul I Plastic Surgery',        'placeId': 'ChIJD2TH6VihfDURnLJU7JdsScE'},
    {'id': 's1780753753273', 'name': 'Sugar Plastic Surgery',          'placeId': 'ChIJWRyVTiKjfDURX-kHBF1KAnU'},
    {'id': 's1780693001969', 'name': '21 Plastic Surgery',             'placeId': 'ChIJZcP1vvKhfDUROJ_brkuRRhY'},
    {'id': 's1780583257815', 'name': 'Reev Clinic Gangnam',            'placeId': 'ChIJN-hOkmujfDURvAN1yDF2CCw'},
    {'id': 's1780565651266', 'name': 'Arc Plastic Surgery Clinic',     'placeId': 'ChIJubPc80ajfDURV1PQhVjE9sE'},
    {'id': 's1780527403963', 'name': 'Glovi Plastic Surgery',          'placeId': 'ChIJBbwIL9KjfDURaApklSMyc_4'},
    {'id': 's1780527084893', 'name': 'GD Clinic',                      'placeId': 'ChIJz_3FYFehfDURFCetWGu0YhE'},
    {'id': 's1780526808341', 'name': 'Barog Clinic Gangnam',           'placeId': 'ChIJhfB3LZChfDURu3aYZ7yVQAc'},
    {'id': 's1780525137360', 'name': 'Forena Clinic Hongdae Branch',   'placeId': 'ChIJkdRPMgCZfDURU4hzP3e3vUo'},
    {'id': 's1780516013117', 'name': 'UHCELL Seocho Clinic',           'placeId': 'ChIJPf5t33mhfDUR-gR9W5m9rMo'},
    {'id': 's1780515687183', 'name': 'DR.EVERS GANGNAM',               'placeId': 'ChIJ3c941UOjfDUReb0GDN2s4Kw'},
    {'id': 's1780515490654', 'name': 'Abijou Clinic Myeongdong',       'placeId': 'ChIJlYdc4PCifDURk6tmEFkH8xg'},
    {'id': 's1780515157329', 'name': 'GU Clinic',                      'placeId': 'ChIJtS5avy2hfDURkzd5I0jpCR4'},
    {'id': 's1780430056171', 'name': 'POPO HAIR SALON Seongsu',        'placeId': 'ChIJITuK_vWlfDURSQXwmI3_kss'},
    {'id': 's1780316408989', 'name': 'COMO CLINIC',                    'placeId': 'ChIJvYXYbVOjfDURQOgJBUnz0g4'},
    {'id': 's1780315558463', 'name': 'INKO Seoul',                     'placeId': 'ChIJwbjxw4ejfDURTOr-rgUgtbg'},
    {'id': 's1780314888496', 'name': 'Reone Dermatology Clinic',       'placeId': 'ChIJrT1FV6Yp640RXxpa9iMwluk'},
    {'id': 's1780225557756', 'name': 'PPEUM Global Clinic Myeongdong', 'placeId': 'ChIJ9wcCYMijfDURNtvCO9ZwrZg'},
    {'id': 's1780220517054', 'name': 'Fleur Jardin Myeongdong',        'placeId': 'ChIJmYvAL-uIm6oRQsJI6orMKok'},
]

# ── placeId 없는 5개 — 이름으로 검색 ──────────────────────
SHOPS_5 = [
    {'id': 's1780527682620', 'name': 'Pencil Plastic Surgery',        'placeId': ''},
    {'id': 's1780564696469', 'name': 'Cinderella Plastic Surgery',    'placeId': ''},
    {'id': 's1780566088980', 'name': 'Braun Plastic Surgery',         'placeId': ''},
    {'id': 's1780566543149', 'name': 'View Plastic Surgery',          'placeId': ''},
    {'id': 's1780923119992', 'name': 'Medi:Woods Dermatology Clinic', 'placeId': ''},
]

# ── Google Places API (placeId → 상세정보) ─────────────────
FIELDS = 'displayName,rating,userRatingCount,formattedAddress,regularOpeningHours,editorialSummary,photos'

def fetch_by_placeid(place_id: str) -> dict:
    url = (f'https://places.googleapis.com/v1/places/{place_id}'
           f'?fields={urllib.parse.quote(FIELDS)}&languageCode=en&key={GOOGLE_KEY}')
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f'    [Places fetch err] {e}')
        return {}

def search_by_name(name: str) -> dict:
    """이름으로 검색해서 placeId + 상세정보 반환"""
    payload = json.dumps({'textQuery': name + ' Seoul Korea', 'languageCode': 'en'}).encode()
    url = 'https://places.googleapis.com/v1/places:searchText'
    req = urllib.request.Request(url, data=payload, headers={
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.regularOpeningHours'
    }, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        places = data.get('places', [])
        if places:
            p = places[0]
            return {'placeId': p.get('id',''), 'raw': p}
    except Exception as e:
        print(f'    [Search err] {e}')
    return {}

def get_photo_urls(place_id: str, max_count=6) -> list:
    """사이트 /api/places-photos 엔드포인트로 사진 URL 가져오기"""
    try:
        payload = json.dumps({'placeId': place_id}).encode()
        req = urllib.request.Request(
            f'{SITE_URL}/api/places-photos',
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read().decode())
        photos = [p for p in data.get('photos', []) if p]
        return photos[:max_count]
    except Exception as e:
        print(f'    [Photos err] {e}')
        return []

def guess_category(name: str, place_types: list = []) -> str:
    name_lower = name.lower()
    if any(w in name_lower for w in ['hair', 'salon', 'barber']): return 'hair'
    if any(w in name_lower for w in ['nail']): return 'nail'
    if any(w in name_lower for w in ['plastic surgery', 'plastic']): return 'clinic'
    if any(w in name_lower for w in ['dermatology', 'derm', 'skin clinic']): return 'skincare'
    if any(w in name_lower for w in ['dental', 'dentist']): return 'clinic'
    if any(w in name_lower for w in ['spa', 'massage']): return 'spa'
    if any(w in name_lower for w in ['makeup', 'color']): return 'makeup'
    if any(w in name_lower for w in ['headspa', 'head spa']): return 'headspa'
    if any(w in name_lower for w in ['clinic']): return 'clinic'
    return 'clinic'

def make_slug(name: str, shop_id: str) -> str:
    slug = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug + '-' + shop_id[-6:]

def restore_shop(cur, shop_id: str, name: str, place_id: str, places_data: dict, photos: list):
    """DB에 업체 복구 INSERT"""
    address  = places_data.get('formattedAddress', '')
    rating   = places_data.get('rating', 5.0) or 5.0
    rv_count = places_data.get('userRatingCount', 0) or 0
    summary  = places_data.get('editorialSummary', {})
    desc     = summary.get('text', '') if isinstance(summary, dict) else ''
    
    # 영업시간
    oh = places_data.get('regularOpeningHours', {})
    weekdays = oh.get('weekdayDescriptions', []) if oh else []
    hours = ' | '.join(weekdays) if weekdays else ''
    
    # 위치 추정 (주소에서)
    location = 'Seoul'
    if address:
        for area in ['Gangnam','Myeongdong','Hongdae','Sinchon','Itaewon','Jamsil','Apgujeong','Cheongdam','Sinsa','Seongsu','Seocho','Mapo']:
            if area.lower() in address.lower():
                location = area + ', Seoul'
                break

    category = guess_category(name)
    slug = make_slug(name, shop_id)
    thumbnail = photos[0] if photos else ''
    today = datetime.now().strftime('%Y-%m-%d')

    cur.execute("""
        INSERT INTO shops (
            id, name, slug, category, location, address,
            google_map_url, google_map_embed, lat, lng,
            price_range, hours, services, service_prices,
            description, meta_description, seo_keywords, seo_text, why_choose,
            rating, review_count, thumbnail, photos,
            commission, active, created_at, google_place_id
        ) VALUES (
            %s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s,%s,%s,
            %s,%s,%s,%s
        ) ON CONFLICT (id) DO NOTHING
    """, (
        shop_id, name, slug, category, location, address,
        '', '', '', '',
        '', hours, json.dumps([]), json.dumps([]),
        desc, '', '', '', json.dumps([]),
        float(rating), int(rv_count), thumbnail, json.dumps(photos),
        15, True, today, place_id
    ))

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # 현재 DB에 있는 ID 확인
    cur.execute('SELECT id FROM shops')
    existing = {r[0] for r in cur.fetchall()}
    print(f'현재 DB: {len(existing)}개 업체\n')

    all_shops = SHOPS_24 + SHOPS_5
    success, skip, fail = 0, 0, 0

    for i, shop in enumerate(all_shops, 1):
        sid   = shop['id']
        name  = shop['name']
        pid   = shop['placeId']

        if sid in existing:
            print(f'[{i:2d}/{len(all_shops)}] ⏭  {name} (이미 존재)')
            skip += 1
            continue

        print(f'[{i:2d}/{len(all_shops)}] 🔄 {name}')

        try:
            # placeId 없으면 검색
            if not pid:
                print(f'       검색 중...')
                result = search_by_name(name)
                pid = result.get('placeId', '')
                print(f'       placeId: {pid or "못 찾음"}')

            # Google Places 상세 조회
            places_data = {}
            if pid:
                places_data = fetch_by_placeid(pid)
                # displayName으로 이름 보정
                dn = places_data.get('displayName', {})
                if isinstance(dn, dict) and dn.get('text'):
                    corrected = dn['text']
                    if corrected and corrected != name:
                        print(f'       이름 보정: {name} → {corrected}')
                        name = corrected

            # 사진 가져오기
            photos = []
            if pid:
                print(f'       사진 로딩...')
                photos = get_photo_urls(pid, 6)
                print(f'       사진: {len(photos)}장')

            # DB INSERT
            restore_shop(cur, sid, name, pid, places_data, photos)
            conn.commit()
            print(f'       ✅ 복구 완료 (rating={places_data.get("rating","—")}, photos={len(photos)})')
            success += 1

        except Exception as e:
            conn.rollback()
            print(f'       ❌ 실패: {e}')
            fail += 1

        time.sleep(0.5)

    cur.execute('SELECT COUNT(*) FROM shops')
    total = cur.fetchone()[0]
    conn.close()

    print(f'\n{"="*55}')
    print(f'✅ 복구 완료: {success}개 | ⏭ 스킵: {skip}개 | ❌ 실패: {fail}개')
    print(f'최종 DB 업체 수: {total}개')

if __name__ == '__main__':
    main()
