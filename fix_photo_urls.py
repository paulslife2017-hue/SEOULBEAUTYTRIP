#!/usr/bin/env python3
"""
기존 저장된 places.googleapis.com 사진 URL을
/api/photo?name=... 프록시 URL로 일괄 변환
"""
import json, subprocess, re, urllib.parse

BASE = "http://localhost:3000"

def api_get(path):
    r = subprocess.run(["curl","-s", BASE+path], capture_output=True, text=True)
    return json.loads(r.stdout)

def api_put(shop_id, body):
    r = subprocess.run([
        "curl","-s","-X","PUT", f"{BASE}/api/shops/{shop_id}",
        "-H","Content-Type: application/json",
        "-d", json.dumps(body)
    ], capture_output=True, text=True)
    return json.loads(r.stdout)

def to_proxy(url):
    """places.googleapis.com URL → /api/photo?name=... 상대경로 프록시 URL"""
    if not url:
        return url
    if '/api/photo' in url:
        # 이미 프록시이지만 절대 URL인 경우 → 상대경로로 변환
        m = re.search(r'/api/photo\?name=(.+)', url)
        if m:
            return f"/api/photo?name={m.group(1)}"
        return url
    # places/XXX/photos/YYY 부분 추출
    m = re.search(r'(places/[^/]+/photos/[^?&]+)', url)
    if m:
        name = urllib.parse.quote(m.group(1), safe='')
        return f"/api/photo?name={name}"
    return url  # 변환 불가 → 그대로

def main():
    data = api_get("/api/shops")
    shops = data.get("shops", data) if isinstance(data, dict) else data

    success, skip = 0, 0
    for shop in shops:
        sid = shop["id"]
        name = shop["name"]

        thumb = shop.get("thumbnail","")
        photos = shop.get("photos",[]) or []

        # 변환 필요 여부 체크
        needs_fix = (
            "places.googleapis.com" in (thumb or "") or
            "seoulbeautytrip.vercel.app" in (thumb or "") or
            any("places.googleapis.com" in (p or "") or "seoulbeautytrip.vercel.app" in (p or "") for p in photos)
        )
        if not needs_fix:
            print(f"  ✅ {name[:35]:<35} — 이미 OK, 스킵")
            skip += 1
            continue

        new_thumb = to_proxy(thumb) if thumb else ""
        new_photos = [to_proxy(p) for p in photos]

        put_body = {k: v for k, v in shop.items()}
        put_body["thumbnail"] = new_thumb
        put_body["photos"]    = new_photos

        res = api_put(sid, put_body)
        if "error" not in res:
            print(f"  🔄 {name[:35]:<35} — thumb + {len(new_photos)}장 프록시화")
            success += 1
        else:
            print(f"  ❌ {name} — 실패: {res}")

    print(f"\n🏁 완료! 변환: {success} / 스킵: {skip}")

if __name__ == "__main__":
    main()
