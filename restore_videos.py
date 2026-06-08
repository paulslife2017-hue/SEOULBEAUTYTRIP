#!/usr/bin/env python3
"""
Cloudinary 영상 → DB videos 테이블 복구 스크립트
- timestamp 기반으로 shop_id 자동 매핑 (차이 60초 이내)
- 이미 존재하는 영상은 스킵
"""
import psycopg2, json, base64, urllib.request, time

CLOUD_NAME   = 'dc0ouozcd'
API_KEY      = '221647295675392'
API_SECRET   = 'g10Q4wv2UzDEAGV35QluPCYz4Ms'
DATABASE_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

# 복구 대상 29개 업체 ID
TARGET_IDS = [
    's1780922890768','s1780873111138','s1780872778831','s1780827310980','s1780826537638',
    's1780754508019','s1780753753273','s1780693001969','s1780583257815','s1780565651266',
    's1780527403963','s1780527084893','s1780526808341','s1780525137360','s1780516013117',
    's1780515687183','s1780515490654','s1780515157329','s1780430056171','s1780316408989',
    's1780315558463','s1780314888496','s1780225557756','s1780220517054',
    's1780527682620','s1780564696469','s1780566088980','s1780566543149','s1780923119992'
]

def cloudinary_thumb(video_url: str) -> str:
    """Cloudinary 영상 URL → 썸네일 URL (첫 프레임)"""
    return video_url.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace('.mp4', '.jpg')

def get_cloudinary_videos():
    """Cloudinary에서 seoul-beauty 폴더 영상 전체 조회"""
    credentials = base64.b64encode(f'{API_KEY}:{API_SECRET}'.encode()).decode()
    url = f'https://api.cloudinary.com/v1_1/{CLOUD_NAME}/resources/video/upload?max_results=100&type=upload'
    req = urllib.request.Request(url, headers={'Authorization': f'Basic {credentials}'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode())
    videos = [r for r in data['resources'] if r['public_id'].startswith('seoul-beauty/')]
    videos.sort(key=lambda x: x['created_at'])
    return videos

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    # 현재 DB에 있는 video URL 목록
    cur.execute('SELECT video_url FROM videos')
    existing_urls = {r[0] for r in cur.fetchall()}
    print(f'기존 DB 영상: {len(existing_urls)}개\n')

    # 복구 대상 업체 정보
    cur.execute('SELECT id, name FROM shops WHERE id = ANY(%s)', (TARGET_IDS,))
    target_shops = {r[0]: r[1] for r in cur.fetchall()}
    print(f'복구 대상 업체: {len(target_shops)}개\n')

    # Cloudinary 영상 조회
    cld_videos = get_cloudinary_videos()
    print(f'Cloudinary 영상: {len(cld_videos)}개\n')
    print('='*70)

    success, skip, fail = 0, 0, 0

    for v in cld_videos:
        video_url = v['secure_url']

        # 이미 DB에 있으면 스킵
        if video_url in existing_urls:
            skip += 1
            continue

        # URL에서 upload timestamp 추출: /upload/v{ts}/
        parts = video_url.split('/')
        vts = 0
        for p in parts:
            if p.startswith('v17') or p.startswith('v16'):
                try:
                    vts = int(p[1:])
                except:
                    pass
                break

        if not vts:
            print(f'⚠️  timestamp 파싱 실패: {video_url}')
            fail += 1
            continue

        # 가장 가까운 shop_id 찾기 (60초 이내)
        best_shop_id = None
        best_diff = 999999
        for sid in TARGET_IDS:
            if sid not in target_shops:
                continue
            shop_ts_s = int(sid[1:]) / 1000  # ms → s
            diff = abs(vts - shop_ts_s)
            if diff < best_diff:
                best_diff = diff
                best_shop_id = sid

        if best_diff > 200:  # 200초 초과면 매핑 불확실
            print(f'⚠️  매핑 불확실 (diff={best_diff:.0f}s): {video_url[-50:]}')
            fail += 1
            continue

        shop_name = target_shops.get(best_shop_id, '???')
        video_id  = 'v' + str(int(time.time() * 1000))
        thumb     = cloudinary_thumb(video_url)

        try:
            cur.execute("""
                INSERT INTO videos (id, shop_id, title, description, video_url, thumbnail, tags, views, likes, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (
                video_id,
                best_shop_id,
                shop_name,
                '',
                video_url,
                thumb,
                json.dumps([]),
                0,
                0,
                v['created_at'][:10]
            ))
            conn.commit()
            existing_urls.add(video_url)
            print(f'✅  [{best_diff:4.0f}s] {shop_name[:40]:40s} → {video_url[-45:]}')
            success += 1
            time.sleep(0.05)

        except Exception as e:
            conn.rollback()
            print(f'❌  INSERT 실패: {e}')
            fail += 1

    cur.execute('SELECT COUNT(*) FROM videos')
    total = cur.fetchone()[0]
    conn.close()

    print(f'\n{"="*70}')
    print(f'✅ 복구 성공: {success}개 | ⏭ 스킵: {skip}개 | ❌ 실패: {fail}개')
    print(f'최종 DB 영상 수: {total}개')

if __name__ == '__main__':
    main()
