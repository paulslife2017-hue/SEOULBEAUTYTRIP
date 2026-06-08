#!/usr/bin/env python3
"""
업체 description 전면 재생성 v2 - 병렬 처리 + 짧은 timeout
"""
import os, sys, time, requests, json
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed

GSK_TOKEN = os.environ.get('GSK_TOKEN', '')
SITE_URL = 'https://seoulbeautytrip.com'
H = {'Content-Type': 'application/json', 'x-admin-token': GSK_TOKEN}
client = OpenAI(api_key=GSK_TOKEN, base_url="https://www.genspark.ai/api/llm_proxy/v1")

START = int(sys.argv[1]) if len(sys.argv) > 1 else 0
END   = int(sys.argv[2]) if len(sys.argv) > 2 else 10

CAT = {
    'clinic':          'Korean skin clinic: laser, Botox, skin boosters, lifting',
    'headspa':         'Korean head spa: scalp massage, oil treatment, hair loss care',
    'hair':            'Korean hair salon: color, perm, cut, treatment',
    'tattoo':          'Korean PMU: eyebrow microblading, lip blushing',
    'makeup':          'Korean makeup: personal color analysis, beauty consultation',
    'skincare':        'Korean skincare: facial, pore care, brightening',
    'plastic_surgery': 'Korean cosmetic surgery: rhinoplasty, eyelid, V-line',
    'dental':          'Korean dental: whitening, Invisalign, implants',
}

def area(loc):
    return (loc or 'Seoul').split(',')[0].strip()

def gen(shop):
    n  = shop.get('name','')
    c  = shop.get('category','clinic')
    r  = shop.get('rating',0)
    rv = shop.get('reviewCount', shop.get('review_count',0))
    sv = ', '.join((shop.get('services') or [])[:4])
    st = (shop.get('seoText') or '')[:200]
    ar = area(shop.get('location','Seoul'))
    ch = CAT.get(c, CAT['clinic'])

    p = f"""Write a 300-400 char persuasive English description for international tourists visiting Seoul.

{n} | {c} — {ch} | {ar}, Seoul
Rating: ★{r} ({rv}+ reviews) | Services: {sv}
Context: {st}

Rules: Don't start with shop name. Mention {ar} once. Be specific. End with trust signal. No clichés.
Output ONLY the description text."""

    try:
        r2 = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[{"role":"user","content":p}],
            temperature=0.7, timeout=20
        )
        return r2.choices[0].message.content.strip().strip('"\'')
    except:
        return ''

def upd(sid, desc):
    try:
        r = requests.put(f'{SITE_URL}/api/shops/{sid}', json={'description':desc}, headers=H, timeout=12)
        return r.status_code == 200
    except:
        return False

def process(shop):
    d = gen(shop)
    if not d:
        return shop['id'], shop.get('name',''), False, 0, ''
    ok = upd(shop['id'], d)
    return shop['id'], shop.get('name',''), ok, len(d), d[:80]

def main():
    shops_r = requests.get(f'{SITE_URL}/api/shops?limit=200', headers=H, timeout=20)
    all_s = shops_r.json().get('shops', [])

    targets = [s for s in all_s if (
        not s.get('description')
        or len(s.get('description','')) < 400
        or 'destination in' in s.get('description','')
        or ', Seoul, Seoul' in s.get('description','')
    )]
    batch = targets[START:END]
    print(f"대상 {len(targets)}개 중 [{START}:{END}] = {len(batch)}개 병렬 처리", flush=True)

    ok=0; fail=0
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(process, s): s for s in batch}
        for fut in as_completed(futs):
            sid, name, success, clen, preview = fut.result()
            status = "✅" if success else "❌"
            print(f"  {status} {name[:35]} → {clen}자: {preview}…", flush=True)
            if success: ok+=1
            else: fail+=1

    print(f"\n완료: ✅{ok}  ❌{fail}", flush=True)

if __name__ == '__main__':
    main()
