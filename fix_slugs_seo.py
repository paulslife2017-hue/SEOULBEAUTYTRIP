#!/usr/bin/env python3
"""
전체 48개 업체 slug SEO 최적화
원칙: [브랜드명]-[카테고리키워드]-[지역명]
- Seoul 없음 (도메인에 이미 있음)
- 카테고리 키워드 포함
- 지역명 포함
- 45자 이하
- 중복 지역명 제거
"""
import psycopg2

DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

# ── 전체 48개 수동 확정 slug 매핑 ──────────────────────────
# key = shop id, value = 최종 SEO slug
SLUG_MAP = {
    # ── clinic / plastic surgery ──────────────────────────
    's1780693001969': '21-plastic-surgery-gangnam',            # 21 Plastic Surgery ✅ OK
    's1780516377910': 'ab-plastic-surgery-seocho',             # AB Plastic Surgery Korea → korea 불필요
    's1780515490654': 'abijou-clinic-myeongdong',              # Abijou Clinic Myeongdong → jung 제거
    's1780565651266': 'arc-plastic-surgery-seocho',            # Arc Plastic Surgery Clinic → clinic 중복
    's1780526808341': 'barog-clinic-gangnam',                  # Barog Clinic Gangnam ✅ OK
    's1780827310980': 'benjamin-clinic-gangnam',               # Benjamin Clinic ✅ OK
    's1780566088980': 'braun-plastic-surgery-gangnam',         # Braun Plastic Surgery ✅ OK
    's1780297110624': 'cheongdam-dear-clinic-cheongdam',       # Cheongdam Dear Clinic ✅ OK
    's1780564696469': 'cinderella-plastic-surgery-seocho',     # Cinderella → clinic 불필요
    's1780316408989': 'como-clinic-itaewon',                   # COMO CLINIC ✅ OK
    's1779719053950': 'd-a-dermatology-clinic-gangnam',        # D&A Dermatology ✅ OK
    's1780515687183': 'drevers-clinic-gangnam',                # DR.EVERS GANGNAM → clinic 추가
    's1780922890768': 'fitting-clinic-gangnam',                # FittingClinic → 공백 추가
    's1780220517054': 'fleur-jardin-spa-myeongdong',           # Fleur Jardin → spa 추가
    's1780525137360': 'forena-clinic-hongdae',                 # Forena → branch/mapo 제거, hongdae 유지
    's1780527084893': 'gd-clinic-gangnam',                     # GD Clinic ✅ OK
    's1780565387125': 'glovi-anti-aging-clinic-gangnam',       # Glovi G-Thera → 간결화
    's1780527403963': 'glovi-plastic-surgery-gangnam',         # Glovi Plastic Surgery ✅ OK
    's1780515157329': 'gu-clinic-seocho',                      # GU Clinic ✅ OK
    's1780315558463': 'inko-clinic-gangnam',                   # INKO Seoul → seoul 제거, clinic 추가
    's1779718296725': 'jiwoo-clinic-gangnam',                  # Jiwoo Clinic ✅ OK
    's1780339886087': 'me-seoul-clinic-gangnam',               # ME SEOUL CLINIC ✅ (브랜드명이 ME SEOUL)
    's1780923119992': 'medicube-clinic-seocho',                # Medicube Clinic ✅ OK
    's1780318944037': 'nohd-dermatology-gangnam',              # Nohd Dermatology ✅ OK
    's1780225557756': 'ppeum-clinic-myeongdong',               # PPEUM Global → global/jung 제거
    's1780583257815': 'reev-clinic-gangnam',                   # Reev Clinic Gangnam ✅ OK
    's1780314888496': 'reone-dermatology-gangnam',             # Reone Dermatology → clinic 중복
    's1779710078129': 'reyou-clinic-gangnam',                  # ReYou clinic ✅ OK
    's1780754508019': 'seoul-i-plastic-surgery-gangnam',       # Seoul I ✅ (브랜드명이 Seoul I)
    's1779718886113': 'sooa-clinic-yongsan',                   # SOOA CLINIC ✅ OK
    's1780753753273': 'sugar-plastic-surgery-gangnam',         # Sugar Plastic Surgery ✅ OK
    's1780219187523': 'tune-clinic-apgujeong',                 # TUNE CLINIC → gangnam 제거, apgujeong 유지
    's1780516013117': 'uhcell-clinic-seocho',                  # UHCELL Seocho → seocho 중복 제거
    's1780873111138': 'upic-clinic-myeongdong',                # UPIC CLINIC ✅ OK
    's1780566543149': 'view-plastic-surgery-gangnam',          # View Plastic Surgery ✅ OK
    's1780527682620': 'wonderful-plastic-surgery-gangnam',     # Wonderful ✅ OK
    's1780826537638': 'yonghada-clinic-myeongdong',            # YONGHADA → jung→myeongdong (Toegye-ro = 명동 인근)
    's1779716197182': 'yonsei-midas-dental-incheon',           # Yonsei Midas Dental → clinic 불필요

    # ── skincare / spa ───────────────────────────────────
    's1779723794112': 'cclime-skincare-gangnam',               # CCLIME → skincare+gangnam 추가
    's1780872778831': 'glassy-skin-clinic-gangnam',            # Glassy Skin Clinic ✅ OK

    # ── hair salon ───────────────────────────────────────
    's1780430236540': 'diony-hair-salon-gangnam',              # DIONY → hair salon 추가
    's1780430056171': 'popo-hair-salon-seongsu',               # POPO HAIR → seongdong 제거

    # ── headspa ──────────────────────────────────────────
    's1779720947812': 'gungseochae-head-spa-gangnam',          # Gungseochae → head spa 추가
    's1780239332310': 'leebeauty-head-spa-myeongdong',         # Leebeauty → 대폭 축약 (69자→30자)
    's1779723339019': 'leekaja-hair-salon-myeongdong',         # LEEKAJA → hair salon
    's1779652745185': 'moclock-head-spa-gangnam',              # Moclock → head spa 추가

    # ── makeup / color ───────────────────────────────────
    's1780304540554': 'mood-collect-color-analysis-gangnam',   # Mood Collect → personal color 명확화

    # ── tattoo / eyebrow ─────────────────────────────────
    's1780741502058': 'inoute-eyebrow-tattoo-jamsil',          # INOUTE → 46자→30자로 축약

    # ── Reone dermatology (skincare) ─────────────────────
    # already listed above under clinic
}

