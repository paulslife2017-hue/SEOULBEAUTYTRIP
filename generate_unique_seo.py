#!/usr/bin/env python3
"""
Seoul Beauty Trip - 업체별 고유 SEO 텍스트 자동생성 (v3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Google Places API (New) → 업종/리뷰/영업시간/에디토리얼 수집
  (전화번호·웹사이트·정확한 주소 제외)
• GPT-5-mini → 업체별 완전 고유 description + whyChoose 생성
• Neon PostgreSQL → shops 테이블 description / why_choose 직접 UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용법:
  python3 generate_unique_seo.py              # 전체 22개 업체
  python3 generate_unique_seo.py --dry        # DB 업데이트 없이 결과만 출력
  python3 generate_unique_seo.py --id=<shopId>  # 특정 업체 1개만
"""

import json, os, sys, time, subprocess, urllib.request, urllib.parse
import psycopg2

# ── 설정 ─────────────────────────────────────────
GOOGLE_KEY   = "AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY"
DATABASE_URL = "postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
AI_URL       = "https://www.genspark.ai/api/llm_proxy/v1/chat/completions"
GPT_MODEL    = "gpt-5.1"
TIMEOUT      = 90

# GSK_TOKEN: 환경변수 → yaml 파일 순서로 읽기
import yaml as _yaml
def _load_gsk() -> str:
    token = os.environ.get("GSK_TOKEN", "")
    if token:
        return token
    yaml_path = os.path.expanduser("~/.genspark_llm.yaml")
    if os.path.exists(yaml_path):
        with open(yaml_path) as f:
            cfg = _yaml.safe_load(f)
        return cfg.get("openai", {}).get("api_key", "")
    return ""

GSK_TOKEN = _load_gsk()
if not GSK_TOKEN:
    print("❌  GSK_TOKEN을 찾을 수 없습니다 (환경변수 또는 ~/.genspark_llm.yaml).")
    sys.exit(1)

# Google Places New API - 수집 필드 (전화·주소·URL 제외)
PLACES_FIELDS = (
    "displayName,rating,userRatingCount,reviews,"
    "regularOpeningHours,editorialSummary,"
    "types,primaryType,businessStatus,priceLevel"
)

# ── 1. Google Places 정보 수집 ────────────────────
def fetch_google_places(place_id: str) -> dict:
    url = (
        f"https://places.googleapis.com/v1/places/{place_id}"
        f"?fields={urllib.parse.quote(PLACES_FIELDS)}"
        f"&key={GOOGLE_KEY}"
    )
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"    [Places API error] {e}")
        return {}


def parse_hours_summary(periods: list) -> str:
    """영업시간 periods → 간결한 요약 (예: Mon–Fri 10:00–20:00, Sat–Sun 10:00–18:00)"""
    if not periods:
        return ""
    days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    slots = {}
    for p in periods:
        o = p.get("open", {})
        c = p.get("close", {})
        d = o.get("day")
        if d is None:
            continue
        time_str = f"{o.get('hour',0):02d}:{o.get('minute',0):02d}–{c.get('hour',0):02d}:{c.get('minute',0):02d}"
        slots[d] = time_str
    if not slots:
        return ""
    # 같은 시간대끼리 묶기
    time_to_days: dict[str, list] = {}
    for d in sorted(slots):
        t = slots[d]
        time_to_days.setdefault(t, []).append(days[d])
    parts = []
    for t, ds in time_to_days.items():
        if len(ds) == 1:
            parts.append(f"{ds[0]} {t}")
        else:
            parts.append(f"{ds[0]}–{ds[-1]} {t}")
    return " | ".join(parts)


