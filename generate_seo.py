#!/usr/bin/env python3
"""
Seoul Beauty Trip - 업체 SEO 설명 일괄 자동생성 스크립트
- curl subprocess 방식 (SSL/쿠키 문제 우회)
- 모델: gpt-5-mini
- 재시도: 최대 3회
"""

import json
import time
import subprocess
import urllib.request
import os
import sys

# ──────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────
GSK_TOKEN = os.environ.get("GSK_TOKEN", "")
AI_URL    = "https://www.genspark.ai/api/llm_proxy/v1/chat/completions"
LOCAL_URL = "http://localhost:3000"
MODEL     = "gpt-5-mini"
MAX_RETRY = 3
TIMEOUT   = 60

if not GSK_TOKEN:
    print("❌ GSK_TOKEN 환경변수가 없습니다.")
    sys.exit(1)

print(f"🔑 GSK_TOKEN: {GSK_TOKEN[:20]}...")

# ──────────────────────────────────────────────
# 카테고리별 키워드
# ──────────────────────────────────────────────
CAT_KEYWORDS = {
    "skincare": "Korean skincare, facial treatment, skin glow, K-beauty skincare",
    "hair":     "Korean hair salon, K-beauty hair, hair treatment, Korean hairstyle",
    "headspa":  "Korean head spa, scalp treatment, hair spa Seoul, Korean scalp care",
    "nail":     "Korean nail art, nail salon Seoul, K-beauty nails, gel nails Seoul",
    "makeup":   "Korean makeup, K-beauty makeup, professional makeup Seoul",
    "clinic":   "Korean aesthetic clinic, medical beauty Korea, Korean skincare clinic, dermatology Seoul",
    "dental":   "Korean dental clinic, teeth whitening Korea, dental care Seoul",
    "wellness": "Korean wellness, spa Seoul, Korean massage, wellness center Seoul",
}

# ──────────────────────────────────────────────
# 프롬프트 빌더
# ──────────────────────────────────────────────
def build_prompt(shop):
    name     = shop["name"]
    location = shop["location"] or "Seoul"
    category = shop["category"] or "beauty"
    keywords = CAT_KEYWORDS.get(category, "Korean beauty, K-beauty Seoul")
    area     = location.split(",")[0].strip()

    return (
        f"You are an SEO expert for a Korean beauty tourism website targeting English-speaking tourists visiting Seoul.\n\n"
        f"Write a shop description for:\n"
        f"- Business: {name}\n"
        f"- Location: {location}, Seoul\n"
        f"- Category: {category}\n"
        f"- Key terms: {keywords}\n\n"
        f"Return ONLY this JSON (no markdown, no explanation):\n"
        f'{{"description": "2-3 sentences (80-120 words). Mention {area} location, highlight Korean {category} expertise, note English-friendly service or tourist accessibility.", '
        f'"metaDescription": "Under 155 chars. Include the business name and main service keyword."}}'
    )

# ──────────────────────────────────────────────
# AI API 호출 (curl subprocess)
# ──────────────────────────────────────────────
def call_ai_curl(prompt):
    payload = json.dumps({
        "model":      MODEL,
        "max_tokens": 600,
        "messages":   [{"role": "user", "content": prompt}]
    })

    cmd = [
        "curl", "-s", "-X", "POST", AI_URL,
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: Bearer {GSK_TOKEN}",
        "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "-H", "Origin: https://www.genspark.ai",
        "-H", "Referer: https://www.genspark.ai/",
        "--max-time", str(TIMEOUT),
        "-d", payload
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT + 5)
        raw = result.stdout.strip()
        if not raw:
            if result.stderr:
                print(f"    stderr: {result.stderr[:100]}")
            return ""
        data    = json.loads(raw)
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            # 오류 메시지 확인
            if "detail" in data:
                print(f"    API 오류: {data['detail'][:100]}")
        return content.strip()
    except subprocess.TimeoutExpired:
        print(f"    타임아웃({TIMEOUT}s)")
        return ""
    except json.JSONDecodeError as e:
        print(f"    JSON 파싱 실패: {e} | raw: {raw[:100]}")
        return ""
    except Exception as e:
        print(f"    예외: {e}")
        return ""

def parse_json(text):
    if not text:
        return None
    s = text.find("{")
    e = text.rfind("}")
    if s == -1 or e == -1:
        return None
    try:
        return json.loads(text[s:e+1])
    except json.JSONDecodeError:
        # 따옴표 문제 시 완화 처리
        return None

