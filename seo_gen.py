#!/usr/bin/env python3
import subprocess, urllib.request, os, sys, json, time

TOKEN = os.environ.get("GSK_TOKEN","")
AI    = "https://www.genspark.ai/api/llm_proxy/v1/chat/completions"
BASE  = "http://localhost:3000"

if not TOKEN:
    print("GSK_TOKEN 없음"); sys.exit(1)
print(f"Token OK: {TOKEN[:20]}...")

CAT = {
    "skincare":"Korean skincare, facial treatment, K-beauty skincare, skin rejuvenation Seoul",
    "hair":    "Korean hair salon, K-beauty hair, hair treatment Seoul, Korean hairstyle",
    "headspa": "Korean head spa, scalp treatment, hair spa Seoul, relaxing scalp care Korea",
    "nail":    "Korean nail art, nail salon Seoul, K-beauty nails, gel nails Korea",
    "makeup":  "Korean makeup artist Seoul, K-beauty makeup, professional makeup Korea",
    "clinic":  "Korean aesthetic clinic Seoul, medical beauty Korea, skin clinic Korea, dermatology Seoul",
    "dental":  "Korean dental clinic, teeth whitening Seoul, dental care Korea, dental tourism Seoul",
    "wellness":"Korean spa Seoul, wellness center Korea, traditional massage Seoul, relaxation Korea",
}

def ai(name, loc, cat):
    area = loc.split(",")[0].strip()
    kw   = CAT.get(cat, "Korean beauty Seoul, K-beauty")
    p = (
        f"SEO expert for Korean beauty tourism website targeting English-speaking tourists.\n"
        f"Business: {name}\nLocation: {loc}, South Korea\nCategory: {cat}\nKeywords: {kw}\n\n"
        f"Write compelling SEO content. Return ONLY valid JSON:\n"
        f'{{ "description": "2-3 sentences, 80-120 words. Mention {area}, Korean {cat} expertise, '
        f'English-friendly or easy tourist access. Warm professional tone.", '
        f'"metaDescription": "Under 155 chars, include business name and key service." }}'
    )
    payload = json.dumps({"model":"gpt-5-mini","max_tokens":500,
                          "messages":[{"role":"user","content":p}]})
    cmd = ["curl","-s","-X","POST", AI,
           "-H","Content-Type: application/json",
           "-H",f"Authorization: Bearer {TOKEN}",
           "-H","User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
           "-H","Origin: https://www.genspark.ai",
           "-H","Referer: https://www.genspark.ai/",
           "--max-time","45","-d",payload]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=50)
        raw = r.stdout.strip()
        if not raw: return None
        d = json.loads(raw)
        c = d.get("choices",[{}])[0].get("message",{}).get("content","").strip()
        if not c:
            print(f"    API err: {str(d)[:120]}")
            return None
        # JSON 추출
        s,e = c.find("{"), c.rfind("}")
        if s==-1: return None
        return json.loads(c[s:e+1])
    except Exception as ex:
        print(f"    예외: {ex}")
        return None

def get_shop(sid):
    r = urllib.request.urlopen(f"{BASE}/api/shops/{sid}", timeout=10)
    d = json.loads(r.read())
    return d.get("shop", d)

def save_desc(sid, desc):
    s = get_shop(sid)
    body = json.dumps({
        "name":s.get("name",""), "slug":s.get("slug",""),
        "category":s.get("category",""), "location":s.get("location",""),
        "address":s.get("address",""), "googleMapUrl":s.get("googleMapUrl",""),
        "googleMapEmbed":s.get("googleMapEmbed",""), "lat":s.get("lat",""),
        "lng":s.get("lng",""), "priceRange":s.get("priceRange",""),
        "hours":s.get("hours",""), "services":s.get("services",[]),
        "servicePrices":s.get("servicePrices",[]), "description":desc,
        "thumbnail":s.get("thumbnail",""), "photos":s.get("photos",[]),
        "commission":s.get("commission",15), "active":s.get("active",True),
    }).encode()
    req = urllib.request.Request(f"{BASE}/api/shops/{sid}", data=body,
                                  headers={"Content-Type":"application/json"}, method="PUT")
    r = urllib.request.urlopen(req, timeout=10)
    return json.loads(r.read()).get("ok", False)

# 업체 목록
r    = urllib.request.urlopen(f"{BASE}/api/shops", timeout=10)
data = json.loads(r.read())
shops = data.get("shops", data) if isinstance(data,dict) else data
print(f"총 {len(shops)}개 업체\n{'='*50}")

ok_n, fail_n = 0, 0
for i, sh in enumerate(shops,1):
    sid  = sh["id"]
    name = sh["name"]
    loc  = sh.get("location","Seoul")
    cat  = sh.get("category","beauty")
    ex   = (sh.get("description") or "").strip()

    print(f"\n[{i}/{len(shops)}] {name} ({loc}, {cat})")

    if len(ex)>50 and ex[0].isascii():
        print("  ⏭️  설명 있음, 스킵")
        ok_n += 1; continue

    seo = None
    for t in range(1,4):
        print(f"  🤖 시도 {t}/3...", end=" ", flush=True)
        seo = ai(name, loc, cat)
        if seo and seo.get("description"):
            print("✅")
            break
        print("❌"); time.sleep(3)

    if not seo or not seo.get("description"):
        print(f"  ❌ 실패")
        fail_n += 1; continue

    desc = seo["description"]
    print(f"  📝 {desc[:80]}...")

    try:
        save_desc(sid, desc)
        print("  💾 저장완료 ✅")
        ok_n += 1
    except Exception as ex2:
        print(f"  ⚠️  저장실패: {ex2}")
        fail_n += 1

    time.sleep(1.5)

print(f"\n{'='*50}\n✅ 성공: {ok_n}  ❌ 실패: {fail_n}")
