#!/usr/bin/env python3
"""
9개 업체 Google Places API 일괄 업데이트
- 영업시간, 영문주소, 리뷰(영어), 별점 자동수집
- PUT /api/shops/:id 로 DB 저장
"""
import json, subprocess, urllib.request, sys, time

LOCAL_URL = "http://localhost:3000"

SHOPS = [
    {"id": "s1779723339019", "name": "LEEKAJA MyeongDong Hair Salon", "location": "Myeongdong Seoul"},
    {"id": "s1779716197182", "name": "Yonsei Midas Dental Clinic",    "location": "Incheon Korea"},
    {"id": "s1779718886113", "name": "SOOA CLINIC",                   "location": "Yongsan Seoul"},
    {"id": "s1779710078129", "name": "ReYou clinic",                  "location": "Gangnam Seoul"},
    {"id": "s1779718296725", "name": "Jiwoo Clinic",                  "location": "Gangnam Seoul"},
    {"id": "s1779723794112", "name": "CCLIME",                        "location": "Seoul Korea"},
    {"id": "s1779719053950", "name": "D&A Dermatology Clinic",        "location": "Gangnam Seoul"},
    {"id": "s1779720947812", "name": "Gungseochae",                   "location": "Gangnam Seoul"},
    {"id": "s1779652745185", "name": "Moclock",                       "location": "Gangnam Seoul"},
]

def call_places_api(name, location):
    query = f"{name} {location} Korea"
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        f"{LOCAL_URL}/api/places-fetch",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def get_shop(shop_id):
    req = urllib.request.Request(f"{LOCAL_URL}/api/shops/{shop_id}")
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read())
        return data.get("shop", data)

def update_shop(shop_id, updates):
    shop = get_shop(shop_id)
    shop.update(updates)
    payload = json.dumps({
        "name":          shop.get("name", ""),
        "slug":          shop.get("slug", ""),
        "category":      shop.get("category", ""),
        "location":      shop.get("location", ""),
        "address":       updates.get("address", shop.get("address", "")),
        "googleMapUrl":  shop.get("googleMapUrl", ""),
        "googleMapEmbed":shop.get("googleMapEmbed", ""),
        "lat":           shop.get("lat", ""),
        "lng":           shop.get("lng", ""),
        "priceRange":    shop.get("priceRange", ""),
        "hours":         updates.get("hours", shop.get("hours", "")),
        "services":      shop.get("services", []),
        "servicePrices": shop.get("servicePrices", []),
        "description":   shop.get("description", ""),
        "thumbnail":     shop.get("thumbnail", ""),
        "photos":        shop.get("photos", []),
        "commission":    shop.get("commission", 15),
        "active":        shop.get("active", True),
        "reviews":       updates.get("reviews", shop.get("reviews", [])),
        "googlePlaceId": updates.get("googlePlaceId", shop.get("googlePlaceId", "")),
        "rating":        updates.get("rating", shop.get("rating", 5.0)),
        "reviewCount":   updates.get("reviewCount", shop.get("reviewCount", 0)),
    }).encode()
    req = urllib.request.Request(
        f"{LOCAL_URL}/api/shops/{shop_id}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def main():
    print(f"🚀 9개 업체 Google Places 정보 자동수집 시작\n{'='*55}")
    ok, fail = 0, 0

    for i, shop in enumerate(SHOPS, 1):
        sid  = shop["id"]
        name = shop["name"]
        loc  = shop["location"]
        print(f"\n[{i}/{len(SHOPS)}] {name}")

        try:
            data = call_places_api(name, loc)
            if data.get("error"):
                print(f"  ⚠️  API 오류: {data['error']}")
                fail += 1
                continue

            updates = {}
            if data.get("address"):     updates["address"]     = data["address"]
            if data.get("hours"):       updates["hours"]       = data["hours"]
            if data.get("reviews"):     updates["reviews"]     = data["reviews"]
            if data.get("placeId"):     updates["googlePlaceId"] = data["placeId"]
            if data.get("rating"):      updates["rating"]      = data["rating"]
            if data.get("reviewCount"): updates["reviewCount"] = data["reviewCount"]

            print(f"  📍 주소: {data.get('address','없음')[:60]}")
            print(f"  🕐 영업시간: {data.get('hours','없음')[:80]}")
            print(f"  ⭐ 별점: {data.get('rating',0)} ({data.get('reviewCount',0)}개)")
            print(f"  💬 영어 리뷰: {len(data.get('reviews',[]))}개")

            update_shop(sid, updates)
            print(f"  💾 DB 저장 ✅")
            ok += 1

        except Exception as e:
            print(f"  ❌ 실패: {e}")
            fail += 1

        time.sleep(0.5)

    print(f"\n{'='*55}")
    print(f"🏁 완료! 성공: {ok} / 실패: {fail}")
    if fail == 0:
        print("🎉 전체 성공!")

if __name__ == "__main__":
    main()