# ── 2. 컨텍스트 조합 ──────────────────────────────
def build_context(shop: dict, places: dict) -> str:
    lines = []

    # 기본 정보
    lines.append(f"Shop name    : {shop['name']}")
    lines.append(f"Category     : {shop['category']}")
    lines.append(f"Neighborhood : {shop['location']}")
    lines.append(f"Google rating: {shop['rating']}/5.0  ({shop['reviewCount']}+ verified reviews)")

    # Google Places 추가 정보
    if places:
        # 업종 태그 (일반 태그 제거)
        skip = {"point_of_interest","establishment","service","health","local_business"}
        types = [t.replace("_"," ") for t in places.get("types",[]) if t not in skip]
        if types:
            lines.append(f"Business type: {', '.join(types[:5])}")

        # Google 에디토리얼 요약
        editorial = places.get("editorialSummary",{}).get("text","")
        if editorial:
            lines.append(f"Google intro : {editorial}")

        # 가격대
        pl_map = {
            "PRICE_LEVEL_INEXPENSIVE": "Budget-friendly (₩)",
            "PRICE_LEVEL_MODERATE":    "Mid-range (₩₩)",
            "PRICE_LEVEL_EXPENSIVE":   "Premium (₩₩₩)",
            "PRICE_LEVEL_VERY_EXPENSIVE": "Luxury (₩₩₩₩)",
        }
        pl = pl_map.get(places.get("priceLevel",""), "")
        if pl:
            lines.append(f"Price level  : {pl}")

        # 영업시간
        hours_str = parse_hours_summary(
            places.get("regularOpeningHours",{}).get("periods",[])
        )
        if hours_str:
            lines.append(f"Opening hours: {hours_str}")

    # 서비스 목록 (DB)
    services = shop.get("services") or []
    if services:
        lines.append(f"Services     : {', '.join(services[:8])}")

    # 서비스 가격 (DB)
    prices = shop.get("servicePrices") or []
    if prices:
        price_strs = [f"{p.get('name','')} {p.get('price','')}" for p in prices[:5] if p.get("name")]
        if price_strs:
            lines.append(f"Price menu   : {', '.join(price_strs)}")

    # 리뷰 합산: DB + Places API (중복 제거)
    db_reviews = shop.get("reviews") or []
    api_reviews = []
    if places:
        for r in places.get("reviews", []):
            txt = (r.get("text",{}).get("text") or "").strip()
            rating = r.get("rating","")
            if txt:
                api_reviews.append({"rating": rating, "text": txt})

    # DB 리뷰 우선, Places API 리뷰로 보충 (최대 8개)
    seen = set()
    merged_reviews = []
    for r in db_reviews:
        txt = (r.get("text") or "").strip()
        if txt and txt[:40] not in seen:
            seen.add(txt[:40])
            merged_reviews.append({"rating": r.get("rating",""), "text": txt})
    for r in api_reviews:
        txt = r["text"]
        if txt[:40] not in seen and len(merged_reviews) < 8:
            seen.add(txt[:40])
            merged_reviews.append(r)

    if merged_reviews:
        lines.append(f"\nCustomer reviews ({len(merged_reviews)} samples):")
        for i, rv in enumerate(merged_reviews, 1):
            # 줄바꿈 제거, 최대 220자
            txt = rv["text"].replace("\n"," ")[:220]
            lines.append(f"  [{i}] {rv['rating']}★  \"{txt}\"")

    return "\n".join(lines)


# ── 3. GPT 호출 (curl subprocess) ────────────────
SYSTEM_PROMPT = """\
You are a copywriter for a Seoul beauty booking platform (seoulbeautytrip.com).
Your job: write SPECIFIC, UNIQUE copy for each shop based on its actual data.

STRICT rules:
- Every sentence must reference THIS shop's real facts (rating, review quotes, specific treatments, hours, location).
- NO generic filler: ban "hassle-free", "seamless", "world-class", "state-of-the-art", "premier",
  "cutting-edge", "unlock", "leverage", "delve", "second to none", "look no further",
  "game-changer", "effortless scheduling".
- Do NOT mention phone number, website URL, or exact street address.
- Each shop's output must sound clearly different from every other shop.
- Output ONLY valid JSON — zero markdown, zero extra text.\
"""

# seo_text 생성용 시스템 프롬프트
SEO_TEXT_SYSTEM_PROMPT = """\
You are an SEO content writer for seoulbeautytrip.com — a K-beauty booking platform for foreigners visiting Seoul.
Write long-form HTML SEO content that is 100% unique for each shop.

STRICT rules:
- Use REAL data: shop name, neighborhood, rating, review count, specific treatments, reviewer quotes/phrases.
- Each heading and paragraph must be SPECIFIC to THIS shop — no copy-paste between shops.
- NO generic filler: ban "hassle-free", "seamless", "world-class", "state-of-the-art", "premier",
  "cutting-edge", "look no further", "game-changer", "effortless".
- Do NOT mention phone number, website URL, or exact street address.
- HTML tags allowed: <h2>, <p>, <strong>, <em>. No <div>, no <script>, no inline styles.
- Output ONLY valid JSON — zero markdown, zero extra text.\
"""

