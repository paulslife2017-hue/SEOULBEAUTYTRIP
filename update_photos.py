#!/usr/bin/env python3
"""
Google Places API로 9개 업체 사진 일괄 업데이트
placeId가 이미 저장되어 있으므로 /api/places-photos 엔드포인트로 바로 요청
"""
import json, subprocess, time

BASE = "http://localhost:3000"

def api_get(path):
    r = subprocess.run(["curl","-s", BASE+path], capture_output=True, text=True)
    return json.loads(r.stdout)

def api_post(path, body):
    r = subprocess.run([
        "curl","-s","-X","POST", BASE+path,
        "-H","Content-Type: application/json",
        "-d", json.dumps(body)
    ], capture_output=True, text=True)
    return json.loads(r.stdout)

def api_put(shop_id, body):
    r = subprocess.run([
        "curl","-s","-X","PUT", f"{BASE}/api/shops/{shop_id}",
        "-H","Content-Type: application/json",
        "-d", json.dumps(body)
    ], capture_output=True, text=True)
    return json.loads(r.stdout)

def main():
    # 전체 업체 목록 가져오기
    data = api_get("/api/shops")
    shops = data.get("shops", data) if isinstance(data, dict) else data

    success, fail = 0, 0

    for shop in shops:
        sid   = shop["id"]
        name  = shop["name"]
        place_id = shop.get("googlePlaceId", "")

        if not place_id:
            print(f"  ⚠️  {name} — placeId 없음, 스킵")
            fail += 1
            continue

        # Places API로 사진 가져오기
        result = api_post("/api/places-photos", {"placeId": place_id})
        photos = result.get("photos", [])

        if not photos:
            print(f"  ⚠️  {name} — 사진 없음 (result: {result})")
            fail += 1
            continue

        # 기존 데이터 유지하면서 photos만 업데이트
        put_body = {k: v for k, v in shop.items()}
        # key 매핑 (camelCase → API 필드명)
        put_body["photos"]      = photos
        put_body["thumbnail"]   = shop.get("thumbnail") or photos[0]
        put_body["googlePlaceId"] = place_id

        res = api_put(sid, put_body)

        if res.get("id") or res.get("success") or "error" not in res:
            print(f"  ✅ {name[:35]:<35} → 사진 {len(photos)}장 저장")
            success += 1
        else:
            print(f"  ❌ {name} — PUT 실패: {res}")
            fail += 1

        time.sleep(0.4)   # API rate limit 방지

    print(f"\n🏁 완료! 성공: {success} / 실패: {fail}")

if __name__ == "__main__":
    main()
