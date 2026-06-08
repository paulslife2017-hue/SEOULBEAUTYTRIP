#!/usr/bin/env python3
"""
29개 업체 slug 숫자 접미사 → 지역명으로 변경
중복 지역명 제거 로직 포함
"""
import psycopg2, re

DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

LOCATION_MAP = {
    'Gangnam': 'gangnam',
    'Seocho': 'seocho',
    'Myeongdong': 'myeongdong',
    'Itaewon': 'itaewon',
    'Mapo': 'mapo',
    'Hongdae': 'hongdae',
    'Sinsa': 'sinsa',
    'Apgujeong': 'apgujeong',
    'Cheongdam': 'cheongdam',
    'Sinchon': 'sinchon',
    'Jamsil': 'jamsil',
    'Seongsu': 'seongsu',
    'Seongdong': 'seongdong',
    'Jung': 'jung',
    'Yongsan': 'yongsan',
}

def get_location_suffix(location, address=''):
    """location + address에서 지역명 slug 추출"""
    combined = ((location or '') + ' ' + (address or '')).lower()
    for area_name, slug in LOCATION_MAP.items():
        if area_name.lower() in combined:
            return slug
    return 'seoul'

def make_base_slug(name):
    slug = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def build_new_slug(base, loc_suffix):
    """
    base slug에 loc_suffix 추가, 단 base 내에 이미 loc_suffix가 포함된 경우 중복 방지
    예: base='barog-clinic-gangnam', loc='gangnam' → 'barog-clinic-gangnam' (중복 제거)
    예: base='gd-clinic', loc='gangnam' → 'gd-clinic-gangnam'
    """
    # base 안에 이미 loc_suffix 단어가 있으면 중복 제거
    parts = base.split('-')
    if loc_suffix in parts:
        return base  # 이미 포함됨
    return base + '-' + loc_suffix

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("SELECT id, name, slug, location, address FROM shops WHERE slug ~ '-[0-9]{6}$' ORDER BY name")
rows = cur.fetchall()

print(f'변경 대상: {len(rows)}개\n')
print(f"{'OLD SLUG':55s} → NEW SLUG")
print('-' * 100)

changes = []
for sid, name, old_slug, location, address in rows:
    base = make_base_slug(name)
    loc_suffix = get_location_suffix(location, address)
    new_slug = build_new_slug(base, loc_suffix)
    
    print(f'  {old_slug:55s} → {new_slug}')
    changes.append((sid, new_slug, old_slug))

print(f'\n총 {len(changes)}개 변경 예정')

# 기존 slug 충돌 확인
new_slugs = [c[1] for c in changes]
cur.execute("SELECT slug FROM shops WHERE slug != ALL(%s::text[]) OR slug = ANY(%s::text[])", (new_slugs, new_slugs))
# 충돌 확인: 새 slug가 다른 업체 slug와 겹치는지
cur.execute("SELECT slug FROM shops WHERE slug ~ '-[0-9]{6}$'")
old_slugs_set = {r[0] for r in cur.fetchall()}

cur.execute("SELECT slug FROM shops WHERE slug !~ '-[0-9]{6}$'")
existing_slugs = {r[0] for r in cur.fetchall()}

conflicts = [(old, new) for sid, new, old in changes if new in existing_slugs and new not in old_slugs_set]
if conflicts:
    print('\n⚠️  충돌 발견:')
    for old, new in conflicts:
        print(f'  {old} → {new} (이미 존재!)')
else:
    print('\n✅ 충돌 없음')

confirm = input('\n실제 DB UPDATE 진행? (yes/no): ')
if confirm.lower() != 'yes':
    print('취소됨')
    conn.close()
    exit()

# 실제 UPDATE
updated = 0
for sid, new_slug, old_slug in changes:
    cur.execute("UPDATE shops SET slug = %s WHERE id = %s", (new_slug, sid))
    updated += cur.rowcount

conn.commit()
print(f'\n✅ {updated}개 slug 업데이트 완료')

# 결과 확인
cur.execute("SELECT name, slug FROM shops WHERE id = ANY(%s::text[])", ([c[0] for c in changes],))
print('\n=== 업데이트 결과 ===')
for r in cur.fetchall():
    print(f'  {r[0]:45s} → {r[1]}')

conn.close()