def build_prompt(context: str, shop_name: str, category: str) -> str:
    # 카테고리별 힌트
    cat_hints = {
        "clinic":   "Focus on: specific treatments (laser names, injectables), doctor expertise, skin results from reviews.",
        "hair":     "Focus on: stylist skill, color/cut techniques, before-after results mentioned in reviews.",
        "headspa":  "Focus on: scalp care method, relaxation experience, therapist attentiveness from reviews.",
        "skincare":  "Focus on: facial technique, skin analysis, product quality, glow results from reviews.",
        "makeup":   "Focus on: color analysis process, makeup consultation style, what clients learned.",
        "nail":     "Focus on: nail art style, design options, precision, longevity from reviews.",
        "dental":   "Focus on: specific dental procedure, pain-free experience, results from reviews.",
    }
    hint = cat_hints.get(category, "Focus on standout features mentioned in reviews.")

    # SEO longform 구조 힌트 (카테고리별 다른 H2 구조)
    seo_structure_hints = {
        "clinic":  'H2-1: "[Name] — [specific treatment type] Clinic in [neighborhood], Seoul". H2-2: "Treatments at [Name]: [list 2-3 specific procedure names from data]". H2-3: "Why Foreigners Choose [Name] for Korean Dermatology". Cite real rating, review count, reviewer phrases.',
        "hair":    'H2-1: "[Name] — Hair Salon in [neighborhood], Seoul". H2-2: "What [Name] Does Differently: [color/cut specialty from reviews]". H2-3: "Booking [Name] as a Foreigner in Seoul". Reference stylist skills or before-after results.',
        "headspa": 'H2-1: "[Name] — Head Spa in [neighborhood], Seoul". H2-2: "The [Name] Scalp Treatment Experience". H2-3: "Visiting [Name] as a Foreign Guest in Seoul". Describe specific steps or sensory details from reviews.',
        "skincare":'H2-1: "[Name] — Skincare Studio in [neighborhood], Seoul". H2-2: "Facial Treatments at [Name]". H2-3: "Why Foreign Skin-Care Lovers Visit [Name]". Reference skin concerns, glow results from reviews.',
        "nail":    'H2-1: "[Name] — Nail Art Studio in [neighborhood], Seoul". H2-2: "Nail Designs and Services at [Name]". H2-3: "Getting Nails Done at [Name] as a Foreigner". Cite design styles, longevity, reviewer compliments.',
        "makeup":  'H2-1: "[Name] — Makeup & Color Analysis in [neighborhood], Seoul". H2-2: "What Happens at a [Name] Session". H2-3: "Foreigners and [Name]: English-Friendly Beauty Consultation". Reference personal color types, client transformations.',
        "dental":  'H2-1: "[Name] — Dental Clinic in [neighborhood], Seoul". H2-2: "Dental Procedures at [Name]". H2-3: "Foreign Patients at [Name]: English Support & Pricing". Reference specific treatments and pain-free feedback.',
    }
    seo_hint = seo_structure_hints.get(category, "Three H2 sections: intro, services, foreigner guide. Each cites real shop data.")

    return f"""\
Write unique copy for "{shop_name}" using only the data below.
Category hint: {hint}

DATA:
{context}

Return a single JSON object:
{{
  "description": "<2–3 sentences, 80–130 words. Must include: neighborhood name, exact rating+review count, 1–2 specific details pulled directly from the reviews (a treatment name, a reviewer phrase, or a unique atmosphere detail). No generic claims.>",
  "whyChoose": [
    "<Bullet 1 — emoji + specific treatment/service highlight unique to THIS shop. 55–85 chars.>",
    "<Bullet 2 — emoji + standout staff/atmosphere/result detail from actual reviews. 55–85 chars.>",
    "<Bullet 3 — emoji + foreigner-accessibility fact (English staff, subway proximity, tourist-area, booking ease) — must be specific to this shop's location/situation. 55–85 chars.>"
  ],
  "seoText": "<3 HTML sections using <h2 class=\\"sp-seo-h2\\"> and <p class=\\"sp-seo-p\\"> tags. Structure: {seo_hint}. Each paragraph 60-100 words. NO phone/URL/exact address. Must be 100% unique to this specific shop — cite real rating, reviewer phrases, or treatment names from the DATA above. No sentence should be reusable for another shop.>"
}}

Each whyChoose bullet must cover a DIFFERENT angle. No two bullets with the same theme.
seoText must be a single HTML string (not an array), no outer div wrapper.\
"""