# ──────────────────────────────────────────────
# 로컬 API 헬퍼
# ──────────────────────────────────────────────
def api_get(path):
    req = urllib.request.Request(f"{LOCAL_URL}{path}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def api_put(path, body_dict):
    payload = json.dumps(body_dict).encode("utf-8")
    req = urllib.request.Request(
        f"{LOCAL_URL}{path}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def update_description(shop_id, description):
    shop_data = api_get(f"/api/shops/{shop_id}")
    shop      = shop_data.get("shop", shop_data)

    result = api_put(f"/api/shops/{shop_id}", {
        "name":          shop.get("name", ""),
        "slug":          shop.get("slug", ""),
        "category":      shop.get("category", ""),
        "location":      shop.get("location", ""),
        "address":       shop.get("address", ""),
        "googleMapUrl":  shop.get("googleMapUrl", ""),
        "googleMapEmbed":shop.get("googleMapEmbed", ""),
        "lat":           shop.get("lat", ""),
        "lng":           shop.get("lng", ""),
        "priceRange":    shop.get("priceRange", ""),
        "hours":         shop.get("hours", ""),
        "services":      shop.get("services", []),
        "servicePrices": shop.get("servicePrices", []),
        "description":   description,
        "thumbnail":     shop.get("thumbnail", ""),
        "photos":        shop.get("photos", []),
        "commission":    shop.get("commission", 15),
        "active":        shop.get("active", True),
    })
    return result.get("ok") or result.get("success") or "ok" in result

# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────
def main():
    print("📋 업체 목록 조회 중...")
    data  = api_get("/api/shops")
    shops = data.get("shops", data) if isinstance(data, dict) else data
    print(f"✅ 총 {len(shops)}개 업체\n{'='*55}")

    ok_list   = []
    fail_list = []

    for i, shop in enumerate(shops, 1):
        sid      = shop["id"]
        name     = shop["name"]
        existing = (shop.get("description") or "").strip()

        print(f"\n[{i}/{len(shops)}] {name}")
        print(f"  위치: {shop.get('location','')} | 카테고리: {shop.get('category','')}")

        # 유효한 영문 설명(50자+)이 이미 있으면 스킵
        if len(existing) > 50 and existing[0].isascii():
            print(f"  ⏭️  이미 설명 있음, 건너뜀")
            ok_list.append({"name": name, "status": "skipped"})
            continue

        prompt = build_prompt(shop)
        seo    = None

        for attempt in range(1, MAX_RETRY + 1):
            print(f"  🤖 AI 생성... (시도 {attempt}/{MAX_RETRY})", end=" ", flush=True)
            text = call_ai_curl(prompt)

            if not text:
                print("❌ 빈 응답")
                time.sleep(3)
                continue

            seo = parse_json(text)
            if seo and seo.get("description"):
                print("✅")
                break
            else:
                # JSON 파싱 실패해도 텍스트 자체가 설명이면 사용
                if len(text) > 50:
                    print(f"⚠️  JSON 실패, 텍스트 직접 사용")
                    seo = {"description": text[:300]}
                    break
                print(f"⚠️  파싱 실패")
                time.sleep(3)

        if not (seo and seo.get("description")):
            print(f"  ❌ 최종 실패")
            fail_list.append({"id": sid, "name": name})
            continue

        desc = seo["description"]
        print(f"  📝 {desc[:90]}...")

        try:
            ok = update_description(sid, desc)
            if ok:
                print(f"  💾 DB 저장 ✅")
                ok_list.append({"name": name, "status": "updated"})
            else:
                print(f"  ⚠️  DB 응답 이상")
                fail_list.append({"id": sid, "name": name})
        except Exception as e:
            print(f"  ⚠️  DB 저장 실패: {e}")
            fail_list.append({"id": sid, "name": name})

        time.sleep(1.5)

    # 결과 요약
    print(f"\n{'='*55}")
    print(f"🏁 완료! 성공: {len(ok_list)} / 실패: {len(fail_list)}")
    print(f"{'='*55}")
    if ok_list:
        print("✅ 성공:")
        for r in ok_list:
            print(f"   [{r['status']}] {r['name']}")
    if fail_list:
        print("\n❌ 실패:")
        for r in fail_list:
            print(f"   {r['name']} ({r['id']})")

    return len(fail_list) == 0

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
