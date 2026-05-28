#!/usr/bin/env python3
"""
기존 9개 업체 - Google Places API로 영업시간 + 영문주소 + 리뷰 일괄 업데이트
"""
import json, subprocess, urllib.request, sys, time

LOCAL_URL = "http://localhost:3000"
GKEY = "AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY"

def places_fetch(query):
    """Google Places API New 호출"""
    payload = json.dumps({
        "textQuery": query + " Korea",
        "languageCode": "en"
    })
    cmd = [
        "curl", "-s", "--max-time", "15",
        "-X", "POST",
        "https://places.googleapis.com/v1/places:searchText",
        "-H", "Content-Type: application/json",
        "-H", f"X-Goog-Api-Key: {GKEY}",
        "-H", "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.regularOpeningHours,places.rating,places.userRatingCount,places.reviews",
        "-d", payload
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        data = json.loads(r.stdout)
        place = data.get("places", [{}])[0]
        if not place:
            return None

        # 영업시간
        weekdays = place.get("regularOpeningHours", {}).get("weekdayDescriptions", [])
        hours_str = " | ".join(weekdays)

        # 영어 리뷰만 최대 5개
        raw_reviews = place.get("reviews", [])
        reviews = []
        for rv in raw_reviews:
            lang = rv.get("text", {}).get("languageCode", "")
            text = rv.get("text", {}).get("text", "")
            if lang == "en" and len(text) > 20:
                reviews.append({
                    "author": rv.get("authorAttribution", {}).get("displayName", "Guest"),
                    "rating": rv.get("rating", 5),
                    "text": text,
                    "time": rv.get("relativePublishTimeDescription", "")
                })
            if len(reviews) >= 5:
                break

        return {
            "placeId": place.get("id", ""),
            "address": place.get("formattedAddress", ""),
            "hours": hours_str,
            "weekdays": weekdays,
            "rating": place.get("rating", 0),
            "reviewCount": place.get("userRatingCount", 0),
            "reviews": reviews
        }
    except Exception as e:
        print(f"    API 오류: {e}")
        return None

def get_shop(shop_id):
    req = urllib.request.Request(f"{LOCAL_URL}/api/shops/{shop_id}")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read()).get("shop", {})

def update_shop(shop_id, updates):
    shop = get_shop(shop_id)
    # 업데이트 적용
    shop.update(updates)
    payload = json.dumps({
        "name":          shop.get("name", ""),
        "slug":          shop.get("slug", ""),
        "category":      shop.get("category", ""),
        "location":      shop.get("location", ""),
        "address":       updates.get("address") or shop.get("address", ""),
        "googleMapUrl":  shop.get("googleMapUrl", ""),
        "googleMapEmbed":shop.get("googleMapEmbed", ""),
        "lat":           shop.get("lat", ""),
        "lng":           shop.get("lng", ""),
        "priceRange":    shop.get("priceRange", ""),
        "hours":         updates.get("hours") or shop.get("hours", ""),
        "services":      shop.get("services", []),
        "servicePrices": shop.get("servicePrices", []),
        "description":   shop.get("description", ""),
        "thumbnail":     shop.get("thumbnail", ""),
        "photos":        shop.get("photos", []),
        "commission":    shop.get("commission", 15),
        "active":        shop.get("active", True),
        "rating":        updates.get("rating") or shop.get("rating", 5.0),
        "reviewCount":   updates.get("reviewCount") or shop.get("reviewCount", 0),
        "reviews":       updates.get("reviews", shop.get("reviews", [])),
        "googlePlaceId": updates.get("placeId") or shop.get("googlePlaceId", ""),
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
    # 업체 목록
    req = urllib.request.Request(f"{LOCAL_URL}/api/shops")
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read())
    shops = data.get("shops", []) if isinstance(data, dict) else data

    print(f"📋 총 {len(shops)}개 업체 Google Places 정보 업데이트\n{'='*55}")
    ok, fail = [], []

    for i, shop in enumerate(shops, 1):
        sid      = shop["id"]
        name     = shop["name"]
        location = shop.get("location", "Seoul")
        query    = f"{name} {location}"

        print(f"\n[{i}/{len(shops)}] {name}")
        print(f"  🔍 검색: {query}")

        result = places_fetch(query)
        if not result:
            print(f"  ❌ Places API 결과 없음")
            fail.append(name)
            time.sleep(0.5)
            continue

        print(f"  📍 주소: {result['address']}")
        print(f"  🕐 영업시간: {result['hours'][:60]}...")
        print(f"  ⭐ 평점: {result['rating']} ({result['reviewCount']} reviews)")
        print(f"  💬 영어 리뷰: {len(result['reviews'])}개")

        try:
            update_shop(sid, result)
            print(f"  ✅ DB 저장 완료!")
            ok.append(name)
        except Exception as e:
            print(f"  ❌ DB 저장 실패: {e}")
            fail.append(name)

        time.sleep(0.3)

    print(f"\n{'='*55}")
    print(f"🏁 완료! 성공: {len(ok)} / 실패: {len(fail)}")
    for n in ok:   print(f"  ✅ {n}")
    for n in fail: print(f"  ❌ {n}")

if __name__ == "__main__":
    main()
