// 실방문 스타일 업체 리뷰 블로그 10개 시딩
const BASE_URL = 'https://seoulbeautytrip.com'

const posts = [

// ── 1. INKO Seoul ──────────────────────────────────────────────────────────
{
  slug: 'inko-seoul-gangnam-dermatology-clinic-review-2025',
  title: 'INKO Seoul Gangnam Review: I Finally Tried the AI Skin Analysis Clinic Everyone\'s Talking About',
  meta_description: 'Honest first-person review of INKO Seoul in Gangnam. AI 3D skin analysis, laser toning, and aquapeel — what actually happened, real prices, and whether it\'s worth it for foreign tourists.',
  excerpt: 'I\'d seen INKO Seoul all over Instagram for months — the 3D skin scanner, the glowing before-and-afters. So on my second trip to Seoul I just went. Here\'s everything that actually happened, including the parts no one posts.',
  category: 'clinic',
  area: 'Gangnam',
  tags: ['INKO Seoul', 'Gangnam clinic', 'skin clinic Seoul', 'laser toning Seoul', 'Seoul dermatology foreigners'],
  cover_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80',
  body: `<p>I'd seen INKO Seoul all over Instagram for months — the 3D skin scanner, the glowing before-and-afters, the reels of foreign tourists walking out looking like they'd stolen someone else's face. So on my second trip to Seoul I just booked it. Here's everything that actually happened, including the parts nobody posts.</p>

<h2>Getting There & First Impressions</h2>
<p>INKO Seoul is a short walk from Gangnam Station exit 10. The building doesn't scream "skin clinic" from the outside — it's a clean, modern office building in a stretch of Gangnam that's all glass and coffee shops. When I pushed open the door, I was immediately hit by the contrast: low lighting, soft music, and a front desk staff member who greeted me in English before I even opened my mouth.</p>
<p>That already set the tone. I'd done a few clinics on previous trips where I spent the first 20 minutes fumbling through a Korean form while the receptionist watched politely. Here, the intake form was on an iPad in English, and someone walked me through every field.</p>

<h2>The AI 3D Skin Analysis — What It Actually Is</h2>
<p>This is the thing everyone's posting about, so let me explain what it actually involves. You sit in front of a machine that photographs your face under different types of light — standard, UV, polarized. The result is a detailed breakdown of your skin: pore size and density, moisture levels, pigmentation, redness, fine lines. It's displayed on a screen as a kind of heat map overlaid on your face photo.</p>
<p>My results were humbling. My T-zone pores were, let's say, "generously sized." There was more UV pigmentation (the kind that hasn't surfaced yet) on my cheeks than I'd expected. The doctor — who came in for the consultation part — spoke decent English and walked me through each area without making me feel bad about any of it. She framed everything as "this is what we can work on," not "wow, what happened to you."</p>

<h2>What I Got Done & Prices</h2>
<p>Based on my scan results, she recommended a combination of laser toning (for the pigmentation) and aquapeel (deep pore cleanse). I'd also added an LED therapy session because it was included in the package I'd booked through Seoul Beauty Trip.</p>
<ul>
<li><strong>Laser toning:</strong> ₩80,000 — the full face took maybe 15 minutes. Mild warmth, no pain. I've had more uncomfortable facials at home.</li>
<li><strong>Aquapeel:</strong> ₩60,000 — suction-based deep cleanse. You can actually see the gunk being extracted into the tip, which is either satisfying or horrifying depending on your perspective. My pores looked noticeably smaller after.</li>
<li><strong>LED therapy:</strong> included in the package</li>
</ul>
<p>Total came to around ₩140,000 (roughly $105 USD). For context, one laser toning session in London would run me at least £150-200 for the same result.</p>

<h2>The Actual Experience on the Bed</h2>
<p>The treatment room was private, which I appreciated. The nurse (not the doctor — normal for clinics in Korea) handled both the aquapeel and the LED. She explained each step in basic but clear English. The laser toning was done by the doctor. The whole thing took about an hour and 20 minutes start to finish.</p>
<p>Immediately after, my skin was slightly pink — expected after laser. They applied a soothing mask, gave me SPF to layer on before going outside, and reminded me to avoid direct sun for a few days. My skin looked noticeably clearer and brighter that evening. The pore improvement lasted about two weeks before I'd need another session for the best long-term results.</p>

<h2>English Support: How Was It Really?</h2>
<p>Genuinely good. The front desk, the consultation, the treatment explanation — all in workable-to-good English. The nurse during treatment used mostly gestures and simple phrases, but for a treatment where you're lying down with your eyes closed anyway, that was fine. They also have a WhatsApp line for pre-visit questions, which I used before booking to confirm what treatments would suit my skin type.</p>

<h2>Would I Go Back?</h2>
<p>Yes, and I already have — once more on the same trip, just for aquapeel. The AI skin analysis alone is worth going once even if you don't commit to a treatment. It's a genuinely useful snapshot of what's happening under the surface. And the prices make it easy to say yes to things you'd hesitate over at home.</p>
<p>If you're planning a Seoul trip and want to do one skin clinic, INKO is the one I'd send a friend to. The English support, the transparent pricing, and the lack of upsell pressure make it feel like a clinic rather than a beauty mall.</p>
<p><strong>Book via Seoul Beauty Trip for English-language WhatsApp support and same-day scheduling.</strong></p>`
},

// ── 2. Moclock ─────────────────────────────────────────────────────────────
{
  slug: 'moclock-gangnam-head-spa-honest-review-2025',
  title: 'Moclock Gangnam Head Spa: My Honest Review After Two Visits (with Curly Hair)',
  meta_description: 'Detailed honest review of Moclock Gangnam scalp spa. What the scalp analysis found, how the treatment felt, results on curly hair, real prices, and whether it\'s worth the hype.',
  excerpt: 'Everyone says Moclock is the best head spa in Seoul. I went twice — once alone, once with a friend who has fine hair. Here\'s what we found, what\'s actually worth it, and what surprised us.',
  category: 'headspa',
  area: 'Gangnam',
  tags: ['Moclock Gangnam', 'head spa Seoul', 'Korean scalp treatment', 'Gangnam head spa', 'Seoul hair spa foreigners'],
  cover_image: 'https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?w=1200&q=80',
  body: `<p>Everyone says Moclock is the best head spa in Seoul. My Instagram feed had served me the same reel of someone emerging from a black shampoo bowl looking absurdly refreshed about fourteen times before I finally made a reservation. I went twice — once alone, once dragging a friend with fine, color-treated hair who was more skeptical than I was. Here's what we actually found.</p>

<h2>Booking: What You Need to Know</h2>
<p>Moclock operates on reservations only — no walk-ins. This is important to know before you show up. You can book through their website or via Creatrip, which gives you an English-language option. I booked about four days in advance for a weekend appointment and there were still slots, but I'd go for one to two weeks ahead if your dates are fixed.</p>
<p>The Gangnam main branch is the one you've likely seen in videos. It's about a 7-minute walk from Gangnam Station or 5 minutes from Sinnonhyeon Station. There's a second branch but I've only been to the main one.</p>

<h2>The Scalp Analysis</h2>
<p>Before any treatment, they do a scalp analysis under a magnifying camera. You sit at a vanity-style station and a staff member runs the scope over your scalp in different zones. The results appear on the screen — you can see the follicle health, sebum buildup, and whether your roots are dry or oily.</p>
<p>Mine showed what I'd suspected: my scalp was oily at the roots but the lengths of my hair were dry. The staff member — who spoke clear English — explained this in a way that made sense, and recommended their signature 90-minute treatment plus an additional ampoule step for moisture retention.</p>
<p>My friend's results showed significant product buildup around her follicles (she uses a lot of dry shampoo) and mild inflammation in places. They recommended the same base treatment but with a scalp-focused enzyme mask.</p>

<h2>The Treatment Itself</h2>
<p>The 90-minute signature treatment breaks down roughly like this: scalp cleanse, enzyme mask (applied while you lie in a semi-reclined chair that is genuinely the most comfortable piece of furniture I've experienced outside of a business class seat), steam, targeted ampoule treatment, scalp massage, hair mask, and finishing blow-dry.</p>
<p>The massage portion is the part everyone talks about, and it lives up to it. It's a combination of pressure point work along the scalp and neck that's firm enough to feel therapeutic but not painful. I fell asleep during my second visit. I am not a person who falls asleep in public. Make of that what you will.</p>

<h2>Results — Especially on Curly Hair</h2>
<p>This was my main concern going in. My hair is type 2C/3A — wavy-to-curly, prone to frizz, doesn't love heat or heavy product. I was worried about how the blow-dry step would turn out.</p>
<p>I told the stylist upfront and she adapted accordingly — diffusing rather than a round brush blow-dry. The results were my hair, but calmer. More defined, less frizz. The scalp felt genuinely clean in a way that's hard to explain if you've only experienced regular shampoo — like the difference between wiping a surface and actually cleaning it.</p>
<p>My friend with fine hair came out with noticeably more volume and her scalp, she said, felt "tight" in the good way — like after a really good facial. She booked a follow-up appointment before we'd even left the building.</p>

<h2>Prices</h2>
<ul>
<li>60-minute treatment: ₩90,000</li>
<li>90-minute signature: ₩130,000–₩150,000 depending on add-ons</li>
<li>Additional ampoule: ₩20,000–₩30,000</li>
</ul>
<p>I paid ₩160,000 total on my first visit including the extra moisture treatment. On my second I went for the base 90-minute, which was ₩130,000. Both felt worth it.</p>

<h2>English Support</h2>
<p>The staff at the main branch speak solid English. The scalp analysis consultation was fully in English. During the treatment itself, communication is minimal because you're largely lying there in bliss, but any questions were answered clearly.</p>

<h2>Verdict</h2>
<p>The hype is real. Moclock is the best standalone scalp treatment I've had anywhere, not just in Seoul. It's not cheap, but it's also not expensive for what it delivers — an hour and a half of the most thorough scalp care most of us have ever experienced, with results that last at least two weeks on scalp health and a few days on style.</p>
<p>If you're visiting Seoul and have any interest in the head spa trend, Moclock is where you go. Book early.</p>`
},

// ── 3. Fleur Jardin ────────────────────────────────────────────────────────
{
  slug: 'fleur-jardin-myeongdong-facial-review-2025',
  title: 'Fleur Jardin Myeongdong: The Facial That Made Me Rethink Every Spa I\'ve Been To',
  meta_description: 'Honest review of Fleur Jardin Myeongdong skincare. What the skin analysis found, which facial I got, real pricing, and whether the glow is real or just good lighting.',
  excerpt: 'My skin had been angry for months — stress breakouts, dullness, the works. A friend who\'d been twice told me Fleur Jardin was the only place that had actually fixed her congested skin. I booked a slot between meetings on a Tuesday. Here\'s what happened.',
  category: 'skincare',
  area: 'Myeongdong',
  tags: ['Fleur Jardin Myeongdong', 'facial Seoul', 'Korean skincare clinic', 'Myeongdong beauty', 'foreigner facial Seoul'],
  cover_image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80',
  body: `<p>My skin had been angry for months. Stress breakouts, persistent dullness, the kind of congestion that no cleanser seems to fully shift. A friend who'd been to Fleur Jardin twice told me it was the only place that had actually fixed her perpetually clogged pores. She'd been evangelical about it in the way people only get about things that genuinely worked. I booked a slot between meetings on a Tuesday. Here's what happened.</p>

<h2>Location & Getting There</h2>
<p>Fleur Jardin is in Myeongdong, which is either ideal or exhausting depending on your relationship with crowds. It's on a side street off the main drag, which means you escape the worst of the tourist traffic. From Myeongdong Station it's about a 5-minute walk. There's also an Olive Young essentially next door, which I mention only because you will not be able to resist stopping in afterward.</p>

<h2>The Skin Analysis</h2>
<p>Every visit starts with a skin analysis using what I can only describe as a very serious camera. You sit in a bright consultation room while a staff member scans different zones of your face. The report that comes up on the screen breaks down hydration, sebum, pore condition, and sensitivity levels — and importantly, it distinguishes between your actual skin issues and surface-level stuff that can be fixed quickly versus deeper concerns that need more sessions.</p>
<p>My results: dehydration across the whole face (not the same as oiliness — my skin was actually producing more oil because it was under-hydrated), significant congestion on my nose and chin, and some residual inflammation from my recent breakouts. The staff member who explained the results spoke fluent English and didn't try to sell me on a full package immediately — she explained three different treatment options at different price points and let me decide.</p>

<h2>The Treatment</h2>
<p>I went with the middle option: a 75-minute personalized facial that included a double cleanse, exfoliation, extraction, high-frequency treatment for the inflamed areas, a sheet mask specific to my skin type (they have several — mine was a hydrating calm-down type), and a finishing moisturizer applied with a gua sha-style massage.</p>
<p>The extraction portion is the part people are either enthusiastic or anxious about. Mine was thorough but not aggressive — the aesthetician knew when to press and when to leave something alone. There was no moment where I wanted to ask her to stop. I've had far more uncomfortable extractions at salons that charge twice as much.</p>
<p>The high-frequency step — a wand that emits electrical current to kill bacteria and reduce inflammation — made a noticeable difference to the active breakouts. I walked out with red spots that were visibly calmer than when I'd walked in.</p>

<h2>Results: Is the Glow Real?</h2>
<p>Yes. Genuinely, embarrassingly yes. I walked past a mirror in a shop about two hours after and stopped because I didn't immediately recognize myself. My skin looked about 40% brighter than it had that morning. The congestion on my nose was noticeably clearer. The dullness was gone.</p>
<p>This lasted, realistically, about a week before my skin went back to its normal state. For lasting results you'd want at least three sessions — the aesthetician was upfront about this. But as a one-off experience, the immediate effect was more dramatic than anything I've paid for at home.</p>

<h2>Price</h2>
<p>My 75-minute facial was ₩130,000 (roughly $95 USD). They also offer shorter express facials from around ₩70,000, and more intensive multi-step treatments up to ₩200,000+. No aggressive upselling happened, which I appreciated.</p>

<h2>Practical Notes</h2>
<ul>
<li>Walk-ins accepted but booking ahead recommended (especially weekends)</li>
<li>English spoken well by all staff I interacted with</li>
<li>Avoid wearing foundation — your skin will thank you</li>
<li>They'll give you a written summary of your skin analysis to take home, which is actually useful</li>
</ul>
<p>If you're in Myeongdong and want one beauty treatment that will make an actual visible difference, Fleur Jardin is where I'd send you. It's the real thing.</p>`
},

// ── 4. LEEKAJA ─────────────────────────────────────────────────────────────
{
  slug: 'leekaja-myeongdong-hair-salon-review-2025',
  title: 'LEEKAJA Myeongdong Hair Salon Review: I Got a Cut, Color, and Scalp Treatment — Here\'s What Was Worth It',
  meta_description: 'Honest review of LEEKAJA Myeongdong hair salon for foreigners. What the cut was like, scalp treatment experience, English communication, real prices, and what I\'d skip next time.',
  excerpt: 'LEEKAJA is Korea\'s biggest hair salon chain and the Myeongdong branch is the one every travel blog tells you to go to. I spent three hours there across two services. Here\'s the honest version.',
  category: 'headspa',
  area: 'Myeongdong',
  tags: ['LEEKAJA Myeongdong', 'Korean hair salon', 'Seoul hair salon foreigners', 'Myeongdong hair', 'scalp treatment Myeongdong'],
  cover_image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80',
  body: `<p>LEEKAJA is Korea's biggest hair salon chain. The Myeongdong Global branch is the one every travel blog directs you toward — it's designed specifically for foreign visitors, with English-speaking designers and a menu that's readable without a Korean phrasebook. I spent about three hours there across two different services on two different trips. Here's the honest version, not the Instagram one.</p>

<h2>The Location & Setup</h2>
<p>LEEKAJA Myeongdong Global is on the 3rd floor of the IB Tower building, a short walk from Myeongdong Station exit 6. The lift takes you up into a salon that's larger than it looks from street level — multiple styling stations, a separate area for scalp treatments, and a waiting area with a coffee machine that I used twice.</p>
<p>The vibe is professional but not intimidating. It's busy — this is a popular destination and they book it accordingly — but each designer gives you their full attention when you're in the chair. I didn't feel rushed, which I'd half expected given the footfall.</p>

<h2>First Visit: Cut + Shine Treatment</h2>
<p>I came in wanting a trim and to fix some damage from a color treatment I'd had at home. I was paired with a designer who spoke very good English — he asked questions about my usual styling routine, how much time I spend on my hair in the morning (honestly, not much), and what I wanted to change versus keep.</p>
<p>The cut took about 45 minutes. He removed more length than I'd initially planned, but he showed me what he was thinking before he did it and it was clearly the right call — the ends were more damaged than I'd realized. Result: genuinely the best cut I've had in three years. The shape suited my face in a way I couldn't quite achieve by just telling someone "a bit shorter."</p>
<p>The shine treatment (Keratin coating, not the permanent kind) added about 30 minutes and ₩30,000 to the bill. My hair caught light differently for the following two weeks.</p>
<p><strong>Cut price: ₩35,000–₩55,000 depending on length. Shine treatment: ₩30,000.</strong></p>

<h2>Second Visit: Scalp Treatment</h2>
<p>On a later trip I specifically went back for the scalp treatment, which I'd skipped the first time. It's a separate booking from hair services — you're taken to a different area, reclined in a chair, and have a technician (not a hair designer) handle the full process.</p>
<p>The 60-minute treatment included a scalp analysis, enzyme mask, scalp massage, and a targeted ampoule. It wasn't as elaborate as a specialist head spa like Moclock, but it was thorough and the massage alone was worth the price.</p>
<p>What I'd note is that the scalp treatment experience at LEEKAJA is good but not exceptional compared to dedicated scalp spa destinations. If you're specifically there for a scalp treatment as your main event, I'd book a specialist. If you want to combine it with a haircut or color, doing both at LEEKAJA makes perfect sense.</p>
<p><strong>Scalp treatment: ₩60,000–₩80,000 for 60 minutes.</strong></p>

<h2>English Communication: How It Actually Went</h2>
<p>Better than expected. The designers at the Global branch really do speak functional-to-good English. Photo references help a lot — I came in with three reference photos saved on my phone and this made everything clearer than a verbal description would have. Staff was patient with questions and nothing felt lost in translation in ways that mattered.</p>

<h2>What I'd Skip</h2>
<p>Avoid the weekends if you can. The salon fills up and while the service quality doesn't drop, the energy of the space shifts — it becomes more chaotic and less relaxing. I also wouldn't book the scalp treatment on the same day as a color service if you can help it; your scalp needs a bit of breathing room between chemical treatments.</p>

<h2>Overall</h2>
<p>LEEKAJA Myeongdong Global is genuinely one of the best hair salon experiences available to foreign visitors in Seoul. The English support is real, the cut quality is excellent, and the prices are significantly lower than comparable quality at home. Just book in advance and go on a weekday if possible.</p>`
},

// ── 5. Cheongdam Dear Clinic ───────────────────────────────────────────────
{
  slug: 'cheongdam-dear-clinic-seoul-botox-review-2025',
  title: 'Cheongdam Dear Clinic Review: Getting Botox in Seoul as a Foreigner (Prices, Process, Honest Results)',
  meta_description: 'Honest personal review of getting Botox at Cheongdam Dear Clinic in Seoul. The consultation, what they suggested, real prices, the procedure itself, and 3-week results.',
  excerpt: 'I was nervous about getting Botox in a country where I don\'t speak the language. Cheongdam Dear Clinic had 1,100+ Google reviews and a 5-star rating. Here\'s exactly what happened from the moment I walked in.',
  category: 'clinic',
  area: 'Cheongdam, Gangnam',
  tags: ['Cheongdam Dear Clinic', 'Botox Seoul', 'Seoul clinic foreigners', 'aesthetic clinic Gangnam', 'Korean Botox review'],
  cover_image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1200&q=80',
  body: `<p>Getting Botox for the first time is nerve-wracking. Getting Botox for the first time in a country where you don't speak the language takes that nervousness and doubles it. I had put off this appointment for almost two years, citing every possible reason, before a friend who'd been twice told me to just go. Cheongdam Dear Clinic had 1,100+ Google reviews averaging 5 stars, which in the wild west of Seoul aesthetic clinics is a meaningful signal. Here's exactly what happened.</p>

<h2>Why Cheongdam, Why Dear Clinic</h2>
<p>Cheongdam is Seoul's equivalent of Mayfair or Beverly Hills — the block where the high-end clinics cluster, where the pricing is higher but so is the standard of practice. Dear Clinic sits on the main strip and while it's not ostentatious from outside, inside it's clearly a well-run operation: clean, organized, no reception desk chaos.</p>
<p>I'd shortlisted three clinics and booked Dear Clinic based on review volume, the range of languages they listed as supported on their website (English, Japanese, Chinese), and honestly, the fact that their Google photos showed actual clinic interiors rather than just treatment shots. Small thing, but it mattered to me.</p>

<h2>The Consultation</h2>
<p>The clinic has an English-speaking coordinator who handles foreign patients. She met me at reception, handed me a form that was already in English, and walked me through the consent paperwork without any of the awkward silence I'd experienced at other clinics.</p>
<p>The doctor consultation was the part I'd been most anxious about. He came in, reviewed my form, and asked — in good English — what I was looking to address. I mentioned the forehead lines and the slight heaviness in my brow area. He gave me a hand mirror and showed me specifically what he'd treat, explained the expected effect, and told me clearly that the result would develop over 7–10 days. He did not suggest anything beyond what I'd come in for, which I appreciated more than I can say.</p>

<h2>The Procedure</h2>
<p>If you've never had Botox: it's fast. The actual injection portion took maybe 8 minutes. They applied a numbing cream beforehand (wait time about 15 minutes), which made the injections uncomfortable rather than painful — a quick sting, then pressure, then it's done. Seven injection points across the forehead and brow area.</p>
<p>I was sitting upright afterward within 5 minutes and given a printed aftercare sheet (in English), reminding me not to lie face-down for 4 hours, avoid intense exercise for 24 hours, and no facial massage for two weeks.</p>

<h2>Real Prices</h2>
<p>This is what everyone actually wants to know. For the forehead + glabella area (the "11" lines between the brows):</p>
<ul>
<li>Botox (Botulinum toxin, Korean brand Meditoxin): ₩80,000–₩100,000 for the area I had done</li>
<li>Imported brands (Allergan, Dysport) available for an additional ₩20,000–₩40,000 premium</li>
</ul>
<p>For reference, the same treatment in London starts at £250–£350. In New York it would run $400–$600+. The price difference is real and significant.</p>

<h2>Results After Three Weeks</h2>
<p>The full effect kicked in around day 10. My forehead moved less and the resting lines were noticeably reduced — not erased, but significantly softened. My brow felt less heavy. The thing I'd read about but wasn't sure I'd experience — looking less tired even without changing anything else about my routine — actually happened.</p>
<p>Three weeks in: I look like a slightly better-rested version of myself. I'll take it. I've already looked up when I need to schedule a follow-up.</p>

<h2>Would I Recommend It?</h2>
<p>Yes, with the usual caveats about doing your own research on any cosmetic procedure. The clinic is professional, the English support is genuine, and the results were exactly what was described in the consultation. There was no pressure to add treatments, no surprise charges, and the follow-up communication (they messaged through the Seoul Beauty Trip WhatsApp to check in after a week) made the whole experience feel well-managed.</p>
<p>If you're considering any injectable treatment during a Seoul trip, Cheongdam Dear Clinic is one of the places I'd specifically recommend.</p>`
},

// ── 6. Leebeauty Myeongdong ────────────────────────────────────────────────
{
  slug: 'leebeauty-myeongdong-spa-head-spa-facial-review-2025',
  title: 'Lee Beauty Myeongdong Spa Review: Facial + Head Spa in One Visit — Is It Worth It?',
  meta_description: 'Honest review of Lee Beauty (Lee Hea Kyung) Myeongdong Spa. Combined facial and aroma head spa experience, English support, prices on Klook vs direct, and whether the glow lasts.',
  excerpt: 'I had two hours between a morning tour and dinner plans and wanted to fit in something proper. Lee Beauty Myeongdong Spa was on the same street. I went for the combined facial and aroma head spa. Here\'s the full breakdown.',
  category: 'headspa',
  area: 'Myeongdong',
  tags: ['Lee Beauty Myeongdong', 'Leebeauty spa Seoul', 'head spa facial Myeongdong', 'Korean spa foreigners', 'Myeongdong beauty treatment'],
  cover_image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80',
  body: `<p>I had exactly two hours between a morning walking tour and dinner reservations. I wanted to do something that felt like more than just a foot massage but didn't require me to have a consultation, explain my entire skin history, or commit to a 3-hour block. Lee Beauty Myeongdong Spa appeared in my search results, was a five-minute walk from where I was standing, and had an English option on their booking page. I called it.</p>

<h2>What Lee Beauty Is</h2>
<p>Lee Beauty — run under the name Lee Hea Kyung Aesthetics & Head Spa — has been in Myeongdong for years and is one of the more established spa options for foreign visitors in the area. It's not a chain and it's not a tiny pop-up. The space is calm, well-decorated in the muted, candle-forward aesthetic that Korean spas do well, and feels like somewhere that takes what it does seriously.</p>
<p>The treatment menu covers facials (standard, lifting, brightening), head spa treatments (aroma, scalp-focused, anti-hairloss), and combination packages. I booked the Aroma Head Spa + Brightening Facial combo, which runs 90 minutes.</p>

<h2>The Booking Experience</h2>
<p>Available on Klook, which gives you an English-language booking interface and upfront pricing. I paid ₩120,000 for the 90-minute combo (slightly less than the walk-in price, which was ₩135,000). Booking on Klook also means you get a confirmation email with the address in English and a map link, which sounds basic but when you're navigating Myeongdong's grid of similar-looking buildings, genuinely helps.</p>

<h2>The Facial Portion</h2>
<p>The facial came first. It ran about 40 minutes and covered cleansing, light exfoliation, a targeted mask based on a quick skin assessment (the aesthetician asked two questions about my current concerns — dryness and some recent congestion — and worked from there), and a finishing massage across the décolletage and neck. She moved efficiently but didn't feel rushed.</p>
<p>My skin after: visibly brighter, plumped. Not a dramatic overhaul but a solid, satisfying improvement. The kind of results that make you look at yourself in a shop window an hour later and think "okay, that was worth it."</p>

<h2>The Aroma Head Spa</h2>
<p>This was the part I hadn't expected to be the highlight. After the facial I was moved to a reclined head-spa chair — the kind that tilts back to a near-horizontal position — and the treatment shifted focus entirely to the scalp and hair.</p>
<p>The aroma head spa involves a scalp oil application (the scent was cedar and something floral — not overwhelming, genuinely pleasant), a slow massage from the neck up across the scalp, steam to help the oil penetrate, a rinse, and then a protein treatment through the lengths of my hair. Total time: about 45 minutes.</p>
<p>I am not someone who cries at spas. I'm mentioning this because I came close during the massage portion, which is either a sign of how good it was or how stressed I'd been before the trip. Possibly both.</p>

<h2>English Communication</h2>
<p>The aesthetician who handled my facial spoke basic-but-functional English. The head spa technician communicated mostly through gentle direction — indicating when to turn my head, when to relax. This is normal for treatment-focused work and didn't affect anything. The reception staff were more comfortable in English and handled all the pre- and post-treatment logistics clearly.</p>

<h2>Price Breakdown</h2>
<ul>
<li>90-min combo (Klook): ₩120,000 (approx $88 USD)</li>
<li>Walk-in price: ₩135,000</li>
<li>Facial only (60 min): ₩80,000</li>
<li>Head spa only (60 min): ₩85,000</li>
</ul>

<h2>Verdict</h2>
<p>For two hours in Myeongdong, this was exactly the right choice. Lee Beauty delivers solid, properly-executed treatments in a calm environment with English support and transparent pricing. It's not the most cutting-edge clinic in Seoul, but that's not what I was looking for. Sometimes you want to lie down, smell nice things, and leave feeling like your body has been reset. This did that.</p>`
},

// ── 7. Mood Collect ────────────────────────────────────────────────────────
{
  slug: 'mood-collect-personal-color-analysis-gangnam-review-2025',
  title: 'Mood Collect Personal Color Analysis Gangnam: What Actually Happens and What I Learned',
  meta_description: 'Detailed review of Mood Collect personal color analysis in Gangnam. The full 2-hour process, what colors I was told to wear and avoid, whether it\'s worth it for tourists, and real pricing.',
  excerpt: 'Personal color analysis is having a moment among tourists visiting Seoul. I booked Mood Collect in Gangnam not expecting much. I left with 45 pages of notes and a completely different understanding of why some colors make me look ill.',
  category: 'makeup',
  area: 'Gangnam',
  tags: ['Mood Collect', 'personal color analysis Seoul', 'color analysis Gangnam', 'Korean personal color', 'Seoul beauty experience foreigners'],
  cover_image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&q=80',
  body: `<p>Personal color analysis has been a Seoul tourist activity for a while, but it's really hit its mainstream moment with the wave of K-beauty content reaching international audiences. The pitch is simple: a trained analyst drapes you in hundreds of fabric swatches in different color temperatures and determines which palette genuinely flatters your skin, eyes, and hair tone. I booked Mood Collect in Gangnam not expecting much — I already know I look better in warm colors, I thought. Two hours later I left with 45 pages of printed notes and a completely recalibrated understanding of why I've been buying the wrong lipstick for the last decade.</p>

<h2>About Mood Collect</h2>
<p>Mood Collect is one of Seoul's most-recommended personal color studios for international visitors. They have several locations (Gangnam, Seongsu, Garosu-gil) and book well in advance, especially at weekends. The Gangnam location is near Sinnonhyeon Station — quiet street, easy to find.</p>
<p>What distinguishes Mood Collect from some other studios is that they also offer a "body analysis" component: proportional analysis of your face and body shape to complement the color results. You can book just the color analysis or the combined package.</p>

<h2>The Booking</h2>
<p>Their website has an English booking option. Slots are on the hour. I booked a week in advance for a Tuesday morning — there were still options, but the weekend slots were fully gone. The 2-hour full color + body analysis was ₩120,000. Color only is ₩90,000.</p>
<p>They ask you to arrive without makeup or with minimal, neutral makeup — no strong foundation or lip color. This is important. Come as close to your natural face as possible.</p>

<h2>What Actually Happens</h2>
<p>You're taken to a private consultation room with a floor-to-ceiling curtained area and a large mirror under studio lighting designed to show color accurately. The analyst introduces herself (mine was named Yunjin — she spoke very good English) and explains the process.</p>
<p>The draping itself takes 60–75 minutes. She moves through color families — first warm vs. cool, then spring/summer/autumn/winter seasonal types, then sub-categories within those. At each stage you hold swatches up to your face under the neutral lighting and she (and you) observe what happens: some colors make your skin look alive, some make shadows appear, some make your teeth look yellow or your undereye circles more pronounced.</p>
<p>The effect when you hit your actual season is almost startling. I went in vaguely aware I suited "warm" tones and came out understanding I'm a "Warm Autumn" — specifically muted, earthy tones, nothing too bright or cool. A bright coral lipstick I'd been wearing for years makes me look tired. A burnt terracotta from the swatches she held up looked better on me than anything in my current makeup bag.</p>

<h2>The Body Analysis</h2>
<p>This added about 40 minutes. It covers face shape (mine: soft, curved — Yunjin called it a "romantic" type), body proportion, and the clothing silhouettes and patterns that work with your build. It sounds like a lot, but the notes they give you are organized clearly and feel genuinely usable rather than overwhelming.</p>

<h2>What You Leave With</h2>
<ul>
<li>Printed color swatch booklet (your personal season's palette — over 100 colors to reference when shopping)</li>
<li>Detailed written analysis (English available)</li>
<li>Face and body type description with styling guidance</li>
</ul>
<p>The color swatch booklet is the thing I've continued using three months later. I take it shopping and it's saved me from bad impulse purchases at least four times.</p>

<h2>Is It Worth It for a Tourist?</h2>
<p>Yes, with one caveat: you need to care even a little bit about color and style. If you have no interest in fashion or beauty, the results won't change much for you. But if you've ever bought something that looked great in the shop and terrible on you, or if you've ever watched someone else wear an outrageous color and thought "how does that work on them" — this explains it. Completely.</p>
<p>₩120,000 for two hours of personalized analysis with take-home materials in English, by someone who clearly knows what they're doing. I'd do it again tomorrow.</p>`
},

// ── 8. D&A Dermatology ─────────────────────────────────────────────────────
{
  slug: 'da-dermatology-gangnam-lifting-treatment-review-2025',
  title: 'D&A Dermatology Gangnam: I Tried the Signature Lifting Treatment — Here\'s the Honest Verdict',
  meta_description: 'Honest review of D&A Dermatology Clinic Gangnam. The V-line lifting treatment, what procedures were done, real pricing, English support, and 4-week results for a foreign visitor.',
  excerpt: 'D&A Dermatology is one of the clinics people share on TikTok for their lifting treatments. I went in with skeptical expectations. The result after four weeks is the clearest my jawline has looked in years.',
  category: 'clinic',
  area: 'Gangnam',
  tags: ['D&A Dermatology', 'Gangnam dermatology', 'V-line lifting Seoul', 'skin lifting clinic Seoul', 'foreigner clinic Gangnam'],
  cover_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80',
  body: `<p>D&A Dermatology has been appearing on my TikTok feed for long enough that I finally looked them up properly. 20+ years operating in Gangnam, 400+ Google reviews averaging 4.9 stars, and a specific reputation for lifting treatments that don't involve going under a knife. I went in with skeptical expectations about a procedure I'd never tried before. Four weeks later, the result is the clearest my jawline has looked in years without surgery or injectables. Here's the full account.</p>

<h2>Finding the Clinic</h2>
<p>D&A Dermatology is on the 6th floor of a building in Sinsa-dong, Gangnam — a 10-minute walk from Apgujeong Rodeo Station. Sinsa-dong is a quieter, leafier part of Gangnam than the main Gangnam Station area, which I preferred. The building doesn't look medical from outside (most Gangnam clinics don't), but the elevator takes you up to a clinic that is clearly professional: organized reception area, staff in coordinated uniforms, no waiting room chaos.</p>

<h2>The Consultation</h2>
<p>An English-speaking coordinator handled my intake. D&A is explicit on their website about having English support for international patients, and this was accurate — not just "we have Google Translate" English, but a person whose job includes facilitating foreign patient visits.</p>
<p>The doctor consultation was thorough. He used a tablet to show me exactly what the treatment would address and realistic before-and-after imaging. When I asked whether I was a good candidate for the signature lifting procedure (a combination of Onda radiofrequency and HIFU), he was straightforward: yes for the jawline and mid-face, but he didn't recommend the full neck treatment I'd seen others get because my concern there was different. I respected that this felt like medical advice rather than a sales pitch.</p>

<h2>The Treatment: Onda + Targeted HIFU</h2>
<p>Onda is a microwave-based radiofrequency device that targets fat and tissue simultaneously. HIFU (high-intensity focused ultrasound) lifts tissue by triggering collagen production at specific depths. Together they address both the tissue laxity and any mild volume issues that contribute to a less-defined jawline.</p>
<p>Let me be honest about the HIFU portion: it hurts. Not unbearably — they apply numbing cream beforehand and offer a mild painkiller which I took — but the sharp, deep heat sensation of HIFU shots is real. I'd read about this beforehand and still found myself doing slow deliberate breathing during the more intense passes. The Onda portion was significantly more comfortable — mild warmth and pressure rather than sharp heat.</p>
<p>Total procedure time: about 60–70 minutes.</p>

<h2>Prices</h2>
<ul>
<li>Onda (face): ₩250,000–₩350,000 depending on area coverage</li>
<li>HIFU (targeted): ₩200,000–₩400,000 depending on shot count and depth</li>
<li>My combined treatment: ₩450,000 total</li>
</ul>
<p>In the UK, a comparable HIFU treatment starts at £600–£900. The same clinic positioning and doctor expertise in a Korean setting comes at about 40% of that cost.</p>

<h2>Recovery & Results</h2>
<p>Day 1–3: mild puffiness and slight redness along the jaw. Not enough to affect plans, but I kept makeup minimal. No pain after leaving the clinic.</p>
<p>Week 1: I could see initial lifting around the cheekbone area. Jawline slightly more defined. Still processing.</p>
<p>Week 4: This is when the HIFU collagen response peaks. The definition in my jawline is noticeably improved — not surgical, not dramatic, but the kind of change that makes your face look like it did a few years ago. My mother noticed without being told, which is the real test.</p>

<h2>English Support: Honest Assessment</h2>
<p>The coordinator: excellent English. The doctor: good functional English, used the coordinator for complex explanations. The treatment nurse: basic English supplemented by clear gestures. For a treatment where the consultation matters most (which is where the English was best), this was sufficient.</p>

<h2>Final Verdict</h2>
<p>D&A Dermatology is a legitimate, well-run clinic with real expertise in what they do. The results from a single session were meaningful. If you're considering a lifting or contouring treatment in Seoul, they belong on your shortlist.</p>`
},

// ── 9. Ppeum Global Myeongdong ─────────────────────────────────────────────
{
  slug: 'ppeum-global-myeongdong-skincare-clinic-review-2025',
  title: 'Ppeum Global Myeongdong: The Walk-In Skin Clinic That Actually Delivers (Review 2025)',
  meta_description: 'Honest review of Ppeum Global Myeongdong clinic for foreigners. Walk-in skincare treatments, English support, laser and aquapeel prices, and whether you need to book ahead.',
  excerpt: 'Ppeum Global is one of the few clinics in Myeongdong that welcomes walk-ins without a major wait. I went on a Thursday afternoon with no appointment. Here\'s the full experience.',
  category: 'clinic',
  area: 'Myeongdong',
  tags: ['Ppeum Global Myeongdong', 'Myeongdong skin clinic', 'walk-in clinic Seoul', 'skincare foreigners Seoul', 'laser toning Myeongdong'],
  cover_image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80',
  body: `<p>Most of the good skin clinics in Seoul require advance booking. Ppeum Global Myeongdong is one of the exceptions — they specifically cater to foreign tourists, including walk-ins, and have structured their operation around the reality that visitors on a Seoul trip often can't plan their schedule three weeks ahead. I showed up on a Thursday afternoon with no appointment and here's exactly what happened.</p>

<h2>Location & Setup</h2>
<p>Ppeum Global is in the heart of Myeongdong — the area where every third storefront is either a cosmetics shop, a fried chicken stall, or a clinic. It's about three minutes from Myeongdong Station and well-signposted. The building itself is easy to spot because there are usually before-and-after photos in the window, which either attracts or repels you depending on your aesthetic preferences.</p>
<p>Inside: clean, busy, organized. The reception area has a board showing treatment options with prices in Korean and English, which I appreciated. No mystery pricing.</p>

<h2>Walk-In Process</h2>
<p>I arrived at 2:30pm on a Thursday. A staff member at reception approached me in English before I'd worked out where to stand. She explained that they could take me in about 20 minutes, asked what I was interested in, and handed me a menu to look through while I waited.</p>
<p>The wait was closer to 15 minutes. I used the time to go through the treatment options and prices, which were clear and more affordable than I'd expected for a Myeongdong location.</p>

<h2>What I Got</h2>
<p>I went with the combination most commonly recommended for first-timers: laser toning and aquapeel. A quick skin assessment (lights and a scope, takes maybe 5 minutes) confirmed what the staff member had suggested was appropriate for my skin.</p>
<p><strong>Laser toning:</strong> ₩70,000 for full face. 10–15 minutes, mild warmth, no downtime. Good for pigmentation and general luminosity.</p>
<p><strong>Aquapeel:</strong> ₩55,000. The deep-pore cleansing suction treatment. Immediate pore-size reduction is visible. I say "visible" — I mean you can look in the mirror after and see the difference in your T-zone.</p>
<p>Total: ₩125,000 (about $90 USD). Including a soothing LED mask that came with the aquapeel package.</p>

<h2>The Experience</h2>
<p>Treatment rooms are private, which matters. The nurse who handled my procedures was efficient and communicated clearly in English. The whole thing — assessment, both treatments, mask, SPF application — took about 50 minutes. I was back on Myeongdong's main street by 3:30pm.</p>

<h2>Results</h2>
<p>My skin looked genuinely brighter that evening. The clogged pores I'd been dealing with for weeks were noticeably clearer. The effect on overall glow lasted about a week, the pore improvement slightly longer. For a single treatment on a trip, the results were satisfying.</p>

<h2>Who This Is Good For</h2>
<p>Ppeum Global is ideal if you're on a Seoul trip, don't have time to research and pre-book a specialist clinic, and want to experience Korean skin treatment without the overhead of a major appointment. It's a well-run tourist-focused operation — which some people view as a negative — but "tourist-focused" here means English-fluent staff, upfront pricing, and efficient scheduling. The treatment quality is solid. I'd send a first-timer here without hesitation.</p>
<p>For more specialized treatments (HIFU, fillers, complex laser work), I'd go to a Gangnam clinic with a specific doctor consultation. For a solid skin-brightening session in Myeongdong? Ppeum Global is exactly right.</p>`
},

// ── 10. Gungseochae ────────────────────────────────────────────────────────
{
  slug: 'gungseochae-gangnam-head-spa-hidden-gem-review-2025',
  title: 'Gungseochae Gangnam Head Spa: The Hidden Gem That Locals Actually Go To',
  meta_description: 'Honest review of Gungseochae traditional head spa in Gangnam. The Korean herbal scalp treatment, private room experience, prices, and how it compares to more famous spots.',
  excerpt: 'Gungseochae doesn\'t have a TikTok account or a Creatrip listing. It has 14 Google reviews averaging 5 stars and a clientele that\'s mostly Korean. I found it by asking a local. Here\'s what makes it different.',
  category: 'headspa',
  area: 'Gangnam',
  tags: ['Gungseochae Gangnam', 'traditional head spa Seoul', 'Korean herbal scalp treatment', 'local head spa Seoul', 'Gangnam hidden gem'],
  cover_image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1200&q=80',
  body: `<p>Gungseochae doesn't have a TikTok presence. It's not listed on Creatrip or in any travel guide I could find. It has 14 Google reviews averaging a perfect 5 stars, and the photos show an interior that looks more like a traditional Korean teahouse than a scalp spa. I found it by asking a local friend who's lived in Gangnam her whole life where she actually goes. Here's what makes it genuinely different.</p>

<h2>Finding It</h2>
<p>Gungseochae is a short cab ride from Gangnam Station — about ₩4,000 in a Kakao taxi. The exterior is understated in a way that reads as deliberate: dark wood, a small sign, no before-and-after photos in the window. If you walked past it you might assume it was a tea room or a small restaurant. This is, I learned, exactly the point.</p>

<h2>What Kind of Spa This Is</h2>
<p>Gungseochae specializes in traditional Korean-method scalp treatments using herbal ingredients rather than the product-heavy chemical approach of most commercial head spa chains. Think fermented rice water rinses, ginseng-based scalp treatments, and techniques rooted in hanbang (Korean traditional medicine) rather than the standardized 18-step programs you see everywhere else.</p>
<p>This is relevant to your experience in a practical way: the treatments feel slower, more deliberate, less like a spa assembly line and more like something that's been adapted to you specifically. It's also why it draws a more local clientele — people who've grown up understanding the difference between traditional and commercial, and prefer the former.</p>

<h2>The Booking (and the Language Question)</h2>
<p>Here's where I'll be honest about the foreign-visitor experience. Gungseochae does not have an English website. My booking happened through WhatsApp via Seoul Beauty Trip, who messaged ahead to confirm availability and communicate my specific concerns (dry scalp, fine hair).</p>
<p>When I arrived, the owner — a woman who appears to be in her 50s and has clearly been doing this for a long time — spoke minimal English. What she did instead was communicate everything through touch, demonstration, and occasional short phrases. None of this detracted from the experience; if anything, it added to the sense that I was somewhere that had not been optimized for tourism.</p>

<h2>The Treatment</h2>
<p>I booked the 90-minute signature treatment. It began with a scalp assessment that was entirely sensory — she ran her fingers across my scalp in a methodical grid pattern, pressing lightly in places, noting something I couldn't understand on a small card. Then the treatment itself:</p>
<ul>
<li>Herbal oil infusion (warm ginseng and camellia oil massaged into the scalp — the scent alone was worth the visit)</li>
<li>Slow scalp massage, significantly different in technique from what I'd experienced at Moclock or LEEKAJA — more focused pressure, less sweeping motion</li>
<li>Steam treatment with a heated herbal cloth placed over the scalp</li>
<li>Fermented rice water rinse (slightly milky, not unpleasant — leaves hair noticeably soft)</li>
<li>Hair mask through the lengths</li>
<li>Finishing with a gua sha-style massage along the neck and shoulder meridian points</li>
</ul>
<p>There was no blow-dry. She air-dried my hair partially and suggested I let it finish naturally, which I did. This suited my hair perfectly and I suspect is partly why the result was so good.</p>

<h2>Price</h2>
<p>₩100,000 for 90 minutes. Cheaper than Moclock, with a treatment that felt more personalized.</p>

<h2>How It Compares</h2>
<p>If you want a polished, well-packaged experience with English menus and a consistent 18-step program, go to Moclock. That's what it's designed for and it delivers it well.</p>
<p>If you want something that feels less like a product and more like a practice — something closer to how Koreans who really understand scalp health actually treat their hair — Gungseochae is closer to that. The results on my scalp lasted longer than any commercial spa I'd tried, and my hair, three days later, still felt different in a way I struggled to describe except to say it felt healthy in a baseline way rather than just treated.</p>
<p>I'd go back on every Seoul trip. Book through Seoul Beauty Trip for English-language coordination.</p>`
}

]

// API로 저장
async function savePost(post) {
  const id = 'b' + Date.now() + Math.floor(Math.random()*1000)
  const payload = {
    id,
    slug: post.slug,
    title: post.title,
    meta_description: post.meta_description,
    excerpt: post.excerpt,
    body: post.body,
    category: post.category,
    area: post.area,
    tags: post.tags,
    cover_image: post.cover_image,
    status: 'published',
    views: 0
  }
  const res = await fetch(`${BASE_URL}/api/blogs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const text = await res.text()
  console.log(`[${res.status}] ${post.slug.slice(0,50)} — ${text.slice(0,80)}`)
  return res.status
}

async function main() {
  console.log(`총 ${posts.length}개 글 저장 시작...`)
  for (const post of posts) {
    await savePost(post)
    await new Promise(r => setTimeout(r, 400))
  }
  console.log('완료!')
}

main().catch(console.error)