def build_seotext_prompt(shop: dict, context: str) -> str:
    """seoText만 단독 생성하는 짧은 프롬프트 (재시도용)"""
    cat = shop.get("category","beauty")
    name = shop["name"]
    seo_structure_hints = {
        "clinic":  f'H2-1: "{name} — Dermatology Clinic in [neighborhood], Seoul". H2-2: "Treatments at {name}". H2-3: "Why Foreigners Choose {name}".',
        "hair":    f'H2-1: "{name} — Hair Salon in [neighborhood], Seoul". H2-2: "What {name} Does Differently". H2-3: "Booking {name} as a Foreigner in Seoul".',
        "headspa": f'H2-1: "{name} — Head Spa in [neighborhood], Seoul". H2-2: "The {name} Scalp Treatment Experience". H2-3: "Visiting {name} as a Foreign Guest".',
        "skincare":f'H2-1: "{name} — Skincare Studio in [neighborhood], Seoul". H2-2: "Facial Treatments at {name}". H2-3: "Why Foreign Visitors Choose {name}".',
        "nail":    f'H2-1: "{name} — Nail Art Studio in [neighborhood], Seoul". H2-2: "Nail Services at {name}". H2-3: "Getting Nails Done at {name} as a Foreigner".',
        "makeup":  f'H2-1: "{name} — Color Analysis in [neighborhood], Seoul". H2-2: "What Happens at {name}". H2-3: "Foreigners and {name}: English-Friendly Consultation".',
        "dental":  f'H2-1: "{name} — Dental Clinic in [neighborhood], Seoul". H2-2: "Dental Procedures at {name}". H2-3: "Foreign Patients at {name}".',
    }
    hint = seo_structure_hints.get(cat, f'Three H2 sections about {name}: intro, services, foreigner guide.')
    return f"""\
Write ONLY the seoText field for "{name}" using the data below.
Structure: {hint}
Each paragraph 60-100 words. Use <h2 class="sp-seo-h2"> and <p class="sp-seo-p"> tags.
Cite real rating, review phrases, treatment names. No phone/URL/address.

DATA:
{context}

Return a single JSON object:
{{"seoText": "<HTML string with 3 h2+p sections>"}}
"""


def call_gpt(system: str, user: str) -> str:
    payload = json.dumps({
        "model":       GPT_MODEL,
        "messages":    [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "temperature": 0.75,
        "max_tokens":  2000,
    })

    # Auth 헤더를 별도 변수로 빌드 (f-string 안에서 긴 토큰 처리 문제 회피)
    auth_header = "Authorization: Bearer " + GSK_TOKEN

    cmd = [
        "curl", "-s", "-X", "POST", AI_URL,
        "-H", "Content-Type: application/json",
        "-H", auth_header,
        "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "-H", "Origin: https://www.genspark.ai",
        "-H", "Referer: https://www.genspark.ai/",
        "--max-time", str(TIMEOUT),
        "-d", payload,
    ]

    for attempt in range(3):
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT + 5)
            raw = res.stdout.strip()
            if not raw:
                raise ValueError("empty response")
            data = json.loads(raw)
            if "error" in data:
                raise ValueError(f"API error: {data['error']}")
            content = data["choices"][0]["message"]["content"].strip()
            if not content:
                raise ValueError("empty content (reasoning tokens exhausted — retry)")
            return content
        except Exception as e:
            print(f"    [GPT attempt {attempt+1}/3 failed] {e}")
            time.sleep(3)
    return ""