def validate():
    """slug 검증: 길이, 중복, 패턴"""
    errors = []
    seen = {}
    for sid, slug in SLUG_MAP.items():
        if len(slug) > 50:
            errors.append(f'[길이초과] {slug} ({len(slug)}자)')
        if slug in seen:
            errors.append(f'[중복] {slug} ← {sid} vs {seen[slug]}')
        seen[slug] = sid
        if '--' in slug:
            errors.append(f'[이중대시] {slug}')
        if slug.startswith('-') or slug.endswith('-'):
            errors.append(f'[앞뒤대시] {slug}')
    return errors

def main():
    # 검증
    errors = validate()
    if errors:
        print('❌ 검증 오류:')
        for e in errors:
            print(f'  {e}')
        return

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # 현재 slug 조회
    ids = list(SLUG_MAP.keys())
    cur.execute("SELECT id, name, slug FROM shops WHERE id = ANY(%s::text[])", (ids,))
    current = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    print(f'=== SEO Slug 최적화 ({len(SLUG_MAP)}개) ===\n')
    print(f"{'업체명':40s} {'현재':55s} → 새 slug")
    print('-' * 130)

    changes = []
    no_change = []
    for sid, new_slug in SLUG_MAP.items():
        if sid not in current:
            print(f'  ⚠ ID 없음: {sid}')
            continue
        name, old_slug = current[sid]
        if old_slug == new_slug:
            no_change.append(name)
        else:
            print(f'  {name:40s} {old_slug:55s} → {new_slug}')
            changes.append((sid, new_slug, old_slug, name))

    print(f'\n변경: {len(changes)}개 | 유지: {len(no_change)}개')
    if no_change:
        print(f'유지 목록: {", ".join(no_change)}')

    # 새 slug가 기존 다른 업체와 충돌하는지 확인
    new_slugs = [c[1] for c in changes]
    if new_slugs:
        cur.execute(
            "SELECT slug, name FROM shops WHERE slug = ANY(%s::text[]) AND id != ALL(%s::text[])",
            (new_slugs, list(SLUG_MAP.keys()))
        )
        conflicts = cur.fetchall()
        if conflicts:
            print('\n❌ 충돌 발견 (다른 업체와 slug 겹침):')
            for slug, name in conflicts:
                print(f'  {slug} ← {name}')
            conn.close()
            return

    print('\n✅ 충돌 없음')

    confirm = input('\n실제 DB UPDATE 진행? (yes/no): ')
    if confirm.strip().lower() != 'yes':
        print('취소됨')
        conn.close()
        return

    # UPDATE 실행
    updated = 0
    for sid, new_slug, old_slug, name in changes:
        cur.execute("UPDATE shops SET slug = %s WHERE id = %s", (new_slug, sid))
        updated += cur.rowcount
        print(f'  ✅ {name}: {old_slug} → {new_slug}')

    conn.commit()
    print(f'\n🎉 {updated}개 slug 업데이트 완료!')
    conn.close()

if __name__ == '__main__':
    main()
