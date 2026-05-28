#!/usr/bin/env python3
"""
9개 업체 SEO 설명 - 직접 작성 후 DB 업데이트
API 호출 없이 하드코딩된 설명을 PUT으로 저장
"""
import json, urllib.request, sys

LOCAL_URL = "http://localhost:3000"

# ──────────────────────────────────────────────────────
# 직접 작성한 SEO 설명 (9개 업체)
# ──────────────────────────────────────────────────────
SEO_DATA = [
    {
        "id": "s1779723339019",
        "name": "LEEKAJA MyeongDong Hair Salon",
        "description": (
            "LEEKAJA Beauty is one of Korea's most iconic hair salon chains, and the Myeongdong branch "
            "sits at the heart of Seoul's most vibrant tourist district. Offering expert haircuts, "
            "color treatments, perms, and Korean-style hair care, this salon is well-equipped to "
            "serve international visitors with English-friendly staff. Whether you want a K-pop "
            "inspired look or a classic Korean blowout, LEEKAJA Myeongdong delivers professional "
            "results at accessible prices — just steps from Myeongdong Station."
        ),
    },
    {
        "id": "s1779716197182",
        "name": "Yonsei Midas Dental Clinic",
        "description": (
            "Yonsei Midas Dental Clinic in Incheon offers world-class dental care with a team of "
            "experienced Korean dentists specializing in teeth whitening, implants, orthodontics, "
            "and cosmetic dentistry. Conveniently located near Incheon International Airport, this "
            "clinic is an excellent option for medical tourists seeking high-quality dental treatment "
            "at a fraction of Western prices. English-speaking coordinators are available to guide "
            "international patients through every step of their treatment journey."
        ),
    },
    {
        "id": "s1779718886113",
        "name": "SOOA CLINIC",
        "description": (
            "SOOA Clinic is a premium aesthetic clinic nestled in Yongsan, Seoul, offering a full "
            "spectrum of skin care and beauty treatments tailored to both locals and international "
            "visitors. Specializing in laser skin rejuvenation, anti-aging procedures, and "
            "customized facial treatments, SOOA Clinic combines cutting-edge Korean medical "
            "technology with personalized care. The clinic's central Yongsan location makes it "
            "easily accessible for tourists, and consultations in English are available upon request."
        ),
    },
    {
        "id": "s1779710078129",
        "name": "ReYou clinic",
        "description": (
            "ReYou Clinic is a trusted aesthetic and skin care clinic in the heart of Gangnam, "
            "Seoul's premier beauty district. The clinic offers a wide range of treatments including "
            "skin boosters, laser therapy, facial contouring, and customized skincare programs "
            "designed for both first-time visitors and those seeking ongoing Korean beauty treatments. "
            "With experienced medical professionals and a welcoming approach to international patients, "
            "ReYou Clinic is a top choice for tourists looking to experience authentic Korean "
            "aesthetic medicine in Gangnam."
        ),
    },
    {
        "id": "s1779718296725",
        "name": "Jiwoo Clinic",
        "description": (
            "Jiwoo Clinic is a boutique aesthetic clinic in Gangnam, Seoul, known for its "
            "personalized approach to Korean beauty treatments. Offering services such as skin "
            "lifting, dermal fillers, Botox, and advanced laser procedures, Jiwoo Clinic's "
            "skilled doctors create customized treatment plans that deliver natural-looking results. "
            "The clinic warmly welcomes international patients and provides English consultation "
            "support, making it an ideal destination for beauty-conscious travelers exploring "
            "Gangnam's world-renowned aesthetic medicine scene."
        ),
    },
    {
        "id": "s1779723794112",
        "name": "CCLIME",
        "description": (
            "CCLIME is a modern K-beauty skincare studio in Seoul offering premium facial treatments, "
            "deep cleansing therapies, and customized skin care solutions inspired by the latest "
            "Korean beauty innovations. Whether you're dealing with acne, dullness, or signs of "
            "aging, CCLIME's trained estheticians analyze your skin and create personalized "
            "treatment plans for visible, lasting results. A perfect destination for beauty "
            "travelers who want to experience authentic Korean skincare rituals in a chic, "
            "relaxing studio environment."
        ),
    },
    {
        "id": "s1779719053950",
        "name": "D&A Dermatology Clinic",
        "description": (
            "Experience advanced Korean dermatology in Gangnam at D&A Dermatology Clinic, offering "
            "laser treatments, acne care, and aesthetic skin rejuvenation. The clinic's board-certified "
            "dermatologists specialize in medical-grade skin treatments including pigmentation "
            "correction, pore refinement, and anti-aging therapy using state-of-the-art Korean "
            "medical technology. English-friendly doctors and a convenient location near Gangnam "
            "Station make D&A Dermatology Clinic a top pick for international visitors seeking "
            "professional Korean skin care. Book via WhatsApp."
        ),
    },
    {
        "id": "s1779720947812",
        "name": "Gungseochae",
        "description": (
            "Gungseochae is a premium Korean head spa and scalp care sanctuary in Gangnam, Seoul, "
            "offering a deeply relaxing and therapeutic experience rooted in traditional Korean "
            "wellness practices. Skilled therapists provide customized scalp analysis, nourishing "
            "hair treatments, and soothing head massages designed to relieve stress and restore "
            "hair vitality. Set in a tranquil, elegantly appointed space in the heart of Gangnam, "
            "Gungseochae is the perfect retreat for travelers who want to indulge in authentic "
            "Korean hair and scalp wellness."
        ),
    },
    {
        "id": "s1779652745185",
        "name": "Moclock",
        "description": (
            "Moclock is a stylish Korean head spa and hair care studio located in the upscale "
            "Gangnam district of Seoul. Specializing in professional scalp treatments, hydrating "
            "hair masks, and relaxing head massage therapy, Moclock combines modern Korean beauty "
            "techniques with a serene, spa-like atmosphere. Each session is tailored to your "
            "specific scalp and hair needs, making it a favorite among both locals and international "
            "visitors seeking a restorative Korean beauty experience in one of Seoul's most "
            "fashionable neighborhoods."
        ),
    },
]

# ──────────────────────────────────────────────────────
# DB 업데이트 함수
# ──────────────────────────────────────────────────────
def get_shop(shop_id):
    req = urllib.request.Request(f"{LOCAL_URL}/api/shops/{shop_id}")
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read())
        return data.get("shop", data)

def update_shop(shop_id, description):
    shop = get_shop(shop_id)
    payload = json.dumps({
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
    }).encode()

    req = urllib.request.Request(
        f"{LOCAL_URL}/api/shops/{shop_id}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# ──────────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────────
def main():
    print(f"🚀 9개 업체 SEO 설명 DB 저장 시작\n{'='*55}")
    ok, fail = 0, 0

    for item in SEO_DATA:
        sid  = item["id"]
        name = item["name"]
        desc = item["description"]
        print(f"\n▶ {name}")
        try:
            res = update_shop(sid, desc)
            print(f"  ✅ 저장 완료 | {desc[:70]}...")
            ok += 1
        except Exception as e:
            print(f"  ❌ 실패: {e}")
            fail += 1

    print(f"\n{'='*55}")
    print(f"🏁 완료!  성공: {ok}  /  실패: {fail}")
    if fail == 0:
        print("🎉 모든 업체 SEO 설명 저장 성공!")

if __name__ == "__main__":
    main()
