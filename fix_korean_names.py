#!/usr/bin/env python3
"""
한글 이름 10개 업체 → Google Places API (languageCode=en) 영어로 전체 재업데이트
- name, address, hours, location 전부 영어로 교체
- slug도 영어 이름 기준으로 재생성
"""
import psycopg2, json, urllib.request, urllib.parse, re, time

DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
GOOGLE_KEY   = 'AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY'
FIELDS       = 'displayName,formattedAddress,regularOpeningHours,location'

# 한글 이름 10개 업체 + placeId
TARGETS = [
    {'id': 's1780526808341', 'english': 'Barog Clinic Gangnam',    'placeId': 'ChIJhfB3LZChfDURu3aYZ7yVQAc'},
    {'id': 's1780872778831', 'english': 'Glassy Skin Clinic',      'placeId': 'ChIJ91Wq5nukfDURtSppFkBrSvo'},
    {'id': 's1780826537638', 'english': 'YONGHADA CLINIC',         'placeId': 'ChIJ4bFXpiiZfDURpgRrPlQbBNk'},
    {'id': 's1780754508019', 'english': 'Seoul I Plastic Surgery', 'placeId': 'ChIJD2TH6VihfDURnLJU7JdsScE'},
    {'id': 's1780583257815', 'english': 'Reev Clinic Gangnam',     'placeId': 'ChIJN-hOkmujfDURvAN1yDF2CCw'},
    {'id': 's1780527084893', 'english': 'GD Clinic',               'placeId': 'ChIJz_3FYFehfDURFCetWGu0YhE'},
    {'id': 's1780922890768', 'english': 'FittingClinic',           'placeId': 'ChIJawa5mCajfDURlcCl7lsudOc'},
    {'id': 's1780516013117', 'english': 'UHCELL Seocho Clinic',    'placeId': 'ChIJPf5t33mhfDUR-gR9W5m9rMo'},
    {'id': 's1780430056171', 'english': 'POPO HAIR SALON Seongsu', 'placeId': 'ChIJITuK_vWlfDURSQXwmI3_kss'},
    {'id': 's1780316408989', 'english': 'COMO CLINIC',             'placeId': 'ChIJvYXYbVOjfDURQOgJBUnz0g4'},
]

def fetch_place_en(place_id: str) -> dict:
    """Places API languageCode=en 으로 영어 정보 가져오기"""
    url = (f'https://places.googleapis.com/v1/places/{place_id}'
           f'?fields={urllib.parse.quote(FIELDS)}&languageCode=en&key={GOOGLE_KEY}')
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f'    [Places err] {e}')
        return {}

def make_slug(name: str, shop_id: str) -> str:
    slug = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug + '-' + shop_id[-6:]

def guess_location(address: str) -> str:
    if not address:
        return 'Seoul'
    for area in ['Gangnam','Myeongdong','Hongdae','Sinchon','Itaewon','Jamsil',
                 'Apgujeong','Cheongdam','Sinsa','Seongsu','Seocho','Mapo','Yongsan','Jung']:
        if area.lower() in address.lower():
            return area + ', Seoul'
    return 'Seoul'

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    success, fail = 0, 0

    for i, t in enumerate(TARGETS, 1):
        sid     = t['id']
        fallback= t['english']
        pid     = t['placeId']

        print(f'[{i:2d}/10] {fallback}')

        try:
            data = fetch_place_en(pid)

            # 영어 이름
            dn = data.get('displayName', {})
            en_name = (dn.get('text', '') if isinstance(dn, dict) else '') or fallback
            print(f'         name: {en_name}')

            # 영어 주소
            en_addr = data.get('formattedAddress', '')
            print(f'         addr: {en_addr[:70]}')

            # 영업시간 (영어)
            oh = data.get('regularOpeningHours', {})
            weekdays = oh.get('weekdayDescriptions', []) if oh else []
            en_hours = ' | '.join(weekdays) if weekdays else ''

            # 위치 추정
            location = guess_location(en_addr)

            # lat/lng
            loc = data.get('location', {})
            lat = str(loc.get('latitude', '')) if loc else ''
            lng = str(loc.get('longitude', '')) if loc else ''

            # slug 재생성
            new_slug = make_slug(en_name, sid)

            cur.execute("""
                UPDATE shops SET
                    name     = %s,
                    slug     = %s,
                    address  = %s,
                    hours    = %s,
                    location = %s,
                    lat      = %s,
                    lng      = %s
                WHERE id = %s
            """, (en_name, new_slug, en_addr, en_hours, location, lat, lng, sid))
            conn.commit()
            print(f'         ✅ 업데이트 완료 (location={location})')

            # videos 테이블의 title도 영어로 업데이트
            cur.execute("UPDATE videos SET title = %s WHERE shop_id = %s AND (title LIKE %s OR title LIKE %s)",
                        (en_name, sid, '%의원%', '%한의원%'))
            conn.commit()

            success += 1

        except Exception as e:
            conn.rollback()
            print(f'         ❌ 실패: {e}')
            fail += 1

        time.sleep(0.4)

    conn.close()
    print(f'\n{"="*55}')
    print(f'✅ 성공: {success}개 | ❌ 실패: {fail}개')

if __name__ == '__main__':
    main()