# ── 4. JSON 파싱 ──────────────────────────────────
def parse_gpt_output(raw: str) -> dict | None:
    clean = raw.strip()
    # ```json ... ``` 래퍼 제거
    if clean.startswith("```"):
        parts = clean.split("```")
        for part in parts:
            p = part.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{"):
                clean = p
                break
    try:
        result = json.loads(clean)
        desc = result.get("description","").strip()
        why  = result.get("whyChoose",[])
        seo  = result.get("seoText","").strip()
        if desc and isinstance(why, list) and len(why) == 3:
            return {
                "description": desc,
                "whyChoose": [str(b).strip() for b in why],
                "seoText": seo,
            }
    except json.JSONDecodeError:
        pass
    return None


# ── 5. DB 업데이트 ────────────────────────────────
def update_shop_db(shop_id: str, description: str, why_choose: list, seo_text: str = "") -> int:
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute(
        "UPDATE shops SET description=%s, why_choose=%s, seo_text=%s WHERE id=%s",
        (description, json.dumps(why_choose, ensure_ascii=False), seo_text or None, shop_id)
    )
    conn.commit()
    n = cur.rowcount
    cur.close(); conn.close()
    return n


# ── 6. 단일 업체 처리 (신규 등록 시 재사용 가능) ──
def generate_seo_for_shop(shop: dict, dry_run: bool = False) -> dict | None:
    """
    입력: shop dict {id, name, category, location, rating, reviewCount,
                     googlePlaceId, services, servicePrices, reviews}
    출력: {"description": "...", "whyChoose": [...]} 또는 None
    dry_run=True 이면 DB UPDATE 생략
    """
    sid   = shop["id"]
    name  = shop["name"]
    cat   = shop.get("category","beauty")
    pid   = shop.get("googlePlaceId") or ""

    print(f"\n{'─'*60}")
    print(f"  {name}  [{sid}]")
    print(f"  {cat} | {shop.get('location','')} | ★{shop.get('rating',0)} ({shop.get('reviewCount',0)})")

    # Step 1: Google Places
    places = {}
    if pid:
        print(f"  ① Google Places ({pid[:20]}...)  ", end="", flush=True)
        places = fetch_google_places(pid)
        if places:
            api_rev_n = len(places.get("reviews",[]))
            types = [t for t in places.get("types",[]) if "point_of_interest" not in t][:3]
            print(f"OK — types:{types}  api_reviews:{api_rev_n}")
        else:
            print("EMPTY (DB only)")
    else:
        print("  ① No Place ID → DB data only")

    # Step 2: 컨텍스트 조합
    context = build_context(shop, places)

    # Step 3: GPT 호출
    print(f"  ② GPT ({GPT_MODEL})... ", end="", flush=True)
    raw = call_gpt(SYSTEM_PROMPT, build_prompt(context, name, cat))
    if not raw:
        print("FAILED")
        return None
    print("OK")

    # Step 4: 파싱
    result = parse_gpt_output(raw)
    if not result:
        print(f"  ✗ JSON parse failed. Raw:\n    {raw[:300]}")
        return None

    print(f"  description: {result['description'][:90]}…")
    for i, b in enumerate(result["whyChoose"]):
        print(f"  why[{i}]: {b}")
    seo_preview = result.get("seoText","")
    if seo_preview:
        print(f"  seoText: {seo_preview[:100]}…")
    else:
        print("  seoText: (empty — will retry once)")
        # seoText 누락 시 1회 재시도 (GPT reasoning 토큰 부족으로 잘릴 수 있음)
        raw2 = call_gpt(SEO_TEXT_SYSTEM_PROMPT, build_seotext_prompt(shop, context))
        if raw2:
            result2 = parse_gpt_output(raw2)
            if result2 and result2.get("seoText"):
                result["seoText"] = result2["seoText"]
                print(f"  seoText (retry): {result['seoText'][:100]}…")

    # Step 5: DB 업데이트
    if not dry_run:
        n = update_shop_db(sid, result["description"], result["whyChoose"], result.get("seoText",""))
        print(f"  ③ DB updated ({n} row)")
    else:
        print("  ③ DRY RUN — DB skipped")

    return result


# ── 7. 메인 ──────────────────────────────────────
def main():
    dry_run  = "--dry" in sys.argv
    only_id  = next((a.split("=",1)[1] for a in sys.argv[1:] if a.startswith("--id=")), None)

    if dry_run:
        print("★ DRY RUN MODE — DB will NOT be updated\n")

    # DB에서 전체 업체 목록 조회
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, name, category, location, rating, review_count,
               google_place_id,
               COALESCE(services,       '[]'::jsonb),
               COALESCE(service_prices, '[]'::jsonb),
               COALESCE(reviews,        '[]'::jsonb)
        FROM shops
        ORDER BY created_at ASC
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    shops = []
    for row in rows:
        shops.append({
            "id":            row[0],
            "name":          row[1],
            "category":      row[2] or "beauty",
            "location":      row[3] or "Seoul",
            "rating":        float(row[4] or 0),
            "reviewCount":   int(row[5] or 0),
            "googlePlaceId": row[6] or "",
            "services":      row[7] if isinstance(row[7], list) else json.loads(row[7] or "[]"),
            "servicePrices": row[8] if isinstance(row[8], list) else json.loads(row[8] or "[]"),
            "reviews":       row[9] if isinstance(row[9], list) else json.loads(row[9] or "[]"),
        })

    if only_id:
        shops = [s for s in shops if s["id"] == only_id]
        if not shops:
            print(f"Shop '{only_id}' not found in DB"); return

    total   = len(shops)
    success = 0
    failed  = []

    print(f"Processing {total} shop(s)…\n")

    for i, shop in enumerate(shops, 1):
        print(f"[{i}/{total}]", end="")
        result = generate_seo_for_shop(shop, dry_run=dry_run)
        if result:
            success += 1
        else:
            failed.append(shop["name"])
        # API rate-limit 방지
        if i < total:
            time.sleep(1.5)

    print(f"\n\n{'═'*60}")
    print(f"DONE  ✔ {success}/{total} succeeded")
    if failed:
        print(f"FAILED: {failed}")


if __name__ == "__main__":
    main()
