import { Hono } from 'hono'
import { neon } from '@neondatabase/serverless'

type Env = {
  GENSPARK_TOKEN: string
  GSK_TOKEN: string
  gsk_token: string
  genspark_token: string
  GOOGLE_PLACES_KEY: string
  DATABASE_URL: string
}

// API 키/DB URL은 환경변수에서만 읽음 (하드코딩 금지)
// 로컬: .dev.vars 파일에 설정
// Vercel 프로덕션: Vercel 대시보드 Environment Variables에 설정
// Cloudflare 프로덕션: wrangler pages secret put DATABASE_URL
// DB 커넥션 캐싱 — 매 요청마다 새 연결 생성 방지 (Neon cold start 타임아웃 방지)
let _cachedSql: ReturnType<typeof neon> | null = null
let _cachedUrl = ''
const getDb = (env?: Env) => {
  const url = env?.DATABASE_URL || (typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined)
  if (!url) throw new Error('DATABASE_URL environment variable is not set')
  if (_cachedSql && _cachedUrl === url) return _cachedSql
  // fetchConnectionCache: true → HTTP 연결 재사용으로 cold start 단축
  _cachedSql = neon(url, { fetchConnectionCache: true })
  _cachedUrl = url
  return _cachedSql
}
const getGoogleKey = (env?: Env) => {
  return env?.GOOGLE_PLACES_KEY || (typeof process !== 'undefined' ? process.env.GOOGLE_PLACES_KEY : undefined) || ''
}
// Google Places photo name → 실제 https:// URL 변환
// DB 저장 시 반드시 이 함수를 통해 절대 URL로 변환 (상대경로 저장 금지)
async function resolveGooglePhotoUrl(photoName: string, apiKey: string): Promise<string> {
  if (!photoName || !apiKey) return ''
  try {
    const cleanName = photoName.replace(/\/media$/, '')
    const apiUrl = `https://places.googleapis.com/v1/${cleanName}/media?key=${apiKey}&maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true`
    const res = await fetch(apiUrl)
    if (!res.ok) return ''
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const json: any = await res.json()
      return json.photoUri || ''
    }
    return ''
  } catch { return '' }
}
// 여러 장 병렬 변환 (최대 concurrency 3)
async function resolveGooglePhotos(photoNames: string[], apiKey: string): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < photoNames.length; i += 3) {
    const batch = photoNames.slice(i, i + 3)
    const resolved = await Promise.all(batch.map(n => resolveGooglePhotoUrl(n, apiKey)))
    results.push(...resolved)
  }
  return results.filter(Boolean)
}

const app = new Hono<{ Bindings: Env }>()

// ══════════════════════════════════════════════
// 🛡️ AI 크롤러 / 스크래퍼 차단 미들웨어
// ══════════════════════════════════════════════

// 차단할 AI 봇 User-Agent 목록
const AI_BOT_PATTERNS = [
  // OpenAI
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  // Google AI
  'Google-Extended', 'Googlebot-Image',
  // Meta AI
  'FacebookBot', 'meta-externalagent',
  // Anthropic
  'anthropic-ai', 'ClaudeBot', 'Claude-Web',
  // Common AI scrapers
  'CCBot', 'Bytespider', 'SemrushBot',
  'AhrefsBot', 'MJ12bot', 'DotBot',
  'DataForSeoBot', 'PetalBot',
  // Amazon / Apple AI
  'Amazonbot', 'Applebot-Extended',
  // AI training crawlers
  'omgili', 'Diffbot', 'Kangaroo Bot',
  'ImagesiftBot', 'cohere-ai',
  'PerplexityBot', 'YouBot',
]

app.use('*', async (c, next) => {
  const ua = c.req.header('User-Agent') || ''
  const isAiBot = AI_BOT_PATTERNS.some(pattern =>
    ua.toLowerCase().includes(pattern.toLowerCase())
  )
  if (isAiBot) {
    return c.text('Access Denied: AI crawlers are not permitted.', 403)
  }
  await next()
})

// ── robots.txt: AI 봇 모두 차단 ──
app.get('/robots.txt', (c) => {
  const robotsTxt = `# robots.txt for SEOUL BEAUTY TRIP
# AI crawlers and data scrapers are NOT permitted

# Block all AI training crawlers
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: DataForSeoBot
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: YouBot
Disallow: /

User-agent: cohere-ai
Disallow: /

# Allow normal search engines (Google, Bing, Naver)
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Yeti
Allow: /

# Default: allow regular users
User-agent: *
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: https://seoulbeautytrip.com/sitemap.xml
`
  return c.text(robotsTxt, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
})



// ── 플랫폼 설정 ──
const PLATFORM = {
  whatsapp: '8201058947690',   // 운영자 왓츠앱 번호 (국가코드 포함, +없이)
  name: 'SEOUL BEAUTY TRIP',
  instagram: 'seoulbeautytrip',
  commission: '10~20%'
}

// ── 타입 정의 ──
interface Shop {
  id: string
  name: string
  slug: string           // SEO URL용: gangnam-luxury-facial
  category: string
  location: string
  address: string
  googleMapUrl: string
  googleMapEmbed: string // embed용 src
  lat: string
  lng: string
  priceRange: string     // e.g. "₩80,000~₩150,000"
  hours: string          // e.g. "10:00~20:00 (Mon-Sat)"
  services: string[]     // ['Deep Cleansing', 'Hydra Facial', ...]
  servicePrices: {name: string; price: string}[]  // [{name:'Facial', price:'₩80,000'}, ...]
  description: string
  rating: number
  reviewCount: number
  thumbnail: string
  photos: string[]       // 추가 사진 URL 배열
  commission: number     // 10 or 20 (%)
  active: boolean
  createdAt: string
  reviews: {author: string; rating: number; text: string; time: string}[]
  googlePlaceId: string
  metaDescription: string
  seoKeywords: string
  menuItems: {name: string; price: string; description: string; image: string}[]
  whyChoose: string[]
}

interface Video {
  id: string
  shopId: string
  title: string
  description: string
  videoUrl: string
  thumbnail: string
  tags: string[]
  views: number
  likes: number
  createdAt: string
}

interface Booking {
  id: string
  shopId: string
  shopName: string
  videoId: string
  name: string
  email: string
  phone: string
  date: string
  people: string
  service: string
  message: string
  status: 'new' | 'contacted' | 'confirmed' | 'completed' | 'cancelled'
  commissionRate: number
  estimatedAmount: string
  createdAt: string
}

// ── DB 헬퍼: DB row → Shop 객체 ──
function rowToShop(r: any): Shop {
  return {
    id: String(r.id), name: r.name, slug: r.slug || '',
    category: r.category || '', location: r.location || '',
    address: r.address || '', googleMapUrl: r.google_map_url || '',
    googleMapEmbed: r.google_map_embed || '', lat: r.lat || '', lng: r.lng || '',
    priceRange: r.price_range || '',
    hours: r.hours || '', services: r.services || [],
    servicePrices: r.service_prices || [], description: r.description || '',
    rating: r.rating || 5.0, reviewCount: r.review_count || 0,
    thumbnail: (r.thumbnail && r.thumbnail.startsWith('http')) ? r.thumbnail : '',
    photos: (() => { const p = r.photos || []; return Array.isArray(p) ? p.filter((u:string) => u && u.startsWith('http')) : []; })(),
    commission: r.commission || 15,
    active: r.active !== false, createdAt: r.created_at || '',
    reviews: (() => { if(!r.reviews) return []; if(Array.isArray(r.reviews)) return r.reviews; try { return JSON.parse(r.reviews) } catch { return [] } })(),
    googlePlaceId: r.google_place_id || '',
    metaDescription: r.meta_description || '',
    seoKeywords: r.seo_keywords || '',
    whyChoose: (() => { if(!r.why_choose) return []; if(Array.isArray(r.why_choose)) return r.why_choose; try { return JSON.parse(r.why_choose) } catch { return [] } })(),
    menuItems: (() => { if(!r.menu_items) return []; if(Array.isArray(r.menu_items)) return r.menu_items; try { return JSON.parse(r.menu_items) } catch { return [] } })(),
    seoText: r.seo_text || ''
  }
}
// Cloudinary video URL → 썸네일 자동 생성 (so_0 = 첫 프레임)
function cloudinaryThumb(videoUrl: string): string {
  if (!videoUrl || !videoUrl.includes('cloudinary.com')) return ''
  // /video/upload/ → /video/upload/so_0,w_600,h_1066,c_fill,q_auto/
  // .mp4 → .jpg
  return videoUrl
    .replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/')
    .replace(/\.mp4$/, '.jpg')
}
// 업체 thumbnail/photos 정제 — Schema.org thumbnailUrl 에러 방지
// Google은 ImageObject.thumbnailUrl 이 절대 https:// URL이어야 함
// 상대경로·빈값·http:// (비보안)는 모두 제거하고 photos[0] fallback 적용
function sanitizeThumb(thumb: string, photos: string[]): string {
  const isAbs = (u: string) => typeof u === 'string' && u.startsWith('https://')
  if (isAbs(thumb)) return thumb
  const fallback = (photos || []).find(isAbs)
  return fallback || ''
}
function sanitizePhotos(photos: string[]): string[] {
  return (photos || []).filter((u: string) => typeof u === 'string' && u.startsWith('https://'))
}
// title이 인스타 파일명 패턴이면 shopName으로 대체
function cleanVideoTitle(title: string, shopName: string): string {
  if (!title) return shopName || 'Video'
  // 파일명 패턴: 영문+숫자+언더스코어로만 이루어지고 길이 10 이상
  const isFilename = /^[a-zA-Z0-9_.-]{8,}$/.test(title.trim())
  return isFilename ? (shopName || title) : title
}
function rowToVideo(r: any): Video {
  const videoUrl = r.video_url || ''
  const rawThumb = r.thumbnail || ''
  const thumb = rawThumb || cloudinaryThumb(videoUrl)
  const shopName = r.shop_name || ''
  return {
    id: String(r.id), shopId: String(r.shop_id),
    title: cleanVideoTitle(r.title || '', shopName),
    description: r.description || '', videoUrl,
    thumbnail: thumb, tags: r.tags || [],
    views: r.views || 0, likes: r.likes || 0, createdAt: r.created_at || ''
  }
}
function rowToBooking(r: any): Booking {
  return {
    id: r.id, shopId: r.shop_id, shopName: r.shop_name || '',
    videoId: '', name: r.name || '', email: r.email || '',
    phone: r.phone || '', date: r.date || '', people: r.people || '1',
    service: r.service || '', message: r.message || '',
    status: r.status || 'new', commissionRate: r.commission_rate || 10,
    estimatedAmount: r.estimated_amount || '', createdAt: r.created_at || ''
  }
}

// ── 샘플 데이터 (DB 초기화용, 최초 1회만) ──
const shops: Shop[] = [
  {
    id: 's1', name: 'Gangnam Glow Skin Clinic',
    slug: 'gangnam-skin-clinic',
    category: 'skincare', location: 'Gangnam, Seoul',
    address: '123 Gangnam-daero, Gangnam-gu, Seoul',
    googleMapUrl: 'https://maps.google.com/?q=Gangnam+Seoul+South+Korea',
    googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3165.4!2d127.0276!3d37.4979!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca157b8d5b8c3%3A0x4b5a1e5f!2sGangnam%2C+Seoul!5e0!3m2!1sen!2skr!4v1',
    priceRange: '₩80,000~₩200,000',
    hours: '10:00~20:00 (Mon~Sat)',
    services: ['Deep Cleansing Facial', 'Hydra Facial', 'Korean Glass Skin', 'Anti-aging Treatment'],
    servicePrices: [{name:'Deep Cleansing Facial',price:'₩80,000'},{name:'Hydra Facial',price:'₩120,000'},{name:'Korean Glass Skin',price:'₩150,000'},{name:'Anti-aging Treatment',price:'₩200,000'}],
    description: 'Premium skin clinic in the heart of Gangnam. Specializing in Korean beauty techniques with certified dermatologists.',
    rating: 4.9, reviewCount: 234,
    thumbnail: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=300&fit=crop',
    commission: 15, active: true, createdAt: '2024-01-01'
  },
  {
    id: 's2', name: 'Hongdae Beauty Studio',
    slug: 'hongdae-makeup-studio',
    category: 'makeup', location: 'Hongdae, Seoul',
    address: '45 Wausan-ro, Mapo-gu, Seoul',
    googleMapUrl: 'https://maps.google.com/?q=Hongdae+Seoul+South+Korea',
    googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3162.7!2d126.9244!3d37.5564!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c98f1e36ef2b7%3A0x4b5a1e5f!2sHongdae%2C+Seoul!5e0!3m2!1sen!2skr!4v1',
    priceRange: '₩50,000~₩120,000',
    hours: '11:00~21:00 (Tue~Sun)',
    services: ['K-pop Makeup', 'Glass Skin Makeup', 'Bridal Makeup', 'Natural Makeup'],
    servicePrices: [{name:'K-pop Makeup',price:'₩60,000'},{name:'Glass Skin Makeup',price:'₩70,000'},{name:'Bridal Makeup',price:'₩120,000'},{name:'Natural Makeup',price:'₩50,000'}],
    description: 'Trendy makeup studio in Hongdae loved by K-pop idols and beauty influencers. Get your Korean beauty look here!',
    rating: 4.8, reviewCount: 187,
    thumbnail: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=300&fit=crop',
    commission: 10, active: true, createdAt: '2024-01-05'
  },
  {
    id: 's3', name: 'Sinchon Hair Lab',
    slug: 'sinchon-hair-salon',
    category: 'hair', location: 'Sinchon, Seoul',
    address: '78 Sinchon-ro, Seodaemun-gu, Seoul',
    googleMapUrl: 'https://maps.google.com/?q=Sinchon+Seoul+South+Korea',
    googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3162.1!2d126.9367!3d37.5596!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357c98b1e36ef2b7%3A0x4b5a1e5f!2sSinchon%2C+Seoul!5e0!3m2!1sen!2skr!4v1',
    priceRange: '₩60,000~₩180,000',
    hours: '10:00~20:00 (Mon~Sat)',
    services: ['Balayage', 'K-pop Hair Color', 'Perm', 'Hair Treatment'],
    servicePrices: [{name:'Balayage',price:'₩150,000'},{name:'K-pop Hair Color',price:'₩120,000'},{name:'Perm',price:'₩100,000'},{name:'Hair Treatment',price:'₩60,000'}],
    description: 'Seoul\'s most popular hair lab for K-pop inspired styles. Our stylists have worked with top Korean celebrities.',
    rating: 4.7, reviewCount: 312,
    thumbnail: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=300&fit=crop',
    commission: 12, active: true, createdAt: '2024-01-10'
  },
  {
    id: 's4', name: 'Itaewon Nail Bar',
    slug: 'itaewon-nail-art',
    category: 'nail', location: 'Itaewon, Seoul',
    address: '22 Itaewon-ro, Yongsan-gu, Seoul',
    googleMapUrl: 'https://maps.google.com/?q=Itaewon+Seoul+South+Korea',
    googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3163.5!2d126.9947!3d37.5347!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca21f3c0b5a6d%3A0x4b5a1e5f!2sItaewon%2C+Seoul!5e0!3m2!1sen!2skr!4v1',
    priceRange: '₩40,000~₩100,000',
    hours: '11:00~20:00 (Mon~Sun)',
    services: ['K-pop Nail Art', 'Gel Nails', 'Nail Extension', 'Nail Removal'],
    servicePrices: [{name:'K-pop Nail Art',price:'₩70,000'},{name:'Gel Nails',price:'₩50,000'},{name:'Nail Extension',price:'₩100,000'},{name:'Nail Removal',price:'₩40,000'}],
    description: 'The most creative nail bar in Seoul! Known for unique K-pop inspired nail art designs.',
    rating: 4.9, reviewCount: 421,
    thumbnail: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop',
    commission: 10, active: true, createdAt: '2024-01-15'
  },
  {
    id: 's5', name: 'Apgujeong Derma Lab',
    slug: 'apgujeong-derma-clinic',
    category: 'clinic', location: 'Apgujeong, Seoul',
    address: '156 Apgujeong-ro, Gangnam-gu, Seoul',
    googleMapUrl: 'https://maps.google.com/?q=Apgujeong+Seoul+South+Korea',
    googleMapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3165.2!2d127.0367!3d37.5247!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x357ca21f3c0b5a6d%3A0x4b5a1e5f!2sApgujeong%2C+Seoul!5e0!3m2!1sen!2skr!4v1',
    priceRange: '₩150,000~₩500,000',
    hours: '10:00~18:00 (Mon~Fri)',
    services: ['Laser Treatment', 'Skin Brightening', 'Anti-aging', 'Botox', 'Filler'],
    servicePrices: [{name:'Laser Treatment',price:'₩300,000'},{name:'Skin Brightening',price:'₩200,000'},{name:'Anti-aging',price:'₩250,000'},{name:'Botox',price:'₩200,000'},{name:'Filler',price:'₩500,000'}],
    description: 'World-class dermatology clinic in prestigious Apgujeong. Board-certified dermatologists with 20+ years experience.',
    rating: 5.0, reviewCount: 156,
    thumbnail: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=300&fit=crop',
    commission: 20, active: true, createdAt: '2024-01-20'
  }
]

const videos: Video[] = [
  { id: 'v1', shopId: 's1', title: 'Gangnam Luxury Facial Treatment', description: 'Experience the famous Korean skincare at Gangnam top skin clinic. Deep cleansing, hydration boost and glow-up guaranteed!', videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4', thumbnail: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=700&fit=crop', tags: ['#KoreanSkincare', '#Gangnam', '#FacialTreatment'], views: 12400, likes: 892, createdAt: '2024-01-15' },
  { id: 'v2', shopId: 's2', title: 'Korean Glass Skin Makeup', description: 'Learn the iconic Korean glass skin makeup from a professional artist in Hongdae. K-beauty at its finest!', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', thumbnail: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400&h=700&fit=crop', tags: ['#GlassSkin', '#KBeauty', '#Makeup'], views: 8900, likes: 674, createdAt: '2024-01-16' },
  { id: 'v3', shopId: 's3', title: 'Korean Hair Salon Balayage', description: 'Get the hottest K-pop inspired hair color at Seoul most popular hair salon. Balayage, highlights and more!', videoUrl: 'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4', thumbnail: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=700&fit=crop', tags: ['#KoreanHair', '#Balayage', '#HairSalon'], views: 6700, likes: 521, createdAt: '2024-01-17' },
  { id: 'v4', shopId: 's4', title: 'Nail Art K-pop Designs', description: 'Stunning K-pop inspired nail art at Seoul trendiest nail studio. Unique designs every time!', videoUrl: 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4', thumbnail: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=700&fit=crop', tags: ['#NailArt', '#Kpop', '#SeoulNails'], views: 15200, likes: 1243, createdAt: '2024-01-18' },
  { id: 'v5', shopId: 's5', title: 'Apgujeong Derma Laser Treatment', description: 'The most advanced derma clinic in Apgujeong. Laser treatments, skin brightening and anti-aging solutions.', videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4', thumbnail: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=700&fit=crop', tags: ['#DermaClinic', '#LaserTreatment', '#KoreanBeauty'], views: 9800, likes: 743, createdAt: '2024-01-19' },
  { id: 'v6', shopId: 's1', title: 'Myeongdong Spa Body Treatment', description: 'Relax with a full body spa in the heart of Myeongdong. Korean herbal therapy included!', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=700&fit=crop', tags: ['#KoreanSpa', '#Myeongdong', '#BodyTreatment'], views: 7300, likes: 589, createdAt: '2024-01-20' }
]

const bookings: Booking[] = [
  { id: 'b1', shopId: 's1', shopName: 'Gangnam Glow Skin Clinic', videoId: 'v1', name: 'Sarah Johnson', email: 'sarah@example.com', phone: '+1-555-0101', date: '2024-02-15', people: '2 People', service: 'Deep Cleansing Facial', message: 'Excited to try!', status: 'confirmed', commissionRate: 15, estimatedAmount: '₩240,000', createdAt: '2024-02-10' },
  { id: 'b2', shopId: 's4', shopName: 'Itaewon Nail Bar', videoId: 'v4', name: 'Emma Wilson', email: 'emma@example.com', phone: '+44-7700-900123', date: '2024-02-18', people: '1 Person', service: 'K-pop Nail Art', message: 'Can you do BTS inspired nails?', status: 'new', commissionRate: 10, estimatedAmount: '₩70,000', createdAt: '2024-02-12' },
  { id: 'b3', shopId: 's2', shopName: 'Hongdae Beauty Studio', videoId: 'v2', name: 'Yuki Tanaka', email: 'yuki@example.com', phone: '+81-90-1234-5678', date: '2024-02-20', people: '3 People', service: 'K-pop Makeup', message: 'We are visiting Seoul for 3 days!', status: 'contacted', commissionRate: 10, estimatedAmount: '₩360,000', createdAt: '2024-02-13' },
  { id: 'b4', shopId: 's5', shopName: 'Apgujeong Derma Lab', videoId: 'v5', name: 'Lisa Chen', email: 'lisa@example.com', phone: '+65-9123-4567', date: '2024-02-22', people: '1 Person', service: 'Laser Treatment', message: 'Interested in skin brightening', status: 'new', commissionRate: 20, estimatedAmount: '₩300,000', createdAt: '2024-02-14' }
]

// ── DB 초기화: 샘플 데이터 없으면 삽입 ──
async function initDb(env: any) {
  const sql = getDb(env)
  try {
    // 테이블 생성
    await sql`CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, category TEXT,
      location TEXT, address TEXT, google_map_url TEXT, google_map_embed TEXT,
      price_range TEXT, hours TEXT, services JSONB DEFAULT '[]',
      service_prices JSONB DEFAULT '[]', description TEXT,
      rating REAL DEFAULT 5.0, review_count INTEGER DEFAULT 0,
      thumbnail TEXT, photos JSONB DEFAULT '[]', commission INTEGER DEFAULT 15,
      active BOOLEAN DEFAULT true, created_at TEXT
    )`
    // photos 컬럼 없으면 추가 (기존 DB 마이그레이션)
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS lat TEXT DEFAULT ''` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS lng TEXT DEFAULT ''` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT '[]'` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS google_place_id TEXT DEFAULT ''` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS meta_description TEXT DEFAULT ''` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS seo_keywords TEXT DEFAULT ''` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS why_choose JSONB DEFAULT '[]'` } catch(e) {}
    try { await sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS menu_items JSONB DEFAULT '[]'` } catch(e) {}
    // ── blog_posts 테이블 ──
    await sql`CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      meta_description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      excerpt TEXT DEFAULT '',
      category TEXT DEFAULT '',
      area TEXT DEFAULT '',
      tags JSONB DEFAULT '[]',
      cover_image TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      views INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )`
    await sql`CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY, shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
      title TEXT, description TEXT, video_url TEXT, thumbnail TEXT,
      tags JSONB DEFAULT '[]', views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0, created_at TEXT
    )`
    await sql`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, shop_id TEXT, shop_name TEXT, name TEXT,
      email TEXT, phone TEXT, service TEXT, people TEXT DEFAULT '1',
      date TEXT, message TEXT, status TEXT DEFAULT 'new',
      commission_rate INTEGER DEFAULT 10, estimated_amount TEXT, created_at TEXT
    )`
    // 샘플 데이터 삽입 (비어있을 때만)
    const cnt = await sql`SELECT COUNT(*) as c FROM shops`
    if (Number(cnt[0].c) === 0) {
      for (const s of shops) {
        await sql`INSERT INTO shops VALUES (
          ${s.id},${s.name},${s.slug},${s.category},${s.location},${s.address},
          ${s.googleMapUrl},${s.googleMapEmbed},${s.priceRange},${s.hours},
          ${JSON.stringify(s.services)},${JSON.stringify(s.servicePrices)},
          ${s.description},${s.rating},${s.reviewCount},${s.thumbnail},
          ${s.commission},${s.active},${s.createdAt}
        ) ON CONFLICT (id) DO NOTHING`
      }
      for (const v of videos) {
        await sql`INSERT INTO videos VALUES (
          ${v.id},${v.shopId},${v.title},${v.description},${v.videoUrl},
          ${v.thumbnail},${JSON.stringify(v.tags)},${v.views},${v.likes},${v.createdAt}
        ) ON CONFLICT (id) DO NOTHING`
      }
    }
  } catch(e) { console.error('initDb error:', e) }
}

// ── lazy init: 첫 요청 시 1회만 실행 ──
let _dbInited = false
async function ensureDb(env: any) {
  if (_dbInited) return
  _dbInited = true
  try {
    await initDb(env)
  } catch(e) {
    _dbInited = false  // 실패 시 재시도 허용
    throw e
  }
}

// ── favicon.ico 404 방지 ──
app.get('/favicon.ico', (c) => c.body(null, 204))

// ── API ──
app.get('/api/videos', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const cat = c.req.query('category')
  const rows = await withTimeout(
    cat && cat !== 'all'
      ? sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.category=${cat} ORDER BY RANDOM()`
      : sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY RANDOM()`,
    15000, []
  )
  const result = rows.map((r: any) => ({
    ...rowToVideo(r),
    shop: { id: r.shop_id, name: r.shop_name, category: r.shop_cat, location: r.shop_location, thumbnail: r.shop_thumb }
  }))
  return c.json({ videos: result })
})

app.get('/api/shops', async (c) => {
  const sql = getDb(c.env)
  const rows = await withTimeout(
    sql`SELECT * FROM shops ORDER BY created_at DESC`,
    15000, []
  )
  return c.json({ shops: rows.map(rowToShop) })
})
app.get('/api/shops/:id', async (c) => {
  const sql = getDb(c.env)
  const rows = await withTimeout(sql`SELECT * FROM shops WHERE id=${c.req.param('id')}`, 10000, [])
  if (!rows.length) return c.json({ error: 'Not found' }, 404)
  const vidRows = await withTimeout(sql`SELECT * FROM videos WHERE shop_id=${c.req.param('id')} ORDER BY created_at DESC`, 8000, [])
  return c.json({ shop: rowToShop(rows[0]), videos: vidRows.map(rowToVideo) })
})
// ── 구글맵 단축URL 언팩 → 업체명·주소·지역 반환 ──
app.post('/api/resolve-gmap', async (c) => {
  try {
    const { url } = await c.req.json() as { url: string }
    if (!url) return c.json({ error: 'no url' }, 400)

    const areaMap: [string, string][] = [
      // 한국어 키워드
      ['압구정','Apgujeong, Seoul'],['청담','Cheongdam, Seoul'],
      ['가로수길','Sinsa, Seoul'],['신사','Sinsa, Seoul'],
      ['역삼','Gangnam, Seoul'],['선릉','Gangnam, Seoul'],
      ['강남','Gangnam, Seoul'],['서초','Seocho, Seoul'],
      ['홍대','Hongdae, Seoul'],['합정','Hapjeong, Seoul'],
      ['상수','Hapjeong, Seoul'],['신촌','Sinchon, Seoul'],
      ['마포','Mapo, Seoul'],['이태원','Itaewon, Seoul'],
      ['한남','Itaewon, Seoul'],['용산','Yongsan, Seoul'],
      ['명동','Myeongdong, Seoul'],['중구','Myeongdong, Seoul'],
      ['종로','Jongno, Seoul'],['인사동','Jongno, Seoul'],
      ['동대문','Dongdaemun, Seoul'],['성수','Seongsu, Seoul'],
      ['성동','Seongsu, Seoul'],['건대','Konkuk, Seoul'],
      ['잠실','Jamsil, Seoul'],['송파','Songpa, Seoul'],
      ['강동','Songpa, Seoul'],['여의도','Yeouido, Seoul'],
      ['영등포','Yeouido, Seoul'],['강서','Gangseo, Seoul'],
      ['목동','Gangseo, Seoul'],['노원','Nowon, Seoul'],
      ['은평','Eunpyeong, Seoul'],
      // 영어 키워드 (Nominatim 결과 대응)
      ['apgujeong','Apgujeong, Seoul'],['cheongdam','Cheongdam, Seoul'],
      ['sinsa','Sinsa, Seoul'],['gangnam','Gangnam, Seoul'],
      ['seocho','Seocho, Seoul'],['hongdae','Hongdae, Seoul'],
      ['hapjeong','Hapjeong, Seoul'],['sinchon','Sinchon, Seoul'],
      ['mapo','Mapo, Seoul'],['itaewon','Itaewon, Seoul'],
      ['hannam','Itaewon, Seoul'],['yongsan','Yongsan, Seoul'],
      ['myeongdong','Myeongdong, Seoul'],['jongno','Jongno, Seoul'],
      ['insadong','Jongno, Seoul'],['dongdaemun','Dongdaemun, Seoul'],
      ['seongsu','Seongsu, Seoul'],['seongdong','Seongsu, Seoul'],
      ['jamsil','Jamsil, Seoul'],['songpa','Songpa, Seoul'],
      ['yeouido','Yeouido, Seoul'],['gangseo','Gangseo, Seoul'],
      ['nowon','Nowon, Seoul'],['eunpyeong','Eunpyeong, Seoul'],
      // 광역시/도시
      ['부산','Busan'],['해운대','Busan'],['서면','Busan'],
      ['busan','Busan'],['haeundae','Busan'],
      ['제주','Jeju'],['jeju','Jeju'],
      ['인천','Incheon'],['incheon','Incheon'],
      ['대구','Daegu'],['daegu','Daegu'],
      ['대전','Daejeon'],['daejeon','Daejeon'],
      ['광주','Gwangju'],['gwangju','Gwangju'],
      ['수원','Suwon'],['suwon','Suwon']
    ]
    const findArea = (text: string) => {
      const t = text.toLowerCase()
      for (const [kw, val] of areaMap) { if (t.indexOf(kw.toLowerCase()) !== -1) return val }
      return ''
    }

    // ── 좌표 추출 함수 (두 가지 패턴 모두 지원) ──
    const extractCoords = (u: string): { lat: string; lon: string } | null => {
      // 패턴1: !3d37.5186!4d127.047 (data= 형태)
      const m1 = u.match(/!3d([-\d.]+)!4d([-\d.]+)/)
      if (m1) return { lat: m1[1], lon: m1[2] }
      // 패턴2: @37.5186,127.047 (일반 공유 URL)
      const m2 = u.match(/@([-\d.]+),([-\d.]+)/)
      if (m2) return { lat: m2[1], lon: m2[2] }
      // 패턴3: ?q=37.5186,127.047
      const m3 = u.match(/[?&]q=([-\d.]+),([-\d.]+)/)
      if (m3) return { lat: m3[1], lon: m3[2] }
      return null
    }

    // ── Nominatim 역지오코딩 ──
    const reverseGeocode = async (lat: string, lon: string) => {
      try {
        const r = await fetch(
          'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&accept-language=en',
          { headers: { 'User-Agent': 'SeoulBeautyTrip/1.0' } }
        )
        const d = await r.json() as any
        if (d && d.display_name) {
          const addr = d.display_name
          const loc = findArea(addr)
            || findArea(d.address?.suburb || '')
            || findArea(d.address?.city_district || '')
            || findArea(d.address?.borough || '')
          return { address: addr, location: loc }
        }
      } catch { /* ignore */ }
      return null
    }

    // ── 단축 URL 팔로우 (goo.gl, maps.app) ──
    let resolved = url
    if (url.indexOf('goo.gl') !== -1 || url.indexOf('maps.app') !== -1) {
      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch(resolved, { method: 'GET', redirect: 'manual' })
          const loc = r.headers.get('location')
          if (!loc) break
          resolved = loc.startsWith('http') ? loc : resolved
          if (resolved.indexOf('/maps/place/') !== -1 || resolved.indexOf('maps.google.com') !== -1) break
        } catch { break }
      }
    }

    // ── Places API 호출 헬퍼 (쿼리 or placeId) ──
    const callPlacesApi = async (textQuery: string, coords?: { lat: string; lon: string }): Promise<any> => {
      const body: any = { textQuery, languageCode: 'en' }
      if (coords) {
        body.locationBias = {
          circle: {
            center: { latitude: parseFloat(coords.lat), longitude: parseFloat(coords.lon) },
            radius: 200
          }
        }
      }
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': getGoogleKey(c.env),
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.regularOpeningHours,places.rating,places.userRatingCount,places.reviews,places.photos,places.internationalPhoneNumber,places.websiteUri,places.location,places.editorialSummary,places.primaryType,places.types'
        },
        body: JSON.stringify(body)
      })
      if (!r.ok) return null
      const d: any = await r.json()
      return d.places?.[0] || null
    }

    const placeDetailsById = async (pid: string): Promise<any> => {
      const fieldMask = 'id,displayName,formattedAddress,addressComponents,regularOpeningHours,rating,userRatingCount,reviews,photos,internationalPhoneNumber,websiteUri,location,editorialSummary,primaryType,types'
      const r = await fetch(`https://places.googleapis.com/v1/places/${pid}?languageCode=en`, {
        headers: { 'X-Goog-Api-Key': getGoogleKey(c.env), 'X-Goog-FieldMask': fieldMask }
      })
      if (!r.ok) return null
      return r.json()
    }

    const placeToJson = async (place: any) => {
      if (!place) return null
      const comps: any[] = place.addressComponents || []
      // 한국어 + 일본어 + 한자 모두 포함
      const isKor = (s: string) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s)
      const stripKor = (s: string) => s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g,'').replace(/\s{2,}/g,' ').trim()
      const get = (...types: string[]) => {
        const c = comps.find((x: any) => types.some(t => x.types?.includes(t)))
        if (!c) return ''
        return !isKor(c.longText||'') ? c.longText||'' : !isKor(c.shortText||'') ? c.shortText||'' : ''
      }
      const street = [get('street_number'), get('route')].filter(Boolean).join(' ')
        || [get('sublocality_level_4'), get('sublocality_level_3'), get('sublocality_level_2')].filter(Boolean).join(' ')
      const sub1 = get('sublocality_level_1')
      const district = get('administrative_area_level_2','locality')
      const province = get('administrative_area_level_1')
      let address = [street, sub1, district, province, 'South Korea'].filter(Boolean).join(', ')
      if (isKor(address)) address = stripKor(place.formattedAddress||'') || 'Seoul, South Korea'

      // 업체명: 파트[0]에서 CJK만 제거 → 브랜드명 최우선 추출
      // 예: "Cheongdam Dear Clinic 청담디어의원" → "Cheongdam Dear Clinic" ✅
      const rawName: string = place.displayName?.text || ''
      const nameParts = rawName.split(/[|\uff5c]/).map((s: string) => s.trim()).filter(Boolean)
      const p0c = nameParts[0] ? stripKor(nameParts[0]) : ''
      const engName = (p0c.length > 1 ? p0c : null)
        || nameParts.find((s: string) => !isKor(s) && s.length > 0)
        || stripKor(rawName)
        || rawName

      // location: sublocality_level_2 → level_1 → 주소 순으로 시도
      const sub1Text = comps.find((x: any) => x.types?.includes('sublocality_level_1'))?.longText || ''
      const sub2Text = comps.find((x: any) => x.types?.includes('sublocality_level_2'))?.longText || ''
      const location = findArea(sub2Text) || findArea(sub1Text) || findArea(address) || findArea(place.formattedAddress || '') || 'Seoul'

      const weekdays: string[] = place.regularOpeningHours?.weekdayDescriptions || []
      const rawReviews: any[] = place.reviews || []
      const enRevs   = rawReviews.filter((r: any) => r.text?.languageCode==='en' && (r.text?.text?.length||0)>20)
      const otherRevs = rawReviews.filter((r: any) => r.text?.languageCode!=='en' && (r.text?.text?.length||0)>20)
      const reviews = [...enRevs, ...otherRevs].slice(0,5).map((r: any) => ({
        author: r.authorAttribution?.displayName||'Guest', rating: r.rating||5,
        text: r.text?.text||'', time: r.relativePublishTimeDescription||''
      }))
      const photoNames2 = (place.photos||[]).slice(0,10).map((p: any) => p.name||'').filter(Boolean)
      const photos = await resolveGooglePhotos(photoNames2, getGoogleKey(c.env))
      const lat = place.location?.latitude?.toString() || ''
      const lng = place.location?.longitude?.toString() || ''

      // 업체 소개 (editorialSummary)
      const description: string = place.editorialSummary?.text || ''

      // primaryType/types → 카테고리 자동감지
      const allTypes = [place.primaryType||'', ...(place.types||[])].map((t: string) => t.toLowerCase())
      let suggestedCategory = ''
      if (allTypes.some((t: string) => ['beauty_salon','hair_care','hair_salon','barber_shop'].includes(t))) suggestedCategory = 'hair'
      else if (allTypes.some((t: string) => ['nail_salon'].includes(t))) suggestedCategory = 'nail'
      else if (allTypes.some((t: string) => ['spa','massage','sauna'].includes(t))) suggestedCategory = 'spa'
      else if (allTypes.some((t: string) => ['doctor','hospital','medical_lab','physiotherapist','skin_care','plastic_surgeon','dermatologist'].includes(t))) suggestedCategory = 'clinic'
      else if (allTypes.some((t: string) => ['makeup_artist'].includes(t))) suggestedCategory = 'makeup'

      return {
        placeId: place.id||'', name: engName, address, location,
        phone: place.internationalPhoneNumber||'', website: place.websiteUri||'',
        hours: weekdays.join(' | '), weekdayDescriptions: weekdays,
        description, suggestedCategory,
        rating: place.rating||0, reviewCount: place.userRatingCount||0,
        reviews, photos, lat, lng,
        _fromPlaces: true  // Places API로 가져왔음을 admin에서 인식
      }
    }

    // ── 1순위: URL에서 placeId(0x...) 추출 → Place Details ──
    const placeIdMatch = resolved.match(/[?&;/]([0-9a-f]{16,}:[0-9a-f]{16,})/i)
      || resolved.match(/place_id[:=]([A-Za-z0-9_-]+)/)
    if (placeIdMatch) {
      const pid = placeIdMatch[1]
      // hex:hex 형태는 Google Maps 내부 ID — Text Search로 변환
      const hexMatch = pid.match(/^([0-9a-f]+):([0-9a-f]+)$/i)
      if (!hexMatch) {
        const pd = await placeDetailsById(pid)
        const result = await placeToJson(pd)
        if (result) return c.json(result)
      }
    }

    // ── 2순위: /place/ URL에서 업체명 추출 → Places Text Search ──
    const placeIdx = resolved.indexOf('/place/')
    if (placeIdx !== -1) {
      const afterPlace = resolved.slice(placeIdx + 7)
      const rawName = afterPlace.split('/')[0].split('?')[0].split('@')[0]
      let shopName = ''
      try { shopName = decodeURIComponent(rawName.split('+').join(' ')).trim() } catch { shopName = rawName.trim() }

      // 한국어/일본어/한자 제거 후 영문 브랜드명 추출
      // 전략: '|' split → 파트[0]에서 CJK 제거 후 영문 잔여분을 최우선 사용
      //   예: "Cheongdam Dear Clinic 청담디어의원" → CJK 제거 → "Cheongdam Dear Clinic" ✅
      //   파트[0] 잔여가 없을 때만 → 다른 순수 영문 파트 사용
      const stripCJK = (s: string) => s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g, '').replace(/\s{2,}/g, ' ').trim()
      const hasCJK   = (s: string) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s)
      const parts    = shopName.split(/[|｜]/).map(s => s.trim()).filter(Boolean)
      // 1) 파트[0]에서 CJK만 제거한 영문 잔여분 (브랜드명이 첫 파트에 있는 경우)
      // 2) 순수 영문 파트 (CJK 전혀 없는 파트, 단 파트[0]는 이미 처리됨)
      // 3) 원본 그대로
      const p0clean = parts[0] ? stripCJK(parts[0]) : ''
      const engPart  = (p0clean.length > 2 ? p0clean : null)
        || parts.find(s => !hasCJK(s) && s.length > 2)
        || shopName

      // 좌표도 추출
      const coords = extractCoords(resolved)
      const latStr = coords?.lat || ''
      const lngStr = coords?.lon || ''

      // Places Text Search로 전체 정보 가져오기 (좌표 있으면 locationBias 적용)
      const searchQ = engPart + ' Seoul Korea'
      const place = await callPlacesApi(searchQ, coords || undefined)
      const result = await placeToJson(place)
      if (result) {
        if (latStr && !result.lat) result.lat = latStr
        if (lngStr && !result.lng) result.lng = lngStr
        // URL 업체명에서 지역 힌트 추출 (예: "TUNE CLINIC APGUJEONG" → Apgujeong)
        if (!result.location || result.location === 'Seoul') {
          const locFromName = findArea(shopName)
          if (locFromName) result.location = locFromName
        }
        return c.json(result)
      }

      // Places 실패 → 기본 정보만
      const geo = coords ? await reverseGeocode(coords.lat, coords.lon) : null
      return c.json({
        name: engPart, address: geo?.address || '', location: geo?.location || findArea(shopName),
        lat: latStr, lng: lngStr
      })
    }

    // ── 3순위: ?q= ──
    const qMatch = resolved.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      let qVal = ''
      try { qVal = decodeURIComponent(qMatch[1].split('+').join(' ')) } catch { qVal = qMatch[1] }
      const coordsFromQ = extractCoords(resolved)
      if (coordsFromQ) {
        const geo = await reverseGeocode(coordsFromQ.lat, coordsFromQ.lon)
        if (geo) return c.json({ name: '', address: geo.address, location: geo.location, lat: coordsFromQ.lat, lng: coordsFromQ.lon })
      }
      const place = await callPlacesApi(qVal + ' Seoul Korea')
      const result = await placeToJson(place)
      if (result) return c.json(result)
      return c.json({ name: '', address: qVal, location: findArea(qVal), lat: '', lng: '' })
    }

    // ── 4순위: 좌표만 ──
    const coordsOnly = extractCoords(resolved)
    if (coordsOnly) {
      const geo = await reverseGeocode(coordsOnly.lat, coordsOnly.lon)
      if (geo) return c.json({ name: '', address: geo.address, location: geo.location, lat: coordsOnly.lat, lng: coordsOnly.lon })
    }

    return c.json({ address: '', location: '', name: '', lat: '', lng: '' })
  } catch (e: any) {
    return c.json({ error: e.message || 'failed' }, 500)
  }
})

// ── Cloudinary 서명 발급 (영상/이미지 공통) ──
const CLD = { KEY: '221647295675392', SECRET: 'g10Q4wv2UzDEAGV35QluPCYz4Ms', NAME: 'dc0ouozcd' }
async function makeSign(folder: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const strToSign = 'folder=' + folder + '&timestamp=' + timestamp + CLD.SECRET
  const enc = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-1', enc.encode(strToSign))
  const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return { cloudName: CLD.NAME, apiKey: CLD.KEY, timestamp, signature, folder }
}
app.get('/api/upload-sign', async (c) => {
  try { return c.json(await makeSign('seoul-beauty')) }
  catch(e: any) { return c.json({ error: e.message || 'Sign failed' }, 500) }
})
app.get('/api/upload-sign-image', async (c) => {
  try { return c.json(await makeSign('seoul-beauty-photos')) }
  catch(e: any) { return c.json({ error: e.message || 'Sign failed' }, 500) }
})

// ── slug 자동 생성 헬퍼 ──
// "Jiwoo Clinic" + "Gangnam, Seoul" → "jiwoo-clinic-gangnam"
// 중복 방지: DB에서 같은 slug 있으면 숫자 suffix 붙임
async function makeShopSlug(sql: any, name: string, location: string): Promise<string> {
  // 업체명 → slug 베이스
  let base = ''
  for (let i = 0; i < name.length; i++) {
    const ch = name[i].toLowerCase()
    base += (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ? ch : '-'
  }
  // 연속 하이픈 정리
  base = base.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'shop'

  // 지역명 추출 (첫 단어, 영문만)
  const areaRaw = (location || '').split(',')[0].trim()
  let area = ''
  for (let i = 0; i < areaRaw.length; i++) {
    const ch = areaRaw[i].toLowerCase()
    area += (ch >= 'a' && ch <= 'z') ? ch : '-'
  }
  area = area.replace(/-+/g, '-').replace(/^-|-$/g, '')

  const candidate = area ? `${base}-${area}` : base

  // DB 중복 확인 → 있으면 -2, -3, ...
  const existing = await sql`SELECT slug FROM shops WHERE slug LIKE ${candidate + '%'}`
  const existingSlugs = new Set(existing.map((r: any) => r.slug))
  if (!existingSlugs.has(candidate)) return candidate
  for (let n = 2; n <= 99; n++) {
    const s = `${candidate}-${n}`
    if (!existingSlugs.has(s)) return s
  }
  return `${candidate}-${Date.now().toString().slice(-4)}`
}

// ══════════════════════════════════════════════════════════════
// ── AI SEO 자동생성 헬퍼 v2
//    Google Places API → 리뷰/업종/영업시간/에디토리얼 수집
//    GPT(gpt-5.1)   → 업체별 완전 고유 description + whyChoose
//    새 업체 등록 / 일괄 재생성 모두 이 함수 하나로 처리
// ══════════════════════════════════════════════════════════════

// Google Places New API에서 업체 정보 수집 (전화·주소·URL 제외)
async function fetchGooglePlacesInfo(placeId: string, googleKey: string): Promise<Record<string,any>> {
  if (!placeId || !googleKey) return {}
  const fields = 'displayName,rating,userRatingCount,reviews,regularOpeningHours,editorialSummary,types,primaryType,businessStatus,priceLevel'
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}?fields=${encodeURIComponent(fields)}&key=${googleKey}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return {}
    return await res.json() as Record<string,any>
  } catch { return {} }
}

// 영업시간 periods → 간결한 문자열
function summarizeHours(periods: any[]): string {
  if (!periods?.length) return ''
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const slots: Record<number,string> = {}
  for (const p of periods) {
    const d = p.open?.day; if (d == null) continue
    slots[d] = `${String(p.open.hour).padStart(2,'0')}:${String(p.open.minute).padStart(2,'0')}–${String(p.close.hour).padStart(2,'0')}:${String(p.close.minute).padStart(2,'0')}`
  }
  const timeToD: Record<string,string[]> = {}
  for (const [d,t] of Object.entries(slots)) timeToD[t] = [...(timeToD[t]||[]), dayName[Number(d)]]
  return Object.entries(timeToD).map(([t,ds]) => `${ds[0]}${ds.length>1?'–'+ds[ds.length-1]:''} ${t}`).join(' | ')
}

// 컨텍스트 문자열 조합
function buildSeoContext(body: any, places: Record<string,any>): string {
  const lines: string[] = []
  lines.push(`Shop name    : ${body.name}`)
  lines.push(`Category     : ${body.category}`)
  lines.push(`Neighborhood : ${body.location || 'Seoul'}`)
  lines.push(`Google rating: ${body.rating || 5}/5.0  (${body.reviewCount || 0}+ verified reviews)`)

  if (places && Object.keys(places).length) {
    const skipTypes = new Set(['point_of_interest','establishment','service','health','local_business'])
    const types = (places.types || []).filter((t:string)=>!skipTypes.has(t)).map((t:string)=>t.replace(/_/g,' ')).slice(0,4)
    if (types.length) lines.push(`Business type: ${types.join(', ')}`)
    const editorial = places.editorialSummary?.text
    if (editorial) lines.push(`Google intro : ${editorial}`)
    const plMap: Record<string,string> = {
      PRICE_LEVEL_INEXPENSIVE:'Budget-friendly (₩)', PRICE_LEVEL_MODERATE:'Mid-range (₩₩)',
      PRICE_LEVEL_EXPENSIVE:'Premium (₩₩₩)', PRICE_LEVEL_VERY_EXPENSIVE:'Luxury (₩₩₩₩)'
    }
    const pl = plMap[places.priceLevel||'']
    if (pl) lines.push(`Price level  : ${pl}`)
    const hrs = summarizeHours(places.regularOpeningHours?.periods || [])
    if (hrs) lines.push(`Opening hours: ${hrs}`)
  }

  const services = Array.isArray(body.services) ? body.services.slice(0,8) : []
  if (services.length) lines.push(`Services     : ${services.join(', ')}`)

  // 리뷰 합산: body(DB) + Places API
  const seen = new Set<string>()
  const reviews: {rating:any,text:string}[] = []
  for (const r of (body.reviews||[])) {
    const t = (r.text||'').replace(/\n/g,' ').trim()
    if (t && !seen.has(t.slice(0,40))) { seen.add(t.slice(0,40)); reviews.push({rating:r.rating,text:t}) }
  }
  if (places?.reviews) {
    for (const r of places.reviews) {
      const t = (r.text?.text||'').replace(/\n/g,' ').trim()
      if (t && !seen.has(t.slice(0,40)) && reviews.length < 8) { seen.add(t.slice(0,40)); reviews.push({rating:r.rating,text:t}) }
    }
  }
  if (reviews.length) {
    lines.push(`\nCustomer reviews (${reviews.length} samples):`)
    for (const [i,rv] of reviews.entries()) lines.push(`  [${i+1}] ${rv.rating}★  "${rv.text.slice(0,220)}"`)
  }
  return lines.join('\n')
}

async function autoGenSeo(body: any, apiKey: string, googleKey?: string): Promise<{description:string, metaDescription:string, keywords:string[], titleSuffix:string, whyChoose:string[], seoText:string} | null> {
  if (!apiKey || !body.name) return null
  try {
    // Google Places 정보 수집 (placeId 있으면)
    const places = await fetchGooglePlacesInfo(body.placeId || body.googlePlaceId || '', googleKey || '')
    const context = buildSeoContext(body, places)

    const area = (body.location || 'Seoul').split(',')[0].trim()
    const cat  = body.category || 'beauty'

    // 카테고리별 GPT 힌트
    const catHints: Record<string,string> = {
      clinic:  'Focus on: specific treatments (laser names, injectables, procedures), doctor expertise, skin results from reviews.',
      hair:    'Focus on: stylist skill, color/cut results, damage repair, before-after transformations in reviews.',
      headspa: 'Focus on: scalp care method, relaxation depth, therapist attentiveness, step-by-step treatment.',
      skincare:'Focus on: facial technique, skin analysis, glow results, product quality mentioned in reviews.',
      makeup:  'Focus on: color analysis process, consultation style, what clients specifically learned or changed.',
      nail:    'Focus on: nail art style, design options, precision, longevity from review feedback.',
      dental:  'Focus on: specific dental procedures, pain-free experience, visible results.',
    }
    const hint = catHints[cat] || 'Focus on standout features and unique aspects mentioned in reviews.'

    // SEO longform 카테고리별 구조 힌트
    const seoStructureHints: Record<string,string> = {
      clinic:  'H2-1: "[Name] — [specific treatment type] Clinic in [area], Seoul". H2-2: "Treatments at [Name]: [list 2-3 specific procedure names]". H2-3: "Why Foreigners Choose [Name] for Korean Dermatology". Each paragraph cites actual rating, review count, or a real reviewer phrase.',
      hair:    'H2-1: "[Name] — Hair Salon in [area] Seoul". H2-2: "What [Name] Does Differently: [color/cut specialty]". H2-3: "Booking [Name] as a Foreigner in Seoul". Each paragraph references specific stylist skills or before-after results from reviews.',
      headspa: 'H2-1: "[Name] — Head Spa in [area], Seoul". H2-2: "The [Name] Scalp Treatment Experience". H2-3: "Visiting [Name] as a Foreign Guest in Seoul". Each paragraph describes a specific step or sensory detail from reviews.',
      skincare:'H2-1: "[Name] — Skincare Studio in [area], Seoul". H2-2: "Facial Treatments at [Name]". H2-3: "Why Foreign Skin-Care Lovers Visit [Name]". Reference skin concerns, product brands, or glow results from reviews.',
      nail:    'H2-1: "[Name] — Nail Art Studio in [area], Seoul". H2-2: "Nail Designs and Services at [Name]". H2-3: "Getting Nails Done at [Name] as a Foreigner". Cite design styles, longevity, or reviewer compliments.',
      makeup:  'H2-1: "[Name] — Makeup & Color Analysis in [area], Seoul". H2-2: "What Happens at a [Name] Session". H2-3: "Foreigners and [Name]: English-Friendly Beauty Consultation". Reference personal color types, cosmetics used, or client transformations.',
      dental:  'H2-1: "[Name] — Dental Clinic in [area], Seoul". H2-2: "Dental Procedures at [Name]". H2-3: "Foreign Patients at [Name]: English Support & Pricing". Reference specific treatments and pain-free feedback.',
    }
    const seoHint = seoStructureHints[cat] || 'Three H2 sections: intro, services, and foreigner guide. Each cites real shop data.'

    const prompt = `Write unique copy for "${body.name}" (${cat} in ${area}, Seoul) using ONLY the data below.
Category hint: ${hint}

DATA:
${context}

Return ONLY a single valid JSON object — no markdown, no explanation:
{
  "description": "<2–3 sentence paragraph, 80–140 words. Must mention: exact neighborhood (${area}), rating+review count, 1–2 specific details from reviews (treatment name, reviewer quote fragment, unique feature). No generic filler.>",
  "whyChoose": [
    "<emoji + specific treatment/service highlight unique to THIS shop. 55–85 chars>",
    "<emoji + standout staff, atmosphere or result detail from actual reviews. 55–85 chars>",
    "<emoji + foreigner accessibility specific to this shop's location/situation. 55–85 chars>"
  ],
  "metaDescription": "<145–158 chars. Include shop name, ${area}, ${cat}, and a specific hook from reviews.>",
  "titleSuffix": "<max 45 chars: ${body.name} | ${area} ${cat}>",
  "keywords": ["<brand+area>","<brand booking>","<brand review>","<brand foreigner>","<best ${cat} ${area} Seoul 2026>","<${cat} Seoul English 2026>","<${area} ${cat} foreigner>","<${cat} Seoul 2026>","<${area} beauty Seoul 2026>","<${cat} Seoul English speaking>","<book ${cat} Seoul foreigners>","<${area} ${cat} foreigners review>"],
  "seoText": "<EXACTLY 3 sections, each with one H2 then one P. Structure: ${seoHint}. Rules: (1) Every P must be 70-110 words. (2) Each H2 must contain the shop name OR area OR Seoul. (3) Mention the year 2026 at least once naturally. (4) NO phone/URL/exact address. (5) Use ONLY: <h2 class=\\"sp-seo-h2\\"> and <p class=\\"sp-seo-p\\"> tags. (6) Must be 100% unique — cite real rating, review count, or a real reviewer phrase. (7) End with a sentence about English-friendly booking. Output ONLY the raw HTML string, NOT an array, NOT markdown.>"
}`

    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          { role: 'system', content: 'You are a Seoul K-beauty SEO expert writing for foreign tourists in 2026. Output ONLY valid JSON — no markdown, no extra text. seoText MUST be a raw HTML string (h2+p tags only), NOT an array, NOT markdown. Always include "2026" naturally in at least one paragraph. Always mention the specific neighborhood. Always end with English-friendly booking info.' },
          { role: 'user',   content: prompt }
        ],
        max_tokens: 2500,
        temperature: 0.75
      })
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const text = (data.choices?.[0]?.message?.content || '').trim()
    if (!text) return null
    const cleaned = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0])
    // 필수 필드 검증
    if (!parsed.description || !Array.isArray(parsed.whyChoose) || parsed.whyChoose.length < 3) return null
    // seoText: H2 없으면 자동 보완 (fallback)
    if (!parsed.seoText) parsed.seoText = ''
    if (parsed.seoText && !parsed.seoText.includes('<h2')) {
      // p 태그를 h2+p 쌍으로 변환
      const _area2 = (body.location||'Seoul').split(',')[0].trim()
      const _catMap2: Record<string,string> = {clinic:'Dermatology Clinic',hair:'Hair Salon',headspa:'Head Spa',skincare:'Skincare',makeup:'Makeup',nail:'Nail Art',dental:'Dental Clinic',tattoo:'Eyebrow Tattoo'}
      const _catN2 = _catMap2[body.category||''] || (body.category||'Beauty').charAt(0).toUpperCase()+(body.category||'').slice(1)
      const _h2auto = [body.name+' \u2014 '+_catN2+' in '+_area2+', Seoul 2026','Foreigner-Friendly '+_catN2+' in '+_area2,'How to Book '+body.name+' as a Foreign Visitor']
      const _ps2 = (parsed.seoText as string).match(/<p[^>]*>[\s\S]*?<\/p>/g) || []
      if (_ps2.length >= 2) {
        parsed.seoText = _ps2.map((p: string, i: number) => '<h2 class="sp-seo-h2">'+(_h2auto[i]||body.name)+'</h2>'+p).join('')
      } else {
        parsed.seoText = '<h2 class="sp-seo-h2">'+_h2auto[0]+'</h2>'+parsed.seoText
      }
    }
    return parsed
  } catch { return null }
}


app.post('/api/shops', async (c) => {
  const sql = getDb(c.env)
  const body = await c.req.json()
  const newId = 's' + Date.now()
  const today = new Date().toISOString().split('T')[0]

  // description 없으면 AI SEO 자동 생성
  let description = body.description || ''
  let metaDescription = body.metaDescription || ''
  let seoKeywords = body.seoKeywords || ''
  let whyChoose: string[] = body.whyChoose || []
  let seoText = body.seoText || ''
  if (!description) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
    const seo = await autoGenSeo(body, apiKey)
    if (seo) {
      description = seo.description || ''
      metaDescription = seo.metaDescription || ''
      seoKeywords = Array.isArray(seo.keywords) ? seo.keywords.join(', ') : ''
      whyChoose = Array.isArray(seo.whyChoose) ? seo.whyChoose : []
      seoText = seo.seoText || ''
    }
  }

  // slug 자동 생성 (항상 새로 생성 — 품질 보장, 중복 방지)
  const slug = await makeShopSlug(sql, body.name||'', body.location||'')

  // Schema.org thumbnailUrl 에러 방지 — 반드시 https:// 절대 URL만 저장
  const cleanPhotos = sanitizePhotos(body.photos||[])
  const cleanThumb  = sanitizeThumb(body.thumbnail||'', cleanPhotos)

  await sql`INSERT INTO shops (id,name,slug,category,location,address,google_map_url,google_map_embed,lat,lng,price_range,hours,services,service_prices,description,meta_description,seo_keywords,seo_text,why_choose,rating,review_count,thumbnail,photos,commission,active,created_at) VALUES (
    ${newId},${body.name||''},${slug},${body.category||''},${body.location||''},${body.address||''},
    ${body.googleMapUrl||''},${body.googleMapEmbed||''},${body.lat||''},${body.lng||''},
    ${body.priceRange||''},${body.hours||''},
    ${JSON.stringify(body.services||[])},${JSON.stringify(body.servicePrices||[])},
    ${description},${metaDescription},${seoKeywords},${seoText},${JSON.stringify(whyChoose)},
    ${body.rating||5.0},${body.reviewCount||0},${cleanThumb},
    ${JSON.stringify(cleanPhotos)},${body.commission||15},true,${today}
  ) ON CONFLICT DO NOTHING`
  return c.json({ ok: true, id: newId, seoGenerated: !body.description })
})

app.put('/api/shops/:id', async (c) => {
  const sql = getDb(c.env)
  const body = await c.req.json()

  // description이 변경됐거나 없으면 AI SEO 재생성
  let description = body.description || ''
  let metaDescription = body.metaDescription || ''
  let seoKeywords = body.seoKeywords || ''
  let whyChoose: string[] = Array.isArray(body.whyChoose) ? body.whyChoose : []
  let seoTextPut = body.seoText || ''
  if (!description || body.regenerateSeo) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
    const seo = await autoGenSeo(body, apiKey)
    if (seo) {
      description = description || seo.description || ''
      metaDescription = metaDescription || seo.metaDescription || ''
      seoKeywords = seoKeywords || (Array.isArray(seo.keywords) ? seo.keywords.join(', ') : '')
      if (!whyChoose.length) whyChoose = Array.isArray(seo.whyChoose) ? seo.whyChoose : []
      if (!seoTextPut) seoTextPut = seo.seoText || ''
    }
  }

  // slug: 보내온 값 없으면 name+location으로 새로 생성 (수정 시에도 품질 보장)
  const slugVal = body.slug || await makeShopSlug(sql, body.name||'', body.location||'')

  // Schema.org thumbnailUrl 에러 방지 — 반드시 https:// 절대 URL만 저장
  const cleanPhotosU = sanitizePhotos(body.photos||[])
  const cleanThumbU  = sanitizeThumb(body.thumbnail||'', cleanPhotosU)

  await sql`UPDATE shops SET
    name=${body.name||''},
    slug=${slugVal},
    category=${body.category||''},
    location=${body.location||''},
    address=${body.address||''},
    google_map_url=${body.googleMapUrl||''},
    google_map_embed=${body.googleMapEmbed||''},
    lat=${body.lat||''},
    lng=${body.lng||''},
    price_range=${body.priceRange||''},
    hours=${body.hours||''},
    services=${JSON.stringify(body.services||[])},
    service_prices=${JSON.stringify(body.servicePrices||[])},
    description=${description},
    meta_description=${metaDescription},
    seo_keywords=${seoKeywords},
    seo_text=${seoTextPut},
    why_choose=${JSON.stringify(whyChoose)},
    rating=${body.rating||5.0},
    review_count=${body.reviewCount||0},
    thumbnail=${cleanThumbU},
    photos=${JSON.stringify(cleanPhotosU)},
    commission=${body.commission||15},
    active=${body.active!==false},
    reviews=${JSON.stringify(body.reviews||[])},
    google_place_id=${body.googlePlaceId||''},
    menu_items=${JSON.stringify(body.menuItems||[])}
    WHERE id=${c.req.param('id')}`
  return c.json({ ok: true, seoGenerated: !body.description || !!body.regenerateSeo })
})
app.delete('/api/shops/:id', async (c) => {
  const sql = getDb(c.env)
  await sql`DELETE FROM shops WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.post('/api/videos', async (c) => {
  const sql = getDb(c.env)
  const body = await c.req.json()
  const newId = 'v' + Date.now()
  const today = new Date().toISOString().split('T')[0]

  // description 없으면 AI 자동 생성
  let description = body.description || ''
  if (!description) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
    if (apiKey && body.shopId) {
      const shopRows = await sql`SELECT name, category, location, services FROM shops WHERE id=${body.shopId}` as any[]
      if (shopRows.length) {
        const shop = { name: shopRows[0].name, category: shopRows[0].category, location: shopRows[0].location, services: JSON.parse(shopRows[0].services||'[]') }
        const video = { title: body.title||'', tags: body.tags||[] }
        description = await genVideoDescription(video, shop, apiKey)
      }
    }
  }

  // thumbnail: 클라이언트가 보낸 값 우선, 없으면 Cloudinary so_0 첫프레임 자동 생성
  const vUrl = body.videoUrl || ''
  const autoThumb = (!body.thumbnail && vUrl && vUrl.includes('cloudinary.com'))
    ? vUrl.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace(/\.mp4$/, '.jpg')
    : ''
  const finalThumb = body.thumbnail || autoThumb

  await sql`INSERT INTO videos (id,shop_id,title,description,video_url,thumbnail,tags,views,likes,created_at) VALUES (
    ${newId},${body.shopId||''},${body.title||''},${description},${vUrl},
    ${finalThumb},${JSON.stringify(body.tags||[])},0,0,${today}
  )`
  return c.json({ ok: true, id: newId, descriptionGenerated: !body.description && !!description })
})
app.delete('/api/videos/:id', async (c) => {
  const sql = getDb(c.env)
  await sql`DELETE FROM videos WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

// ── AI description 생성 헬퍼 ──
async function genVideoDescription(video: any, shop: any, apiKey: string): Promise<string> {
  if (!apiKey) return ''
  const shopName = shop?.name || video.title || 'Seoul Beauty'
  const category = shop?.category || ''
  const location = shop?.location || 'Seoul'
  const services = Array.isArray(shop?.services) ? shop.services.slice(0,5).join(', ') : ''
  const tags = Array.isArray(video.tags) ? video.tags.join(', ') : ''
  const title = video.title || shopName

  const prompt = `Write a compelling 1-2 sentence SEO video description for a Korean beauty salon video.

Shop: ${shopName}
Category: ${category}
Location: ${location}${services ? '\nServices: ' + services : ''}${tags ? '\nTags: ' + tags : ''}
Video title: ${title}

Requirements:
- 80-160 characters
- Include shop name, location (Seoul/area), and 1-2 key services
- End with "Book via WhatsApp." 
- Natural English, no markdown, no quotes
- Include 2-3 relevant hashtags at the end

Return ONLY the description text, nothing else.`

  try {
    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [{ role: 'user', content: prompt }], max_tokens: 200 })
    })
    if (!res.ok) return ''
    const data: any = await res.json()
    return (data.choices?.[0]?.message?.content || '').trim()
  } catch { return '' }
}

// POST /api/videos/:id/gen-description — 개별 영상 AI description 생성
app.post('/api/videos/:id/gen-description', async (c) => {
  const sql = getDb(c.env)
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
  if (!apiKey) return c.json({ ok: false, error: 'No API key' }, 400)

  const vid = await sql`SELECT v.*, s.name as shop_name, s.category as shop_cat, s.location as shop_loc, s.services as shop_svcs FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE v.id=${c.req.param('id')}` as any[]
  if (!vid.length) return c.json({ ok: false, error: 'Not found' }, 404)

  const v = vid[0]
  const shop = { name: v.shop_name, category: v.shop_cat, location: v.shop_loc, services: JSON.parse(v.shop_svcs||'[]') }
  const video = { id: v.id, title: v.title, tags: JSON.parse(v.tags||'[]') }

  const desc = await genVideoDescription(video, shop, apiKey)
  if (!desc) return c.json({ ok: false, error: 'AI generation failed' }, 500)

  await sql`UPDATE videos SET description=${desc} WHERE id=${c.req.param('id')}`
  return c.json({ ok: true, description: desc })
})

// POST /api/videos/gen-description-bulk — 빈 description 영상 일괄 AI 생성
app.post('/api/videos/gen-description-bulk', async (c) => {
  const sql = getDb(c.env)
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
  if (!apiKey) return c.json({ ok: false, error: 'No API key' }, 400)

  const body = await c.req.json().catch(() => ({})) as any
  const forceAll = body?.force === true  // force=true면 기존 description도 재생성

  const rows = forceAll
    ? await sql`SELECT v.*, s.name as shop_name, s.category as shop_cat, s.location as shop_loc, s.services as shop_svcs FROM videos v LEFT JOIN shops s ON v.shop_id=s.id`
    : await sql`SELECT v.*, s.name as shop_name, s.category as shop_cat, s.location as shop_loc, s.services as shop_svcs FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE v.description IS NULL OR v.description=''`

  if (!(rows as any[]).length) return c.json({ ok: true, updated: 0, message: 'No videos to update' })

  let updated = 0, failed = 0
  for (const v of rows as any[]) {
    const shop = { name: v.shop_name, category: v.shop_cat, location: v.shop_loc, services: JSON.parse(v.shop_svcs||'[]') }
    const video = { id: v.id, title: v.title, tags: JSON.parse(v.tags||'[]') }
    const desc = await genVideoDescription(video, shop, apiKey)
    if (desc) {
      await sql`UPDATE videos SET description=${desc} WHERE id=${v.id}`
      updated++
    } else {
      failed++
    }
    // rate limit 방지
    await new Promise(r => setTimeout(r, 300))
  }
  return c.json({ ok: true, updated, failed, total: (rows as any[]).length })
})
app.put('/api/videos/:id', async (c) => {
  const sql = getDb(c.env)
  const body = await c.req.json()
  // title만 넘어온 경우 title만 업데이트, 나머지 필드는 기존값 유지
  if(body.titleOnly) {
    await sql`UPDATE videos SET title=${body.title||''} WHERE id=${c.req.param('id')}`
  } else {
    await sql`UPDATE videos SET
      title=${body.title||''},
      description=${body.description||''},
      thumbnail=${body.thumbnail||''},
      tags=${JSON.stringify(body.tags||[])}
      WHERE id=${c.req.param('id')}`
  }
  return c.json({ ok: true })
})
app.post('/api/videos/:id/view', async (c) => {
  const sql = getDb(c.env)
  await sql`UPDATE videos SET views=views+1 WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.get('/api/bookings', async (c) => {
  const sql = getDb(c.env)
  const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`
  return c.json({ bookings: rows.map(rowToBooking) })
})
app.post('/api/bookings', async (c) => {
  const sql = getDb(c.env)
  const body = await c.req.json()
  const shopRows = await sql`SELECT name, commission FROM shops WHERE id=${body.shopId||''}`
  const shop = shopRows[0]
  const newId = 'b' + Date.now()
  const today = new Date().toISOString().split('T')[0]
  await sql`INSERT INTO bookings (id,shop_id,shop_name,name,email,phone,service,people,date,message,status,commission_rate,estimated_amount,created_at) VALUES (
    ${newId},${body.shopId||''},${shop?.name||body.shopName||''},${body.name||''},${body.email||''},
    ${body.phone||''},${body.service||''},${body.people||'1'},${body.date||''},${body.message||''},
    'new',${shop?.commission||10},${body.estimatedAmount||''},${today}
  )`
  return c.json({ ok: true })
})
app.put('/api/bookings/:id/status', async (c) => {
  const sql = getDb(c.env)
  const { status } = await c.req.json()
  await sql`UPDATE bookings SET status=${status} WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.get('/api/stats', async (c) => {
  try {
    const sql = getDb(c.env)
    const [vStats] = await sql`SELECT COALESCE(SUM(views),0) as total_views, COUNT(*) as total FROM videos`
    const [bStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='new') as new_cnt, COUNT(*) FILTER (WHERE status='confirmed') as confirmed_cnt, COUNT(*) FILTER (WHERE status='contacted') as contacted_cnt FROM bookings`
    const [sStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active=true) as active_cnt FROM shops`
    const topRows = await sql`SELECT v.*, s.name as shop_name FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY v.views DESC LIMIT 5`
    const catRows = await sql`SELECT category, COUNT(*) as cnt FROM shops WHERE active=true GROUP BY category ORDER BY cnt DESC`
    const shopViewRows = await sql`SELECT s.name, s.category, COALESCE(SUM(v.views),0) as total_views FROM shops s LEFT JOIN videos v ON v.shop_id=s.id GROUP BY s.id, s.name, s.category ORDER BY total_views DESC LIMIT 5`
    const recentBookings = await sql`SELECT DATE(CAST(created_at AS timestamptz)) as day, COUNT(*) as cnt FROM bookings WHERE CAST(created_at AS timestamptz) >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`
    return c.json({
      totalViews: Number(vStats.total_views), totalBookings: Number(bStats.total),
      newBookings: Number(bStats.new_cnt), confirmedBookings: Number(bStats.confirmed_cnt),
      contactedBookings: Number(bStats.contacted_cnt),
      totalShops: Number(sStats.total), activeShops: Number(sStats.active_cnt),
      topVideos: topRows.map((r: any) => ({ ...rowToVideo(r), shop: { name: r.shop_name } })),
      categoryStats: catRows.map((r: any) => ({ category: r.category, count: Number(r.cnt) })),
      shopViewStats: shopViewRows.map((r: any) => ({ name: r.name, category: r.category, views: Number(r.total_views) })),
      recentBookings: recentBookings.map((r: any) => ({ day: r.day, count: Number(r.cnt) }))
    })
  } catch(e: any) {
    return c.json({ error: e.message, totalViews:0, totalBookings:0, newBookings:0, confirmedBookings:0, contactedBookings:0, totalShops:0, activeShops:0, topVideos:[], categoryStats:[], shopViewStats:[], recentBookings:[] }, 200)
  }
})

app.get('/api/platform', (c) => c.json(PLATFORM))

// ── AI SEO 설명 자동생성 ──
app.post('/api/ai-seo', async (c) => {
  try {
    const body = await c.req.json()
    const { name, location, category, services, priceRange, hours, placeId, rating, reviewCount } = body
    if (!name) return c.json({ error: 'name required' }, 400)

    // 카테고리별 외국인 검색 키워드
    const catKeywords: Record<string,string> = {
      skincare: 'Korean skincare Seoul, facial treatment Seoul, glass skin Seoul, K-beauty facial, skin clinic Seoul foreigners',
      makeup:   'Korean makeup Seoul, K-beauty makeup artist, Korean beauty look, makeup studio Seoul foreigners',
      hair:     'Korean hair salon Seoul, K-pop hairstyle Seoul, hair coloring Seoul foreigners, balayage Seoul, Korean hair dyeing',
      headspa:  'head spa Seoul, Korean head spa foreigners, scalp treatment Seoul, Korean scalp massage, head spa Seoul English',
      nail:     'Korean nail art Seoul, nail salon Seoul foreigners, K-pop nail design, gel nails Seoul English, nail salon Seoul English speaking',
      clinic:   'Korean dermatology Seoul, skin clinic Seoul foreigners, laser treatment Seoul, aesthetic clinic Korea, Korean skin care clinic',
      spa:      'Korean spa Seoul, body treatment Seoul foreigners, Korean massage Seoul, relaxation spa Seoul English',
    }
    const catKeyword = catKeywords[category] || 'Korean beauty Seoul, K-beauty'
    const area = (location || 'Seoul').split(',')[0].trim()

    // 브랜드 검색 변형 자동 생성
    // "Moclock" → "Moclock Seoul", "Moclock head spa", "Moclock booking", "Moclock review", "Moclock foreigner"
    const brandVariants = [
      `${name} Seoul`,
      `${name} ${category}`,
      `${name} booking`,
      `${name} review`,
      `${name} foreigner`,
      `${name} English`,
      `${name} price`,
      `${name} ${area}`,
    ].join(', ')

    const ratingInfo = rating ? `- Google Rating: ${rating}/5 (${reviewCount || 0} reviews)` : ''
    const serviceList = Array.isArray(services) ? services.join(', ') : (services || 'beauty services')

    const prompt = `You are an SEO expert for a Korean beauty booking platform targeting foreign tourists in Seoul.

The shop "${name}" is a real, well-known ${category} salon in ${area}, Seoul.
Some tourists already search for this shop by name (brand searches).
Your job is to create SEO content that captures BOTH:
1. Brand searches: people who already know "${name}" and search for it
2. Generic searches: people looking for "best ${category} ${area} Seoul foreigners"

Shop details:
- Name: ${name}
- Area: ${area}, Seoul, South Korea
- Category: ${category}
- Services: ${serviceList}
- Price Range: ${priceRange || 'contact for pricing'}
${ratingInfo}
- Brand keyword variations: ${brandVariants}
- Category keywords: ${catKeyword}

Rules:
1. title (titleSuffix): max 40 chars — use format like "${name} | ${area} ${category} Seoul" — must include shop name
2. metaDescription: 140-155 chars — start with shop name, include area + category + "English-friendly" + "Book via WhatsApp"
3. description: 2-3 natural sentences (180-240 chars) — mention shop name naturally, include area, category, what makes it special for foreigners
4. keywords: exactly 8 strings — mix of brand keywords (${name} Seoul, ${name} booking, ${name} review) AND generic keywords (best ${category} ${area} Seoul, ${category} Seoul foreigners, English speaking ${category} Seoul)
5. No quotes inside text values, no markdown, no special characters

Return ONLY valid JSON:
{"titleSuffix":"...","metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6","k7","k8"]}`

    const OPENAI_KEY = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
    if (!OPENAI_KEY) return c.json({ error: 'API key not configured' }, 500)
    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      })
    })
    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'AI API error', detail: err }, 500)
    }
    const data: any = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) return c.json({ error: 'empty response from AI' }, 500)
    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return c.json({ error: 'parse error', raw: text }, 500)
    const result = JSON.parse(jsonMatch[0])
    return c.json(result)
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ── AI 요금표 사진 분석 → servicePrices 추출 ──
app.post('/api/parse-price-image', async (c) => {
  try {
    const body = await c.req.json() as { imageUrl: string }
    const { imageUrl } = body
    if (!imageUrl) return c.json({ error: 'imageUrl required' }, 400)

    const OPENAI_KEY = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
    if (!OPENAI_KEY) return c.json({ error: 'API key not configured' }, 500)

    const prompt = `You are a price menu OCR assistant for Korean beauty salons.
Look at this price menu image and extract all service names and prices.

Rules:
- Extract EVERY service item you can see
- Convert Korean service names to English (e.g. 보톡스→Botox, 필러→Filler, 리프팅→Lifting, 레이저→Laser, 스킨케어→Skincare, 헤어→Hair, 네일→Nail, 페이셜→Facial)
- For prices: remove commas, keep numbers only (e.g. 80,000원 → 80000)
- If price shows a range like 80,000~150,000, use the lower value
- If price is unclear or not visible, use 0
- Return ONLY valid JSON array, no explanation

Format:
[{"name":"Service Name","price":80000},{"name":"Service Name 2","price":120000}]`

    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
          ]
        }],
        max_tokens: 2000
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'AI API error', detail: err }, 500)
    }
    const data: any = await res.json()
    const text = (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    let items: any[] = []
    try { items = JSON.parse(text) } catch(e) {
      // JSON 배열 부분만 추출 시도
      const match = text.match(/\[[\s\S]*\]/)
      if (match) items = JSON.parse(match[0])
    }
    if (!Array.isArray(items)) return c.json({ error: 'Failed to parse items', raw: text }, 500)
    return c.json({ items })
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ── Google Places API 자동가져오기 (query 또는 placeId 직접) ──
app.post('/api/places-fetch', async (c) => {
  try {
    const body = await c.req.json() as { query?: string; placeId?: string }
    const { query, placeId: directPlaceId } = body

    // ── 공통 헬퍼 ──
    // 한국어 + 일본어 + 한자 모두 포함 (업체명에 한자가 붙어오는 경우 대응)
    const isKorean = (s: string) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s)

    // 한국어/일본어/한자 제거 — 영어/숫자/공백/기호만 남김
    const stripKorean = (s: string) =>
      s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g, '').replace(/\s{2,}/g, ' ').trim()

    // 지역명 매핑 (한/영 → 표준 표기)
    const areaMap: [string, string][] = [
      ['apgujeong','Apgujeong'],['압구정','Apgujeong'],
      ['cheongdam','Cheongdam'],['청담','Cheongdam'],
      ['sinsa','Sinsa'],['신사','Sinsa'],['가로수길','Sinsa'],
      ['gangnam','Gangnam'],['강남','Gangnam'],['역삼','Gangnam'],['선릉','Gangnam'],
      ['seocho','Seocho'],['서초','Seocho'],
      ['hongdae','Hongdae'],['홍대','Hongdae'],
      ['hapjeong','Hapjeong'],['합정','Hapjeong'],['상수','Hapjeong'],
      ['mapo','Mapo'],['마포','Mapo'],
      ['itaewon','Itaewon'],['이태원','Itaewon'],['한남','Itaewon'],
      ['yongsan','Yongsan'],['용산','Yongsan'],
      ['myeongdong','Myeongdong'],['명동','Myeongdong'],
      ['jongno','Jongno'],['종로','Jongno'],['인사동','Jongno'],
      ['dongdaemun','Dongdaemun'],['동대문','Dongdaemun'],
      ['seongsu','Seongsu'],['성수','Seongsu'],['성동','Seongsu'],
      ['jamsil','Jamsil'],['잠실','Jamsil'],
      ['songpa','Songpa'],['송파','Songpa'],
      ['yeouido','Yeouido'],['여의도','Yeouido'],
      ['sinchon','Sinchon'],['신촌','Sinchon'],
    ]
    const detectLocation = (text: string): string => {
      const t = text.toLowerCase()
      for (const [kw, val] of areaMap) {
        if (t.includes(kw.toLowerCase())) return `${val}, Seoul`
      }
      return 'Seoul'
    }

    // addressComponents → 깨끗한 영문 주소 조합
    const buildEngAddress = (comps: any[], fallbackAddr: string): string => {
      const get = (...types: string[]) => {
        const c = comps.find((x: any) => types.some(t => x.types?.includes(t)))
        if (!c) return ''
        // shortText, longText 중 한국어 없는 것 선택
        const lt = c.longText || '', st = c.shortText || ''
        return !isKorean(lt) ? lt : !isKorean(st) ? st : ''
      }
      const streetNum  = get('street_number')
      const route      = get('route')
      const sub4       = get('sublocality_level_4')
      const sub3       = get('sublocality_level_3')
      const sub2       = get('sublocality_level_2')
      const sub1       = get('sublocality_level_1')
      const district   = get('administrative_area_level_2','locality')
      const province   = get('administrative_area_level_1')

      const street = [streetNum, route].filter(Boolean).join(' ') || [sub4,sub3,sub2].filter(Boolean).join(' ')
      const neighborhood = sub1
      const parts = [street, neighborhood, district, province, 'South Korea'].filter(Boolean)
      const candidate = parts.join(', ')

      // 조합된 주소에도 한국어가 남아있으면 fallback
      if (isKorean(candidate)) {
        const stripped = stripKorean(fallbackAddr)
        return stripped || 'Seoul, South Korea'
      }
      return candidate || stripKorean(fallbackAddr) || 'Seoul, South Korea'
    }

    // Places API 공통 fieldMask (editorialSummary, primaryType, types 포함)
    const FIELD_MASK_DETAILS = [
      'id','displayName','formattedAddress','shortFormattedAddress',
      'addressComponents','regularOpeningHours','rating','userRatingCount',
      'reviews','photos','websiteUri','internationalPhoneNumber',
      'editorialSummary','primaryType','types'
    ].join(',')
    const FIELD_MASK_SEARCH = FIELD_MASK_DETAILS.split(',').map((f: string) => 'places.' + f).join(',')

    // 장소 단일 조회 (placeId로) — Place Details v1
    const fetchPlaceById = async (pid: string): Promise<any> => {
      const r = await fetch(`https://places.googleapis.com/v1/places/${pid}?languageCode=en`, {
        headers: { 'X-Goog-Api-Key': getGoogleKey(c.env), 'X-Goog-FieldMask': FIELD_MASK_DETAILS }
      })
      if (!r.ok) throw new Error('Place Details error: ' + r.status)
      return r.json()
    }

    // primaryType/types → 우리 카테고리로 매핑
    const detectCategory = (primaryType: string, types: string[]): string => {
      const all = [primaryType, ...(types || [])].map(t => t.toLowerCase())
      if (all.some(t => ['beauty_salon','hair_care','hair_salon','barber_shop'].includes(t))) return 'hair'
      if (all.some(t => ['nail_salon'].includes(t))) return 'nail'
      if (all.some(t => ['spa','massage','sauna'].includes(t))) return 'spa'
      if (all.some(t => ['doctor','hospital','medical_lab','physiotherapist','skin_care','plastic_surgeon','dermatologist'].includes(t))) return 'clinic'
      if (all.some(t => ['makeup_artist'].includes(t))) return 'makeup'
      return '' // 감지 불가 → 사용자가 직접 선택
    }

    let place: any

    if (directPlaceId) {
      // placeId 직접 전달 → Place Details 바로 조회
      place = await fetchPlaceById(directPlaceId)
    } else {
      if (!query) return c.json({ error: 'query or placeId required' }, 400)
      // Text Search
      const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': getGoogleKey(c.env),
          'X-Goog-FieldMask': FIELD_MASK_SEARCH
        },
        body: JSON.stringify({ textQuery: query, languageCode: 'en' })
      })
      if (!searchRes.ok) {
        const err = await searchRes.text()
        return c.json({ error: 'Places API error', detail: err }, 500)
      }
      const sd: any = await searchRes.json()
      place = sd.places?.[0]
      if (!place) return c.json({ error: 'No place found' }, 404)
    }

    // ── 업체 영문명: 한국어/일본어/한자 제거 ──
    const rawDisplayName: string = place.displayName?.text || ''
    // 1) '|' 구분자로 split → 비(非)CJK 파트 우선
    const nameParts = rawDisplayName.split(/[|｜]/).map((s: string) => s.trim()).filter(Boolean)
    const engName = nameParts.find((s: string) => !isKorean(s) && s.length > 0)
      || (() => { const stripped = stripKorean(rawDisplayName); return stripped.length > 1 ? stripped : '' })()
      || rawDisplayName

    // ── 영문 주소 ──
    const comps: any[] = place.addressComponents || []
    const engAddress = buildEngAddress(comps, place.formattedAddress || '')

    // ── 지역 (location) — addressComponents sublocality_level_1 우선, 없으면 주소 전체 검색 ──
    const sub1Comp = comps.find((x: any) => x.types?.includes('sublocality_level_1'))
    const sub2Comp = comps.find((x: any) => x.types?.includes('sublocality_level_2'))
    const sub1Text = sub1Comp?.longText || sub1Comp?.shortText || ''
    const sub2Text = sub2Comp?.longText || sub2Comp?.shortText || ''
    // sublocality_level_2 → level_1 → formattedAddress 순으로 시도
    const location = detectLocation(sub2Text) !== 'Seoul'
      ? detectLocation(sub2Text)
      : detectLocation(sub1Text) !== 'Seoul'
      ? detectLocation(sub1Text)
      : detectLocation(engAddress) !== 'Seoul'
      ? detectLocation(engAddress)
      : detectLocation(place.formattedAddress || '')

    // ── 영업시간 ──
    const weekdays: string[] = place.regularOpeningHours?.weekdayDescriptions || []
    const hoursStr = weekdays.join(' | ')

    // ── 업체 소개 (editorialSummary) ──
    const description: string = place.editorialSummary?.text || ''

    // ── 카테고리 자동감지 ──
    const suggestedCategory = detectCategory(place.primaryType || '', place.types || [])

    // ── 리뷰: 영어 우선 (최대 5개) ──
    const rawReviews: any[] = place.reviews || []
    const enReviews   = rawReviews.filter((r: any) => r.text?.languageCode === 'en' && (r.text?.text?.length || 0) > 20)
    const otherReviews = rawReviews.filter((r: any) => r.text?.languageCode !== 'en' && (r.text?.text?.length || 0) > 20)
    const reviews = [...enReviews, ...otherReviews].slice(0, 5).map((r: any) => ({
      author: r.authorAttribution?.displayName || 'Guest',
      rating: r.rating || 5,
      text: r.text?.text || '',
      time: r.relativePublishTimeDescription || ''
    }))

    // ── 사진 URL (최대 10장) — 실제 https:// URL로 변환하여 저장 ──
    const rawPhotos: any[] = place.photos || []
    const photoNames = rawPhotos.slice(0, 10).map((p: any) => p.name || '').filter(Boolean)
    const photos = await resolveGooglePhotos(photoNames, getGoogleKey(c.env))

    return c.json({
      placeId:             place.id || '',
      name:                engName,
      address:             engAddress,
      location,
      phone:               place.internationalPhoneNumber || '',
      website:             place.websiteUri || '',
      hours:               hoursStr,
      weekdayDescriptions: weekdays,
      description,
      suggestedCategory,
      primaryType:         place.primaryType || '',
      rating:              place.rating || 0,
      reviewCount:         place.userRatingCount || 0,
      reviews,
      photos
    })
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ── Google Places 사진만 가져오기 ──
app.post('/api/places-photos', async (c) => {
  try {
    const { placeId } = await c.req.json() as { placeId: string }
    if (!placeId) return c.json({ error: 'placeId required' }, 400)

    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': getGoogleKey(c.env),
        'X-Goog-FieldMask': 'photos'
      }
    })
    if (!res.ok) return c.json({ error: 'Places API error' }, 500)
    const data: any = await res.json()
    const rawPhotos: any[] = data.photos || []
    const photoNames3 = rawPhotos.slice(0, 6).map((p: any) => p.name || '').filter(Boolean)
    const photos = await resolveGooglePhotos(photoNames3, getGoogleKey(c.env))
    return c.json({ photos })
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ── Google Places 사진 프록시 (Referer 제한 우회) ──
// URL: /api/photo?name=places%2FPLACE_ID%2Fphotos%2FPHOTO_REF
app.get('/api/photo', async (c) => {
  const name = c.req.query('name') || ''
  if (!name) return c.text('name required', 400)

  // name에 /media suffix가 포함된 경우 제거 (중복 방지)
  const cleanName = name.replace(/\/media$/, '')
  // 1단계: skipHttpRedirect=true로 photoUri JSON 받기
  const apiUrl = `https://places.googleapis.com/v1/${cleanName}/media?key=${getGoogleKey(c.env)}&maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true`
  try {
    const res = await fetch(apiUrl)
    const ct = res.headers.get('content-type') || ''

    let imgUrl = ''
    if (ct.includes('application/json')) {
      // JSON에서 photoUri 추출
      const json: any = await res.json()
      imgUrl = json.photoUri || ''
    } else if (res.ok) {
      // 직접 이미지로 온 경우
      const buf = await res.arrayBuffer()
      return new Response(buf, {
        headers: { 'Content-Type': ct || 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'Access-Control-Allow-Origin': '*' }
      })
    }

    if (!imgUrl) return c.text('no photo uri', 502)

    // 2단계: 실제 lh3.googleusercontent.com 이미지 fetch
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return c.text('img fetch failed: ' + imgRes.status, 502)
    const buf = await imgRes.arrayBuffer()
    const imgCt = imgRes.headers.get('content-type') || 'image/jpeg'
    return new Response(buf, {
      headers: {
        'Content-Type': imgCt,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch(e: any) {
    return c.text('proxy error: ' + e.message, 500)
  }
})

// ══════════════════════════════════════════
// ── 원클릭 업체+영상 동시 등록 API ──
// POST /api/quick-register
// body: { gmapUrl, videoUrl, category }
// → 구글맵 → 업체정보 자동가져오기 + 영상 동시 등록
// ══════════════════════════════════════════
app.post('/api/quick-register', async (c) => {
  try {
    const sql = getDb(c.env)
    const { gmapUrl, videoUrl, category } = await c.req.json() as { gmapUrl: string; videoUrl: string; category: string }

    if (!gmapUrl) return c.json({ error: '구글맵 URL을 입력해주세요' }, 400)

    // ── STEP 1: 구글맵 URL → 업체 정보 가져오기 ──
    // resolve-gmap 로직 재사용: URL 언팩 → Places API 조회
    // ── STEP 1: resolve-gmap 엔드포인트를 내부 호출하여 완전한 업체 정보 획득 ──
    // (placeToJson 로직 동일하게 재사용 → photos, reviews, description, whyChoose 등 모두 포함)
    let resolvedData: any = null
    try {
      const resolveRes = await fetch(
        new URL('/api/resolve-gmap', new URL(c.req.url).origin).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: gmapUrl })
        }
      )
      if (resolveRes.ok) {
        const d: any = await resolveRes.json()
        if (d && (d.name || d.address)) resolvedData = d
      }
    } catch(e: any) { console.error('[quick-register] resolve-gmap error:', e?.message) }

    if (!resolvedData || (!resolvedData.name && !resolvedData.address)) {
      return c.json({ error: '구글맵에서 업체 정보를 가져오지 못했습니다. (URL 확인 또는 잠시 후 재시도)' }, 400)
    }

    // ── STEP 2: 업체명 정리 — 파트[0]에서 CJK만 제거 → 브랜드명 최우선 추출 ──
    // 예: "Cheongdam Dear Clinic 청담디어의원" → "Cheongdam Dear Clinic" ✅
    const isKor = (s: string) => /[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/.test(s)
    const stripCJK2 = (s: string) => s.replace(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]+/g,'').replace(/\s{2,}/g,' ').trim()
    const rawName: string = resolvedData.name || ''
    const nameParts = rawName.split(/[|\uff5c]/).map((s: string) => s.trim()).filter(Boolean)
    const p0clean2 = nameParts[0] ? stripCJK2(nameParts[0]) : ''
    const engName = (p0clean2.length > 1 ? p0clean2 : null)
      || nameParts.find((s: string) => !isKor(s) && s.length > 0)
      || stripCJK2(rawName)
      || rawName

    // ── STEP 3: slug 생성 ──
    const makeSlug = (name: string, loc: string) => {
      const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const area = (loc.split(',')[0] || '').trim()
      return `${clean(name)}-${clean(area)}`.slice(0, 60)
    }
    let slug = makeSlug(engName, resolvedData.location || 'seoul')
    const existing = await sql`SELECT id FROM shops WHERE slug = ${slug}`
    if (existing.length > 0) slug = slug + '-' + Date.now().toString().slice(-4)

    // ── STEP 4~6: GPT + Google Places로 고유 SEO 자동 생성 ──
    const loc = resolvedData.location || 'Seoul'
    const cat = category || 'skincare'
    const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || ''
    const gKey   = c.env?.GOOGLE_PLACES_KEY || ''

    // autoGenSeo 호출: Google Places 정보 + 리뷰 + GPT로 완전히 고유한 텍스트 생성
    let description    = resolvedData.description || ''
    let whyChoose: string[] = resolvedData.whyChoose?.length ? resolvedData.whyChoose : []
    let metaDescription = resolvedData.metaDescription || ''
    let seoKeywords     = resolvedData.seoKeywords || ''

    const seoResult = await autoGenSeo({
      name:        engName,
      category:    cat,
      location:    loc,
      rating:      resolvedData.rating || 5,
      reviewCount: resolvedData.reviewCount || 0,
      placeId:     resolvedData.placeId || resolvedData.googlePlaceId || '',
      services:    resolvedData.services || [],
      reviews:     resolvedData.reviews  || [],
    }, apiKey, gKey)

    let seoTextVal = ''
    if (seoResult) {
      if (!description)    description    = seoResult.description
      if (!whyChoose.length) whyChoose    = seoResult.whyChoose
      if (!metaDescription) metaDescription = seoResult.metaDescription || ''
      if (!seoKeywords)    seoKeywords    = Array.isArray(seoResult.keywords) ? seoResult.keywords.join(', ') : ''
      seoTextVal = seoResult.seoText || ''
    }

    // fallback: GPT 실패 시 기본 템플릿
    if (!description)
      description = `${engName} is a ${cat} destination in ${loc}, Seoul. ` +
        `Rated ${resolvedData.rating || 5}/5 with ${resolvedData.reviewCount || 0}+ reviews. Book via WhatsApp with Seoul Beauty Trip.`
    if (!whyChoose.length) whyChoose = [
      `🌐 English-friendly service and easy WhatsApp booking for international visitors`,
      `⭐ Rated ${resolvedData.rating || 5}/5 with ${resolvedData.reviewCount || 0}+ verified reviews`,
      `📍 Conveniently located in ${loc}, perfect for tourists exploring Seoul`
    ]
    if (!metaDescription)
      metaDescription = `${engName} ${loc} Seoul — Premium ${cat} for foreigners. English-speaking staff. Book via WhatsApp with Seoul Beauty Trip.`
    if (!seoKeywords)
      seoKeywords = `${engName} Seoul, ${engName} ${loc}, best ${cat} ${loc} Seoul, ${cat} Seoul English speaking`

    // ── STEP 7: photos 처리 — Schema.org thumbnailUrl 에러 방지 (https:// 절대 URL만 허용) ──
    const photos: string[] = sanitizePhotos(resolvedData.photos || [])
    const thumbnail = sanitizeThumb(resolvedData.thumbnail || '', photos)

    // ── STEP 8: reviews 처리 ──
    const reviews = resolvedData.reviews || []

    // ── STEP 9: DB에 업체 저장 (전체 필드) ──
    const shopId = 's' + Date.now()
    await sql`
      INSERT INTO shops (
        id, name, slug, category, location, address, hours,
        rating, review_count, thumbnail, photos,
        google_place_id, google_map_url, lat, lng,
        description, why_choose, meta_description, seo_keywords, seo_text,
        reviews, active, created_at
      ) VALUES (
        ${shopId}, ${rawName}, ${slug}, ${cat},
        ${loc}, ${resolvedData.address || ''}, ${resolvedData.hours || ''},
        ${resolvedData.rating || 5.0}, ${resolvedData.reviewCount || 0},
        ${thumbnail}, ${JSON.stringify(photos)},
        ${resolvedData.placeId || ''}, ${gmapUrl}, ${resolvedData.lat || ''}, ${resolvedData.lng || ''},
        ${description}, ${JSON.stringify(whyChoose)}, ${metaDescription}, ${seoKeywords}, ${seoTextVal},
        ${JSON.stringify(reviews)}, true, NOW()
      )
    `

    // ── STEP 10: 영상 URL이 있으면 같이 등록 ──
    let videoId = null
    if (videoUrl && videoUrl.trim()) {
      videoId = 'v' + Date.now()
      const thumb = videoUrl.includes('cloudinary.com')
        ? videoUrl.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace(/\.mp4$/, '.jpg')
        : ''
      const today = new Date().toISOString().slice(0, 10)
      await sql`
        INSERT INTO videos (id, shop_id, title, description, video_url, thumbnail, tags, views, likes, created_at)
        VALUES (${videoId}, ${shopId}, ${engName}, ${''}, ${videoUrl.trim()}, ${thumb}, ${'[]'}, 0, 0, ${today})
      `
    }

    return c.json({
      success: true,
      shopId,
      shopName: rawName,
      slug,
      location: loc,
      videoId,
      url: `/shop/${slug}`
    })
  } catch(e: any) {
    return c.json({ error: e.message || '등록 중 오류가 발생했습니다' }, 500)
  }
})

// ══════════════════════════════════════════
// ── 일괄 SEO 재생성 API ──
// ── POST /api/admin/fix-video-thumbnails ──
// thumbnail이 비어있는 영상들에 Cloudinary so_0 자동 썸네일을 DB에 일괄 저장
app.post('/api/admin/fix-video-thumbnails', async (c) => {
  const sql = getDb(c.env)
  const rows = await sql`SELECT id, video_url FROM videos WHERE (thumbnail IS NULL OR thumbnail='') AND video_url IS NOT NULL AND video_url != ''` as any[]
  let fixed = 0
  for (const r of rows) {
    const vUrl = r.video_url || ''
    if (!vUrl.includes('cloudinary.com')) continue
    const thumb = vUrl
      .replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/')
      .replace(/\.mp4$/, '.jpg')
    await sql`UPDATE videos SET thumbnail=${thumb} WHERE id=${r.id}`
    fixed++
  }
  return c.json({ ok: true, fixed, total: rows.length })
})

// POST /api/admin/fix-slugs
// → 모든 업체 slug를 name+location 기반으로 재생성 (숫자 suffix → 지역명 suffix)
// ══════════════════════════════════════════
app.post('/api/admin/fix-slugs', async (c) => {
  const sql = getDb(c.env)
  const rows = await sql`SELECT id, name, location, slug FROM shops ORDER BY created_at ASC`
  const results: {id:string, name:string, old:string, new:string}[] = []

  for (const row of rows) {
    // 자기 자신을 제외한 slug 중복 확인을 위해 임시로 다른 slug로 변경
    // → 새 slug 계산 시 자기 자신은 무시
    const base = (function() {
      let b = ''
      for (let i = 0; i < (row.name||'').length; i++) {
        const ch = (row.name[i]||'').toLowerCase()
        b += (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ? ch : '-'
      }
      b = b.replace(/-+/g,'-').replace(/^-|-$/g,'') || 'shop'
      const areaRaw = (row.location||'').split(',')[0].trim()
      let area = ''
      for (let i = 0; i < areaRaw.length; i++) {
        const ch = areaRaw[i].toLowerCase()
        area += (ch >= 'a' && ch <= 'z') ? ch : '-'
      }
      area = area.replace(/-+/g,'-').replace(/^-|-$/g,'')
      return area ? `${b}-${area}` : b
    })()
    // 자기 자신 제외 중복 확인
    const conflict = await sql`SELECT slug FROM shops WHERE slug=${base} AND id!=${row.id}`
    let newSlug = base
    if (conflict.length > 0) {
      for (let n = 2; n <= 99; n++) {
        const s = `${base}-${n}`
        const c2 = await sql`SELECT slug FROM shops WHERE slug=${s} AND id!=${row.id}`
        if (!c2.length) { newSlug = s; break }
      }
    }
    if (newSlug !== row.slug) {
      await sql`UPDATE shops SET slug=${newSlug} WHERE id=${row.id}`
      results.push({ id: row.id, name: row.name, old: row.slug, new: newSlug })
    }
  }
  return c.json({ ok: true, updated: results.length, results })
})

// POST /api/admin/regenerate-seo-all
// → 모든 활성 업체 순회, description/metaDescription/seoKeywords 없는 것 자동 생성
// ══════════════════════════════════════════
app.post('/api/admin/regenerate-seo-all', async (c) => {
  const sql = getDb(c.env)
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
  if (!apiKey) return c.json({ error: 'API key not configured' }, 500)

  // 쿼리파라미터: force=true 이면 이미 있는 것도 재생성
  const force = c.req.query('force') === 'true'

  // no_h2=true: seoText에 h2 태그 없는 업체만 재생성 (H2 없는 34개 업체 타겟)
  const noH2Only = c.req.query('no_h2') === 'true'

  let rows: any[] = []
  try {
    rows = force
      ? await sql`SELECT * FROM shops WHERE active=true ORDER BY created_at ASC`
      : noH2Only
      ? await sql`SELECT * FROM shops WHERE active=true AND (seo_text IS NULL OR seo_text='' OR seo_text NOT LIKE '%<h2%') ORDER BY created_at ASC`
      : await sql`SELECT * FROM shops WHERE active=true AND (description IS NULL OR description='' OR meta_description IS NULL OR meta_description='') ORDER BY created_at ASC`
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }

  const results: {id:string, name:string, status:string}[] = []

  for (const row of rows) {
    const shop = rowToShop(row)
    try {
      const gKey = c.env?.GOOGLE_PLACES_KEY || ''
      const seo = await autoGenSeo({
        name:        shop.name,
        category:    shop.category,
        location:    shop.location,
        services:    shop.services,
        priceRange:  shop.priceRange,
        rating:      shop.rating,
        reviewCount: shop.reviewCount,
        placeId:     (shop as any).googlePlaceId || '',
        reviews:     (shop as any).reviews || [],
      }, apiKey, gKey)
      if (!seo) { results.push({ id: shop.id, name: shop.name, status: 'skipped (api fail)' }); continue }

      await sql`UPDATE shops SET
        description      = ${seo.description   || shop.description},
        meta_description = ${seo.metaDescription || ''},
        seo_keywords     = ${Array.isArray(seo.keywords) ? seo.keywords.join(', ') : ''},
        why_choose       = ${JSON.stringify(Array.isArray(seo.whyChoose) ? seo.whyChoose : [])},
        seo_text         = ${seo.seoText || ''}
        WHERE id = ${shop.id}`
      results.push({ id: shop.id, name: shop.name, status: 'updated' })
    } catch(e: any) {
      results.push({ id: shop.id, name: shop.name, status: 'error: ' + e.message })
    }
    // Rate limit 방지: 각 업체 사이 0.5초 대기
    await new Promise(r => setTimeout(r, 500))
  }

  return c.json({ total: rows.length, results })
})

// ════════════════════════════════════════════
// BLOG API
// ════════════════════════════════════════════

// 블로그 slug 생성
function makeBlogSlug(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-|-$/g, '')
}

// AI 블로그 본문 생성
async function autoGenBlog(params: {
  title: string, category: string, area: string, keywords: string[]
}, apiKey: string): Promise<{ content: string, excerpt: string, metaDescription: string, tags: string[] } | null> {
  if (!apiKey) return null
  const { title, category, area, keywords } = params
  const prompt = `You are an expert travel & beauty writer creating an SEO-optimized blog post for seoulbeautytrip.com — a K-beauty booking platform for foreign visitors in Seoul.

Write a comprehensive blog post with this EXACT structure (use HTML tags):

<h2>[Section 1 heading]</h2>
<p>...</p>
<h2>[Section 2 heading]</h2>
<p>...</p>
... (6~8 sections total)
<h2>FAQ</h2>
<h3>[Question 1]</h3>
<p>[Answer]</p>
<h3>[Question 2]</h3>
<p>[Answer]</p>
... (4~5 FAQ items)

Requirements:
- Title: "${title}"
- Category: ${category}, Area: ${area}
- Keywords to include naturally: ${keywords.join(', ')}
- Length: 1000~1500 words
- Tone: helpful travel guide, friendly, informative
- Always mention: English booking, WhatsApp, foreigner-friendly
- Include practical tips: what to expect, how to book, price ranges in KRW
- NO markdown, use HTML only
- NO intro like "In this article..." — dive straight into valuable content

Also provide (after the HTML content, separated by ---JSON---):
{"metaDescription":"[155 chars max]","excerpt":"[2 sentences summary]","tags":["tag1","tag2","tag3","tag4","tag5"]}`

  try {
    const res = await fetch('https://api.genspark.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      })
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    if (!raw) return null

    const parts = raw.split('---JSON---')
    const htmlContent = parts[0].trim()
    let meta = { metaDescription: '', excerpt: '', tags: [] as string[] }
    if (parts[1]) {
      try {
        const jsonStr = parts[1].trim().replace(/```json|```/g, '').trim()
        meta = JSON.parse(jsonStr)
      } catch(e) {}
    }
    return {
      content: htmlContent,
      excerpt: meta.excerpt || htmlContent.replace(/<[^>]+>/g, '').slice(0, 200),
      metaDescription: meta.metaDescription || '',
      tags: Array.isArray(meta.tags) ? meta.tags : []
    }
  } catch(e) { return null }
}

// GET /api/blogs — 목록
app.get('/api/blogs', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const status = c.req.query('status') || ''
  const rows = status
    ? await sql`SELECT id,slug,title,meta_description,excerpt,category,area,tags,cover_image,status,views,created_at,updated_at FROM blog_posts WHERE status=${status} ORDER BY created_at DESC`
    : await sql`SELECT id,slug,title,meta_description,excerpt,category,area,tags,cover_image,status,views,created_at,updated_at FROM blog_posts ORDER BY created_at DESC`
  return c.json(rows)
})

// GET /api/blogs/:slug — 단건
app.get('/api/blogs/:slug', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const rows = await sql`SELECT * FROM blog_posts WHERE slug=${c.req.param('slug')}`
  if (!rows.length) return c.json({ error: 'not found' }, 404)
  return c.json(rows[0])
})

// POST /api/blogs — 생성 (AI 자동생성 or 직접입력)
app.post('/api/blogs', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const body = await c.req.json()
  const id = 'b' + Date.now()
  const now = new Date().toISOString()
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''

  let title = body.title || ''
  let content = body.content || ''
  let excerpt = body.excerpt || ''
  let metaDescription = body.metaDescription || ''
  let tags: string[] = body.tags || []
  const category = body.category || ''
  const area = body.area || ''
  const keywords: string[] = body.keywords || []
  const coverImage = body.coverImage || ''
  const status = body.status || 'published'

  // content 없으면 AI 자동 생성
  if (!content && title && apiKey) {
    const gen = await autoGenBlog({ title, category, area, keywords }, apiKey)
    if (gen) {
      content = gen.content
      excerpt = excerpt || gen.excerpt
      metaDescription = metaDescription || gen.metaDescription
      tags = tags.length ? tags : gen.tags
    }
  }

  const slug = body.slug || makeBlogSlug(title)

  await sql`INSERT INTO blog_posts
    (id,slug,title,meta_description,content,excerpt,category,area,tags,cover_image,status,views,created_at,updated_at)
    VALUES (${id},${slug},${title},${metaDescription},${content},${excerpt},${category},${area},${JSON.stringify(tags)},${coverImage},${status},0,${now},${now})
    ON CONFLICT (slug) DO NOTHING`

  return c.json({ ok: true, id, slug, aiGenerated: !body.content })
})

// PUT /api/blogs/:id — 수정
app.put('/api/blogs/:id', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const body = await c.req.json()
  const now = new Date().toISOString()
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''

  let content = body.content || ''
  let excerpt = body.excerpt || ''
  let metaDescription = body.metaDescription || ''
  let tags: string[] = body.tags || []

  // regenerate 요청 시 AI 재생성
  if (body.regenerate && apiKey) {
    const gen = await autoGenBlog({
      title: body.title, category: body.category,
      area: body.area, keywords: body.keywords || []
    }, apiKey)
    if (gen) {
      content = gen.content
      excerpt = gen.excerpt
      metaDescription = gen.metaDescription
      tags = gen.tags
    }
  }

  await sql`UPDATE blog_posts SET
    title=${body.title||''},
    slug=${body.slug||makeBlogSlug(body.title||'')},
    meta_description=${metaDescription},
    content=${content},
    excerpt=${excerpt},
    category=${body.category||''},
    area=${body.area||''},
    tags=${JSON.stringify(tags)},
    cover_image=${body.coverImage||''},
    status=${body.status||'published'},
    updated_at=${now}
    WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

// DELETE /api/blogs/:id
app.delete('/api/blogs/:id', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  await sql`DELETE FROM blog_posts WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

// POST /api/admin/generate-blog — AI 블로그 일괄 생성
app.post('/api/admin/generate-blog', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const apiKey = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
  if (!apiKey) return c.json({ error: 'API key not configured' }, 500)

  const body = await c.req.json()
  const topics: Array<{ title: string, category: string, area: string, keywords: string[] }> = body.topics || []

  if (!topics.length) return c.json({ error: 'topics required' }, 400)

  const results: { title: string, slug: string, status: string }[] = []

  for (const topic of topics) {
    try {
      const gen = await autoGenBlog(topic, apiKey)
      if (!gen) { results.push({ title: topic.title, slug: '', status: 'ai_fail' }); continue }

      const id = 'b' + Date.now() + Math.random().toString(36).slice(2,6)
      const slug = makeBlogSlug(topic.title)
      const now = new Date().toISOString()

      await sql`INSERT INTO blog_posts
        (id,slug,title,meta_description,content,excerpt,category,area,tags,cover_image,status,views,created_at,updated_at)
        VALUES (${id},${slug},${topic.title},${gen.metaDescription},${gen.content},${gen.excerpt},${topic.category},${topic.area},${JSON.stringify(gen.tags)},'','published',0,${now},${now})
        ON CONFLICT (slug) DO NOTHING`

      results.push({ title: topic.title, slug, status: 'created' })
    } catch(e: any) {
      results.push({ title: topic.title, slug: '', status: 'error: ' + e.message })
    }
    await new Promise(r => setTimeout(r, 800))
  }
  return c.json({ total: topics.length, results })
})

// ── SEO 업체 상세 페이지 ──
app.get('/shop/:slug', async (c) => {
  const sql = getDb(c.env)
  const shopRows = await withTimeout(sql`SELECT * FROM shops WHERE slug=${c.req.param('slug')}`, 15000, [])
  if (!shopRows.length) return c.notFound()
  const shop = rowToShop(shopRows[0])
  const vidRows = await withTimeout(sql`SELECT * FROM videos WHERE shop_id=${shop.id} ORDER BY views DESC`, 15000, [])
  const shopVideos = vidRows.map((r: any) => rowToVideo({ ...r, shop_name: shop.name }))
  // 같은 카테고리 업체 (본인 제외, 최대 6개, rating 높은 순)
  const relatedRows = await withTimeout(sql`
    SELECT id, name, slug, category, location, thumbnail, rating, review_count, description
    FROM shops
    WHERE category=${shop.category} AND id != ${shop.id} AND slug IS NOT NULL
    ORDER BY rating DESC NULLS LAST, review_count DESC NULLS LAST
    LIMIT 6`, 15000, [])
  const relatedShops = relatedRows.map((r: any) => rowToShop(r))
  const shopArea = shop.location ? ` (${shop.location.split(',')[0].trim()})` : ''
  const shopAddrLine = shop.address ? `\nAddress: ${shop.address}` : ''
  const waMsg = encodeURIComponent(`[ Booking Request ]\nShop: ${shop.name}${shopArea}${shopAddrLine}\n\nDate: \nTime: \nService: \nName: \nPeople: `)
  const waUrl = `https://wa.me/${PLATFORM.whatsapp}?text=${waMsg}`
  const base = 'https://seoulbeautytrip.com'
  const canonicalUrl = `${base}/shop/${shop.slug}`
  // thumbnail이 상대경로(/api/photo...)면 절대 URL로 변환 — OG/Twitter 크롤러용
  const ogImage = shop.thumbnail
    ? (shop.thumbnail.startsWith('http') ? shop.thumbnail : `${base}${shop.thumbnail}`)
    : `https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg`
  const catEmoji: Record<string,string> = {skincare:'🌿',makeup:'💋',hair:'💇',headspa:'🧖',nail:'💅',clinic:'🏥',tattoo:'✒️'}
  const catIcon = catEmoji[shop.category] || '✨'

  // ── 템플릿 밖에서 미리 계산 (esbuild: HTML 템플릿 내 object literal {} 충돌 방지) ──
  const _shopArea  = shop.location.split(',')[0].trim()
  const _shopCat   = shop.category
  const _catTitleLabels: Record<string,string> = {
    clinic:'Dermatology Clinic', hair:'Hair Salon', headspa:'Head Spa',
    skincare:'Skincare', makeup:'Makeup & Color Analysis', nail:'Nail Art', dental:'Dental Clinic', tattoo:'Eyebrow Tattoo & Microblading'
  }
  const _catLabel  = _catTitleLabels[_shopCat] || (_shopCat.charAt(0).toUpperCase()+_shopCat.slice(1))
  const _areaFinal = _shopArea.toLowerCase().replace('cheongdam','Gangnam').replace('apgujeong','Gangnam') !== _shopArea ? 'Gangnam' : _shopArea
  // title: 업체명 + 지역 + 카테고리 + Seoul + 연도 (구글 검색 키워드 최적화)
  const _pageTitle = shop.name+' '+_areaFinal+' '+_catLabel+' Seoul 2026 | Foreigners Guide'

  const _metaDescLabels: Record<string,string> = {
    clinic:'dermatology clinic', hair:'hair salon', headspa:'head spa & scalp clinic',
    skincare:'skincare studio', makeup:'personal color & makeup', nail:'nail art studio', dental:'dental clinic', tattoo:'eyebrow tattoo & microblading studio'
  }
  const _catLbl2   = _metaDescLabels[_shopCat] || _shopCat
  const _rating    = shop.rating ? shop.rating+'★' : ''
  const _revs      = shop.reviewCount > 10 ? shop.reviewCount+'+ verified reviews' : shop.reviewCount > 0 ? shop.reviewCount+' reviews' : ''
  const _svc1      = shop.services && shop.services.length > 0 ? shop.services[0] : ''
  const _svc2      = shop.services && shop.services.length > 1 ? shop.services[1] : ''
  const _svcPart   = _svc1 ? (_svc2 ? _svc1+' & '+_svc2 : _svc1) : ''
  const _areaClean = _shopArea.replace(', Seoul','').trim()
  const _metaDesc  = (shop.metaDescription && shop.metaDescription.trim().length > 30)
    ? shop.metaDescription.replace(/Seoul,?\s*Seoul/g,'Seoul').replace(/Gangnam,?\s*Seoul Seoul/g,'Gangnam, Seoul').trim().slice(0,160)
    : (shop.name+' is a '+_rating+' foreigner-friendly '+_catLbl2+' in '+_areaClean+', Seoul.'
       +(_revs?' '+_revs+'.':'')+(_svcPart?' Specializing in '+_svcPart+'.':'')
       +' English booking via WhatsApp. Same-day appointments available.').slice(0,160)

  const _areaGn    = _shopArea.toLowerCase().includes('cheongdam')||_shopArea.toLowerCase().includes('apgujeong') ? 'Gangnam' : _shopArea
  const _n         = shop.name
  const _catKwMap: Record<string,string[]> = {
    clinic:  [_areaGn+' dermatology clinic foreigners',_areaGn+' skin clinic Seoul','laser clinic Seoul English','Korean dermatology foreigners','aesthetic clinic Seoul booking','skin treatment '+_areaGn+' Seoul'],
    hair:    [_areaGn+' hair salon foreigners','hair salon Seoul English speaking','Korean hair salon foreigners','hair color Seoul English',_areaGn+' hair color Seoul'],
    headspa: [_areaGn+' head spa foreigners','scalp treatment Seoul English','head spa Seoul foreigners','Korean head spa English',_areaGn+' scalp care Seoul'],
    skincare:[_areaGn+' skincare foreigners','facial Seoul English speaking','skincare Seoul foreigners','Korean facial treatment English',_areaGn+' glow treatment Seoul'],
    makeup:  [_areaGn+' personal color analysis','color analysis Seoul English','makeup Seoul foreigners','personal color Seoul English',_areaGn+' makeup consultation'],
    nail:    [_areaGn+' nail art foreigners','nail salon Seoul English','Korean nail art Seoul','nail art Seoul foreigners',_areaGn+' nail design Seoul'],
    dental:  [_areaGn+' dental clinic foreigners','dentist Seoul English speaking','dental Seoul foreigners','Korean dentist English',_areaGn+' tooth whitening Seoul'],
  }
  const _extras    = _catKwMap[_shopCat] || []
  const _svcKw     = shop.services.slice(0,3)
  const _base2     = [_n,_n+' Seoul',_n+' '+_areaGn,_n+' review',_n+' booking',_n+' foreigners',_n+' English','best '+_shopCat+' '+_areaGn+' Seoul']
  // 2026 연도 키워드 자동 포함 (SEO 갱신)
  const _year2026kw = [_n+' Seoul 2026', 'best '+_shopCat+' '+_areaGn+' Seoul 2026', _shopCat+' Seoul foreigners 2026']
  const _keywords  = (shop.seoKeywords && shop.seoKeywords.trim().length > 20)
    ? shop.seoKeywords.includes('2026') ? shop.seoKeywords : shop.seoKeywords+', '+_year2026kw.join(', ')
    : [..._base2,..._extras,..._svcKw,..._year2026kw].join(', ')

  const _ogCatLabels: Record<string,string> = {
    clinic:'Dermatology Clinic', hair:'Hair Salon', headspa:'Head Spa',
    skincare:'Skincare', makeup:'Makeup', nail:'Nail', dental:'Dental', tattoo:'Eyebrow Tattoo'
  }
  const _ogCatLabel = _ogCatLabels[_shopCat] || _shopCat
  const _ogTitle   = shop.name+' | '+_shopArea.replace('Cheongdam','Gangnam').replace('Apgujeong','Gangnam')+' '+_ogCatLabel+' Seoul'

  const _schemaTypeMap: Record<string,string> = {
    clinic:'["MedicalClinic","HealthAndBeautyBusiness","LocalBusiness"]',
    hair:'["HairSalon","BeautySalon","LocalBusiness"]',
    headspa:'["BeautySalon","HealthClub","LocalBusiness"]',
    skincare:'["BeautySalon","LocalBusiness"]',
    makeup:'["BeautySalon","LocalBusiness"]',
    nail:'["NailSalon","BeautySalon","LocalBusiness"]',
    dental:'["Dentist","MedicalClinic","LocalBusiness"]',
  }
  const _schemaType = _schemaTypeMap[_shopCat] || '["LocalBusiness","BeautySalon"]'

  const _breadcrumbCatLabels: Record<string,string> = {
    clinic:'Dermatology Clinic Seoul', hair:'Hair Salon Seoul', headspa:'Head Spa Seoul',
    skincare:'Skincare Seoul', makeup:'Makeup Seoul', nail:'Nail Salon Seoul', dental:'Dental Clinic Seoul', tattoo:'Eyebrow Tattoo Seoul'
  }
  const _bcCatName = _breadcrumbCatLabels[_shopCat] || _shopCat

  const _wpCatLabels: Record<string,string> = {
    clinic:'Dermatology Clinic', hair:'Hair Salon', headspa:'Head Spa',
    skincare:'Skincare Studio', makeup:'Makeup & Color Analysis', nail:'Nail Art Studio', dental:'Dental Clinic', tattoo:'Eyebrow Tattoo Studio'
  }
  const _wpCatLabel = _wpCatLabels[_shopCat] || _shopCat
  const _wpName    = shop.name+' \u2014 '+_shopArea+' '+_wpCatLabel+' Seoul'

  return c.html(`<!DOCTYPE html>
<html lang="en" itemscope itemtype="https://schema.org/LocalBusiness">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_pageTitle}</title>
<meta name="description" content="${_metaDesc}">
<meta name="keywords" content="${_keywords}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<!-- Open Graph -->
<meta property="og:type" content="business.business">
<meta property="og:title" content="${_ogTitle}">
<meta property="og:description" content="${(shop.metaDescription||shop.description||'').replace(/Seoul,?\s*Seoul/g,'Seoul').slice(0,155)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${shop.name} | Seoul Beauty Trip">
<meta name="twitter:description" content="${(shop.metaDescription||shop.description||'').replace(/Seoul,?\s*Seoul/g,'Seoul').slice(0,155)}">
<meta name="twitter:image" content="${ogImage}">
<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":${_schemaType},
      "@id":"${canonicalUrl}",
      "name":"${shop.name}",
      "alternateName":"${shop.name} Seoul",
      "description":"${(shop.description||'').replace(/"/g,"'")}",
      "image":${(()=>{const imgs=[ogImage,...(shop.photos||[]).map((p:string)=>p.startsWith('http')?p:base+p)].filter(Boolean);return JSON.stringify(imgs.map(u=>({'@type':'ImageObject','url':u,'thumbnailUrl':u})));})()},
      "url":"${canonicalUrl}",
      "address":{
        "@type":"PostalAddress",
        "streetAddress":"${shop.address.replace(/"/g,"'")}",
        "addressLocality":"${shop.location.split(',')[0].trim()}",
        "addressRegion":"Seoul",
        "addressCountry":"KR"
      },
      "geo":{
        "@type":"GeoCoordinates",
        "latitude":"${shop.lat||''}",
        "longitude":"${shop.lng||''}"
      },
      "openingHours":"${shop.hours.replace(/"/g,"'")}",
      ${(()=>{
        // openingHoursSpecification 자동 생성 (hours 문자열 파싱)
        // 형식: "Monday: 10:00 AM – 9:00 PM / Tuesday: ..." 또는 "10:00~20:00 (Mon~Sat)"
        const _days: Record<string,string> = {monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday',mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'}
        const _hrs = shop.hours.toLowerCase()
        const _specs: string[] = []
        // 패턴 1: "Monday: 10:30 AM – 9:00 PM"
        const _p1 = _hrs.matchAll(/([a-z]+):\s*(\d+):(\d+)\s*(am|pm)?\s*[\u2013\-~]+\s*(\d+):(\d+)\s*(am|pm)?/gi)
        for (const m of _p1) {
          const day = _days[m[1].toLowerCase()]
          if (!day) continue
          let oh = parseInt(m[2]); const om = m[3]; const oap = (m[4]||'').toLowerCase()
          let ch = parseInt(m[5]); const cm = m[6]; const cap = (m[7]||'').toLowerCase()
          if (oap==='pm' && oh!==12) oh+=12; if (oap==='am' && oh===12) oh=0
          if (cap==='pm' && ch!==12) ch+=12; if (cap==='am' && ch===12) ch=0
          _specs.push('{"@type":"OpeningHoursSpecification","dayOfWeek":"https://schema.org/'+day+'","opens":"'+String(oh).padStart(2,'0')+':'+om+'","closes":"'+String(ch).padStart(2,'0')+':'+cm+'"}')
        }
        if (_specs.length > 0) return '"openingHoursSpecification":['+_specs.join(',')+'],';
        return '';
      })()}
      "priceRange":"${shop.priceRange}",
      "currenciesAccepted":"KRW",
      "paymentAccepted":"Cash, Credit Card",
      "areaServed":{"@type":"City","name":"Seoul"},
      "aggregateRating":{
        "@type":"AggregateRating",
        "ratingValue":"${shop.rating}",
        "bestRating":"5",
        "worstRating":"1",
        "reviewCount":"${Math.max(shop.reviewCount,1)}"
      },
      "hasOfferCatalog":{
        "@type":"OfferCatalog",
        "name":"${shop.category} Services at ${shop.name}",
        "itemListElement":[${shop.servicePrices.map((sp:any,i:number)=>`{"@type":"Offer","position":${i+1},"name":"${sp.name}","price":"${sp.price}","priceCurrency":"KRW","availability":"https://schema.org/InStock"}`).join(',')}]
      },
      "contactPoint":{
        "@type":"ContactPoint",
        "contactType":"reservations",
        "availableLanguage":["English","Korean"]
      },
      "sameAs":[
        "https://seoulbeautytrip.com/shop/${shop.slug}",
        ${shop.googlePlaceId ? `"https://maps.google.com/?cid=${shop.googlePlaceId}",` : ''}
        ${shop.googlePlaceId ? `"https://www.google.com/maps/place/?q=place_id:${shop.googlePlaceId}",` : ''}
        "https://www.instagram.com/seoulbeautytrip/"
      ],
      "keywords":"${(shop.seoKeywords||shop.name+' Seoul, '+shop.name+' booking, '+shop.name+' review, '+shop.name+' foreigners').replace(/Seoul,?\s*Seoul/g,'Seoul')}"
    },
    {
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"Seoul Beauty Trip","item":"${base}/"},
        {"@type":"ListItem","position":2,"name":"${_bcCatName}","item":"${base}/?cat=${shop.category}"},
        {"@type":"ListItem","position":3,"name":"${shop.name}","item":"${canonicalUrl}"}
      ]
    },
    {
      "@type":"FAQPage",
      "mainEntity":[
        {
          "@type":"Question",
          "name":"Is ${shop.name} foreigner-friendly?",
          "acceptedAnswer":{"@type":"Answer","text":"Yes. ${shop.name} in ${shop.location.split(',')[0].trim()}, Seoul is foreigner-friendly. Seoul Beauty Trip handles all booking communication in English via WhatsApp, so no Korean is needed."}
        },
        {
          "@type":"Question",
          "name":"How do I book ${shop.name} as a foreigner in Seoul?",
          "acceptedAnswer":{"@type":"Answer","text":"Tap the Book button on this page to open WhatsApp. Seoul Beauty Trip will confirm your appointment at ${shop.name}, explain pricing in English, and handle all coordination. Same-day bookings are often available."}
        },
        {
          "@type":"Question",
          "name":"What treatments does ${shop.name} offer?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.name} offers ${shop.services.slice(0,6).join(', ')}${shop.services.length>6?' and more':''} in ${shop.location.split(',')[0].trim()}, Seoul. Contact us via WhatsApp for full service list and current pricing."}
        },
        {
          "@type":"Question",
          "name":"What is ${shop.name}'s rating?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.name} is rated ${shop.rating} out of 5 based on ${shop.reviewCount}+ verified reviews. It is consistently recommended by foreign visitors to Seoul for its quality and English-friendly service."}
        },
        {
          "@type":"Question",
          "name":"Where is ${shop.name} located in Seoul?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.name} is located in ${shop.location.split(',')[0].trim()}, Seoul.${shop.address?' Address: '+shop.address:''} Easy to reach from major tourist areas."}
        }
      ]
    },
    ${shop.reviews && shop.reviews.length > 0 ? `{
      "@type":"ItemList",
      "name":"Reviews of ${shop.name}",
      "itemListElement":[${shop.reviews.slice(0,3).map((r:any,i:number)=>`{
        "@type":"ListItem","position":${i+1},
        "item":{
          "@type":"Review",
          "author":{"@type":"Person","name":"${(r.author||'Guest').replace(/"/g,"'")}"},
          "reviewRating":{"@type":"Rating","ratingValue":"${r.rating||5}","bestRating":"5"},
          "reviewBody":"${(r.text||'').replace(/"/g,"'").slice(0,200)}",
          "itemReviewed":{"@type":"LocalBusiness","name":"${shop.name}"}
        }
      }`).join(',')}]
    },` : ''}
    {
      "@type":"WebPage",
      "@id":"${canonicalUrl}#webpage",
      "url":"${canonicalUrl}",
      "name":"${_wpName}",
      "description":"${(shop.metaDescription||shop.description||'').replace(/"/g,"'").replace(/Seoul,?\s*Seoul/g,'Seoul').slice(0,155)}",
      "inLanguage":"en",
      "isPartOf":{"@id":"${base}/#website"},
      "primaryImageOfPage":{"@type":"ImageObject","url":"${shop.thumbnail}","thumbnailUrl":"${shop.thumbnail}"},
      "speakable":{"@type":"SpeakableSpecification","cssSelector":".sp-title,.sp-desc-text,.sp-seo-block"}
    }
  ]
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;
  --gold:#C9A84C;--gold2:#F0C96E;
  --bg:#08080E;--bg2:#0F0F1A;--bg3:#161625;
  --cd:#1A1A2E;--cd2:#1F1F35;
  --border:rgba(255,255,255,.07);
  --ff-serif:'Playfair Display',serif;
  --ff-sans:'Inter',sans-serif;
}
body{background:var(--bg);color:#fff;font-family:var(--ff-sans);min-height:100vh}
/* NAV */
.sp-nav{position:sticky;top:0;z-index:100;background:rgba(8,8,14,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.sp-nav-inner{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;max-width:600px;margin:0 auto}
.sp-nav-logo{font-family:var(--ff-serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,#fff,var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.sp-nav-back{display:flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid var(--border);border-radius:20px;color:rgba(255,255,255,.6);font-size:12px;font-weight:600;text-decoration:none;transition:all .2s;background:rgba(255,255,255,.04)}
.sp-nav-back:hover{color:#fff;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
/* HERO */
.sp-hero{position:relative;height:320px;overflow:hidden;max-width:600px;margin:0 auto}
.sp-hero-img{width:100%;height:100%;object-fit:cover}
.sp-hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,8,14,.1) 0%,transparent 30%,rgba(8,8,14,.6) 65%,var(--bg) 100%)}
.sp-hero-info{position:absolute;bottom:0;left:0;right:0;padding:24px 20px 20px}
.sp-cat-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 13px;border-radius:20px;background:rgba(232,65,122,.18);border:1px solid rgba(232,65,122,.35);font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--pk3);margin-bottom:8px;backdrop-filter:blur(8px)}
.sp-title{font-family:var(--ff-serif);font-size:26px;font-weight:700;line-height:1.2;margin-bottom:6px;text-shadow:0 2px 20px rgba(0,0,0,.8)}
.sp-loc{display:flex;align-items:center;gap:5px;font-size:13px;color:rgba(255,255,255,.65);margin-bottom:6px}
.sp-rating{display:flex;align-items:center;gap:6px}
.sp-stars{color:var(--gold);font-size:13px;letter-spacing:1px}
.sp-rating-num{font-size:12px;color:rgba(255,255,255,.55)}
/* GALLERY */
.sp-gallery{display:flex;gap:8px;overflow-x:auto;padding:16px 20px;scrollbar-width:none;background:var(--bg);max-width:600px;margin:0 auto}
.sp-gallery::-webkit-scrollbar{display:none}
.sp-gthumb{flex-shrink:0;width:72px;height:72px;border-radius:10px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color .2s}
.sp-gthumb.active,.sp-gthumb:hover{border-color:var(--pk)}
.sp-gthumb img{width:100%;height:100%;object-fit:cover}
/* WRAP */
.sp-wrap{max-width:600px;margin:0 auto;padding:16px 20px 100px}
/* ACTION BTNS */
.sp-actions{display:flex;gap:10px;margin-bottom:20px}
.sp-wa{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;background:linear-gradient(135deg,#25D366,#0EA855);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,.3);transition:opacity .2s}
.sp-wa:hover{opacity:.9}
.sp-gmap{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;transition:opacity .2s}
.sp-gmap:hover{opacity:.9}
/* CARDS (legacy) */
.sp-card{background:var(--cd);border:1px solid var(--border);border-radius:18px;padding:20px;margin-bottom:14px}
.sp-card-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
/* ── 통일 섹션 (모달 스타일과 동일) ── */
.sp-addr-row{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.42);margin-bottom:14px;line-height:1.5}
.sp-addr-row i{color:var(--pk2);margin-top:2px;flex-shrink:0}
.sp-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.sp-ig-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 12px}
.sp-ig-label{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:4px}
.sp-ig-val{font-size:13px;font-weight:700;color:#fff;display:flex;align-items:center;gap:5px}
.sp-ig-val i{color:var(--pk2);font-size:11px}
.sp-ig-stars{color:#fbbf24;font-size:11px;letter-spacing:1px}
.sp-sec{margin-bottom:14px}
.sp-sec-title{font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:4px}
.sp-sec-body{font-size:13px;color:rgba(255,255,255,.62);line-height:1.8;letter-spacing:.1px}
/* HOURS TABLE */
.sp-hours-wrap{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:6px 14px}
.sp-hours-table{width:100%;border-collapse:collapse}
.sp-hours-day{font-size:11px;font-weight:700;color:rgba(255,255,255,.45);padding:7px 0;width:44px}
.sp-hours-time{font-size:12px;color:rgba(255,255,255,.72);text-align:right;padding:7px 0}
.sp-hours-time.closed{color:rgba(255,80,80,.6)}
.sp-hours-today .sp-hours-day,.sp-hours-today .sp-hours-time{color:#fff;font-weight:800}
/* SERVICES */
.sp-svc-tags{display:flex;flex-wrap:wrap;gap:7px}
.sp-svc-tag{padding:6px 13px;background:rgba(232,65,122,.08);border:1px solid rgba(232,65,122,.2);border-radius:20px;font-size:12px;color:var(--pk3);font-weight:600}
/* PRICE LIST */
.sp-price-list{display:flex;flex-direction:column;gap:0}
.sp-price-item{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.sp-price-item:last-child{border-bottom:none}
.sp-price-name{font-size:13px;color:rgba(255,255,255,.8);font-weight:500}
.sp-price-val{font-size:13px;color:var(--gold);font-weight:800}
/* MAP */
.sp-map{border-radius:14px;overflow:hidden;height:200px;border:1px solid var(--border)}
.sp-map iframe{width:100%;height:100%;border:0;display:block}
.sp-map-link{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#60a5fa;text-decoration:none}
.sp-map-link:hover{color:#93c5fd}
/* VIDEOS */
.sp-vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;justify-items:center}
.sp-vid-grid .sp-vid-card:nth-child(odd):last-child{grid-column:1/-1;width:180px;aspect-ratio:9/16}
.sp-vid-grid.single-vid{display:flex;justify-content:center;align-items:flex-start}
.sp-vid-grid.single-vid .sp-vid-card{width:180px;flex-shrink:0}
.sp-vid-card{border-radius:14px;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16;background:#000}
.sp-vid-inner{position:absolute;inset:0;border-radius:14px;overflow:hidden}
.sp-vid-poster{transition:opacity .35s}
.sp-vid-card.vid-on .sp-vid-poster{opacity:0}
.sp-vid-card img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.sp-vid-card:hover img{transform:scale(1.04)}
.sp-vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.85) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:12px 10px}
.sp-vid-card-title{font-size:11px;font-weight:700;line-height:1.3;color:#fff}
.sp-vid-views{font-size:10px;color:rgba(255,255,255,.55);margin-top:3px}
.sp-play-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(232,65,122,.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
/* FLOAT BTN */
.sp-float{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;white-space:nowrap}
.sp-float a{display:flex;align-items:center;gap:9px;padding:15px 36px;background:linear-gradient(135deg,#25D366,#0EA855);border-radius:30px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 28px rgba(37,211,102,.45)}
/* REVIEWS */
.sp-reviews-wrap{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px 14px}
.sp-review-card{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.sp-review-card:last-child{border-bottom:none}
.sp-review-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
.sp-review-author{font-size:12px;font-weight:700;color:rgba(255,255,255,.85)}
.sp-review-stars{font-size:11px;color:#fbbf24;letter-spacing:1px}
.sp-review-text{font-size:12px;color:rgba(255,255,255,.55);line-height:1.6}
.sp-review-time{font-size:10px;color:rgba(255,255,255,.28);margin-top:4px}
/* WHY CHOOSE */
.sp-why-list{display:flex;flex-direction:column;gap:8px}
.sp-why-item{font-size:13px;color:rgba(255,255,255,.75);line-height:1.6;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;border-left:3px solid var(--pk2)}
/* SEO 텍스트 블록 */
.sp-seo-block{margin-bottom:14px;padding:18px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px}
.sp-seo-h2{font-size:14px;font-weight:700;color:rgba(255,255,255,.75);margin:0 0 8px 0;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06);line-height:1.4}
.sp-seo-p{font-size:12.5px;color:rgba(255,255,255,.55);line-height:1.8;margin:0 0 14px}
.sp-seo-p:last-child{margin-bottom:0}
/* ── 비슷한 업체 추천 ── */
.sp-related{padding:0 20px 0;margin-bottom:0}
.sp-related-title{font-size:13px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:7px}
.sp-related-title i{color:var(--pk2)}
.sp-rel-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-rel-card{display:block;text-decoration:none;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);transition:border-color .18s,transform .18s;position:relative}
.sp-rel-card:active{transform:scale(.97);border-color:rgba(232,65,122,.4)}
.sp-rel-thumb{width:100%;aspect-ratio:1;object-fit:cover;display:block}
.sp-rel-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(8,8,14,.92) 100%)}
.sp-rel-info{position:absolute;bottom:0;left:0;right:0;padding:10px 10px 9px}
.sp-rel-name{font-size:12px;font-weight:800;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.sp-rel-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.sp-rel-loc{font-size:10px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:2px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-rel-rating{font-size:10px;color:#F59E0B;font-weight:700;display:flex;align-items:center;gap:2px;flex-shrink:0}
</style>
</head>
<body>
<nav class="sp-nav" itemscope itemtype="https://schema.org/SiteNavigationElement">
  <div class="sp-nav-inner">
    <a href="/" class="sp-nav-logo" itemprop="url"><span itemprop="name">Seoul Beauty Trip</span></a>
    <a href="/" class="sp-nav-back"><i class="fas fa-arrow-left"></i> Catalog</a>
  </div>
</nav>

<div class="sp-hero">
  <img class="sp-hero-img" src="${shop.thumbnail}" alt="${shop.name} ${_catLabel} in ${_areaFinal} Seoul — Best Korean Beauty for Foreigners" itemprop="image" width="800" height="600">
  <div class="sp-hero-ov"></div>
  <div class="sp-hero-info">
    <div class="sp-cat-badge">${catIcon} ${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)} · ${shop.location.split(',')[0].trim()} Seoul</div>
    <h1 class="sp-title" itemprop="name">${shop.name}</h1>
    <div class="sp-subtitle" style="font-size:13px;color:rgba(255,255,255,.65);margin-top:4px;font-weight:500;letter-spacing:.3px">${_catLabel} &middot; ${_areaFinal}, Seoul &middot; English Booking Available</div>
    <div class="sp-loc"><i class="fas fa-map-marker-alt" style="color:var(--pk)"></i><span itemprop="addressLocality">${shop.location}, Seoul</span></div>
    <div style="margin-top:7px;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);border-radius:20px;padding:5px 12px;width:fit-content;cursor:pointer;max-width:90vw;overflow:hidden" onclick="navigator.clipboard&&navigator.clipboard.writeText('${canonicalUrl}').then(function(){var el=document.getElementById('sp-url-copied');if(el){el.style.opacity='1';setTimeout(function(){el.style.opacity='0'},1500)}})">
      <i class="fas fa-link" style="color:rgba(255,255,255,.5);font-size:10px;flex-shrink:0"></i>
      <span style="font-size:11px;color:rgba(255,255,255,.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${canonicalUrl}</span>
      <span id="sp-url-copied" style="font-size:10px;color:#34d399;flex-shrink:0;opacity:0;transition:opacity .3s;margin-left:2px">Copied!</span>
    </div>
    <div class="sp-rating">
      <span class="sp-stars">★★★★★</span>
      <span class="sp-rating-num" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
        <span itemprop="ratingValue">${shop.rating}</span> (<span itemprop="reviewCount">${shop.reviewCount}</span> reviews)
      </span>
    </div>
  </div>
</div>

${(()=>{const allP=[shop.thumbnail,...(shop.photos||[]).filter((p:string)=>p&&p!==shop.thumbnail)];if(allP.length<2)return '';const _altL=['interior and atmosphere','treatment room setup','service area for foreigners','professional staff','entrance and facade','treatment detail shot','relaxing ambiance','reception and waiting area'];const thumbs=allP.map((url:string,i:number)=>{const _cls='sp-gthumb'+(i===0?' active':'');const _lbl=_altL[i]||('photo '+(i+1));const _alt=shop.name+' '+_catLabel+' '+_areaFinal+' Seoul \u2014 '+_lbl;return '<div class="'+_cls+'" onclick="setHero(\''+url+'\',this)"><img src="'+url+'" alt="'+_alt+'" loading="lazy" width="120" height="160"></div>';}).join('');return '<div class="sp-gallery">'+thumbs+'</div>';})()}

<div class="sp-wrap">

  ${(()=>{
    /* ── Address (모달과 동일) ── */
    const addrHtml2 = shop.address
      ? `<div class="sp-addr-row"><i class="fas fa-location-dot"></i><span itemprop="address">${shop.address}</span></div>`
      : '';

    /* ── Info Grid (Area + Rating) ── */
    let infoCards2 = '';
    const locArea2 = shop.location ? shop.location.split(',')[0].trim() : '';
    if(locArea2) infoCards2 += `<div class="sp-ig-card"><div class="sp-ig-label">Area</div><div class="sp-ig-val"><i class="fas fa-map-marker-alt"></i>${locArea2}</div></div>`;
    if(shop.reviewCount && shop.reviewCount > 0) {
      const starsHtml2 = '★'.repeat(Math.min(5,Math.round(Number(shop.rating||5)))) + '☆'.repeat(Math.max(0,5-Math.round(Number(shop.rating||5))));
      infoCards2 += `<div class="sp-ig-card"><div class="sp-ig-label">Rating</div><div class="sp-ig-val"><span class="sp-ig-stars">${starsHtml2}</span>&nbsp;${shop.rating}</div></div>`;
    }
    const infoGridHtml2 = infoCards2 ? `<div class="sp-info-grid">${infoCards2}</div>` : '';

    /* ── Description ── */
    const descHtml2 = shop.description
      ? `<div class="sp-sec"><div class="sp-sec-title">About</div><div class="sp-sec-body" itemprop="description">${shop.description}</div></div>`
      : '';

    /* ── Hours (모달과 동일 방식) ── */
    let hoursHtml2 = '';
    if(shop.hours) {
      const days2 = shop.hours.split(/\s*[\/|]\s*/).map((s:string)=>s.trim()).filter(Boolean);
      const dayNames2 = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const today2 = new Date().getDay();
      if(days2.length > 1) {
        const rows2 = days2.map((line:string)=>{
          const col2 = line.indexOf(':');
          const dayP = col2>-1 ? line.slice(0,col2).trim() : line;
          const timeP = col2>-1 ? line.slice(col2+1).trim() : '';
          const isToday2 = dayNames2[today2] && dayP.toLowerCase().startsWith(dayNames2[today2].toLowerCase());
          const isClosed2 = timeP.toLowerCase().includes('closed');
          return `<tr class="${isToday2?'sp-hours-today':''}"><td class="sp-hours-day">${dayP.slice(0,3).toUpperCase()}</td><td class="sp-hours-time${isClosed2?' closed':''}">${timeP||'Closed'}</td></tr>`;
        }).join('');
        hoursHtml2 = `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div><div class="sp-hours-wrap"><table class="sp-hours-table">${rows2}</table></div></div>`;
      } else {
        hoursHtml2 = `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div><div class="sp-sec-body" itemprop="openingHours">${shop.hours}</div></div>`;
      }
    }

    /* ── Price List ── */
    let priceHtml2 = '';
    if(shop.servicePrices && shop.servicePrices.length > 0) {
      const rows3 = shop.servicePrices.map((p:any)=>`<div class="sp-price-item"><span class="sp-price-name">${p.name}</span><span class="sp-price-val" itemprop="priceRange">${p.price}</span></div>`).join('');
      priceHtml2 = `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Price List</div><div class="sp-price-list">${rows3}</div></div>`;
    } else {
      priceHtml2 = `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Pricing</div><div class="sp-sec-body">Prices vary by treatment &amp; consultation. <span style="color:rgba(255,255,255,.35)">Contact us via WhatsApp below for a free quote.</span></div></div>`;
    }

    /* ── Services ── */
    const svcHtml2 = shop.services && shop.services.length > 0
      ? `<div class="sp-sec"><div class="sp-sec-title">Services</div><div class="sp-svc-tags">${shop.services.map((s:string)=>`<span class="sp-svc-tag">${s}</span>`).join('')}</div></div>`
      : '';

    /* ── Map ── */
    const mapHtml2 = (()=>{
      if(!shop.lat || !shop.lng) return shop.address ? `<div class="sp-sec"><div class="sp-sec-title">Location</div><div class="sp-sec-body"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>${shop.address}</div></div>` : '';
      const mlat2=parseFloat(shop.lat), mlng2=parseFloat(shop.lng), z=16;
      const tx=Math.floor((mlng2+180)/360*Math.pow(2,z)), ty=Math.floor((1-Math.log(Math.tan(mlat2*Math.PI/180)+1/Math.cos(mlat2*Math.PI/180))/Math.PI)/2*Math.pow(2,z));
      const t1=`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`, t2=`https://tile.openstreetmap.org/${z}/${tx+1}/${ty}.png`;
      const gLink=`https://maps.google.com/?q=${mlat2},${mlng2}&hl=en`;
      return `<div class="sp-sec"><div class="sp-sec-title">Location</div><div class="sp-map" style="cursor:pointer;overflow:hidden;position:relative" data-map-url="${gLink}" onclick="openMapUrl(this)"><div style="display:flex;height:100%;filter:saturate(0.8) brightness(0.75)"><img src="${t1}" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy"><img src="${t2}" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><i class="fas fa-map-marker-alt" style="font-size:32px;color:#e8414a;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))"></i></div>${(shop.address||shop.location)?`<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);backdrop-filter:blur(4px);color:#fff;font-size:11px;padding:4px 10px;border-radius:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:88%;pointer-events:none"><i class="fas fa-map-marker-alt" style="margin-right:4px;color:#FF4D8D"></i>${(shop.address||shop.location).trim()}</div>`:""}</div></div>`;
    })();

    return addrHtml2 + infoGridHtml2 + descHtml2 + priceHtml2 + svcHtml2 + hoursHtml2;
  })()}

  ${(()=>{
    /* ── Google Reviews → Map 바로 위 ── */
    const shopReviews2: any[] = shop.reviews || [];
    if(!shopReviews2.length) return '';
    const reviewCards2 = shopReviews2.map((rv:any)=>{
      const rvR = Number(rv.rating)||5;
      const rvStars = '★'.repeat(Math.min(5,Math.max(0,rvR)))+'☆'.repeat(Math.max(0,5-rvR));
      return `<div class="sp-review-card"><div class="sp-review-top"><span class="sp-review-author">${rv.author||'Guest'}</span><span class="sp-review-stars">${rvStars}</span></div><div class="sp-review-text">${rv.text||''}</div>${rv.time?`<div class="sp-review-time">${rv.time}</div>`:''}</div>`;
    }).join('');
    /* ── Map (리뷰 바로 뒤) ── */
    const mapHtml3 = (()=>{
      if(!shop.lat || !shop.lng) return shop.address ? `<div class="sp-sec"><div class="sp-sec-title">Location</div><div class="sp-sec-body"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>${shop.address}</div></div>` : '';
      const mlat3=parseFloat(shop.lat), mlng3=parseFloat(shop.lng), z=16;
      const tx=Math.floor((mlng3+180)/360*Math.pow(2,z)), ty=Math.floor((1-Math.log(Math.tan(mlat3*Math.PI/180)+1/Math.cos(mlat3*Math.PI/180))/Math.PI)/2*Math.pow(2,z));
      const t1=`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`, t2=`https://tile.openstreetmap.org/${z}/${tx+1}/${ty}.png`;
      const gLink=`https://maps.google.com/?q=${mlat3},${mlng3}&hl=en`;
      return `<div class="sp-sec"><div class="sp-sec-title">Location</div><div class="sp-map" style="cursor:pointer;overflow:hidden;position:relative" data-map-url="${gLink}" onclick="openMapUrl(this)"><div style="display:flex;height:100%;filter:saturate(0.8) brightness(0.75)"><img src="${t1}" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy"><img src="${t2}" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none"><i class="fas fa-map-marker-alt" style="font-size:32px;color:#e8414a;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))"></i></div>${(shop.address||shop.location)?`<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);backdrop-filter:blur(4px);color:#fff;font-size:11px;padding:4px 10px;border-radius:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:88%;pointer-events:none"><i class="fas fa-map-marker-alt" style="margin-right:4px;color:#FF4D8D"></i>${(shop.address||shop.location).trim()}</div>`:""}</div></div>`;
    })();

    const reviewsBlock = shopReviews2.length
      ? `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-star" style="color:var(--gold);margin-right:4px"></i>Google Reviews${shop.reviewCount?` <span style="font-size:10px;color:rgba(255,255,255,.35);font-weight:400">(${shop.rating}★ · ${Number(shop.reviewCount).toLocaleString()} reviews)</span>`:''}</div><div class="sp-reviews-wrap">${reviewCards2}</div></div>`
      : '';

    return reviewsBlock + mapHtml3;
  })()}

  ${(()=>{
    if(!shopVideos.length) return '';
    const cardsHtml = shopVideos.map((v:any,vi:number)=>{
      const thumb  = v.thumbnail || '';
      const vidUrl = v.videoUrl  || '';
      let displayTitle = (v.title||'').trim();
      if(!displayTitle || displayTitle===shop.name || /^[a-zA-Z0-9_.~-]{8,}$/.test(displayTitle)) displayTitle = shop.name;
      return '<div class="sp-vid-card" data-vid-url="'+vidUrl+'" data-vid-thumb="'+thumb+'" onclick="playSpVid('+vi+')">'
        +(vidUrl?'<video class="sp-vid-inline" data-src="'+vidUrl+'" poster="'+thumb+'" loop muted playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;display:block"></video>':'')
        +(thumb?'<img class="sp-vid-poster" src="'+thumb+'" alt="'+displayTitle+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;transition:opacity .4s">':'<div class="sp-vid-poster" style="position:absolute;inset:0;background:#111;border-radius:14px"></div>')
        +'<div class="sp-play-ic"><i class="fas fa-play" style="font-size:14px;color:#fff;margin-left:2px"></i></div>'
        +'<div class="sp-vid-card-ov"><div class="sp-vid-card-title">'+displayTitle+'</div></div>'
        +'</div>';
    }).join('');
    const gridClass = shopVideos.length===1 ? 'sp-vid-grid single-vid' : 'sp-vid-grid';
    return '<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-play-circle" style="color:var(--pk);margin-right:4px"></i>Videos <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:400;letter-spacing:0">('+shopVideos.length+')</span></div><div class="'+gridClass+'">'+cardsHtml+'</div></div>';
  })()}

  ${(()=>{
    /* ── Why Choose (AI 생성 bullets) ── */
    const wc: string[] = shop.whyChoose || [];
    if(!wc.length) return '';
    const items = wc.map((b:string)=>`<div class="sp-why-item">${b}</div>`).join('');
    return `<div class="sp-sec"><div class="sp-sec-title"><i class="fas fa-check-circle" style="color:var(--pk);margin-right:4px"></i>Why Choose ${shop.name}</div><div class="sp-why-list">${items}</div></div>`;
  })()}

  ${(()=>{
    /* ── SEO 텍스트 섹션: DB seo_text 우선, 없으면 템플릿 fallback ── */
    if(shop.seoText && shop.seoText.trim()){
      // DB에 &amp; 등 엔티티로 저장된 경우 복원
      let cleanSeo = shop.seoText
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
        .replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&hellip;/g,'…');
      // H2가 없으면 업체명+카테고리+지역 기반 H2 자동 삽입
      if(!cleanSeo.includes('<h2')){
        const _area = (shop.location||'Seoul').split(',')[0].trim();
        const _cat  = shop.category.charAt(0).toUpperCase()+shop.category.slice(1);
        const _areaLabel = _area.toLowerCase().includes('cheongdam')||_area.toLowerCase().includes('apgujeong') ? 'Gangnam' : _area;
        const _catLabel: Record<string,string> = {skincare:'Skincare',makeup:'Makeup',hair:'Hair Salon',nail:'Nail',clinic:'Dermatology Clinic',headspa:'Head Spa',spa:'Spa',tattoo:'Eyebrow Tattoo'};
        const _catName = _catLabel[shop.category] || _cat;
        // p 태그를 H2+p 쌍으로 분리 (3개 p → h2+p, h2+p, h2+p)
        const _paras = cleanSeo.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [];
        const _h2titles = [
          shop.name+' \u2014 '+_catName+' in '+_areaLabel+', Seoul',
          'Foreigner-Friendly '+_catName+' in '+_areaLabel,
          'How to Book '+shop.name+' for Foreign Visitors'
        ];
        if(_paras.length >= 2){
          cleanSeo = _paras.map(function(p, i){
            return '<h2 class="sp-seo-h2">'+(_h2titles[i] || shop.name+' \u2014 '+_catName)+'</h2>'+p;
          }).join('');
        } else {
          cleanSeo = '<h2 class="sp-seo-h2">'+_h2titles[0]+'</h2>'+cleanSeo;
        }
      }
      return '<div class="sp-seo-block">'+cleanSeo+'</div>';
    }
    /* fallback: DB seo_text 없을 때 템플릿 */
    const area3   = (shop.location||'Seoul').split(',')[0].trim();
    const cat3    = shop.category.charAt(0).toUpperCase()+shop.category.slice(1);
    const svcList = shop.services && shop.services.length > 0 ? shop.services.slice(0,4).join(', ') : cat3+' treatments';
    const areaGn  = area3.toLowerCase().includes('cheongdam')||area3.toLowerCase().includes('apgujeong') ? 'Gangnam' : area3;
    const revTxt  = shop.reviewCount > 10 ? ' With '+shop.reviewCount+'+ verified reviews and a '+shop.rating+'-star rating, it' : ' It';

    if(shop.category === 'clinic'){
      const treatments = shop.services && shop.services.length > 0
        ? shop.services.slice(0,6).join(', ')
        : 'laser toning, skin booster injections, RF lifting, acne treatment, chemical peels';
      return '<div class="sp-seo-block">'
        +'<h2 class="sp-seo-h2">'+shop.name+' \u2014 Dermatology Clinic in '+areaGn+', Seoul for Foreigners</h2>'
        +'<p class="sp-seo-p">'+shop.name+' is a foreigner-friendly dermatology clinic located in '+area3+', Seoul.'+revTxt+' is consistently rated as one of the top aesthetic clinics in '+areaGn+' by international patients. The clinic offers English-language consultations, transparent pricing, and easy WhatsApp booking \u2014 everything a foreign visitor needs to get world-class Korean dermatology treatments without the language barrier.</p>'
        +'<h2 class="sp-seo-h2">Treatments Available at '+shop.name+'</h2>'
        +'<p class="sp-seo-p">As a full-service '+areaGn+' dermatology clinic, '+shop.name+' provides a comprehensive range of medical aesthetic treatments popular among foreign patients: '+treatments+'. Korean dermatology clinics like '+shop.name+' use the latest FDA-approved and KFDA-approved equipment, offering results that are often 40\u201360% more affordable than equivalent treatments in the US, UK, or Australia.</p>'
        +'<h2 class="sp-seo-h2">Why Foreign Patients Choose '+shop.name+'</h2>'
        +'<p class="sp-seo-p">For foreigners visiting Seoul, finding a dermatology clinic with English-speaking staff and no hidden fees is the biggest challenge. '+shop.name+' solves this with dedicated English-speaking coordinators, a clear treatment menu with prices listed in advance, and a seamless booking experience via WhatsApp. Whether you are a first-time medical tourist or a returning patient, the team at '+shop.name+' ensures your comfort from initial consultation through aftercare.</p>'
        +'<h2 class="sp-seo-h2">How to Book '+shop.name+' as a Foreigner</h2>'
        +'<p class="sp-seo-p">Booking '+shop.name+' through Seoul Beauty Trip takes under 2 minutes. Simply tap the WhatsApp button above, describe your desired treatment, and our English-speaking team will confirm your appointment, explain pricing, and prepare the clinic for your visit. No Korean language skills needed. Same-day and advance bookings both available.</p>'
        +'</div>';
    }

    return '<div class="sp-seo-block">'
      +'<h2 class="sp-seo-h2">'+shop.name+' \u2014 '+cat3+' in '+area3+', Seoul</h2>'
      +'<p class="sp-seo-p">Looking for the best '+shop.category+' experience in '+area3+', Seoul? '+shop.name+' is a top-rated '+shop.category+' destination welcoming foreign visitors with English-friendly service and easy WhatsApp booking.'+revTxt+' offers an authentic Korean beauty experience tailored for international guests.</p>'
      +'<h2 class="sp-seo-h2">Foreigner-Friendly '+cat3+' in '+area3+'</h2>'
      +'<p class="sp-seo-p">Located in '+area3+', one of the top beauty districts in Seoul, '+shop.name+' specializes in '+svcList+'. The team provides English support throughout your visit \u2014 from consultation to aftercare \u2014 so you can relax and enjoy your treatment without language barriers. Book easily via WhatsApp through Seoul Beauty Trip.</p>'
      +'</div>';
  })()}

  ${relatedShops.length > 0 ? `
  <div class="sp-related">
    <div class="sp-related-title"><i class="fas fa-th-large"></i> More ${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)} in Seoul</div>
    <div class="sp-rel-grid">
      ${relatedShops.map((r: any) => {
        const rArea = (r.location||'').split(',')[0].trim()
        const rRating = r.rating ? `<span class="sp-rel-rating"><i class="fas fa-star" style="font-size:8px"></i>${Number(r.rating).toFixed(1)}</span>` : ''
        const rThumb = r.thumbnail || ''
        const rCatL: Record<string,string> = {clinic:'Clinic',hair:'Hair Salon',headspa:'Head Spa',skincare:'Skincare',makeup:'Makeup',nail:'Nail',spa:'Spa',tattoo:'Eyebrow Tattoo'}
        const rCatLabel = rCatL[r.category] || r.category
        return `<a class="sp-rel-card" href="/shop/${r.slug}">
          ${rThumb ? `<img class="sp-rel-thumb" src="${rThumb}" alt="${r.name} ${rCatLabel} ${rArea} Seoul" loading="lazy">` : `<div class="sp-rel-thumb" style="background:#111"></div>`}
          <div class="sp-rel-ov"></div>
          <div class="sp-rel-info">
            <div class="sp-rel-name">${r.name}</div>
            <div class="sp-rel-meta">
              <span class="sp-rel-loc"><i class="fas fa-map-marker-alt" style="font-size:7px;color:#FF4D8D"></i>${rArea}</span>
              ${rRating}
            </div>
          </div>
        </a>`
      }).join('')}
    </div>
  </div>` : ''}

  <!-- 내부 SEO 링크 세션: 구글이 페이지 주제와 사이트 구조를 파악하도록 돕는 다차원 링크 -->
  <div class="sp-seo-links" style="padding:0 20px 16px;margin-bottom:0">
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px">Explore More in Seoul</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px">
      <a href="/best/${shop.category}/seoul" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11.5px;text-decoration:none" title="Best ${_catLabel} in Seoul for Foreigners"><i class="fas fa-crown" style="color:var(--pk);font-size:9px"></i>Best ${_catLabel} in Seoul</a>
      ${_areaFinal !== 'Seoul' ? `<a href="/best/${shop.category}/${_areaFinal.toLowerCase()}" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11.5px;text-decoration:none" title="Best ${_catLabel} in ${_areaFinal} Seoul"><i class="fas fa-map-marker-alt" style="color:var(--pk2);font-size:9px"></i>Best ${_catLabel} in ${_areaFinal}</a>` : ''}
      <a href="/blog" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11.5px;text-decoration:none" title="Seoul Beauty Blog for Foreigners"><i class="fas fa-book-open" style="color:var(--pk);font-size:9px"></i>Seoul Beauty Guide</a>
      <a href="/blog/category/${shop.category}" style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11.5px;text-decoration:none" title="${_catLabel} Tips for Foreigners in Seoul"><i class="fas fa-feather-alt" style="color:var(--pk2);font-size:9px"></i>${_catLabel} Tips</a>
    </div>
  </div>

  <div style="height:100px"></div>
</div>

<div class="sp-float">
  <a href="${waUrl}" target="_blank" rel="noopener" onclick="if(typeof gtag==='function')gtag('event','whatsapp_click',{event_category:'conversion',event_label:'${shop.name.replace(/'/g,"\\'")}',shop_name:'${shop.name.replace(/'/g,"\\'")}',shop_category:'${shop.category}',page_location:window.location.href})">
    <i class="fab fa-whatsapp" style="font-size:20px"></i> Book via WhatsApp
  </a>
</div>

<script>
// 뒤로가기: 이전 페이지가 같은 사이트면 history.back(), 아니면 메인으로
function goBack(){
  // history가 2개 이상이면 이전 페이지로, 아니면 메인으로
  if(window.history.length > 1){
    window.history.back();
  } else {
    location.href = '/';
  }
}

function setHero(url, el) {
  document.querySelector('.sp-hero-img').src = url;
  document.querySelectorAll('.sp-gthumb').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
}

/* ── sp-vid-card: 페이지 로드 즉시 + 스크롤 진입시 자동재생 (쇼츠/릴스 방식) ── */
(function(){
  function startVid(card){
    var vid = card.querySelector('.sp-vid-inline');
    var poster = card.querySelector('.sp-vid-poster');
    if(!vid) return;
    if(vid.dataset.src && !vid.dataset.loaded){
      vid.dataset.loaded = '1';
      vid.src = vid.dataset.src;
    }
    vid.muted = true;
    var p = vid.play();
    if(p && p.then) p.then(function(){
      card.classList.add('vid-on');
      if(poster) poster.style.opacity = '0';
    }).catch(function(){});
  }
  function stopVid(card){
    var vid = card.querySelector('.sp-vid-inline');
    var poster = card.querySelector('.sp-vid-poster');
    if(vid){ vid.pause(); }
    card.classList.remove('vid-on');
    if(poster) poster.style.opacity = '1';
  }
  function initVidCards(){
    var cards = document.querySelectorAll('.sp-vid-card');
    if(!cards.length) return;
    if(window.IntersectionObserver){
      var obs = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting) startVid(entry.target);
          else stopVid(entry.target);
        });
      },{threshold: 0.2, rootMargin:'0px'});
      cards.forEach(function(c){ obs.observe(c); });
    } else {
      cards.forEach(function(c){ startVid(c); });
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initVidCards);
  } else {
    initVidCards();
  }
})();

// 영상 카드 클릭 → 중앙 모달 (로딩 스피너 + 소리 토글)
var _spVidMuted = false;
function playSpVid(idx){
  var cards = document.querySelectorAll('.sp-vid-card');
  var card  = cards[idx];
  if(!card) return;
  var vidUrl = card.getAttribute('data-vid-url');
  var thumb  = card.getAttribute('data-vid-thumb');
  if(!vidUrl) return;

  var old = document.getElementById('sp-vid-ov');
  if(old) old.remove();

  var ov = document.createElement('div');
  ov.id = 'sp-vid-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';

  var muteIcon = _spVidMuted ? 'fa-volume-mute' : 'fa-volume-up';
  ov.innerHTML =
    '<div style="position:relative;width:min(88vw,360px);max-height:calc(100dvh - 80px);aspect-ratio:9/16">'
    // 닫기 버튼
    +'<button id="sp-vid-ov-close" style="position:absolute;top:-42px;right:0;width:34px;height:34px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:50%;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2">&#10005;</button>'
    // 소리 버튼
    +'<button id="sp-vid-ov-mute" style="position:absolute;top:-42px;left:0;width:34px;height:34px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:50%;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2">'
      +'<i class="fas '+muteIcon+'"></i>'
    +'</button>'
    // 로딩 스피너 (영상 로드 전 표시)
    +'<div id="sp-vid-ov-spin" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;border-radius:18px;background:rgba(0,0,0,.6)">'
      +'<div style="width:36px;height:36px;border:3px solid rgba(255,255,255,.15);border-top-color:#FF4D8D;border-radius:50%;animation:spSpinAnim .7s linear infinite"></div>'
    +'</div>'
    // 영상 (poster로 즉시 표시, src는 JS로 설정)
    +'<video id="sp-vid-ov-video"'+(thumb?' poster="'+thumb+'"':'')
    +' loop playsinline'
    +' style="width:100%;height:100%;border-radius:18px;object-fit:cover;background:#000;display:block"></video>'
    +'</div>';

  // 스피너 애니메이션 CSS (한 번만 추가)
  if(!document.getElementById('sp-spin-style')){
    var st = document.createElement('style');
    st.id = 'sp-spin-style';
    st.textContent = '@keyframes spSpinAnim{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);

  var vid = document.getElementById('sp-vid-ov-video');
  var spin = document.getElementById('sp-vid-ov-spin');

  function _updateMuteBtn(){
    var btn = document.getElementById('sp-vid-ov-mute');
    if(btn) btn.innerHTML = '<i class="fas '+(_spVidMuted?'fa-volume-mute':'fa-volume-up')+'"></i>';
  }

  if(vid){
    vid.muted = _spVidMuted;
    // 로드가 충분히 됐을 때 스피너 숨김
    vid.addEventListener('canplay', function(){
      if(spin) spin.style.display = 'none';
    }, {once:true});
    // 버퍼링 중 다시 스피너 표시
    vid.addEventListener('waiting', function(){
      if(spin) spin.style.display = 'flex';
    });
    vid.addEventListener('playing', function(){
      if(spin) spin.style.display = 'none';
    });
    // src 설정 → 로드 시작
    vid.src = vidUrl;
    vid.play().catch(function(){ vid.muted=true; _spVidMuted=true; _updateMuteBtn(); vid.play().catch(function(){}); });
  }

  document.getElementById('sp-vid-ov-close').addEventListener('click', function(){ ov.remove(); });
  document.getElementById('sp-vid-ov-mute').addEventListener('click', function(e){
    e.stopPropagation();
    _spVidMuted = !_spVidMuted;
    if(vid) vid.muted = _spVidMuted;
    _updateMuteBtn();
  });
}
function openMapUrl(el){
  var u=el.getAttribute('data-map-url');
  if(!u) return;
  var embedUrl=u;
  var qMatch=u.match(/[?&]q=([^&]+)/);
  if(qMatch) embedUrl='https://www.google.com/maps?q='+qMatch[1]+'&hl=en&output=embed';
  var badge=el.querySelector('[style*="bottom:8px"]');
  var title=badge?badge.textContent.trim():'Google Maps';
  var ov=document.getElementById('mapOverlay');
  var frame=document.getElementById('mapOverlayFrame');
  var titleEl=document.getElementById('mapOverlayTitle');
  if(!ov||!frame) return;
  if(titleEl) titleEl.textContent=title;
  frame.src=embedUrl;
  ov.style.display='flex';
  document.body.style.overflow='hidden';
  // GA4: 지도 클릭 이벤트
  if(typeof gtag==='function') gtag('event','map_click',{event_category:'engagement',event_label:title,page_location:window.location.href});
}
function closeMapOverlay(){
  var ov=document.getElementById('mapOverlay');
  var frame=document.getElementById('mapOverlayFrame');
  if(ov){ov.style.display='none';document.body.style.overflow='';}
  if(frame){frame.src='';}
}
</script>
<!-- 구글맵 인앱 오버레이 -->
<div id="mapOverlay" style="display:none;position:fixed;inset:0;z-index:2000;flex-direction:column;background:#000">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#111;border-bottom:1px solid #222;flex-shrink:0">
    <span id="mapOverlayTitle" style="color:#fff;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:10px"></span>
    <button onclick="closeMapOverlay()" style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.12);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&times;</button>
  </div>
  <iframe id="mapOverlayFrame" src="" style="flex:1;border:0;width:100%;display:block" allowfullscreen loading="lazy"></iframe>
</div>
</body>
</html>`)
})

// ══════════════════════════════════════════════════════
// ── /best/:category/:area  카테고리×지역 랜딩 페이지 ──
// ══════════════════════════════════════════════════════
const CATEGORY_LABELS: Record<string,string> = {
  skincare:'Skincare', makeup:'Makeup', hair:'Hair Salon',
  headspa:'Head Spa', nail:'Nail Salon', clinic:'Skin Clinic', spa:'Spa & Massage', tattoo:'Eyebrow Tattoo'
}
const AREA_LABELS: Record<string,string> = {
  gangnam:'Gangnam', hongdae:'Hongdae', itaewon:'Itaewon',
  myeongdong:'Myeongdong', sinchon:'Sinchon', mapo:'Mapo',
  jongno:'Jongno', dongdaemun:'Dongdaemun', insadong:'Insadong',
  apgujeong:'Apgujeong', yeouido:'Yeouido', yongsan:'Yongsan', seoul:'Seoul'
}
const CAT_FAQ: Record<string,{q:string,a:string}[]> = {
  headspa:[
    {q:'What is a Korean head spa?',a:'A Korean head spa is a therapeutic scalp and hair treatment combining deep cleansing, massage, and nourishing treatments. It relieves stress, improves scalp health, and promotes hair growth — popular among tourists in Seoul.'},
    {q:'How much does a head spa cost in Seoul?',a:'Head spa prices in Seoul typically range from ₩50,000 to ₩150,000 depending on the salon and treatment duration. Most sessions last 60–90 minutes.'},
    {q:'Do Seoul head spas have English-speaking staff?',a:'Many head spas in tourist areas like Gangnam, Hongdae, and Itaewon have English-speaking staff or translation support. Seoul Beauty Trip only lists foreigner-friendly salons.'},
    {q:'Do I need to book a head spa in Seoul in advance?',a:'Yes, booking in advance is strongly recommended, especially on weekends. You can book via WhatsApp through Seoul Beauty Trip with English support.'},
    {q:'What should I expect at a Korean head spa?',a:'Expect a consultation, scalp analysis, deep cleansing shampoo, relaxing massage, and nourishing treatment. Some salons also include a facial massage or aromatherapy.'}
  ],
  skincare:[
    {q:'What makes Korean skincare treatments special?',a:'Korean skincare focuses on hydration, brightening, and glass-skin techniques using advanced ingredients like snail mucin, hyaluronic acid, and fermented extracts — not commonly found elsewhere.'},
    {q:'How much do Korean facial treatments cost in Seoul?',a:'Facial treatments in Seoul range from ₩50,000 to ₩300,000. Basic hydrafacials start around ₩80,000 while advanced treatments like laser or RF cost more.'},
    {q:'Are Seoul skin clinics safe for foreigners?',a:'Yes. Seoul skin clinics are among the most advanced in the world with certified dermatologists. Seoul Beauty Trip lists only foreigner-friendly clinics with English support.'},
    {q:'Can I walk in or do I need a reservation?',a:'Reservations are recommended to avoid waiting. Book via WhatsApp through Seoul Beauty Trip for same-day or advance appointments with English support.'},
    {q:'What skin treatments are most popular among tourists in Seoul?',a:'Hydrafacial, LED therapy, glass skin facial, galvanic treatment, and Korean lymphatic massage are the most popular among foreign tourists.'}
  ],
  hair:[
    {q:'Are Seoul hair salons experienced with non-Asian hair?',a:'Many hair salons in Seoul, especially in Gangnam and Itaewon, have stylists trained for various hair textures including Western, curly, and colored hair. Always inform the salon beforehand.'},
    {q:'How much does a haircut cost in Seoul?',a:'A basic haircut in Seoul ranges from ₩20,000 to ₩80,000. Korean perms, balayage, and color treatments range from ₩80,000 to ₩300,000+ depending on length.'},
    {q:'Can I get a K-pop hairstyle in Seoul?',a:'Absolutely! Many Seoul hair salons specialize in K-pop inspired hairstyles including perms, bleaching, and trendy cuts seen on Korean celebrities.'},
    {q:'Do Seoul hair salons speak English?',a:'Tourist-area salons in Gangnam, Hongdae, and Itaewon often have English-speaking staff. Seoul Beauty Trip lists only English-friendly salons for foreign visitors.'},
    {q:'How long does a hair appointment take in Seoul?',a:'A basic cut takes 30–60 minutes. Color treatments and perms can take 2–4 hours. Book in advance especially on weekends.'}
  ],
  nail:[
    {q:'What is Korean nail art?',a:'Korean nail art features intricate designs, minimalist aesthetics, and high-quality gel applications. Popular styles include gradient nails, 3D nail art, and character-themed designs.'},
    {q:'How much does a nail appointment cost in Seoul?',a:'Basic gel manicures start from ₩30,000. Full nail art designs range from ₩50,000 to ₩150,000 depending on complexity and salon.'},
    {q:'How long does a nail appointment take in Seoul?',a:'A simple gel manicure takes about 1 hour. Full nail art with intricate designs can take 2–3 hours.'},
    {q:'Do I need to book a nail salon in Seoul in advance?',a:'Weekend bookings should be made 2–3 days in advance. Weekday slots are more flexible. Book via WhatsApp through Seoul Beauty Trip.'},
    {q:'Are Korean nail salons foreigner-friendly?',a:'Many nail salons in tourist areas have English menus and picture references so you can easily show the design you want.'}
  ],
  clinic:[
    {q:'What is a Gangnam dermatology clinic?',a:'A Gangnam dermatology clinic is a medical aesthetic center in Seoul\'s Gangnam district staffed by board-certified Korean dermatologists. Unlike regular beauty salons, these clinics perform medical-grade treatments including laser resurfacing, Botox, dermal fillers, RF lifting, skin booster injections, and prescription skincare — all at prices typically 40–60% lower than equivalent treatments in Western countries.'},
    {q:'Are Gangnam dermatology clinics foreigner-friendly?',a:'Yes. Most top-tier Gangnam dermatology clinics have English-speaking coordinators specifically for foreign patients. They provide consultations in English, transparent pricing in USD or KRW, and accommodate WhatsApp bookings from abroad. Seoul Beauty Trip only lists clinics with verified English support.'},
    {q:'How much does a Gangnam dermatology clinic cost?',a:'Treatment prices at a Gangnam dermatology clinic vary: laser toning (₩50,000–₩150,000), skin booster injections like Rejuran or Juvelook (₩150,000–₩400,000), RF lifting/Thermage (₩300,000–₩800,000), Botox (₩50,000–₩200,000 per area), and acne scar laser (₩100,000–₩500,000). Compared to the US or UK, these prices are 40–60% cheaper for the same quality.'},
    {q:'What treatments can I get at a Gangnam dermatology clinic as a foreigner?',a:'Popular treatments for foreign visitors at Gangnam dermatology clinics include: laser toning for pigmentation, skin booster injections (Rejuran, Juvelook, Skinbooster), Botox and dermal fillers, RF lifting (Thermage, HIFU/Ulthera), acne and acne scar laser treatment, chemical peels, and LED phototherapy. Most clinics offer same-day consultations for tourists.'},
    {q:'Do I need to book a Gangnam dermatology clinic in advance?',a:'For laser and injection treatments, booking 1–3 days in advance is recommended. Walk-ins are sometimes accepted for basic consultations. Through Seoul Beauty Trip, you can book any Gangnam dermatology clinic via WhatsApp in English — no Korean language skills needed.'},
    {q:'Is it safe to get dermatology treatments in Gangnam as a tourist?',a:'Yes. Korean dermatologists are among the most trained in the world — Korea has the highest rate of cosmetic procedures per capita globally. Gangnam dermatology clinics use FDA-approved and KFDA-approved equipment and products. Always disclose your medical history and current medications during the consultation.'}
  ],
  makeup:[
    {q:'What is a Korean makeup look?',a:'Korean makeup emphasizes natural, dewy skin, gradient lips, straight eyebrows, and a youthful glow. It differs from Western makeup by focusing on skin texture over heavy coverage.'},
    {q:'Can I get a Korean makeup lesson in Seoul?',a:'Yes! Many makeup studios in Seoul offer tutorial sessions for tourists where you learn Korean makeup techniques and take home product recommendations.'},
    {q:'How much does a makeup session cost in Seoul?',a:'Professional makeup applications range from ₩50,000 to ₩150,000. Makeup lessons with a Korean artist typically cost ₩80,000 to ₩200,000.'},
    {q:'What occasions are Korean makeup services popular for?',a:'Korean makeup studios are popular for photoshoots, hanbok experiences, K-pop lookbooks, weddings, and just as a unique cultural experience in Seoul.'},
    {q:'Do Seoul makeup artists speak English?',a:'Many makeup studios in Hongdae, Myeongdong, and Gangnam cater to foreign tourists and have English-speaking artists or booking support.'}
  ],
  spa:[
    {q:'What types of spa treatments are available in Seoul?',a:'Seoul spas offer traditional Korean body scrub (Italy towel exfoliation), aromatherapy massage, hot stone therapy, traditional Korean jjimjilbang experience, and luxurious body wraps.'},
    {q:'What is a Korean body scrub?',a:'The Korean body scrub (때밀이, ddaemiri) is a traditional exfoliation using a special Italy towel. It removes dead skin cells leaving skin remarkably smooth and is a uniquely Korean experience.'},
    {q:'How much does a Korean spa cost in Seoul?',a:'Basic spa treatments start from ₩50,000. Premium body treatments and full spa packages range from ₩100,000 to ₩300,000.'},
    {q:'Are Seoul spas open to foreigners?',a:'Yes, most Seoul spas welcome foreigners. Seoul Beauty Trip lists spas with English booking support and foreigner-friendly service.'},
    {q:'Should I book a spa in Seoul in advance?',a:'Yes, especially for weekend visits. Premium time slots fill quickly. Book via WhatsApp through Seoul Beauty Trip for easy English reservations.'}
  ],
  tattoo:[
    {q:'What is eyebrow microblading in Korea?',a:'Korean eyebrow microblading (눈썹 반영구) is a semi-permanent tattooing technique that creates hair-stroke-like marks to define, reshape, and fill in eyebrows. Korea is globally recognized for its advanced microblading artistry, producing ultra-natural results that can last 1–2 years.'},
    {q:'How much does eyebrow microblading cost in Seoul?',a:'Eyebrow microblading in Seoul typically costs ₩150,000–₩400,000 depending on the studio and technique (hairstroke, powder brow, or combo brow). This is significantly more affordable than Western countries where the same treatment can cost $500–$1,000+.'},
    {q:'Is Korean microblading safe for foreigners?',a:'Yes. Korean eyebrow tattoo studios are licensed, use single-use sterile needles, and follow strict hygiene protocols. Seoul Beauty Trip only lists studios verified for foreign visitors with English support and transparent aftercare guidance.'},
    {q:'How long does eyebrow microblading last in Korea?',a:'Korean microblading typically lasts 12–18 months before a touch-up is needed. Powder brow techniques can last up to 2 years. Longevity depends on skin type, sun exposure, and aftercare.'},
    {q:'Can men get eyebrow microblading in Seoul?',a:'Absolutely. Men\'s eyebrow tattooing is a growing trend in Korea. Studios like INOUTE specialize in natural-looking men\'s eyebrow microblading, creating fuller, defined brows without an obvious "tattooed" appearance.'},
    {q:'Do I need to book an eyebrow tattoo appointment in Seoul in advance?',a:'Yes, booking 1–3 days in advance is recommended. Popular studios can be fully booked on weekends. Book via WhatsApp through Seoul Beauty Trip for easy English-language reservations.'}
  ]
}
const DEFAULT_FAQ = [
  {q:'How do I book a beauty salon in Seoul as a foreigner?',a:'Seoul Beauty Trip makes it easy — browse shops, choose your service, and book via WhatsApp in English. No Korean language skills needed.'},
  {q:'Are these salons English-friendly?',a:'Yes, all salons listed on Seoul Beauty Trip are verified to support foreign visitors with English communication for bookings.'},
  {q:'How far in advance should I book?',a:'1–3 days in advance is recommended. Same-day bookings are sometimes available on weekdays.'},
  {q:'What payment methods are accepted?',a:'Most salons accept credit cards and cash (Korean Won). Some also accept international cards like Visa and Mastercard.'},
  {q:'Can I cancel or reschedule my booking?',a:'Yes. Contact us via WhatsApp and we will help reschedule or cancel depending on the salon\'s policy.'}
]

// ── /video/:id — Google VideoObject embedUrl 전용 보기 페이지 ──
app.get('/video/:id', async (c) => {
  const sql = getDb(c.env)
  const vid = c.req.param('id')
  const rows = await sql`
    SELECT v.*, s.name as shop_name, s.slug as shop_slug,
           s.category as shop_cat, s.location as shop_loc,
           s.thumbnail as shop_thumb, s.google_map_url as shop_map
    FROM videos v LEFT JOIN shops s ON v.shop_id=s.id
    WHERE v.id=${vid}` as any[]
  if (!rows.length) return c.notFound()
  const r = rows[0]
  const video = rowToVideo({ ...r, shop_name: r.shop_name })
  const base = 'https://seoulbeautytrip.com'
  const pageUrl = `${base}/video/${vid}`
  // 썸네일: DB thumb → Cloudinary 자동(so_0 JPG) → shop thumb(https만) → OG cover
  const autoThumb = video.videoUrl && video.videoUrl.includes('cloudinary.com')
    ? video.videoUrl.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace(/\.mp4$/, '.jpg')
    : ''
  const shopThumbAbs = r.shop_thumb && String(r.shop_thumb).startsWith('http') ? r.shop_thumb : ''
  const thumb = (video.thumbnail && video.thumbnail.startsWith('http') ? video.thumbnail : '')
    || autoThumb
    || shopThumbAbs
    || `https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg`
  const ogThumb = thumb.startsWith('http') ? thumb : `${base}${thumb}`
  const shopName = r.shop_name || 'Seoul Beauty'
  const title = video.title || `${shopName} Beauty Video`
  const desc = video.description || `Watch ${shopName} beauty treatments and services in Seoul. Book via WhatsApp.`
  const uploadDate = video.createdAt
    ? (video.createdAt.includes('T') ? video.createdAt : video.createdAt + 'T00:00:00+09:00')
    : new Date().toISOString()
  // 저화질 스트리밍 URL
  const streamUrl = video.videoUrl
    ? video.videoUrl.replace('/video/upload/', '/video/upload/q_auto:low,vc_auto,br_800k/')
    : ''
  // 업체 페이지 링크
  const shopUrl = r.shop_slug ? `${base}/shop/${r.shop_slug}` : `${base}/`
  // VideoObject JSON-LD (이 페이지가 embedUrl의 실제 대상)
  // ⚠️ contentUrl(mp4 직접링크) 제거 — Google이 이를 별도 "동영상 URL"로 인식해 21개 URL 오류 발생
  // embedUrl만 유지: 이 페이지 자체가 동영상의 전용 보기 페이지
  const videoLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    'name': title,
    'description': desc,
    'thumbnailUrl': ogThumb,
    'uploadDate': uploadDate,
    'embedUrl': pageUrl,
    'duration': 'PT30S',
    'publisher': {
      '@type': 'Organization',
      'name': 'Seoul Beauty Trip',
      'url': base,
      'logo': { '@type': 'ImageObject', 'url': `https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg` }
    }
  }
  const ldJson = JSON.stringify(videoLd).replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--')
  const waMsg = encodeURIComponent(`[ Booking Request ]\nShop: ${shopName}${r.shop_loc ? ' ('+r.shop_loc.split(',')[0].trim()+')' : ''}\n\nDate: \nTime: \nService: \nName: \nPeople: `)
  const waUrl = `https://wa.me/${PLATFORM.whatsapp}?text=${waMsg}`
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Seoul Beauty Trip</title>
<meta name="description" content="${desc.slice(0,155)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${title} | Seoul Beauty Trip">
<meta property="og:description" content="${desc.slice(0,155)}">
<meta property="og:image" content="${ogThumb}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title} | Seoul Beauty Trip">
<meta name="twitter:description" content="${desc.slice(0,155)}">
<meta name="twitter:image" content="${ogThumb}">
<script type="application/ld+json">${ldJson}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100%;overflow:hidden}
/* ── full-viewport video player: Google이 "동영상이 주요 콘텐츠"로 인식하게 함 ── */
#player-page{position:fixed;inset:0;display:flex;flex-direction:column;background:#000}
#vid-container{position:relative;flex:1;overflow:hidden;background:#000}
#mainVid{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;cursor:pointer}
#vid-poster{position:absolute;inset:0;background-size:cover;background-position:center;background-color:#000;pointer-events:none}
#play-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:rgba(0,0,0,.55);border:2.5px solid rgba(255,255,255,.45);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(6px);transition:opacity .2s}
#play-btn svg{fill:#fff;margin-left:5px}
/* 하단 오버레이: 영상 위에 반투명으로 올림 */
#bottom-overlay{position:absolute;bottom:0;left:0;right:0;padding:0 16px 20px;background:linear-gradient(transparent,rgba(0,0,0,.85) 40%);pointer-events:none}
#bottom-overlay .info{pointer-events:auto}
.shop-nm{font-size:16px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:2px;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.shop-lc{font-size:13px;color:rgba(255,255,255,.7);margin-bottom:10px;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.vid-ttl{font-size:13px;color:rgba(255,255,255,.85);line-height:1.45;margin-bottom:12px;text-shadow:0 1px 3px rgba(0,0,0,.8)}
.act-row{display:flex;gap:8px;margin-bottom:8px}
.btn-wa{flex:1;background:#25D366;color:#fff;border:none;border-radius:12px;padding:12px 10px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.btn-sh{flex:0 0 auto;background:rgba(255,255,255,.1);color:#FF4D8D;border:1px solid rgba(255,77,141,.5);border-radius:12px;padding:12px 14px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;backdrop-filter:blur(4px)}
/* 상단 back bar */
#top-bar{position:absolute;top:0;left:0;right:0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(rgba(0,0,0,.6),transparent);z-index:10;pointer-events:auto}
#top-bar a{color:#FF4D8D;text-decoration:none;font-size:14px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.8)}
#top-bar span{font-size:12px;color:rgba(255,255,255,.6);text-shadow:0 1px 3px rgba(0,0,0,.8)}
</style>
</head>
<body>
<div id="player-page">
  <div id="vid-container">
    <!-- 썸네일 포스터 -->
    <div id="vid-poster" style="background-image:url('${ogThumb}')"></div>
    <!-- primary video element: Google이 이 페이지의 주요 콘텐츠로 인식 -->
    <video id="mainVid" loop playsinline preload="metadata"
      poster="${ogThumb}"
      src="${streamUrl}"
    ></video>
    <!-- 상단 back bar -->
    <div id="top-bar">
      <a href="/">← Seoul Beauty Trip</a>
      <span>Beauty Video</span>
    </div>
    <!-- 재생 버튼 -->
    <div id="play-btn" onclick="togglePlay()">
      <svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </div>
    <!-- 하단 정보 오버레이 -->
    <div id="bottom-overlay">
      <div class="info">
        ${r.shop_name ? `<div class="shop-nm">${r.shop_name}</div>` : ''}
        ${r.shop_loc ? `<div class="shop-lc">📍 ${r.shop_loc.split(',')[0].trim()}, Seoul</div>` : ''}
        ${video.title ? `<div class="vid-ttl">${video.title}</div>` : ''}
        <div class="act-row">
          <a class="btn-wa" href="${waUrl}" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Book via WhatsApp
          </a>
          ${r.shop_slug ? `<a class="btn-sh" href="${shopUrl}">🏪 Shop</a>` : ''}
        </div>
      </div>
    </div>
  </div>
</div>
<script>
var vid = document.getElementById('mainVid');
var playBtn = document.getElementById('play-btn');
var poster = document.getElementById('vid-poster');
var playing = false;
function togglePlay(){
  if(!playing){
    vid.play().then(function(){
      playing=true;
      if(poster) poster.style.display='none';
      playBtn.style.display='none';
    }).catch(function(){
      vid.muted=true;
      vid.play().then(function(){
        playing=true;
        if(poster) poster.style.display='none';
        playBtn.style.display='none';
      }).catch(function(){});
    });
  } else {
    vid.pause();
    playing=false;
    playBtn.style.display='flex';
  }
}
vid.addEventListener('click', togglePlay);
vid.addEventListener('ended', function(){
  playing=false;
  playBtn.style.display='flex';
  if(poster){ poster.style.display='block'; }
});
// 조회수 카운트
fetch('/api/videos/${vid}/view',{method:'POST'}).catch(function(){});
</script>
</body>
</html>`)
})

app.get('/best/:category/:area', async (c) => {
  const catSlug  = c.req.param('category').toLowerCase()
  const areaSlug = c.req.param('area').toLowerCase()
  const catLabel  = CATEGORY_LABELS[catSlug]
  const areaLabel = AREA_LABELS[areaSlug]
  // 유효하지 않은 카테고리/지역이면 404
  if (!catLabel || !areaLabel) return c.notFound()

  const sql = getDb(c.env)
  const base = 'https://seoulbeautytrip.com'
  const pageUrl = `${base}/best/${catSlug}/${areaSlug}`
  const areaForQuery = areaLabel  // DB location 컬럼 매칭용

  // 해당 카테고리+지역 업체 조회
  let shops: Shop[] = []
  let fallbackArea = false
  try {
    const rows = areaSlug === 'seoul'
      ? await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} ORDER BY rating DESC, review_count DESC LIMIT 10`
      : await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} AND LOWER(location) LIKE ${('%'+areaLabel+'%').toLowerCase()} ORDER BY rating DESC, review_count DESC LIMIT 10`
    shops = rows.map(rowToShop)
  } catch(e) {}

  // seoul 범위인 경우 전체 fallback 시도
  if (shops.length === 0 && areaSlug === 'seoul') {
    try {
      const rows = await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} ORDER BY rating DESC, review_count DESC LIMIT 10`
      shops = rows.map(rowToShop)
      fallbackArea = true
    } catch(e) {}
  }

  // 업체 없는 경우 → Coming Soon 페이지 렌더링 (301 redirect 제거 — 지역별 canonical 유지)
  if (shops.length === 0) {
    const _base = 'https://seoulbeautytrip.com'
    // 같은 카테고리에서 업체 있는 다른 지역 링크 모아주기
    const availableAreaLinks = Object.entries(AREA_LABELS)
      .filter(([k]) => k !== areaSlug)
      .map(([k,v]) => `<a href="/best/${catSlug}/${k}" style="display:inline-block;padding:8px 16px;margin:4px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:20px;color:rgba(255,255,255,.8);text-decoration:none;font-size:13px;">${v}</a>`)
      .join('')
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best ${catLabel} in ${areaLabel} Seoul — Coming Soon | Seoul Beauty Trip</title>
<meta name="description" content="We are curating the best ${catLabel.toLowerCase()} in ${areaLabel}, Seoul for foreign visitors. Check back soon or explore other areas.">
<link rel="canonical" href="${_base}/best/${catSlug}/${areaSlug}">
<meta property="og:title" content="Best ${catLabel} in ${areaLabel} Seoul | Seoul Beauty Trip">
<meta property="og:description" content="Coming soon — top-rated ${catLabel.toLowerCase()} in ${areaLabel}, Seoul for foreigners.">
<meta name="robots" content="index,follow">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f0f12;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center}
.cs-icon{font-size:56px;margin-bottom:20px}
.cs-title{font-size:24px;font-weight:800;margin-bottom:12px;background:linear-gradient(135deg,#e8417a,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.cs-sub{font-size:14px;color:rgba(255,255,255,.55);line-height:1.7;max-width:400px;margin-bottom:32px}
.cs-areas{margin-bottom:32px}
.cs-areas-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}
.cs-back{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:linear-gradient(135deg,#e8417a,#f97316);border-radius:24px;color:#fff;text-decoration:none;font-size:14px;font-weight:700}
</style>
</head>
<body>
<div class="cs-icon">✨</div>
<h1 class="cs-title">Best ${catLabel} in ${areaLabel}, Seoul</h1>
<p class="cs-sub">We're currently curating the best foreigner-friendly ${catLabel.toLowerCase()} options in ${areaLabel}. Check back soon — or explore ${catLabel} in other areas of Seoul below.</p>
<div class="cs-areas">
  <div class="cs-areas-label">Explore ${catLabel} in other areas</div>
  ${availableAreaLinks}
</div>
<a href="/" class="cs-back">← Back to Seoul Beauty Catalog</a>
</body>
</html>`, 200)
  }

  const faqList = CAT_FAQ[catSlug] || DEFAULT_FAQ
  const yr = new Date().getFullYear()
  // clinic+gangnam 조합은 "Gangnam Dermatology Clinic" 키워드 타깃
  const isClinicGangnam = catSlug === 'clinic' && areaSlug === 'gangnam'
  // headspa+myeongdong 조합은 "Korean Head Spa Myeongdong" 키워드 타깃
  const isHeadSpaMyeongdong = catSlug === 'headspa' && areaSlug === 'myeongdong'
  const titleMain   = isClinicGangnam
    ? `Best Gangnam Dermatology Clinic for Foreigners ${yr} | Seoul Beauty Trip`
    : isHeadSpaMyeongdong
    ? `Best Korean Head Spa in Myeongdong Seoul ${yr} | Seoul Beauty Trip`
    : `Best ${catLabel} in ${areaLabel} Seoul for Foreigners ${yr}`
  const metaDesc    = isClinicGangnam
    ? `Top-rated Gangnam dermatology clinic guide for foreigners ${yr}. English-speaking dermatologists, transparent pricing, WhatsApp booking. Laser, RF, skin booster & more.`
    : isHeadSpaMyeongdong
    ? `Best Korean head spa in Myeongdong Seoul ${yr}. Viral 18-step scalp treatment, foreigner-friendly with English booking. Prices, tips & honest guide for tourists.`
    : `Best ${catLabel.toLowerCase()} in ${areaLabel}, Seoul ${yr}. Top-rated, foreigner-friendly salons with English support & WhatsApp booking. Real reviews, verified prices.`
  const h1Text      = isClinicGangnam
    ? `Best Gangnam Dermatology Clinic for Foreigners ${yr}`
    : isHeadSpaMyeongdong
    ? `Best Korean Head Spa in Myeongdong, Seoul ${yr}`
    : `Best ${catLabel} in ${areaLabel}, Seoul ${yr}`
  const subText     = isClinicGangnam
    ? `English-Speaking Dermatologists · Verified Clinics · WhatsApp Booking · Updated ${yr}`
    : isHeadSpaMyeongdong
    ? `Viral 18-Step Scalp Ritual · English Booking · Verified Salons · Updated ${yr}`
    : `Foreigner-Friendly · English Booking · Verified Reviews · Updated ${yr}`
  // 카테고리별 인트로 텍스트 (SEO 롱폼)
  const catIntros: Record<string,string> = {
    headspa: isHeadSpaMyeongdong
      ? `Myeongdong is the most tourist-friendly neighbourhood in Seoul — and its head spa scene is perfectly designed for first-time foreign visitors. You can walk in off the street, communicate in English, and walk out with the most relaxing scalp treatment of your life. The <strong>Korean head spa Myeongdong</strong> experience typically includes a thorough scalp analysis, multi-step deep cleanse, pressure-point massage, and nourishing treatment mask — all performed in a reclining chair in a serene, spa-like environment. No Korean required. No awkward navigation. Just 60–90 minutes of pure relaxation in the heart of Seoul.`
      : `Seoul's head spa scene has exploded in popularity among foreign travelers, and ${areaLabel} is home to some of the best. These foreigner-friendly head spas offer English booking, transparent pricing, and authentic Korean scalp treatments — from the viral 18-step scalp ritual to deep-cleansing scalp analysis and relaxing massage. Whether you have hair loss concerns, a dry scalp, or simply want the most relaxing experience of your Seoul trip, these ${areaLabel} head spas welcome international guests with open arms.`,
    skincare: `Korean skincare treatments in ${areaLabel}, Seoul are world-renowned for their innovation and results. Foreign tourists visiting Seoul consistently rate skin clinics and beauty salons in ${areaLabel} as must-visit experiences. From hydrating glass-skin facials and LED therapy to customized prescription skincare, these foreigner-friendly salons offer English consultations and WhatsApp booking to make your experience seamless.`,
    hair: `${areaLabel} is one of Seoul's top destinations for Korean hair transformations. From K-pop inspired cuts and colors to balayage, Korean perms, and treatment packages, these English-friendly hair salons cater specifically to international visitors. All salons listed are experienced with various hair textures and provide English support throughout.`,
    nail: `Korean nail art in ${areaLabel} is a world-class experience. These foreigner-friendly nail salons offer intricate K-beauty nail designs, premium gel applications, and English-speaking nail artists. Whether you want minimalist Korean aesthetics or elaborate 3D nail art, ${areaLabel}'s nail scene has something for every visitor.`,
    clinic: isClinicGangnam
      ? `Gangnam is Seoul's undisputed capital of medical aesthetics — and home to Korea's most foreigner-friendly dermatology clinics. A Gangnam dermatology clinic isn't just a skin clinic: it's a full-service medical aesthetic center staffed by board-certified dermatologists who routinely treat international patients. Whether you're looking for laser resurfacing, skin booster injections, acne scar treatment, RF lifting, or a simple brightening facial, Gangnam dermatology clinics offer world-class results at a fraction of Western prices — typically 40–60% less than equivalent treatments in the US, UK, or Australia. Every clinic on this list has English-speaking coordinators, transparent pricing, and accepts WhatsApp bookings for foreign visitors.`
      : `${areaLabel} is Seoul's medical beauty hub, home to top-tier dermatology clinics and aesthetic centers welcoming foreign patients. From laser toning and skin boosters to RF lifting and acne treatments, these clinics offer cutting-edge technology at competitive prices — often 30-50% less than Western countries — with English-speaking consultants.`,
    makeup: `Experience a Korean makeup transformation in ${areaLabel}. These English-friendly makeup studios specialize in K-beauty looks including glass skin, gradient lips, and K-pop inspired styles. Perfect for photoshoots, hanbok experiences, or just a memorable Seoul beauty experience. All studios offer English booking via WhatsApp.`,
    spa: `Discover authentic Korean spa treatments in ${areaLabel}, Seoul. From traditional Korean body scrubs (때밀이) and aromatherapy massage to modern wellness packages, these foreigner-friendly spas deliver true Korean relaxation. All listed spas support English booking and welcome international guests.`,
    tattoo: `Korean eyebrow tattooing (눈썹 반영구) in ${areaLabel}, Seoul is globally acclaimed for its ultra-natural, hair-stroke precision. Unlike traditional heavy tattooing, Korean microblading and powder brow techniques create results so natural that people around you simply think you were born with perfect eyebrows — not that you had a procedure. Studios in Seoul use single-use sterile needles, FDA-approved pigments, and follow strict hygiene protocols. Whether you prefer the hairline stroke technique for the most natural look, the soft powder brow for a defined finish, or a combo brow for depth and texture, ${areaLabel} studios listed here welcome foreign visitors with English-language consultations and easy WhatsApp booking. Men's eyebrow tattooing is also a growing specialty — Korean studios understand how to design brows that look completely natural on male faces. Prices are 40–60% lower than equivalent studios in the US, UK, or Australia.`
  }
  const introText = catIntros[catSlug] || `Discover the best ${catLabel.toLowerCase()} experiences in ${areaLabel}, Seoul. All salons are foreigner-friendly with English booking support via WhatsApp. Browse top-rated options below.`
  const catEmoji: Record<string,string> = {skincare:'🌿',makeup:'💋',hair:'💇',headspa:'🧖',nail:'💅',clinic:'🏥',spa:'🛁',tattoo:'✒️'}
  const emoji = catEmoji[catSlug] || '✨'

  // Schema.org JSON-LD
  const schemaGraph = [
    // WebPage
    {
      '@type':'WebPage',
      '@id':`${pageUrl}#webpage`,
      'url':pageUrl,
      'name':titleMain,
      'description':metaDesc,
      'inLanguage':'en',
      'isPartOf':{'@id':`${base}/#website`}
    },
    // BreadcrumbList
    {
      '@type':'BreadcrumbList',
      'itemListElement':[
        {'@type':'ListItem','position':1,'name':'Seoul Beauty Trip','item':`${base}/`},
        {'@type':'ListItem','position':2,'name':catLabel,'item':`${base}/?cat=${catSlug}`},
        {'@type':'ListItem','position':3,'name':`${catLabel} ${areaLabel}`,'item':pageUrl}
      ]
    },
    // ItemList — 업체 목록
    ...(shops.length > 0 ? [{
      '@type':'ItemList',
      'name':`Best ${catLabel} in ${areaLabel} Seoul`,
      'description':metaDesc,
      'numberOfItems':shops.length,
      'itemListElement': shops.map((s,i) => ({
        '@type':'ListItem',
        'position':i+1,
        'item':{
          '@type':['LocalBusiness','BeautySalon'],
          '@id':`${base}/shop/${s.slug}`,
          'name':s.name,
          'url':`${base}/shop/${s.slug}`,
          ...(s.thumbnail && s.thumbnail.startsWith('http') ? {
            'image':{
              '@type':'ImageObject',
              'url':s.thumbnail,
              'thumbnailUrl':s.thumbnail
            }
          } : {}),
          'address':{
            '@type':'PostalAddress',
            'streetAddress':s.address,
            'addressLocality':areaLabel,
            'addressRegion':'Seoul',
            'addressCountry':'KR'
          },
          ...(s.lat && s.lng ? {'geo':{'@type':'GeoCoordinates','latitude':s.lat,'longitude':s.lng}} : {}),
          'aggregateRating':{
            '@type':'AggregateRating',
            'ratingValue':String(s.rating),
            'bestRating':'5',
            'reviewCount':String(Math.max(s.reviewCount,1))
          },
          'priceRange':s.priceRange,
          ...(s.googlePlaceId ? {'sameAs':[`https://www.google.com/maps/place/?q=place_id:${s.googlePlaceId}`]} : {})
        }
      }))
    }] : []),
    // FAQPage
    {
      '@type':'FAQPage',
      'mainEntity': faqList.map(f => ({
        '@type':'Question',
        'name':f.q,
        'acceptedAnswer':{'@type':'Answer','text':f.a}
      }))
    }
  ]

  const shopCards = shops.length > 0
    ? shops.map((s,i) => {
        const stars = '⭐'.repeat(Math.round(s.rating))
        // 200자로 확장 — metaDescription 우선, 없으면 description
        const desc = (s.metaDescription || s.description || '').slice(0,200)
        // 첫 번째 Google 리뷰 발췌 (있을 경우)
        const firstReview = Array.isArray(s.googleReviews) && s.googleReviews.length > 0
          ? s.googleReviews[0] : null
        const reviewQuote = firstReview && firstReview.text
          ? `<div class="card-review-quote">&ldquo;${firstReview.text.slice(0,100)}${firstReview.text.length>100?'…':''}&rdquo;<span class="card-review-author"> — ${firstReview.author||'Guest'}</span></div>`
          : ''
        return `
<article class="shop-card" itemscope itemtype="https://schema.org/LocalBusiness">
  <a href="/shop/${s.slug}" class="card-link">
    <div class="card-rank">#${i+1}</div>
    <div class="card-img-wrap">
      <img src="${s.thumbnail}" alt="${s.name} ${catLabel} ${areaLabel} Seoul" loading="lazy" onerror="this.parentElement.remove()">
    </div>
    <div class="card-body">
      <h2 class="card-name" itemprop="name">${s.name}</h2>
      <div class="card-meta">
        <span class="card-area">📍 ${s.location}</span>
        <span class="card-rating">${stars} ${s.rating} (${s.reviewCount} reviews)</span>
      </div>
      <p class="card-desc" itemprop="description">${desc}</p>
      ${reviewQuote}
      <div class="card-services">${s.services.slice(0,4).map(sv=>`<span class="svc-tag">${sv}</span>`).join('')}</div>
      <div class="card-price">${s.priceRange}</div>
      <div class="card-cta">
        <span class="btn-view">View Details →</span>
        <span class="btn-book">📱 Book via WhatsApp</span>
      </div>
    </div>
  </a>
</article>`}).join('')
    : `<div class="no-shops"><p>No ${catLabel} shops listed in ${areaLabel} yet. <a href="/">Browse all Seoul beauty salons →</a></p></div>`

  const faqHtml = faqList.map((f,i) => `
<details class="faq-item" ${i===0?'open':''}>
  <summary class="faq-q">${f.q}</summary>
  <div class="faq-a">${f.a}</div>
</details>`).join('')

  // 관련 카테고리 링크
  const relatedCats = Object.entries(CATEGORY_LABELS)
    .filter(([k]) => k !== catSlug)
    .map(([k,v]) => `<a href="/best/${k}/${areaSlug}" class="rel-link">${catEmoji[k]||'✨'} ${v} in ${areaLabel}</a>`)
    .join('')
  // 관련 지역 링크
  const relatedAreas = Object.entries(AREA_LABELS)
    .filter(([k]) => k !== areaSlug && k !== 'seoul')
    .slice(0,6)
    .map(([k,v]) => `<a href="/best/${catSlug}/${k}" class="rel-link">${emoji} ${catLabel} in ${v}</a>`)
    .join('')

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleMain} | Seoul Beauty Trip</title>
<meta name="description" content="${metaDesc}">
<meta name="keywords" content="${isClinicGangnam
    ? 'Gangnam dermatology clinic, Gangnam dermatology clinic foreigners, Gangnam skin clinic Seoul, best dermatology clinic Gangnam Seoul, Gangnam dermatologist English, Seoul dermatology clinic foreigners, skin clinic Gangnam tourists, Korean dermatology clinic Gangnam, dermatologist Seoul foreigner friendly, Gangnam aesthetic clinic English booking'
    : isHeadSpaMyeongdong
    ? 'head spa Myeongdong, Korean head spa Myeongdong Seoul, Myeongdong scalp treatment, head spa Seoul Myeongdong foreigners, Korean scalp massage Myeongdong, 18 step head spa Seoul, head spa Seoul English, Myeongdong head spa booking, head spa Myeongdong price, best head spa Seoul tourists'
    : `best ${catLabel.toLowerCase()} ${areaLabel} Seoul, ${catLabel.toLowerCase()} Seoul foreigners, ${catLabel.toLowerCase()} Seoul English, ${catLabel.toLowerCase()} ${areaLabel} tourists, foreigner friendly ${catLabel.toLowerCase()} Seoul, ${catLabel.toLowerCase()} Seoul booking, Korean ${catLabel.toLowerCase()} ${areaLabel}, ${catLabel.toLowerCase()} Seoul recommendation`}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="${titleMain} | Seoul Beauty Trip">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${shops[0]?.thumbnail ? (shops[0].thumbnail.startsWith('http') ? shops[0].thumbnail : base+shops[0].thumbnail) : 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg'}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleMain} | Seoul Beauty Trip">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${shops[0]?.thumbnail || 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg'}">
<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':schemaGraph})}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#f8f9fa;color:#1a1a2e}
a{text-decoration:none;color:inherit}
/* NAV */
.nav{background:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 8px rgba(0,0,0,.08);position:sticky;top:0;z-index:100}
.nav-logo{font-size:1.1rem;font-weight:800;background:linear-gradient(135deg,#e91e8c,#9c27b0);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-back{font-size:.85rem;color:#666;margin-left:auto}
/* HERO */
.hero{background:linear-gradient(135deg,#e91e8c 0%,#9c27b0 50%,#3f51b5 100%);color:#fff;padding:48px 20px 56px;text-align:center}
.hero-emoji{font-size:3rem;margin-bottom:12px;display:block}
.hero-h1{font-size:clamp(1.5rem,5vw,2.4rem);font-weight:800;line-height:1.25;margin-bottom:10px}
.hero-sub{font-size:.95rem;opacity:.9;margin-bottom:20px}
.hero-badges{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.badge{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);border-radius:20px;padding:4px 14px;font-size:.8rem;font-weight:600}
/* MAIN */
.main{max-width:900px;margin:0 auto;padding:24px 16px 60px}
.section-title{font-size:1.3rem;font-weight:700;margin:32px 0 16px;display:flex;align-items:center;gap:8px}
/* SHOP CARDS */
.shop-card{background:#fff;border-radius:16px;overflow:hidden;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.08);transition:transform .2s,box-shadow .2s;position:relative}
.shop-card:hover{transform:translateY(-3px);box-shadow:0 6px 24px rgba(233,30,140,.15)}
.card-link{display:flex;gap:0}
.card-rank{position:absolute;top:12px;left:12px;background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;z-index:2}
.card-img-wrap{width:140px;min-width:140px;overflow:hidden}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;min-height:160px}
.card-body{flex:1;padding:16px}
.card-name{font-size:1.05rem;font-weight:700;margin-bottom:6px;color:#1a1a2e}
.card-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:.8rem;color:#666;margin-bottom:8px}
.card-rating{color:#f59e0b;font-weight:600}
.card-desc{font-size:.85rem;color:#444;line-height:1.5;margin-bottom:10px}
.card-services{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.svc-tag{background:#f3e8ff;color:#7c3aed;border-radius:12px;padding:2px 10px;font-size:.75rem;font-weight:500}
.card-price{font-size:.85rem;color:#e91e8c;font-weight:600;margin-bottom:12px}
.card-cta{display:flex;gap:8px;flex-wrap:wrap}
.btn-view{background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;padding:7px 16px;border-radius:20px;font-size:.82rem;font-weight:600}
.btn-book{background:#25d366;color:#fff;padding:7px 16px;border-radius:20px;font-size:.82rem;font-weight:600}
/* NO SHOPS */
.no-shops{text-align:center;padding:60px 20px;color:#666}
.no-shops a{color:#e91e8c;text-decoration:underline}
/* FAQ */
.faq-item{background:#fff;border-radius:12px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06)}
.faq-q{padding:16px 20px;font-size:.95rem;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;color:#1a1a2e}
.faq-q::-webkit-details-marker{display:none}
.faq-q::after{content:'▼';font-size:.7rem;color:#e91e8c;transition:transform .2s}
details[open] .faq-q::after{transform:rotate(180deg)}
.faq-a{padding:0 20px 16px;font-size:.88rem;color:#444;line-height:1.7;border-top:1px solid #f0f0f0;padding-top:12px}
/* RELATED */
.rel-grid{display:flex;flex-wrap:wrap;gap:8px}
.rel-link{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:6px 16px;font-size:.82rem;font-weight:500;color:#374151;transition:all .2s}
.rel-link:hover{background:#fdf2f8;border-color:#e91e8c;color:#e91e8c}
/* INTRO TEXT */
.intro-box{background:#fff;border-radius:16px;padding:24px 28px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.06);font-size:.92rem;line-height:1.9;color:#374151;border-left:4px solid #e91e8c}
.intro-box p{margin:0 0 14px}
.intro-box strong{color:#e91e8c}
.intro-trust{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}
.intro-trust span{background:#fdf2f8;color:#e91e8c;border-radius:20px;padding:4px 14px;font-size:.8rem;font-weight:600}
/* CARD REVIEW QUOTE */
.card-review-quote{font-size:.8rem;color:#555;font-style:italic;line-height:1.5;margin:6px 0 8px;padding:6px 10px;background:#f9fafb;border-radius:8px;border-left:3px solid #e91e8c}
.card-review-author{font-style:normal;font-weight:600;color:#e91e8c}
/* FOOTER */
.lp-footer{text-align:center;padding:32px 16px;font-size:.82rem;color:#999;border-top:1px solid #eee;margin-top:40px}
.lp-footer a{color:#e91e8c}
/* LONGFORM GUIDE */
.guide-block{background:#fff;border-radius:16px;padding:28px 28px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
.guide-block h2{font-size:1.15rem;font-weight:700;color:#1a1a2e;margin:0 0 12px;line-height:1.4}
.guide-block h3{font-size:1rem;font-weight:700;color:#e91e8c;margin:18px 0 8px}
.guide-block p{font-size:.9rem;color:#444;line-height:1.85;margin:0 0 12px}
.guide-block ul,.guide-block ol{padding-left:20px;margin:8px 0 14px}
.guide-block li{font-size:.88rem;color:#444;line-height:1.75;margin-bottom:4px}
.guide-block strong{color:#1a1a2e;font-weight:700}
.guide-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.85rem}
.guide-table th{background:#fdf2f8;color:#e91e8c;font-weight:700;padding:10px 14px;text-align:left;border-bottom:2px solid #f9a8d4}
.guide-table td{padding:9px 14px;border-bottom:1px solid #f3f4f6;color:#374151}
.guide-table tr:last-child td{border-bottom:none}
.guide-callout{background:linear-gradient(135deg,#fdf2f8,#f3e8ff);border-radius:12px;padding:16px 20px;margin:14px 0;border-left:4px solid #e91e8c}
.guide-callout p{margin:0;font-size:.88rem;color:#374151}
@media(max-width:520px){
  .card-link{flex-direction:column}
  .card-img-wrap{width:100%;min-width:unset;height:180px}
  .card-img-wrap img{min-height:180px}
  .guide-block{padding:20px 16px}
  .guide-table{font-size:.8rem}
}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">Seoul Beauty Trip</a>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> All Salons</a>
</nav>
<header class="hero">
  <span class="hero-emoji">${emoji}</span>
  <h1 class="hero-h1">${h1Text}</h1>
  <p class="hero-sub">${subText}</p>
  <div class="hero-badges">
    <span class="badge">🌍 Foreigner Friendly</span>
    <span class="badge">💬 English Booking</span>
    <span class="badge">⭐ Verified Reviews</span>
    <span class="badge">📱 WhatsApp Support</span>
  </div>
</header>
<main class="main">
  <div class="intro-box">
    <p>${introText}</p>
    <div class="intro-trust">
      <span>✅ All salons verified</span>
      <span>🌍 Foreigner-friendly</span>
      <span>💬 English support</span>
      <span>📱 WhatsApp booking</span>
    </div>
  </div>
  <div class="section-title">${emoji} Top ${catLabel} Salons in ${areaLabel} <span style="font-size:.85rem;font-weight:400;color:#888">(${shops.length} listed)</span></div>
  ${shopCards}
  <div class="section-title">❓ FAQ — ${catLabel} in ${areaLabel} Seoul</div>
  <div>${faqHtml}</div>

  ${isClinicGangnam ? `
  <div class="section-title">📖 Complete Guide: Gangnam Dermatology Clinics for Foreigners 2026</div>

  <div class="guide-block">
    <h2>What Is a Gangnam Dermatology Clinic?</h2>
    <p>A <strong>Gangnam dermatology clinic</strong> is a medical aesthetic center staffed by board-certified Korean dermatologists who specialize in skin treatments ranging from laser therapy and injectables to advanced cosmetic procedures. Gangnam — Seoul's most prestigious medical district — is home to over 500 licensed dermatology clinics, making it the world's densest concentration of aesthetic dermatology in a single neighborhood.</p>
    <p>Unlike beauty salons or spas, Gangnam dermatology clinics are fully regulated medical facilities. All procedures are performed or supervised by a licensed <em>피부과</em> (dermatologist) certified by the Korean Medical Association. This means you receive the same standard of care as Korean patients — but increasingly, with English-language support designed specifically for foreign visitors.</p>
    <p>For foreigners seeking <strong>laser toning, skin boosters, Botox, RF lifting, or acne treatment</strong> in Seoul, the Gangnam clinic district offers world-class results at 40–60% lower cost than equivalent clinics in the US, UK, Australia, or Singapore.</p>

    <h3>Gangnam vs. Other Seoul Dermatology Areas</h3>
    <table class="guide-table">
      <thead><tr><th>Area</th><th>Known For</th><th>Price Range</th><th>English Support</th></tr></thead>
      <tbody>
        <tr><td><strong>Gangnam / Cheongdam</strong></td><td>Premium medical clinics, celebrity dermatologists</td><td>₩₩₩</td><td>High (foreigner-focused)</td></tr>
        <tr><td>Apgujeong</td><td>Luxury cosmetic procedures, anti-aging</td><td>₩₩₩₩</td><td>Moderate</td></tr>
        <tr><td>Hongdae</td><td>Trendy salons, budget-friendly</td><td>₩₩</td><td>Limited</td></tr>
        <tr><td>Itaewon</td><td>International-facing clinics</td><td>₩₩₩</td><td>High</td></tr>
        <tr><td>Myeongdong</td><td>Tourist-area walk-ins</td><td>₩₩–₩₩₩</td><td>Moderate</td></tr>
      </tbody>
    </table>
  </div>

  <div class="guide-block">
    <h2>Top Treatments at Gangnam Dermatology Clinics (With 2026 Prices)</h2>
    <p>Korean dermatology clinics in Gangnam offer the most comprehensive menu of medical-grade aesthetic treatments in Asia. Below is an up-to-date 2026 price guide based on average clinic rates across the Gangnam district. Prices can vary by clinic reputation, doctor experience, and the number of sessions purchased.</p>

    <h3>Laser Treatments</h3>
    <table class="guide-table">
      <thead><tr><th>Treatment</th><th>What It Does</th><th>Price (per session)</th></tr></thead>
      <tbody>
        <tr><td><strong>Laser Toning</strong></td><td>Brightening, pigmentation reduction, pore minimization</td><td>₩50,000 – ₩150,000</td></tr>
        <tr><td><strong>Pico Laser</strong></td><td>Melasma, sun spots, skin texture</td><td>₩80,000 – ₩250,000</td></tr>
        <tr><td><strong>Fractional CO2 Laser</strong></td><td>Acne scars, deep texture resurfacing</td><td>₩200,000 – ₩600,000</td></tr>
        <tr><td><strong>V-Beam / PDL</strong></td><td>Redness, rosacea, vascular lesions</td><td>₩150,000 – ₩350,000</td></tr>
        <tr><td><strong>Clear + Brilliant</strong></td><td>Preventative skin maintenance, glow</td><td>₩120,000 – ₩280,000</td></tr>
      </tbody>
    </table>

    <h3>Injectable Treatments</h3>
    <table class="guide-table">
      <thead><tr><th>Treatment</th><th>What It Does</th><th>Price (per session)</th></tr></thead>
      <tbody>
        <tr><td><strong>Botox (forehead / glabella)</strong></td><td>Wrinkle relaxation, face slimming</td><td>₩80,000 – ₩200,000</td></tr>
        <tr><td><strong>Botox (jaw slimming)</strong></td><td>Masseter reduction for V-line effect</td><td>₩150,000 – ₩350,000</td></tr>
        <tr><td><strong>Rejuran Healer</strong></td><td>DNA repair, deep hydration, anti-aging</td><td>₩200,000 – ₩500,000</td></tr>
        <tr><td><strong>Juvelook / PLLA</strong></td><td>Collagen biostimulation, long-term lifting</td><td>₩300,000 – ₩700,000</td></tr>
        <tr><td><strong>Hyaluronic Acid Filler</strong></td><td>Volume, contouring, tear trough</td><td>₩200,000 – ₩600,000 / syringe</td></tr>
        <tr><td><strong>Exosome Skin Booster</strong></td><td>Stem-cell-derived regeneration, glow</td><td>₩250,000 – ₩600,000</td></tr>
      </tbody>
    </table>

    <h3>Lifting &amp; Tightening</h3>
    <table class="guide-table">
      <thead><tr><th>Treatment</th><th>What It Does</th><th>Price</th></tr></thead>
      <tbody>
        <tr><td><strong>HIFU (Ultherapy-type)</strong></td><td>Non-surgical facelift via ultrasound</td><td>₩300,000 – ₩1,200,000</td></tr>
        <tr><td><strong>Thermage / RF Lifting</strong></td><td>Skin tightening, collagen remodeling</td><td>₩400,000 – ₩1,500,000</td></tr>
        <tr><td><strong>Thread Lift</strong></td><td>Minimally invasive lift with PDO threads</td><td>₩500,000 – ₩2,000,000</td></tr>
      </tbody>
    </table>

    <div class="guide-callout">
      <p>💡 <strong>Pro tip for foreigners:</strong> Many Gangnam dermatology clinics offer <em>package deals</em> (e.g., 5 laser toning sessions for the price of 4). If you're in Seoul for more than a week, ask about package pricing — you can often save 20–30% vs. single-session rates.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>Are Gangnam Dermatology Clinics Safe for Foreigners?</h2>
    <p>Yes — Korean dermatology clinics in Gangnam operate under some of the world's strictest medical regulations. Here is what makes them safe and reliable for foreign patients:</p>
    <ul>
      <li><strong>KFDA-approved equipment only:</strong> All lasers, RF devices, and injectables used in Korean clinics must be approved by the Korean Food &amp; Drug Administration (KFDA). Many devices gain KFDA approval before receiving US FDA clearance.</li>
      <li><strong>Board-certified dermatologists:</strong> Dermatology (피부과) is a fully separate specialty in Korea, requiring 4 years of post-medical-school residency. Your treatment will be performed or directly supervised by a fully certified specialist — not a nurse or aesthetician.</li>
      <li><strong>Korea ranks #1 globally in medical procedures per capita:</strong> According to the International Society of Aesthetic Plastic Surgery (ISAPS), South Korea has the highest rate of cosmetic procedures per capita in the world. Korean clinicians have performed millions more procedures than their Western counterparts.</li>
      <li><strong>Transparent pricing:</strong> Since 2022, Korean medical law requires clinics to display treatment prices. Foreigner-friendly clinics listed on Seoul Beauty Trip provide itemized quotes before any procedure begins.</li>
      <li><strong>No-pressure consultations:</strong> Reputable Gangnam dermatology clinics will never push upsells or bundle packages you didn't ask for. You can always say no and pay only for what was agreed.</li>
    </ul>

    <h3>What to Watch Out For</h3>
    <ul>
      <li>Avoid clinics that cannot provide a written price list before treatment</li>
      <li>Avoid walk-in clinics near tourist areas (Myeongdong station exits) that specifically target foreigners with aggressive pricing</li>
      <li>Always confirm your doctor's name and specialization before the appointment</li>
      <li>If a price seems too low compared to the table above, ask why — heavily discounted procedures are sometimes performed on lower-end equipment or by junior staff</li>
    </ul>
  </div>

  <div class="guide-block">
    <h2>How to Choose the Right Gangnam Dermatology Clinic as a Foreigner</h2>
    <p>With over 500 dermatology clinics in the Gangnam area, narrowing down the right clinic for your needs can feel overwhelming. Here is a step-by-step process specifically designed for foreign visitors:</p>

    <h3>Step 1: Define Your Treatment Goal</h3>
    <p>Different clinics specialize in different areas. A clinic known for acne scar lasers may not be the best choice for Botox jaw slimming. Common goals and matching specializations:</p>
    <ul>
      <li><strong>Skin brightening / pigmentation:</strong> Look for clinics with strong laser toning and pico laser experience</li>
      <li><strong>Acne &amp; active breakouts:</strong> Look for clinics with IPL, LED phototherapy, and prescription treatments</li>
      <li><strong>Anti-aging &amp; lifting:</strong> Look for clinics with HIFU, RF lifting, and thread lift experience</li>
      <li><strong>Hydration &amp; glow:</strong> Skin booster injections (Rejuran, Juvelook, Exosomes) are the Korean specialty</li>
      <li><strong>Facial contouring:</strong> Jaw Botox and filler contouring requires specialist experience</li>
    </ul>

    <h3>Step 2: Check English Communication</h3>
    <p>The biggest frustration for foreign patients is language barriers mid-treatment. At minimum, your chosen clinic should be able to:</p>
    <ul>
      <li>Respond to your initial WhatsApp or email inquiry in English</li>
      <li>Provide an English-language treatment menu and price list</li>
      <li>Conduct the pre-treatment consultation in English (in person or via interpreter)</li>
      <li>Give written aftercare instructions in English</li>
    </ul>
    <p>All clinics listed on Seoul Beauty Trip have been verified for English communication capability. When you book through us via WhatsApp, we act as your English-language liaison from inquiry to aftercare.</p>

    <h3>Step 3: Verify Reviews from Foreigners</h3>
    <p>Google Maps reviews are your best source of truth. Filter specifically for English-language reviews and look for mentions of: English staff, transparent pricing, no-pressure consultation, and good aftercare communication. Red flags include recurring mentions of surprise charges or post-visit upselling.</p>

    <h3>Step 4: Book in Advance</h3>
    <p>Popular Gangnam dermatology clinics — especially those with English-speaking staff — are often booked 1–3 days in advance. For treatments like HIFU or thread lifts that require a pre-consultation, you may need 3–5 days advance notice. Walk-in availability is more common for simpler treatments like laser toning or Botox.</p>

    <div class="guide-callout">
      <p>📱 <strong>Booking via Seoul Beauty Trip:</strong> All clinics on this page can be booked directly via WhatsApp through Seoul Beauty Trip. Our English-speaking team confirms your appointment, briefs the clinic on your goals, and follows up after your treatment. No Korean required.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>Gangnam Dermatology Clinic vs. Home Country: Is It Worth Traveling For?</h2>
    <p>One of the most common questions we hear from foreign visitors is whether the trip to a Gangnam dermatology clinic is genuinely worth it compared to getting the same treatment at home. The answer depends on your home country — but for most travelers from English-speaking countries, the answer is an emphatic yes.</p>

    <h3>Cost Comparison (2026)</h3>
    <table class="guide-table">
      <thead><tr><th>Treatment</th><th>Seoul (Gangnam)</th><th>USA</th><th>UK</th><th>Australia</th></tr></thead>
      <tbody>
        <tr><td>Laser Toning (1 session)</td><td>₩50k–₩150k (~$37–$110)</td><td>$200–$400</td><td>£150–£350</td><td>A$250–A$450</td></tr>
        <tr><td>Rejuran Healer</td><td>₩200k–₩500k (~$150–$370)</td><td>$800–$1,500</td><td>£600–£1,200</td><td>A$900–A$1,600</td></tr>
        <tr><td>Botox (forehead)</td><td>₩80k–₩200k (~$60–$150)</td><td>$300–$600</td><td>£200–£400</td><td>A$350–A$500</td></tr>
        <tr><td>HIFU (full face)</td><td>₩300k–₩1.2M (~$220–$880)</td><td>$1,500–$3,500</td><td>£1,200–£2,800</td><td>A$1,800–A$3,500</td></tr>
        <tr><td>Fractional CO2 Laser</td><td>₩200k–₩600k (~$150–$440)</td><td>$1,000–$2,500</td><td>£800–£2,000</td><td>A$1,200–A$2,800</td></tr>
      </tbody>
    </table>
    <p>Even accounting for flights and accommodation, many foreign patients save significant money by combining a Seoul trip with multiple treatments. A 5-day Seoul medical beauty trip with 3–4 treatments often costs less than a single equivalent treatment package at a private clinic in London, New York, or Sydney.</p>

    <h3>Quality: Is Korean Dermatology Actually Better?</h3>
    <p>For many treatments — especially those involving Korean-developed technologies — yes. Korea has driven innovation in several areas of aesthetic dermatology that are only now reaching Western markets:</p>
    <ul>
      <li><strong>Skin booster injections</strong> (Rejuran, Juvelook, PLLA): developed and refined in Korea, still unavailable or heavily restricted in many Western countries</li>
      <li><strong>Laser protocols:</strong> Korean dermatologists typically perform significantly higher treatment volumes, developing refined protocols that reduce downtime and improve outcomes</li>
      <li><strong>Exosome therapy:</strong> Korea is a global leader in exosome-based skin regeneration, with clinics offering treatments not available elsewhere</li>
      <li><strong>Combination protocols:</strong> Korean clinics have perfected multi-step treatment combinations (e.g., pico laser + skin booster + LED) that maximize results in a single visit</li>
    </ul>
  </div>

  <div class="guide-block">
    <h2>What to Do Before &amp; After Your Gangnam Clinic Visit</h2>
    <h3>Before Your Appointment (1–3 Days Prior)</h3>
    <ul>
      <li>Avoid retinol, AHAs/BHAs, and exfoliating products for at least 3 days before laser treatments</li>
      <li>Avoid alcohol for 24 hours before injectable treatments (Botox, fillers)</li>
      <li>Apply and reapply SPF 50+ sunscreen in the days leading up to your laser appointment — sun-damaged skin can have increased sensitivity</li>
      <li>Prepare a list of current skincare products and any medications (especially blood thinners or retinoids) to share with your doctor</li>
      <li>Take a no-makeup selfie in natural light — this helps the doctor assess your baseline skin condition</li>
    </ul>

    <h3>After Your Treatment</h3>
    <ul>
      <li><strong>Laser treatments:</strong> Expect mild redness for 4–24 hours. Apply prescribed barrier cream and avoid makeup for the first day. SPF is essential for 2–4 weeks post-treatment.</li>
      <li><strong>Botox:</strong> Avoid lying down for 4 hours post-injection. Avoid strenuous exercise and alcohol for 24 hours. Results appear over 5–14 days.</li>
      <li><strong>Skin boosters (Rejuran, fillers):</strong> Small bumps at injection sites are normal and resolve within 24–48 hours. Apply ice packs if needed. Avoid saunas and hot showers for 24 hours.</li>
      <li><strong>HIFU / RF lifting:</strong> Mild swelling and tenderness for 3–7 days is normal. Final results appear over 3–6 months as collagen remodels.</li>
    </ul>

    <div class="guide-callout">
      <p>✈️ <strong>Planning your Seoul trip around treatments:</strong> If you have a flight home within 24 hours of a procedure, stick to gentler treatments like laser toning or skin boosters. For more intensive procedures like fractional CO2 laser or thread lifts, allow at least 5–7 days before flying to ensure proper healing.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>How to Book a Gangnam Dermatology Clinic Through Seoul Beauty Trip</h2>
    <p>Seoul Beauty Trip is an English-language platform specifically designed to help foreigners navigate the Gangnam dermatology clinic scene. Here is how the booking process works:</p>
    <ol>
      <li><strong>Browse clinics above</strong> — each listing includes verified reviews, treatment menus, pricing information, and location details</li>
      <li><strong>Tap the WhatsApp button</strong> on your chosen clinic's page — this connects you directly to our English-speaking team</li>
      <li><strong>Tell us your treatment goal</strong> — we'll confirm the right treatment, current availability, and any pre-appointment preparation needed</li>
      <li><strong>Receive your booking confirmation</strong> — including clinic address (in Korean for your taxi), appointment time, and what to bring</li>
      <li><strong>Attend your appointment</strong> — our team has briefed the clinic about your goals and language needs in advance</li>
      <li><strong>Get aftercare support</strong> — if you have any questions post-treatment, message us on WhatsApp anytime</li>
    </ol>
    <p>All clinics listed on Seoul Beauty Trip have been personally vetted by our team. We only list clinics that consistently deliver excellent results for foreign patients and maintain transparent pricing. There is no booking fee — our service is completely free for patients.</p>
  </div>
  ` : ''}

  ${isHeadSpaMyeongdong ? `
  <div class="section-title">📖 Complete Guide: Korean Head Spa in Myeongdong for First-Timers 2026</div>

  <div class="guide-block">
    <h2>What Is a Korean Head Spa — And Why Myeongdong?</h2>
    <p>A <strong>Korean head spa</strong> is a multi-step therapeutic scalp and hair treatment that goes far beyond a regular shampoo. It combines scalp diagnosis, deep-cleanse, stimulating massage, and nourishing treatments into a single 60–90 minute ritual designed to relieve stress, improve scalp health, and leave your hair visibly shinier.</p>
    <p>Myeongdong is the single best neighbourhood for first-time visitors to experience a Korean head spa. As Seoul's most international shopping district, virtually every head spa here has English-speaking staff, printed English menus, and experience handling foreign card payments. You don't need to speak Korean, book weeks in advance, or navigate complicated subway routes — many salons accept walk-ins right off the main shopping street.</p>
    <p>The <strong>viral 18-step Korean head spa</strong> you've seen on TikTok and YouTube? Myeongdong is where most of those videos are filmed. The neighbourhood's salons have perfected the foreigner experience, and the results speak for themselves.</p>

    <h3>Myeongdong vs. Other Seoul Head Spa Areas</h3>
    <table class="guide-table">
      <thead><tr><th>Area</th><th>Best For</th><th>Price Range</th><th>English Level</th></tr></thead>
      <tbody>
        <tr><td><strong>Myeongdong</strong></td><td>First-timers, walk-ins, viral TikTok experience</td><td>&#8361;60,000–120,000</td><td>Excellent</td></tr>
        <tr><td>Gangnam</td><td>Premium treatments, medical-grade scalp care</td><td>&#8361;80,000–180,000</td><td>Good</td></tr>
        <tr><td>Hongdae</td><td>Trendy atmosphere, younger crowd</td><td>&#8361;50,000–100,000</td><td>Moderate</td></tr>
        <tr><td>Itaewon</td><td>International vibe, diverse hair types</td><td>&#8361;70,000–130,000</td><td>Excellent</td></tr>
        <tr><td>Insadong</td><td>Traditional atmosphere, cultural experience</td><td>&#8361;55,000–110,000</td><td>Moderate</td></tr>
      </tbody>
    </table>
  </div>

  <div class="guide-block">
    <h2>What Happens During a Korean Head Spa? Step-by-Step</h2>
    <p>Most Myeongdong head spas follow a structured ritual. Here's what to expect from the moment you sit down:</p>
    <ol>
      <li><strong>Scalp Consultation</strong> — A therapist examines your scalp type (oily, dry, sensitive, or combination) using a digital scalp camera in many salons. This determines which products and pressure levels will be used.</li>
      <li><strong>Pre-Treatment Oil Application</strong> — A nourishing oil or serum is applied to loosen buildup and prepare the scalp for deep cleansing. This phase alone is deeply relaxing.</li>
      <li><strong>First Shampoo (Clarifying)</strong> — A clarifying shampoo removes product buildup, pollution, and excess sebum. The therapist uses specific finger techniques to stimulate blood circulation.</li>
      <li><strong>Scalp Scrub / Exfoliation</strong> — A gentle exfoliant is massaged into the scalp to remove dead skin cells. This step is often described as "the most satisfying" by first-timers.</li>
      <li><strong>Second Shampoo (Nourishing)</strong> — A second shampoo, tailored to your scalp type, provides hydration and prepares the scalp for the treatment mask.</li>
      <li><strong>Treatment Mask Application</strong> — A targeted treatment mask (for hair loss, hydration, or scalp balance) is applied to both the scalp and lengths. This sits for 10–20 minutes under heat.</li>
      <li><strong>Extended Head &amp; Shoulder Massage</strong> — While the mask works, you receive a full head, neck, and shoulder massage. Pressure points along the scalp are stimulated to relieve tension and promote circulation.</li>
      <li><strong>Rinse &amp; Conditioning Treatment</strong> — The mask is thoroughly rinsed and a conditioning treatment is worked through the hair lengths.</li>
      <li><strong>Blow-Dry &amp; Styling</strong> — Your hair is blow-dried and styled to finish. Many salons include a complimentary facial mist or scalp tonic spray.</li>
    </ol>
    <div class="guide-callout">
      <p><strong>Pro Tip:</strong> The full 18-step version adds additional steam treatments, LED scalp therapy, acupressure scalp massage, and a hair gloss treatment. Ask specifically for the "18-step" or "premium" package when booking — it typically adds 30 minutes and &#8361;20,000–40,000 to the base price.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>Head Spa Prices in Myeongdong 2026</h2>
    <p>Myeongdong head spa prices are generally mid-range — more affordable than Gangnam but with the same quality of service. Here's what to expect:</p>
    <table class="guide-table">
      <thead><tr><th>Treatment</th><th>Duration</th><th>Price Range</th><th>Best For</th></tr></thead>
      <tbody>
        <tr><td><strong>Basic Head Spa</strong></td><td>60 min</td><td>&#8361;55,000–75,000</td><td>First-timers, relaxation</td></tr>
        <tr><td><strong>Standard Head Spa</strong></td><td>75 min</td><td>&#8361;75,000–100,000</td><td>Deep cleanse + massage</td></tr>
        <tr><td><strong>Premium / 18-Step</strong></td><td>90–110 min</td><td>&#8361;100,000–140,000</td><td>Full ritual experience</td></tr>
        <tr><td><strong>Scalp Treatment Add-on</strong></td><td>+20 min</td><td>&#8361;20,000–40,000</td><td>Hair loss, dandruff concern</td></tr>
        <tr><td><strong>Couple Package</strong></td><td>75–90 min</td><td>&#8361;130,000–200,000</td><td>Two people together</td></tr>
      </tbody>
    </table>
    <div class="guide-callout">
      <p><strong>Booking Tip:</strong> Prices listed above are per person. Walk-in rates may be slightly higher than pre-booked rates. Book via Seoul Beauty Trip's WhatsApp to confirm availability and lock in the best price.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>Is a Korean Head Spa Safe for All Hair Types?</h2>
    <p>Yes — Korean head spas are designed to work with all hair types, including curly, coily, fine, thick, chemically treated, and colour-treated hair. Myeongdong salons, in particular, have significant experience with international guests who have diverse hair textures.</p>
    <p>When you arrive, mention the following to your therapist:</p>
    <ul>
      <li>Recent chemical treatments (colour, perm, relaxer) within the last 2–3 weeks</li>
      <li>Any scalp sensitivities or skin conditions (psoriasis, eczema, sensitive skin)</li>
      <li>Hair loss concerns — the therapist can adjust the treatment protocol</li>
      <li>Preference for lighter or firmer massage pressure</li>
    </ul>
    <p>Most Myeongdong salons can communicate these adjustments in English. All products used are professional-grade Korean cosmetics brands (Mise en Scene, Ryo, Pyunkang Yul, etc.) — gentle, well-tested, and safe for international visitors.</p>
  </div>

  <div class="guide-block">
    <h2>How to Get to Head Spas in Myeongdong</h2>
    <p>Myeongdong is extremely easy to reach from anywhere in Seoul:</p>
    <ul>
      <li><strong>Subway:</strong> Line 4 (Blue), Myeongdong Station (Exit 5 or 8) — most salons are within a 5-minute walk</li>
      <li><strong>From Hongdae:</strong> 20 minutes via Line 2 → transfer at City Hall to Line 1</li>
      <li><strong>From Gangnam:</strong> 25 minutes via Line 2 → transfer at Euljiro 3-ga to Line 2</li>
      <li><strong>From Itaewon:</strong> 15 minutes via Line 6 → transfer at Samgakji to Line 4</li>
      <li><strong>From Incheon Airport:</strong> Airport Railroad (AREX) to Seoul Station, then 2 stops on Line 4</li>
    </ul>
    <div class="guide-callout">
      <p><strong>Location Tip:</strong> Most head spas are located on the upper floors (2F–6F) of buildings along the main Myeongdong street and the side streets between Myeongdong Cathedral and Lotte Department Store. Look for signs in the elevator lobbies.</p>
    </div>
  </div>

  <div class="guide-block">
    <h2>Before &amp; After Your Head Spa — What You Need to Know</h2>
    <h3>Before Your Appointment</h3>
    <ul>
      <li>Avoid applying heavy dry shampoo or styling products on the day of your appointment — your therapist will need to work through any buildup</li>
      <li>You don't need to pre-wash your hair — the salon will cleanse everything as part of the treatment</li>
      <li>Arrive 5–10 minutes early to complete a brief consultation card</li>
      <li>Wear a top you don't mind getting slightly damp around the collar</li>
    </ul>
    <h3>After Your Treatment</h3>
    <ul>
      <li>Your scalp may feel slightly more sensitive than usual for 24 hours — this is normal</li>
      <li>Avoid washing your hair for at least 24 hours to let the treatment fully absorb</li>
      <li>Avoid heavy heat styling for 48 hours after a treatment mask</li>
      <li>For ongoing scalp concerns (hair loss, dandruff), consider a follow-up treatment after 2–3 weeks</li>
    </ul>
  </div>

  <div class="guide-block">
    <h2>How to Book a Myeongdong Head Spa as a Foreigner</h2>
    <p>Booking a head spa in Myeongdong is straightforward — especially through Seoul Beauty Trip:</p>
    <ol>
      <li><strong>Browse the salons above</strong> and check ratings, reviews, and photos</li>
      <li><strong>Click "Book via WhatsApp"</strong> on any salon listing — our English-speaking team handles communication with the salon</li>
      <li><strong>Confirm your date, time, and treatment</strong> — we'll send you a booking confirmation with the exact address and floor number</li>
      <li><strong>Arrive and enjoy</strong> — your therapist will be briefed on your preferences and any language needs in advance</li>
    </ol>
    <p>All salons listed on Seoul Beauty Trip have been verified for quality, English support, and foreigner-friendly service. Booking via our WhatsApp is always free — no platform fee, no hidden charges.</p>
  </div>
  ` : ''}

  <div class="section-title">🔍 More ${catLabel} by Area</div>
  <div class="rel-grid">${relatedAreas}</div>
  <div class="section-title">💅 Other Beauty Services in ${areaLabel}</div>
  <div class="rel-grid">${relatedCats}</div>
</main>
<footer class="lp-footer">
  © ${new Date().getFullYear()} <a href="/">Seoul Beauty Trip</a> — Book Korean Beauty in Seoul for Foreigners
</footer>
</body>
</html>`)
})

// ── /shops 카탈로그 전용 페이지 ──
app.get('/shops', async (c) => {
  const sql = getDb(c.env)
  const rows = await sql`SELECT * FROM shops WHERE active=true ORDER BY rating DESC, created_at DESC`
  const shops = rows.map(rowToShop)
  const catColors: Record<string,string> = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa',tattoo:'#e879f9'}
  const catIcons:  Record<string,string> = {skincare:'fa-leaf',makeup:'fa-magic',hair:'fa-cut',headspa:'fa-spa',nail:'fa-hand-sparkles',clinic:'fa-briefcase-medical',spa:'fa-hot-tub',tattoo:'fa-pen-nib'}
  const cats      = ['all','clinic','headspa','skincare','hair','nail','makeup','spa','tattoo']
  const catLabels: Record<string,string> = {all:'All',clinic:'Clinic',headspa:'Head Spa',skincare:'Skincare',hair:'Hair',nail:'Nail',makeup:'Makeup',spa:'Spa',tattoo:'Brow Tattoo'}

  const catCountMap: Record<string,number> = {}
  shops.forEach((s: any) => { catCountMap[s.category] = (catCountMap[s.category]||0)+1 })

  const cardsHtml = shops.map((shop: any) => {
    const col   = catColors[shop.category] || '#aaa'
    const icon  = catIcons[shop.category]  || 'fa-star'
    const href  = shop.slug ? `/shop/${shop.slug}` : '#'
    const loc   = (shop.location||'').split(',')[0].trim()
    const nameL = shop.name.toLowerCase().replace(/"/g,'')
    return `<a class="sc-card" href="${href}" data-cat="${shop.category}" data-name="${nameL}" data-loc="${loc.toLowerCase()}">
  <div class="sc-img" id="scimg-${shop.id}"><img src="${shop.thumbnail||''}" alt="" loading="lazy" decoding="async" onload="parentLoaded(this)" onerror="parentLoaded(this)"></div>
  <div class="sc-info">
    <div class="sc-cat" style="color:${col}"><i class="fas ${icon}"></i>${catLabels[shop.category]||shop.category}</div>
    <div class="sc-name">${shop.name}</div>
    <div class="sc-loc"><i class="fas fa-map-marker-alt"></i>${loc}</div>
  </div>
  <div class="sc-rating-wrap"><i class="fas fa-star"></i>${shop.rating}</div>
</a>`
  }).join('')

  const filterBtns = cats.map(cat => {
    const cnt = cat==='all' ? shops.length : (catCountMap[cat]||0)
    if(cnt===0) return ''
    return `<button class="sc-flt${cat==='all'?' on':''}" data-cat="${cat}">${catLabels[cat]} <span class="sc-flt-n">${cnt}</span></button>`
  }).join('')

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Catalog \u2014 All K-Beauty Shops | Seoul Beauty Trip</title>
<meta name="description" content="Browse all Korean beauty salons in Seoul \u2014 foreigner-friendly with English support.">
<link rel="canonical" href="https://seoulbeautytrip.com/shops">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;--gold:#C9A84C;
  --bg:#08080E;--border:rgba(255,255,255,.07);
  --nav-h:52px;--ctrl-h:84px;
  --ff-serif:'Playfair Display',serif;--ff-sans:'Inter',sans-serif
}
html,body{height:100%;overflow:hidden}
body{background:var(--bg);color:#fff;font-family:var(--ff-sans);display:flex;flex-direction:column}
a{text-decoration:none;color:inherit}

/* NAV */
.sc-nav{
  flex-shrink:0;height:var(--nav-h);
  background:rgba(8,8,14,.97);backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  padding:0 14px;
  display:flex;align-items:center;gap:10px;
}
.sc-back{
  display:flex;align-items:center;justify-content:center;
  width:30px;height:30px;border-radius:50%;
  border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.45);font-size:12px;
  transition:all .18s;flex-shrink:0;
}
.sc-back:hover{border-color:var(--pk);color:var(--pk2)}
.sc-title{
  font-family:var(--ff-serif);font-size:16px;font-weight:900;
  background:linear-gradient(100deg,#fff 20%,var(--pk3) 65%,var(--gold) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.sc-spacer{flex:1}
.sc-badge{
  background:rgba(232,65,122,.1);border:1px solid rgba(232,65,122,.2);
  border-radius:14px;padding:3px 9px;
  font-size:10px;font-weight:700;color:var(--pk2);
}

/* CONTROLS */
.sc-ctrl{
  flex-shrink:0;height:var(--ctrl-h);
  background:rgba(8,8,14,.97);backdrop-filter:blur(16px);
  border-bottom:1px solid var(--border);
  padding:8px 14px;display:flex;flex-direction:column;gap:7px;
}
.sc-srch{
  display:flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);
  border-radius:9px;padding:7px 11px;
  transition:border-color .18s;
}
.sc-srch:focus-within{border-color:rgba(232,65,122,.3)}
.sc-srch i{color:rgba(255,255,255,.2);font-size:11px;flex-shrink:0}
.sc-srch input{flex:1;background:none;border:none;outline:none;color:#fff;font-size:13px;font-family:var(--ff-sans)}
.sc-srch input::placeholder{color:rgba(255,255,255,.18)}
.sc-srch-x{background:none;border:none;color:rgba(255,255,255,.2);font-size:10px;cursor:pointer;padding:0;display:none}
.sc-srch-x.on{display:block}
.sc-flts{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none}
.sc-flts::-webkit-scrollbar{display:none}
.sc-flt{
  flex-shrink:0;padding:4px 10px;border-radius:12px;
  border:1px solid rgba(255,255,255,.07);background:transparent;
  color:rgba(255,255,255,.38);font-size:11px;font-weight:700;
  cursor:pointer;transition:all .15s;white-space:nowrap;font-family:var(--ff-sans);
}
.sc-flt:hover{color:rgba(255,255,255,.7)}
.sc-flt.on{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff;box-shadow:0 2px 8px rgba(232,65,122,.3)}
.sc-flt-n{font-size:9px;opacity:.75;margin-left:2px}

/* GRID AREA - fills remaining height */
.sc-area{
  flex:1;overflow:hidden;
  padding:10px 12px 10px;
}
.sc-grid{
  height:100%;
  display:grid;
  /* PC 기본: 5열×2행 */
  grid-template-columns:repeat(5,1fr);
  grid-template-rows:repeat(2,1fr);
  gap:8px;
}
@media(max-width:700px){
  .sc-grid{grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr)}
}

/* CARD */
.sc-card{
  background:#0d0d1f;
  border:1px solid rgba(255,255,255,.07);
  border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column;
  transition:border-color .18s,box-shadow .18s,transform .18s;
  min-height:0;
}
.sc-card:hover{border-color:rgba(232,65,122,.35);box-shadow:0 4px 16px rgba(232,65,122,.12);transform:scale(1.02)}
.sc-img{flex:1;overflow:hidden;min-height:0;position:relative;background:#12122a}
/* shimmer skeleton — 이미지 로딩 전 반짝이는 플레이스홀더 */
.sc-img::before{
  content:'';position:absolute;inset:0;z-index:1;
  background:linear-gradient(105deg,#12122a 40%,rgba(255,255,255,.04) 50%,#12122a 60%);
  background-size:200% 100%;
  animation:sc-shimmer 1.6s infinite linear;
}
@keyframes sc-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
/* 이미지 로드 완료 후 skeleton 숨김 */
.sc-img.loaded::before{display:none}
.sc-img img{
  width:100%;height:100%;object-fit:cover;display:block;
  /* blur-up: 처음엔 흐릿하게 → 로드 완료 후 선명하게 */
  filter:blur(6px);transform:scale(1.04);
  transition:filter .45s ease,transform .45s ease;
  position:relative;z-index:2;
}
.sc-img.loaded img{filter:blur(0);transform:scale(1)}
.sc-card:hover .sc-img.loaded img{transform:scale(1.06)}
.sc-rating-wrap{
  position:absolute;top:5px;right:5px;
  background:rgba(0,0,0,.7);backdrop-filter:blur(4px);
  border-radius:8px;padding:2px 5px;
  font-size:9px;font-weight:800;color:#fbbf24;
  display:flex;align-items:center;gap:2px;
  pointer-events:none;
}
.sc-rating-wrap i{font-size:7px}
.sc-info{
  flex-shrink:0;padding:5px 7px 6px;
  display:flex;flex-direction:column;gap:2px;
  background:#0d0d1f;
}
.sc-cat{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;display:flex;align-items:center;gap:3px;opacity:.85}
.sc-cat i{font-size:7px}
.sc-name{font-size:11px;font-weight:800;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-loc{display:flex;align-items:center;gap:3px;font-size:9px;color:rgba(255,255,255,.28)}
.sc-loc i{color:var(--pk);font-size:7px;flex-shrink:0}

/* HIDDEN / EMPTY */
.sc-card.hide{display:none}
.sc-empty{
  display:none;grid-column:1/-1;grid-row:1/-1;
  align-items:center;justify-content:center;flex-direction:column;gap:8px;
  color:rgba(255,255,255,.2);font-size:13px;
}
.sc-empty.show{display:flex}
.sc-empty i{font-size:32px;opacity:.2}
</style>
</head>
<body>

<nav class="sc-nav">
  <a href="/" class="sc-back"><i class="fas fa-arrow-left"></i></a>
  <div class="sc-title">Seoul Beauty</div>
  <div class="sc-spacer"></div>
  <div class="sc-badge" id="scBadge">${shops.length} shops</div>
</nav>

<div class="sc-ctrl">
  <div class="sc-srch">
    <i class="fas fa-search"></i>
    <input id="scQ" type="search" placeholder="Name, area, category..." autocomplete="off" oninput="doFilter(this.value)">
    <button class="sc-srch-x" id="scX" onclick="clearQ()"><i class="fas fa-times"></i></button>
  </div>
  <div class="sc-flts">
    ${filterBtns}
  </div>
</div>

<div class="sc-area">
  <div class="sc-grid" id="scGrid">
    ${cardsHtml}
    <div class="sc-empty" id="scEmpty"><i class="fas fa-search"></i>No shops found</div>
  </div>
</div>

<script>
/* 이미지 blur-up 헬퍼 */
function parentLoaded(el){ if(el && el.parentElement) el.parentElement.classList.add('loaded'); }

var _cat='all', _q='';

/* 카테고리 필터 */
document.querySelectorAll('.sc-flt').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.sc-flt').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');
    _cat = b.dataset.cat;
    render();
  });
});

/* 검색 */
function doFilter(v){
  _q = v.toLowerCase().trim();
  document.getElementById('scX').classList.toggle('on', !!_q);
  render();
}
function clearQ(){
  document.getElementById('scQ').value='';
  document.getElementById('scX').classList.remove('on');
  _q=''; render();
}

/* 렌더 */
function render(){
  var cards = document.querySelectorAll('.sc-card');
  var vis = 0;
  cards.forEach(function(c){
    var ok = (_cat==='all' || c.dataset.cat===_cat)
          && (!_q || (c.dataset.name||'').indexOf(_q)!==-1
                  || (c.dataset.loc||'').indexOf(_q)!==-1
                  || (c.dataset.cat||'').indexOf(_q)!==-1);
    c.classList.toggle('hide', !ok);
    if(ok) vis++;
  });

  /* 보이는 카드 수에 맞게 그리드 레이아웃 재계산 */
  var grid = document.getElementById('scGrid');
  var cols, rows;
  var isMobile = window.innerWidth < 700;
  if(vis === 0){ cols=1; rows=1; }
  else if(isMobile){
    /* 모바일: 최대 3열, 필요한 만큼 행 */
    rows = vis <= 3 ? 1 : vis <= 6 ? 2 : 3;
    cols = Math.ceil(vis / rows);
  } else {
    /* PC: 항상 2행, 열 수는 카드 수에 맞게 자동 */
    rows = vis <= 4 ? 1 : 2;
    cols = Math.ceil(vis / rows);
  }
  grid.style.gridTemplateColumns = 'repeat('+cols+',1fr)';
  grid.style.gridTemplateRows    = 'repeat('+rows+',1fr)';

  document.getElementById('scEmpty').classList.toggle('show', vis===0);
  document.getElementById('scBadge').textContent = vis+' shop'+(vis!==1?'s':'');
}

/* 초기 레이아웃 */
render();
</script>
</body>
</html>`)
})
// ── sitemap.xml ──
// ════════════════════════════════════════════
// BLOG PAGES
// ════════════════════════════════════════════

app.get('/blog', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const posts = await sql`SELECT id,slug,title,meta_description,excerpt,category,area,tags,cover_image,views,created_at FROM blog_posts WHERE status='published' ORDER BY created_at DESC`
  const base = 'https://seoulbeautytrip.com'

  const postCards = posts.map((p: any) => {
    const tags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags||'[]') : [])
    const catLabel: Record<string,string> = { headspa:'Head Spa', skincare:'Skincare', hair:'Hair Salon', nail:'Nail Art', clinic:'Skin Clinic', makeup:'Makeup', spa:'Spa', tattoo:'Eyebrow Tattoo' }
    const cat = catLabel[p.category] || p.category || 'Beauty'
    const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : ''
    return `
    <article class="blog-card" onclick="location.href='/blog/${p.slug}'">
      <div class="blog-card-img" style="${p.cover_image ? `background-image:url('${p.cover_image}')` : 'background:linear-gradient(135deg,#ff4d8d22,#9b59b622)'}">
        <span class="blog-cat-badge">${cat}</span>
      </div>
      <div class="blog-card-body">
        <div class="blog-meta"><span class="blog-area">${p.area||'Seoul'}</span><span class="blog-date">${dateStr}</span></div>
        <h2 class="blog-title">${p.title}</h2>
        <p class="blog-excerpt">${p.excerpt || p.meta_description || ''}</p>
        <div class="blog-footer">
          <div class="blog-tags">${tags.slice(0,3).map((t:string)=>`<span class="blog-tag">#${t}</span>`).join('')}</div>
          <span class="blog-read">Read more →</span>
        </div>
      </div>
    </article>`
  }).join('')

  const emptyState = !posts.length ? `
    <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,.4)">
      <div style="font-size:48px;margin-bottom:16px">✍️</div>
      <p style="font-size:16px">No blog posts yet.<br>Add some from the admin panel!</p>
    </div>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Blog — K-Beauty Guides & Tips | Seoul Beauty Trip</title>
<meta name="description" content="Expert guides on the best head spas, hair salons, skincare clinics and nail art in Seoul. K-beauty tips for foreign visitors with English booking.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${base}/blog">
<meta property="og:title" content="Seoul Beauty Blog — K-Beauty Guides & Tips">
<meta property="og:description" content="Expert guides on the best head spas, hair salons, skincare clinics and nail art in Seoul for foreign visitors.">
<meta property="og:url" content="${base}/blog">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="Seoul Beauty Blog — K-Beauty Guides & Tips">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Seoul Beauty Blog — K-Beauty Guides & Tips">
<meta name="twitter:description" content="Expert guides on the best head spas, hair salons, skincare clinics and nail art in Seoul for foreign visitors.">
<meta name="twitter:image" content="https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Blog","url":"${base}/blog","name":"Seoul Beauty Blog","description":"K-Beauty guides and tips for foreign visitors in Seoul","publisher":{"@type":"Organization","name":"Seoul Beauty Trip","url":"${base}"}}</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d18;color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
.nav{background:#13132a;border-bottom:1px solid rgba(255,77,141,.15);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-logo{font-size:16px;font-weight:900;background:linear-gradient(135deg,#FF4D8D,#FF85B3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.nav-back{color:rgba(255,255,255,.5);text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px;padding:6px 13px;border:1px solid rgba(255,255,255,.12);border-radius:16px;transition:all .2s}
.nav-back:hover{color:#fff;border-color:rgba(255,77,141,.4)}
.blog-hero{padding:40px 20px 24px;text-align:center;background:linear-gradient(180deg,rgba(255,77,141,.08) 0%,transparent 100%)}
.blog-hero h1{font-size:clamp(1.6rem,5vw,2.4rem);font-weight:900;background:linear-gradient(135deg,#fff,rgba(255,255,255,.7));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
.blog-hero p{color:rgba(255,255,255,.5);font-size:.95rem;max-width:500px;margin:0 auto}
.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;padding:20px;max-width:1100px;margin:0 auto}
.blog-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,border-color .2s}
.blog-card:hover{transform:translateY(-3px);border-color:rgba(255,77,141,.3)}
.blog-card-img{height:180px;background:#1c1c30;background-size:cover;background-position:center;position:relative}
.blog-cat-badge{position:absolute;top:12px;left:12px;background:rgba(255,77,141,.9);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;backdrop-filter:blur(4px)}
.blog-card-body{padding:16px}
.blog-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.blog-area{font-size:11px;color:#FF4D8D;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.blog-date{font-size:11px;color:rgba(255,255,255,.35)}
.blog-title{font-size:15px;font-weight:800;line-height:1.4;margin-bottom:8px;color:#fff}
.blog-excerpt{font-size:12.5px;color:rgba(255,255,255,.45);line-height:1.6;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.blog-footer{display:flex;justify-content:space-between;align-items:center}
.blog-tags{display:flex;gap:4px;flex-wrap:wrap}
.blog-tag{font-size:10px;color:rgba(255,255,255,.3);background:rgba(255,255,255,.06);padding:3px 7px;border-radius:8px}
.blog-read{font-size:12px;color:#FF4D8D;font-weight:700;white-space:nowrap}
@media(max-width:480px){.blog-grid{grid-template-columns:1fr;padding:14px}}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">✨ Seoul Beauty Trip</a>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> Back</a>
</nav>
<section class="blog-hero">
  <h1>✍️ Seoul Beauty Blog</h1>
  <p>Expert guides & tips for K-beauty lovers visiting Seoul</p>
</section>
<div class="blog-grid">${postCards}${emptyState}</div>
</body>
</html>`
  return c.html(html)
})

// ── 블로그 카테고리 페이지 /blog/category/:cat ──
app.get('/blog/category/:cat', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const cat = c.req.param('cat').toLowerCase()
  const base = 'https://seoulbeautytrip.com'

  const CAT_LABELS: Record<string,string> = {
    headspa: 'Head Spa', skincare: 'Skincare', hair: 'Hair Salon',
    nail: 'Nail Art', clinic: 'Skin Clinic', makeup: 'Makeup', spa: 'Spa', tattoo: 'Eyebrow Tattoo'
  }
  const catLabel = CAT_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)

  // 해당 카테고리 블로그만 조회
  const posts = await sql`
    SELECT id,slug,title,meta_description,excerpt,category,area,tags,cover_image,views,created_at
    FROM blog_posts
    WHERE status='published' AND category=${cat}
    ORDER BY created_at DESC
  `

  // 404 — 카테고리 없거나 글 없으면 블로그 목록으로
  if (!posts.length) return c.redirect('/blog', 301)

  const postCards = posts.map((p: any) => {
    const tags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? JSON.parse(p.tags||'[]') : [])
    const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) : ''
    return `
    <article class="blog-card" onclick="location.href='/blog/${p.slug}'">
      <div class="blog-card-img" style="${p.cover_image ? `background-image:url('${p.cover_image}')` : 'background:linear-gradient(135deg,#ff4d8d22,#9b59b622)'}">
        <span class="blog-cat-badge">${catLabel}</span>
      </div>
      <div class="blog-card-body">
        <div class="blog-meta"><span class="blog-area">${p.area||'Seoul'}</span><span class="blog-date">${dateStr}</span></div>
        <h2 class="blog-title">${p.title}</h2>
        <p class="blog-excerpt">${p.excerpt || p.meta_description || ''}</p>
        <div class="blog-footer">
          <div class="blog-tags">${tags.slice(0,3).map((t:string)=>`<span class="blog-tag">#${t}</span>`).join('')}</div>
          <span class="blog-read">Read more →</span>
        </div>
      </div>
    </article>`
  }).join('')

  // 다른 카테고리 링크
  const otherCats = Object.entries(CAT_LABELS)
    .filter(([k]) => k !== cat)
    .map(([k,v]) => `<a href="/blog/category/${k}" style="display:inline-flex;align-items:center;padding:6px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.6);text-decoration:none;font-size:12px;font-weight:600;transition:all .2s" onmouseover="this.style.background='rgba(255,77,141,.15)';this.style.borderColor='rgba(255,77,141,.3)';this.style.color='#FF4D8D'" onmouseout="this.style.background='rgba(255,255,255,.06)';this.style.borderColor='rgba(255,255,255,.1)';this.style.color='rgba(255,255,255,.6)'">${v}</a>`)
    .join('')

  const metaDesc = `Best ${catLabel} guides for foreigners in Seoul. Expert tips, salon reviews, pricing, and English-friendly booking — updated ${new Date().getFullYear()}.`
  const canonicalUrl = `${base}/blog/category/${cat}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-1N9ZQRHLJ0');</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${catLabel} in Seoul — K-Beauty Guides for Foreigners | Seoul Beauty Trip</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${catLabel} in Seoul — K-Beauty Guides for Foreigners">
<meta property="og:description" content="${metaDesc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="website">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","url":"${canonicalUrl}","name":"${catLabel} Seoul Guide","description":"${metaDesc}","breadcrumb":{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"${base}"},{"@type":"ListItem","position":2,"name":"Blog","item":"${base}/blog"},{"@type":"ListItem","position":3,"name":"${catLabel}","item":"${canonicalUrl}"}]}}</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d18;color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
.nav{background:#13132a;border-bottom:1px solid rgba(255,77,141,.15);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-logo{font-size:16px;font-weight:900;background:linear-gradient(135deg,#FF4D8D,#FF85B3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.nav-back{color:rgba(255,255,255,.5);text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px;padding:6px 13px;border:1px solid rgba(255,255,255,.12);border-radius:16px;transition:all .2s}
.nav-back:hover{color:#fff;border-color:rgba(255,77,141,.4)}
.blog-hero{padding:40px 20px 24px;text-align:center;background:linear-gradient(180deg,rgba(255,77,141,.08) 0%,transparent 100%)}
.blog-hero h1{font-size:clamp(22px,5vw,34px);font-weight:900;margin-bottom:8px}
.blog-hero p{color:rgba(255,255,255,.5);font-size:14px;max-width:480px;margin:0 auto 16px}
.breadcrumb{font-size:12px;color:rgba(255,255,255,.35);margin-bottom:12px}
.breadcrumb a{color:rgba(255,255,255,.45);text-decoration:none}
.breadcrumb a:hover{color:#FF4D8D}
.cat-nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:20px;padding:0 20px}
.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;padding:20px;max-width:1100px;margin:0 auto}
.blog-card{background:rgba(255,255,255,.04);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;border:1px solid rgba(255,255,255,.07)}
.blog-card:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(255,77,141,.12);border-color:rgba(255,77,141,.2)}
.blog-card-img{height:180px;background-size:cover;background-position:center;position:relative}
.blog-cat-badge{position:absolute;top:12px;left:12px;background:rgba(255,77,141,.85);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px}
.blog-card-body{padding:16px}
.blog-meta{display:flex;justify-content:space-between;margin-bottom:8px}
.blog-area{font-size:11px;color:#FF4D8D;font-weight:700}
.blog-date{font-size:11px;color:rgba(255,255,255,.3)}
.blog-title{font-size:16px;font-weight:800;line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.blog-excerpt{font-size:13px;color:rgba(255,255,255,.5);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:12px}
.blog-footer{display:flex;justify-content:space-between;align-items:center}
.blog-tags{display:flex;gap:4px;flex-wrap:wrap}
.blog-tag{font-size:10px;color:rgba(255,255,255,.3);background:rgba(255,255,255,.06);padding:3px 7px;border-radius:8px}
.blog-read{font-size:12px;color:#FF4D8D;font-weight:700;white-space:nowrap}
@media(max-width:480px){.blog-grid{grid-template-columns:1fr;padding:14px}}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">Seoul Beauty Trip</a>
  <a href="/blog" class="nav-back"><i class="fas fa-arrow-left"></i> All Posts</a>
</nav>
<header class="blog-hero">
  <div class="breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a> › ${catLabel}</div>
  <h1><i class="fas fa-${cat==='headspa'?'spa':cat==='clinic'?'stethoscope':cat==='hair'?'cut':cat==='nail'?'hand-sparkles':cat==='makeup'?'star':cat==='skincare'?'leaf':cat==='tattoo'?'pen-nib':'hot-tub'}" style="color:#FF4D8D;margin-right:8px"></i>${catLabel} in Seoul</h1>
  <p>Expert guides for foreigners — English-friendly salons, honest reviews & real pricing</p>
  <div class="cat-nav">${otherCats}</div>
</header>
<main class="blog-grid">${postCards}</main>
<footer style="text-align:center;padding:32px 20px;color:rgba(255,255,255,.25);font-size:12px;border-top:1px solid rgba(255,255,255,.06);margin-top:20px">
  <a href="/blog" style="color:#FF4D8D;text-decoration:none;font-weight:700">← All Seoul Beauty Guides</a>
  <p style="margin-top:8px">© ${new Date().getFullYear()} Seoul Beauty Trip. All rights reserved.</p>
</footer>
</body>
</html>`
  return c.html(html)
})

app.get('/blog/:slug', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  const slug = c.req.param('slug')
  const rows = await sql`SELECT * FROM blog_posts WHERE slug=${slug} AND status='published'`
  if (!rows.length) return c.notFound()
  const post = rows[0]
  const tags = Array.isArray(post.tags) ? post.tags : (typeof post.tags === 'string' ? JSON.parse(post.tags||'[]') : [])

  // 조회수 +1
  sql`UPDATE blog_posts SET views=views+1 WHERE slug=${slug}`.catch(()=>{})

  // 관련 글 (같은 카테고리, 최대 3개)
  const related = await sql`SELECT slug,title,excerpt,category,area,created_at FROM blog_posts WHERE status='published' AND slug!=${slug} AND category=${post.category||''} ORDER BY created_at DESC LIMIT 3`

  const base = 'https://seoulbeautytrip.com'
  const catLabel: Record<string,string> = { headspa:'Head Spa', skincare:'Skincare', hair:'Hair Salon', nail:'Nail Art', clinic:'Skin Clinic', makeup:'Makeup', spa:'Spa', tattoo:'Eyebrow Tattoo' }
  const cat = catLabel[post.category] || post.category || 'Beauty'
  const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : ''
  const canonicalUrl = `${base}/blog/${slug}`

  const relatedHtml = related.length ? `
  <aside class="related-posts">
    <h3>📚 Related Articles</h3>
    <div class="related-grid">
      ${related.map((r: any) => `
      <a href="/blog/${r.slug}" class="related-card">
        <div class="related-cat">${catLabel[r.category]||r.category}</div>
        <div class="related-title">${r.title}</div>
        <div class="related-area">${r.area||'Seoul'}</div>
      </a>`).join('')}
    </div>
  </aside>` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${post.title} | Seoul Beauty Trip Blog</title>
<meta name="description" content="${post.meta_description||post.excerpt||''}">
<meta name="robots" content="${(!post.title || post.slug.startsWith('test-') || (!post.meta_description && !post.excerpt)) ? 'noindex, follow' : 'index, follow'}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.meta_description||post.excerpt||''}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${post.cover_image || 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg'}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${post.title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${post.title}">
<meta name="twitter:description" content="${post.meta_description||''}">
<meta name="twitter:image" content="${post.cover_image || 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg'}">
<script type="application/ld+json">${JSON.stringify({
  "@context":"https://schema.org",
  "@type":"BlogPosting",
  "headline": post.title,
  "description": post.meta_description||post.excerpt||'',
  "url": canonicalUrl,
  "datePublished": post.created_at,
  "dateModified": post.updated_at||post.created_at,
  "author":{"@type":"Organization","name":"Seoul Beauty Trip","url":base},
  "publisher":{"@type":"Organization","name":"Seoul Beauty Trip","url":base},
  "keywords": tags.join(', '),
  "articleSection": cat,
  ...(post.cover_image ? {"image":post.cover_image} : {})
})}</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d18;color:#fff;font-family:"Segoe UI",sans-serif;line-height:1.7}
.nav{background:#13132a;border-bottom:1px solid rgba(255,77,141,.15);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-logo{font-size:16px;font-weight:900;background:linear-gradient(135deg,#FF4D8D,#FF85B3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.nav-back{color:rgba(255,255,255,.5);text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px;padding:6px 13px;border:1px solid rgba(255,255,255,.12);border-radius:16px;transition:.2s}
.nav-back:hover{color:#fff;border-color:rgba(255,77,141,.4)}
.post-container{max-width:760px;margin:0 auto;padding:30px 20px 60px}
.post-breadcrumb{font-size:12px;color:rgba(255,255,255,.35);margin-bottom:20px;display:flex;align-items:center;gap:6px}
.post-breadcrumb a{color:rgba(255,255,255,.4);text-decoration:none}
.post-breadcrumb a:hover{color:#FF4D8D}
.post-header{margin-bottom:28px}
.post-cats{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.post-cat-badge{background:rgba(255,77,141,.15);color:#FF4D8D;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(255,77,141,.3)}
.post-area-badge{background:rgba(155,89,182,.15);color:#c39bd3;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid rgba(155,89,182,.3)}
.post-title{font-size:clamp(1.5rem,4vw,2rem);font-weight:900;line-height:1.25;margin-bottom:14px;color:#fff}
.post-meta{display:flex;align-items:center;gap:14px;font-size:12px;color:rgba(255,255,255,.35);margin-bottom:20px;flex-wrap:wrap}
.post-meta i{color:rgba(255,77,141,.6)}
.post-cover{width:100%;height:300px;object-fit:cover;border-radius:16px;margin-bottom:28px;background:linear-gradient(135deg,#ff4d8d22,#9b59b622)}
.post-body{font-size:15px;line-height:1.85;color:rgba(255,255,255,.85)}
.post-body h2{font-size:1.2rem;font-weight:800;color:#fff;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(255,77,141,.2)}
.post-body h3{font-size:1rem;font-weight:700;color:rgba(255,255,255,.9);margin:20px 0 8px}
.post-body p{margin-bottom:16px;color:rgba(255,255,255,.75)}
.post-body strong{color:#fff;font-weight:700}
.post-body ul,.post-body ol{margin:12px 0 16px 20px;color:rgba(255,255,255,.75)}
.post-body li{margin-bottom:6px}
.post-body a{color:#FF4D8D;text-decoration:none}
.post-body a:hover{text-decoration:underline}
.post-tags{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0}
.post-tag{font-size:12px;color:rgba(255,255,255,.4);background:rgba(255,255,255,.06);padding:5px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.08)}
.cta-box{background:linear-gradient(135deg,rgba(255,77,141,.12),rgba(155,89,182,.12));border:1px solid rgba(255,77,141,.25);border-radius:16px;padding:24px;text-align:center;margin:32px 0}
.cta-box h3{font-size:16px;font-weight:800;margin-bottom:8px}
.cta-box p{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:16px}
.cta-btn{display:inline-block;background:linear-gradient(135deg,#FF4D8D,#9B59B6);color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:30px;text-decoration:none}
.related-posts{margin-top:40px;padding-top:28px;border-top:1px solid rgba(255,255,255,.08)}
.related-posts h3{font-size:15px;font-weight:800;margin-bottom:16px;color:rgba(255,255,255,.8)}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.related-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;text-decoration:none;transition:.2s}
.related-card:hover{border-color:rgba(255,77,141,.3)}
.related-cat{font-size:10px;color:#FF4D8D;font-weight:700;margin-bottom:6px;text-transform:uppercase}
.related-title{font-size:12.5px;color:rgba(255,255,255,.8);font-weight:700;line-height:1.4;margin-bottom:6px}
.related-area{font-size:11px;color:rgba(255,255,255,.3)}
@media(max-width:600px){.related-grid{grid-template-columns:1fr}.post-cover{height:200px}}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">✨ Seoul Beauty Trip</a>
  <a href="/blog" class="nav-back"><i class="fas fa-arrow-left"></i> Blog</a>
</nav>
<main class="post-container">
  <div class="post-breadcrumb">
    <a href="/">Home</a> <span>›</span>
    <a href="/blog">Blog</a> <span>›</span>
    <span>${post.title}</span>
  </div>
  <header class="post-header">
    <div class="post-cats">
      <span class="post-cat-badge"><i class="fas fa-tag"></i> ${cat}</span>
      ${post.area ? `<span class="post-area-badge"><i class="fas fa-map-marker-alt"></i> ${post.area}</span>` : ''}
    </div>
    <h1 class="post-title">${post.title}</h1>
    <div class="post-meta">
      <span><i class="fas fa-calendar"></i> ${dateStr}</span>
      <span><i class="fas fa-eye"></i> ${(post.views||0)+1} views</span>
      <span><i class="fas fa-clock"></i> BLOG_READMIN_PLACEHOLDER min read</span>
    </div>
  </header>
  BLOG_COVER_PLACEHOLDER
  <article class="post-body">BLOG_CONTENT_PLACEHOLDER</article>
  <div class="post-tags">BLOG_TAGS_PLACEHOLDER</div>
  <div class="cta-box">
    <h3>💅 Ready to Book Your K-Beauty Experience?</h3>
    <p>Browse the best salons in Seoul — English booking via WhatsApp, no Korean needed.</p>
    <a href="/" class="cta-btn">🌸 Find Salons Now</a>
  </div>
  BLOG_RELATED_PLACEHOLDER
</main>
</body>
</html>`
  // content/tags 등을 별도로 치환 (CF Workers 템플릿 리터럴 CPU 부담 경감)
  const readMin = Math.ceil((post.content||'').replace(/<[^>]+>/g,'').split(' ').length / 200)
  const coverHtml = post.cover_image
    ? '<img src="'+post.cover_image+'" alt="'+post.title.replace(/"/g,'&quot;')+'" class="post-cover" loading="lazy">'
    : ''
  const tagsHtml = tags.map((t:string)=>'<span class="post-tag">#'+t+'</span>').join('')
  const finalHtml = html
    .replace('BLOG_READMIN_PLACEHOLDER', String(readMin))
    .replace('BLOG_COVER_PLACEHOLDER', coverHtml)
    .replace('BLOG_CONTENT_PLACEHOLDER', post.content||'')
    .replace('BLOG_TAGS_PLACEHOLDER', tagsHtml)
    .replace('BLOG_RELATED_PLACEHOLDER', relatedHtml)
  return c.html(finalHtml)
})

app.get('/sitemap.xml', async (c) => {
  await ensureDb(c.env)
  const sql = getDb(c.env)
  let shopSlugs: string[] = []
  let blogSlugs: string[] = []
  let videoIds: string[] = []
  try {
    const rows = await sql`SELECT slug FROM shops WHERE active=true AND slug IS NOT NULL AND slug!=''`
    shopSlugs = rows.map((r: any) => r.slug).filter((s: string) => {
      // 비정상 slug 필터링: 하이픈으로 시작하거나, 숫자로만 끝나는 이상한 slug 제외
      if (!s || s.startsWith('-')) return false
      if (/^-/.test(s)) return false
      return true
    })
  } catch(e) {}
  try {
    const brows = await sql`SELECT slug, title, meta_description, content FROM blog_posts WHERE status='published' AND slug IS NOT NULL AND slug != '' AND title IS NOT NULL AND title != ''`
    // test 페이지, 빈 콘텐츠/description 페이지 제외
    blogSlugs = brows
      .filter((r: any) => {
        const s = (r.slug || '')
        const t = (r.title || '').toLowerCase()
        const d = (r.meta_description || r.content || '')
        if (s.startsWith('test-') || t.startsWith('test ')) return false  // test 페이지 제외
        if (!d || d.trim().length < 20) return false  // 내용 없는 페이지 제외
        return true
      })
      .map((r: any) => r.slug)
  } catch(e) {}
  try {
    const vrows = await sql`SELECT id FROM videos ORDER BY created_at DESC`
    videoIds = vrows.map((r: any) => String(r.id)).filter(Boolean)
  } catch(e) {}
  const base = 'https://seoulbeautytrip.com'
  const today = new Date().toISOString().split('T')[0]

  // 카테고리×지역 조합 — 실제 업체가 있는 페이지만 sitemap 포함
  // (업체 없는 지역은 /best/:cat/seoul 로 301 redirect → sitemap 중복/thin 제거)
  const bestPages: string[] = []
  try {
    // 업체가 있는 카테고리+지역 조합 조회
    const shopRows = await sql`
      SELECT category, LOWER(location) as loc FROM shops WHERE active=true
    `
    const hasCatArea = new Set<string>()
    for (const r of shopRows) {
      const cat = r.category as string
      for (const [areaKey, areaLabel] of Object.entries(AREA_LABELS)) {
        if (areaKey === 'seoul') continue
        if ((r.loc as string || '').includes(areaLabel.toLowerCase())) {
          hasCatArea.add(`${cat}|${areaKey}`)
        }
      }
    }
    for (const cat of Object.keys(CATEGORY_LABELS)) {
      // seoul (전체) 항상 포함
      bestPages.push(`<url><loc>${base}/best/${cat}/seoul</loc><changefreq>weekly</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`)
      // 업체 있는 특정 지역만 포함
      for (const area of Object.keys(AREA_LABELS)) {
        if (area === 'seoul') continue
        if (hasCatArea.has(`${cat}|${area}`)) {
          bestPages.push(`<url><loc>${base}/best/${cat}/${area}</loc><changefreq>weekly</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`)
        }
      }
    }
  } catch(e) {
    // fallback: 기존 방식
    for (const cat of Object.keys(CATEGORY_LABELS)) {
      for (const area of Object.keys(AREA_LABELS)) {
        bestPages.push(`<url><loc>${base}/best/${cat}/${area}</loc><changefreq>weekly</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`)
      }
    }
  }

  // 블로그 카테고리 페이지 — 실제 글 있는 카테고리만
  const blogCatSet = new Set<string>()
  try {
    const catRows = await sql`SELECT DISTINCT category FROM blog_posts WHERE status='published' AND category IS NOT NULL AND category!=''`
    for (const r of catRows) blogCatSet.add(r.category as string)
  } catch(e) {}
  const blogCatPages = Array.from(blogCatSet).map(cat =>
    `<url><loc>${base}/blog/category/${cat}</loc><changefreq>weekly</changefreq><priority>0.85</priority><lastmod>${today}</lastmod></url>`
  )

  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${base}/blog</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`,
    ...blogCatPages,
    ...bestPages,
    ...shopSlugs.map(slug =>
      `<url><loc>${base}/shop/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`
    ),
    ...blogSlugs.map(slug =>
      `<url><loc>${base}/blog/${slug}</loc><changefreq>weekly</changefreq><priority>0.85</priority><lastmod>${today}</lastmod></url>`
    ),
    ...videoIds.map(id =>
      `<url><loc>${base}/video/${id}</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${today}</lastmod></url>`
    )
  ].join('\n  ')
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  ${urls}
</urlset>`, 200, { 'Content-Type': 'application/xml; charset=utf-8' })
})

// ── robots.txt ──
app.get('/robots.txt', (c) => c.text(
`User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://seoulbeautytrip.com/sitemap.xml
`))

// ── MAIN PAGE ── (초기 데이터 인라인으로 삽입해 첫 fetch 제거)
// DB 쿼리 타임아웃 래퍼 (Neon cold start 대비 — Vercel 60s 제한 초과 방지)
const withTimeout = (promise: Promise<any>, ms: number, fallback: any): Promise<any> =>
  Promise.race([promise, new Promise<any>(resolve => setTimeout(() => resolve(fallback), ms))])

app.get('/', async (c) => {
  const sql = getDb(c.env)
  try {
    const vidRows = await withTimeout(
      sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.active=true ORDER BY v.views DESC, v.created_at DESC`,
      15000, []
    )
    const initVideos = vidRows.map((r: any) => {
      // thumbnail: DB 저장값 → Cloudinary 자동 생성 (so_0 첫프레임 JPG) 순서로 fallback
      const vUrl = r.video_url || ''
      const dbThumb = r.thumbnail || ''
      const autoThumb = (!dbThumb && vUrl && vUrl.includes('cloudinary.com'))
        ? vUrl.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace(/\.mp4$/, '.jpg')
        : ''
      const finalThumb = dbThumb || autoThumb
      // shop thumbnail: /api/photo 상대경로는 VideoObject JSON-LD에 사용 불가 → Cloudinary thumb fallback만 사용
      const shopThumbRaw = r.shop_thumb || ''
      const shopThumb = shopThumbRaw.startsWith('http') ? shopThumbRaw : ''
      return {
        id: r.id, shopId: r.shop_id,
        // cleanVideoTitle: 인스타 파일명 패턴 → shop_name으로 대체
        title: cleanVideoTitle(r.title || '', r.shop_name || ''),
        description: r.description || '',
        videoUrl: vUrl, thumbnail: finalThumb, tags: r.tags || [],
        views: r.views || 0, likes: r.likes || 0, createdAt: r.created_at || '',
        shop: { id: r.shop_id, name: r.shop_name || '', category: r.shop_cat || '', location: r.shop_location || '', thumbnail: shopThumb }
      }
    })
    // platform 테이블 대신 PLATFORM 상수 사용
    const initPlatform = { whatsapp: PLATFORM.whatsapp, name: PLATFORM.name, instagram: PLATFORM.instagram }
    // </script> 문자열이 JSON 안에 있으면 HTML 파서가 스크립트를 조기 종료 → 이스케이프 처리
    const safeJson = (obj: any) => JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--')

    // VideoObject JSON-LD — 구글 동영상 검색 색인용 (전체 영상, 최대 20개)
    // embedUrl: /video/:id 전용 보기 페이지 (Google 요구사항 — 영상이 주요 콘텐츠인 전용 URL)
    // ※ slice 제거: 5개만 포함하면 나머지 7개가 누락되어 "일부 항목이 잘못됨" 오류 발생
    const videoJsonLd = initVideos.slice(0, 20).map((v: any) => {
      // thumbnailUrl: 반드시 https:// 절대 URL이어야 함 (Google 필수)
      // 우선순위: DB thumbnail → Cloudinary 자동(so_0 JPG) → shop thumbnail(https만) → og-cover
      const vThumb = (v.thumbnail && v.thumbnail.startsWith('http') ? v.thumbnail : '')
        || (v.videoUrl && v.videoUrl.includes('cloudinary.com') ? v.videoUrl.replace('/video/upload/', '/video/upload/so_0,w_600,h_1066,c_fill,q_auto/').replace(/\.mp4$/, '.jpg') : '')
        || (v.shop?.thumbnail && v.shop.thumbnail.startsWith('http') ? v.shop.thumbnail : '')
        || 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg'
      const vUploadDate = v.createdAt
        ? (v.createdAt.includes('T') ? v.createdAt : v.createdAt + 'T00:00:00+09:00')
        : new Date().toISOString()
      const vEmbedUrl = `https://seoulbeautytrip.com/video/${v.id}`
      return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        'name': v.title || (v.shop?.name ? `${v.shop.name} Seoul Beauty Video` : 'Seoul Beauty Video'),
        'description': v.description || `Watch ${v.shop?.name || 'Seoul Beauty'} treatments and services in Seoul. Book via WhatsApp.`,
        'thumbnailUrl': vThumb,
        'uploadDate': vUploadDate,
        // ⚠️ contentUrl 제거: mp4 직접링크를 넣으면 Google이 별도 "동영상 URL"로 인식 →
        //    "여러 동영상 URL이 이 동영상에 속함" + 21개 URL 오류 발생
        //    embedUrl(/video/:id 전용 보기 페이지)만으로 충분
        'embedUrl': vEmbedUrl,
        'duration': 'PT30S',
        'publisher': {
          '@type': 'Organization',
          'name': 'Seoul Beauty Trip',
          'url': 'https://seoulbeautytrip.com',
          'logo': { '@type': 'ImageObject', 'url': 'https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg' }
        }
      }
    })
    const videoLdScript = videoJsonLd.length
      ? `<script type="application/ld+json">${safeJson(videoJsonLd)}<\/script>`
      : ''

    // ── SSR: shops 데이터 서버에서 함께 가져오기 (카탈로그 Loading... 제거)
    const shopRows = await withTimeout(
      sql`SELECT id, name, slug, category, location, thumbnail, rating, review_count FROM shops WHERE active=true ORDER BY rating DESC, review_count DESC`,
      10000, []
    )
    const initShops = shopRows.map((r: any) => ({
      id: r.id, name: r.name, slug: r.slug || '',
      category: r.category || 'beauty', location: r.location || 'Seoul',
      thumbnail: r.thumbnail || '', rating: r.rating || 0, reviewCount: r.review_count || 0
    }))

    // ── SSR: 카탈로그 패널 HTML 서버에서 렌더링 (Google 크롤러가 읽을 수 있도록)
    const catColorsSSR: Record<string,string> = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa',tattoo:'#e879f9'}
    const catFaIconsSSR: Record<string,string> = {skincare:'fa-leaf',makeup:'fa-magic',hair:'fa-cut',headspa:'fa-spa',nail:'fa-hand-sparkles',clinic:'fa-briefcase-medical',spa:'fa-hot-tub',tattoo:'fa-pen-nib'}
    const catLabelsSSR: Record<string,string> = {skincare:'Skincare',makeup:'Makeup',hair:'Hair',headspa:'Head Spa',nail:'Nail',clinic:'Clinic',spa:'Spa',tattoo:'Brow Tattoo'}

    const ssrShopCards = initShops.map((s: any) => {
      const col  = catColorsSSR[s.category] || '#aaa'
      const icon = catFaIconsSSR[s.category] || 'fa-star'
      const lbl  = catLabelsSSR[s.category] || s.category
      const loc  = (s.location || '').split(',')[0].trim()
      const href = s.slug ? `/shop/${s.slug}` : '#'
      return `<a class="sp-card" href="${href}" data-cat="${s.category}" data-name="${s.name.toLowerCase().replace(/"/g,'')}" data-loc="${loc.toLowerCase()}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background=''">
  <div style="width:44px;height:44px;border-radius:10px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,.06)"><img src="${s.thumbnail||''}" alt="${s.name}" style="width:100%;height:100%;object-fit:cover" loading="lazy"></div>
  <div style="flex:1;min-width:0">
    <div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
    <div style="font-size:10px;color:${col};margin-top:2px"><i class="fas ${icon}" style="margin-right:3px"></i>${lbl} · ${loc}</div>
  </div>
  <div style="font-size:11px;color:rgba(255,255,255,.4);flex-shrink:0">★${s.rating}</div>
</a>`
    }).join('')

    const ssrCatCounts: Record<string,number> = {}
    initShops.forEach((s: any) => { ssrCatCounts[s.category] = (ssrCatCounts[s.category]||0)+1 })
    const ssrFilterBtns = ['all','clinic','headspa','skincare','hair','nail','makeup','spa','tattoo'].map(cat => {
      const cnt = cat === 'all' ? initShops.length : (ssrCatCounts[cat]||0)
      if(cnt === 0) return ''
      const lbl = cat === 'all' ? 'All' : catLabelsSSR[cat] || cat
      return `<button class="sp-flt${cat==='all'?' on':''}" data-cat="${cat}" onclick="filterSpGrid(this)">${lbl} <span class="sp-flt-n">${cnt}</span></button>`
    }).join('')

    const ssrCountText = `${initShops.length} shops`

    const inlineScript = `${videoLdScript}<script>window.__INIT_VIDEOS__=${safeJson(initVideos)};window.__INIT_PLATFORM__=${safeJson(initPlatform)};window.__INIT_SHOPS__=${safeJson(initShops)};<\/script>`

    // SSR placeholders를 실제 콘텐츠로 교체
    const html = MAIN_HTML
      .replace('__INLINE_DATA_PLACEHOLDER__', inlineScript)
      .replace('__SSR_SHOP_COUNT__', ssrCountText)
      .replace('__SSR_FILTER_BTNS__', ssrFilterBtns)
      .replace('__SSR_SHOP_CARDS__', ssrShopCards)

    return c.html(html)
  } catch(e: any) {
    console.error('[/ route error]', e?.message || e)
    return c.html(MAIN_HTML
      .replace('__INLINE_DATA_PLACEHOLDER__', '')
      .replace('__SSR_SHOP_COUNT__', 'K-beauty shops')
      .replace('__SSR_FILTER_BTNS__', '<button class="sp-flt on" data-cat="all">All</button>')
      .replace('__SSR_SHOP_CARDS__', ''))
  }
})
app.get('/admin', (c) => {
  const token = c.env?.GSK_TOKEN || c.env?.gsk_token || c.env?.GENSPARK_TOKEN || c.env?.genspark_token || ''
  const html = ADMIN_HTML.replace('__GSK_TOKEN__', token)
  return c.html(html)
})

// ── GA4 Data API 프록시 ──
// GA4 서비스 계정 JWT 생성 (RS256)
async function makeGa4Jwt(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }
  const b64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const unsigned = `${b64(header)}.${b64(payload)}`

  // PEM → CryptoKey
  const pem = sa.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  return `${unsigned}.${sigB64}`
}

async function getGa4Token(serviceAccountJson: string): Promise<string> {
  const jwt = await makeGa4Jwt(serviceAccountJson)
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  })
  const d: any = await r.json()
  return d.access_token
}

app.get('/api/analytics', async (c) => {
  try {
    // Cloudflare Workers: c.env 우선, 없으면 process.env fallback
    const saKey = (c.env as any)?.GA4_SERVICE_ACCOUNT_KEY
      || (typeof process !== 'undefined' ? process.env.GA4_SERVICE_ACCOUNT_KEY : undefined)
    const propId = (c.env as any)?.GA4_PROPERTY_ID
      || (typeof process !== 'undefined' ? process.env.GA4_PROPERTY_ID : undefined)

    if (!saKey || !propId) {
      return c.json({ error: 'GA4_NOT_CONFIGURED' }, 503)
    }

    const days = parseInt(c.req.query('days') || '7')
    const startDate = `${days}daysAgo`
    const token = await getGa4Token(saKey)

    const ga4Fetch = (body: object) => fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    ).then(r => r.json())

    // 병렬로 모든 데이터 요청
    const [overview, daily, countries, pages, sources, devices] = await Promise.all([
      // 1. 핵심 지표 (전체 기간)
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        metrics: [
          { name: 'totalUsers' }, { name: 'screenPageViews' },
          { name: 'newUsers' }, { name: 'averageSessionDuration' }
        ]
      }),
      // 2. 일별 방문자
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }]
      }),
      // 3. 국가별
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 8
      }),
      // 4. 인기 페이지
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10
      }),
      // 5. 유입 경로
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6
      }),
      // 6. 디바이스
      ga4Fetch({
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }]
      })
    ])

    return c.json({ overview, daily, countries, pages, sources, devices })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default app

// ════════════════════════════════════════════
const MAIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Seoul Beauty Trip — Book Korean Beauty in Seoul | Skincare, Hair, Nail, Clinic</title>
<meta name="description" content="Discover and book the best Korean beauty salons in Seoul. Skincare, makeup, hair, nail art and derma clinics — foreign-friendly with WhatsApp booking. K-beauty at its finest.">
<meta name="keywords" content="Seoul beauty salon, Korean skincare, K-beauty booking, Seoul hair salon, Seoul nail art, Korean makeup, Seoul derma clinic, beauty travel Korea">
<meta name="robots" content="index, follow">
<meta name="msvalidate.01" content="DD5A8D9AA094B888C8A409EADE4610E9">
<link rel="canonical" href="https://seoulbeautytrip.com/">
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta property="og:title" content="Seoul Beauty Trip — Book Korean Beauty in Seoul">
<meta property="og:description" content="Discover and book the best Korean beauty salons in Seoul. Skincare, makeup, hair, nail art and derma clinics — foreign-friendly with WhatsApp booking.">
<meta property="og:image" content="https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="Seoul Beauty Trip — Book Korean Beauty in Seoul">
<meta property="og:url" content="https://seoulbeautytrip.com/">
<meta property="og:locale" content="en_US">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@seoulbeautytrip">
<meta name="twitter:title" content="Seoul Beauty Trip — Book Korean Beauty in Seoul">
<meta name="twitter:description" content="Discover and book the best Korean beauty salons in Seoul. WhatsApp booking, foreign-friendly.">
<meta name="twitter:image" content="https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg">
<meta name="twitter:image:alt" content="Seoul Beauty Trip — Book Korean Beauty in Seoul">
<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":"WebSite",
      "@id":"https://seoulbeautytrip.com/#website",
      "url":"https://seoulbeautytrip.com/",
      "name":"Seoul Beauty Trip",
      "description":"Discover and book the best Korean beauty salons in Seoul.",
      "inLanguage":"en",
      "potentialAction":{
        "@type":"SearchAction",
        "target":{"@type":"EntryPoint","urlTemplate":"https://seoulbeautytrip.com/?cat={search_term_string}"},
        "query-input":"required name=search_term_string"
      }
    },
    {
      "@type":"Organization",
      "@id":"https://seoulbeautytrip.com/#organization",
      "name":"Seoul Beauty Trip",
      "url":"https://seoulbeautytrip.com/",
      "logo":"https://res.cloudinary.com/dc0ouozcd/video/upload/so_0,w_1200,h_630,c_fill,q_80/v1779652741/seoul-beauty/tuynkcoz6ni4eedmspsa.jpg",
      "sameAs":["https://instagram.com/seoulbeautytrip"]
    }
  ]
}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css"></noscript>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;
  --gold:#C9A84C;--gold2:#F0C96E;
  --bg:#08080E;--bg2:#0F0F1A;--bg3:#161625;
  --cd:#1A1A2E;--cd2:#1F1F35;
  --border:rgba(255,255,255,.07);
  --ff-serif:'Playfair Display',serif;
  --ff-sans:'Inter',sans-serif;
}
html,body{height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:var(--ff-sans)}
/* ── 로딩 스플래시 ── */
#ld{position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:opacity .6s}
.ld-pre{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.28);text-transform:uppercase;font-family:var(--ff-sans)}
.ld-logo{font-family:var(--ff-serif);font-size:34px;font-weight:900;background:linear-gradient(135deg,#fff 0%,var(--pk3) 60%,var(--gold2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;text-align:center;line-height:1.1;animation:ldpulse 2s ease-in-out infinite}
.ld-sub{font-size:9px;letter-spacing:6px;color:rgba(255,255,255,.25);text-transform:uppercase;margin-top:2px}
.ld-line{width:1px;height:28px;background:linear-gradient(to bottom,transparent,rgba(201,168,76,.5),transparent);margin:10px 0 6px}
.ld-bar{width:140px;height:2px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:4px}
.ld-prog{height:100%;background:linear-gradient(90deg,var(--pk),var(--gold));animation:ldpg 2.2s cubic-bezier(.4,0,.2,1) forwards}
.ld-tips{font-size:10px;color:rgba(255,255,255,.18);margin-top:18px;letter-spacing:.3px;text-align:center;min-height:14px;transition:opacity .4s}
@keyframes ldpg{from{width:0}to{width:100%}}
@keyframes ldpulse{0%,100%{opacity:1}50%{opacity:.75}}
/* ── 모달 hero 이미지 shimmer + blur-up ── */
.m-hero{position:relative}
.m-hero::before{
  content:'';position:absolute;inset:0;z-index:1;
  background:linear-gradient(105deg,#0c0c1e 40%,rgba(255,255,255,.045) 50%,#0c0c1e 60%);
  background-size:200% 100%;
  animation:mh-shimmer 1.6s infinite linear;
  border-radius:0;
}
@keyframes mh-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.m-hero.loaded::before{display:none}
.m-hero-img{
  position:relative;z-index:2;
  filter:blur(8px);transform:scale(1.05);
  transition:filter .5s ease,transform .5s ease;
}
.m-hero.loaded .m-hero-img{filter:blur(0);transform:scale(1)}
/* 썸네일 스트립 이미지도 blur-up */
.m-ts-thumb img{
  filter:blur(4px);transform:scale(1.04);
  transition:filter .35s ease,transform .35s ease;
}
.m-ts-thumb.img-loaded img{filter:blur(0);transform:scale(1)}
/* 사진 그리드 blur-up */
.m-photos-grid img{
  filter:blur(5px);transform:scale(1.04);
  transition:filter .35s ease,transform .35s ease,opacity .2s;
}
.m-photos-grid img.img-loaded{filter:blur(0);transform:scale(1)}
/* ── 스켈레톤 슬라이드 ── */
.skeleton-feed{height:100vh;width:100%;max-width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#0a0a14;flex-shrink:0;display:flex;flex-direction:column;justify-content:flex-end}
.sk-bg{position:absolute;inset:0;background:linear-gradient(135deg,#0e0e20 0%,#12121e 50%,#0a0a16 100%)}
.sk-shimmer{position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.035) 50%,transparent 60%);background-size:200% 100%;animation:shimmer 1.8s infinite linear}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-info{position:absolute;bottom:0;left:0;right:0;padding:16px 18px 80px;z-index:3;display:flex;flex-direction:column;gap:8px}
.sk-badge{width:80px;height:18px;border-radius:10px;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite}
.sk-title{width:65%;height:20px;border-radius:6px;background:rgba(255,255,255,.07);animation:skpulse 1.5s ease-in-out infinite .1s}
.sk-desc{width:45%;height:13px;border-radius:5px;background:rgba(255,255,255,.05);animation:skpulse 1.5s ease-in-out infinite .2s}
.sk-shop{display:flex;align-items:center;gap:8px;margin-top:4px}
.sk-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite .15s;flex-shrink:0}
.sk-shop-info{display:flex;flex-direction:column;gap:5px}
.sk-shop-name{width:90px;height:12px;border-radius:4px;background:rgba(255,255,255,.06);animation:skpulse 1.5s ease-in-out infinite .2s}
.sk-shop-loc{width:60px;height:10px;border-radius:4px;background:rgba(255,255,255,.04);animation:skpulse 1.5s ease-in-out infinite .3s}
.sk-actions{position:absolute;right:14px;bottom:100px;display:flex;flex-direction:column;gap:16px;align-items:center;z-index:3}
.sk-act-btn{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.05);animation:skpulse 1.5s ease-in-out infinite}
.sk-act-label{width:24px;height:8px;border-radius:3px;background:rgba(255,255,255,.04);animation:skpulse 1.5s ease-in-out infinite .1s}
@keyframes skpulse{0%,100%{opacity:.6}50%{opacity:1}}
/* ── 카테고리 전환 오버레이 ── */
#cat-loading{position:absolute;inset:0;z-index:50;display:none;align-items:center;justify-content:center;pointer-events:none}
#cat-loading.on{display:flex}
.cat-spin{width:28px;height:28px;border:2.5px solid rgba(232,65,122,.15);border-top-color:var(--pk);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* ── 헤더 ── */
#hd{position:fixed;top:0;left:0;right:0;z-index:100;padding:12px 16px 0;background:linear-gradient(to bottom,rgba(8,8,14,.96) 60%,transparent)}
.hd-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.logo{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none}
.logo-mark{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--pk) 0%,#7C3AED 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 14px rgba(232,65,122,.38),0 0 0 1px rgba(255,255,255,.08);font-size:0}
.logo-mark::after{content:'';display:block;width:14px;height:14px;border-radius:50%;border:2.5px solid rgba(255,255,255,.9);box-shadow:0 0 0 3px rgba(255,255,255,.15)}
.logo-text{display:flex;flex-direction:column;gap:1px}
.logo-name{font-family:var(--ff-serif);font-size:16px;font-weight:900;letter-spacing:.2px;line-height:1;background:linear-gradient(100deg,#fff 30%,var(--pk3) 80%,var(--gold2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tag{font-size:7.5px;color:rgba(201,168,76,.75);letter-spacing:3.5px;text-transform:uppercase;-webkit-text-fill-color:rgba(201,168,76,.75);font-weight:600}
.hd-right{display:flex;align-items:center;gap:8px}
.mute-btn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.mute-btn:hover{background:rgba(255,255,255,.1);color:#fff}
/* ── 카테고리 탭 ── */
.cats{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:12px;-webkit-overflow-scrolling:touch;touch-action:pan-x}
.cats::-webkit-scrollbar{display:none}
/* PC에서 cats 가로 스크롤 강제 활성화 */
@media(min-width:768px){
  .cats{overflow-x:scroll;cursor:grab}
  .cats:active{cursor:grabbing}
}
.cat{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:rgba(255,255,255,.4);font-size:10.5px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;font-family:var(--ff-sans);letter-spacing:.1px}
.cat:hover{background:rgba(232,65,122,.12);border-color:rgba(232,65,122,.3);color:rgba(255,255,255,.75)}
.cat.on{background:linear-gradient(135deg,var(--pk) 0%,#7C3AED 100%);border-color:transparent;color:#fff;box-shadow:0 2px 14px rgba(232,65,122,.4),0 0 0 1px rgba(255,255,255,.08) inset}
.cat i{font-size:9px;opacity:.85}
/* ── 피드 ── */
#feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;display:flex;flex-direction:column;align-items:center}
#feed::-webkit-scrollbar{display:none}
/* ── 슬라이드 ── */
.slide{height:100vh;width:100%;max-width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#000;flex-shrink:0}
.bg-img{
  position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
  filter:blur(12px);transform:scale(1.06);
  transition:filter .5s ease,transform .5s ease;
}
.bg-img.loaded{filter:blur(0);transform:scale(1)}
.slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#000}
.ov{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 25%,transparent 40%,rgba(0,0,0,.2) 60%,rgba(0,0,0,.7) 80%,rgba(0,0,0,.92) 100%);cursor:pointer}
/* ── 슬라이드 정보 영역 ── */
.info{position:absolute;bottom:0;left:0;right:0;padding:16px 18px 26px;z-index:3;display:flex;flex-direction:column;gap:0}
.slide-cat-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;background:linear-gradient(135deg,rgba(232,65,122,.25),rgba(124,58,237,.2));backdrop-filter:blur(12px);border:1px solid rgba(232,65,122,.3);font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,.95);margin-bottom:6px;align-self:flex-start;box-shadow:0 2px 8px rgba(232,65,122,.15)}
.slide-cat-badge i{font-size:9px;color:var(--pk3)}
.shop-info-block{flex:1;overflow:hidden;min-width:0;margin-right:10px}
.shop-info-name{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:900;color:#fff;text-shadow:0 2px 16px rgba(0,0,0,.9);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.shop-info-name .si-icon{color:var(--pk3);font-size:13px;flex-shrink:0;filter:drop-shadow(0 0 4px rgba(255,179,204,.4))}
.shop-info-loc{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.5);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop-info-loc i{font-size:9px;color:var(--pk);opacity:.85}
.btns-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:0;overflow:hidden}
.wa-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:22px;border:none;background:linear-gradient(135deg,#25D366 0%,#128C5E 100%);color:#fff;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 16px rgba(37,211,102,.35),0 0 0 1px rgba(255,255,255,.08) inset;letter-spacing:.2px;transition:all .2s;white-space:nowrap;flex-shrink:0}
.wa-btn:hover{opacity:.9;transform:scale(1.03)}
/* ── 인디케이터 ── */
.hint{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:.4;animation:hb 2.4s infinite}
.hint span{font-size:8px;color:#fff;letter-spacing:2px;text-transform:uppercase}
@keyframes hb{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}
#dots{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:200;display:flex;flex-direction:column;gap:5px}
.dot{width:3px;height:3px;border-radius:2px;background:rgba(255,255,255,.18);transition:all .3s}
.dot.on{background:var(--pk);height:18px;box-shadow:0 0 6px rgba(232,65,122,.5)}
/* muteBtn: fixed 해제 → hd-right 인라인 버튼 */
#muteBtn{position:relative;top:auto;right:auto;z-index:1;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0;backdrop-filter:none}
#muteBtn:hover,#muteBtn.on{background:rgba(232,65,122,.15);color:var(--pk2);border-color:rgba(232,65,122,.3)}
/* ── PC 반응형 (768px~1199px) ── */
@media(min-width:768px) and (max-width:1199px){
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  .modal{max-width:420px}
  .hint{display:none}
}
/* ── PC 사이드 카탈로그 완전 제거 ── */
#shop-panel{display:none!important}
#pc-layout{display:block!important}
#feed-col{width:100%}
/* ── PC 반응형 (1200px+) ── */
@media(min-width:1200px){
  body{overflow:hidden}
  /* pc-layout: 피드(좌) + 카탈로그(우) 나란히 */
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  .modal{max-width:420px}
  .hint{display:none}
}
/* ── PC 카탈로그 패널 ── */
#pc-layout{display:block;width:100%}
#feed-col{position:relative}
#shop-panel{display:none;flex:1;height:100vh;overflow-y:auto;background:#0d0d18;border-left:1px solid rgba(255,255,255,.06);padding:16px;scrollbar-width:thin;scrollbar-color:rgba(255,77,141,.3) transparent}
#shop-panel::-webkit-scrollbar{width:4px}
#shop-panel::-webkit-scrollbar-thumb{background:rgba(255,77,141,.3);border-radius:2px}
.sp-header{padding:8px 4px 12px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:14px}
.sp-title{font-size:13px;font-weight:900;color:#fff;letter-spacing:-.2px;margin-bottom:4px}
.sp-subtitle{font-size:11px;color:rgba(255,255,255,.35)}
.sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .2s;position:relative}
.sp-card:hover{border-color:rgba(232,65,122,.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,65,122,.12)}
.sp-card-img{width:100%;height:100px;object-fit:cover;display:block;background:#1a1a2e}
.sp-card-body{padding:9px 10px 10px}
.sp-card-cat{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--pk);margin-bottom:3px;opacity:.85}
.sp-card-name{font-size:12px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sp-card-loc{font-size:10px;color:rgba(255,255,255,.38);display:flex;align-items:center;gap:3px}
.sp-card-loc i{font-size:8px;color:var(--pk);opacity:.7}
.sp-card-rating{position:absolute;top:7px;right:7px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);border-radius:20px;padding:3px 7px;font-size:10px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:3px}
.sp-filter{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding-bottom:8px;margin-bottom:8px;-webkit-overflow-scrolling:touch}
.sp-filter::-webkit-scrollbar{display:none}
.sp-flt{padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);font-size:10px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap}
.sp-flt.on{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff}
.sp-empty{grid-column:1/-1;text-align:center;padding:40px 16px;color:rgba(255,255,255,.25);font-size:12px}
/* ── 업체 모달 ── */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:500;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(16px)}
.modal-bg.open{display:flex}
.modal{background:linear-gradient(180deg,#111118 0%,#0d0d14 100%);border-radius:28px 28px 0 0;padding:0;width:100%;max-width:520px;border:1px solid rgba(255,255,255,.08);border-bottom:none;animation:msu .35s cubic-bezier(.22,1,.36,1);position:relative;height:88vh;display:flex;flex-direction:column;touch-action:pan-y}
@media(min-width:768px){
  .modal-bg{align-items:center}
  .modal{border-radius:24px;border-bottom:1px solid rgba(255,255,255,.08);height:90vh;max-height:860px;max-width:440px}
}
@keyframes msu{from{transform:translateY(100%);opacity:.6}to{transform:translateY(0);opacity:1}}
/* 핸들 */
.modal-handle-area{flex-shrink:0;padding:10px 20px 0;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:10px}
.mhdl{width:32px;height:3px;background:rgba(255,255,255,.12);border-radius:2px}
.modal-top-row{display:flex;align-items:center;justify-content:space-between;width:100%}
.modal-back-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.65);font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer;white-space:nowrap;transition:all .2s}
.modal-back-btn:hover,.modal-back-btn:active{background:rgba(232,65,122,.15);border-color:rgba(232,65,122,.4);color:var(--pk2)}
.mcls{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.mcls:hover{background:rgba(232,65,122,.18);color:#fff;border-color:rgba(232,65,122,.3)}
/* 스크롤 */
.modal-scroll{flex:1;overflow-y:auto;scrollbar-width:none}
.modal-scroll::-webkit-scrollbar{display:none}
/* 히어로 — 풀블리드 사진 */
.m-hero{height:240px;position:relative;overflow:hidden;flex-shrink:0;background:#0a0a12}
.m-hero-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
.m-hero:hover .m-hero-img{transform:scale(1.03)}
.m-hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,transparent 35%,rgba(8,8,14,.95) 100%)}
/* 히어로 위 카테고리 뱃지 */
.m-hero-badge{position:absolute;top:14px;left:16px;display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(8,8,14,.65);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:#fff}
/* 하단 3개 썸네일 스트립 — 히어로 바로 아래 */
.m-thumbstrip{display:flex;gap:4px;padding:0 16px;margin-top:-1px;flex-shrink:0}
.m-ts-thumb{flex:1;height:52px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;border:2px solid transparent;transition:border-color .2s,opacity .2s;opacity:.72}
.m-ts-thumb.on,.m-ts-thumb:hover{border-color:var(--pk);opacity:1}
.m-ts-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.m-ts-more{flex:1;height:52px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:rgba(255,255,255,.45);cursor:pointer;gap:3px}
/* 본문 */
.m-body{padding:16px 20px 20px}
/* 샵 헤더 */
.m-shop-header{margin-bottom:16px}
.m-shop-name{font-family:var(--ff-serif);font-size:22px;font-weight:700;line-height:1.2;margin-bottom:6px;letter-spacing:-.2px}
.m-shop-sub{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.m-shop-loc{display:flex;align-items:center;gap:4px;font-size:11.5px;color:rgba(255,255,255,.4);font-weight:500}
.m-shop-loc i{color:var(--pk2);font-size:10px}
.m-divider{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2)}
.m-stars{color:var(--gold);font-size:11px;letter-spacing:1px}
.m-rating-txt{font-size:11.5px;color:rgba(255,255,255,.38)}
/* 정보 카드 그리드 */
.m-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
.m-info-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.m-info-card-label{font-size:9px;font-weight:700;color:rgba(255,255,255,.28);letter-spacing:1.5px;text-transform:uppercase}
.m-info-card-val{font-size:12.5px;color:rgba(255,255,255,.82);font-weight:600;line-height:1.4}
.m-info-card-val i{color:var(--pk2);margin-right:4px;font-size:11px}
/* 섹션 */
.m-sec{margin-bottom:20px}
.m-sec-title{font-size:9px;font-weight:800;color:var(--gold);letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.m-sec-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(201,168,76,.25),transparent)}
/* 가격 리스트 */
.m-price-list{display:flex;flex-direction:column;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden}
.m-price-item{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.04)}
.m-price-item:last-child{border-bottom:none}
.m-price-name{font-size:13px;color:rgba(255,255,255,.78);font-weight:500}
.m-price-val{font-size:13px;color:var(--gold);font-weight:800;letter-spacing:.3px}
/* 서비스 태그 */
.m-svc-tags{display:flex;flex-wrap:wrap;gap:6px}
.m-svc-tag{padding:5px 13px;background:rgba(232,65,122,.07);border:1px solid rgba(232,65,122,.16);border-radius:20px;font-size:11px;color:rgba(232,65,122,.9);font-weight:600;letter-spacing:.3px}
/* 지도 */
.m-map{border-radius:16px;overflow:hidden;height:210px;border:1px solid rgba(255,255,255,.08);position:relative;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.m-map iframe{width:100%;height:100%;border:0;display:block}
/* 구글맵 "View on Google Maps" 링크 완전 차단 오버레이 */
.m-map-cover{position:absolute;top:4px;left:4px;z-index:4;background:#fff;pointer-events:all;cursor:default;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.08)}
.m-map-cover-txt{font-size:12px;font-weight:400;color:#5f6368;font-family:Roboto,Arial,sans-serif;letter-spacing:0;white-space:nowrap}
.m-map-cover-icon{font-size:12px;color:#1a73e8}
.m-map-zoom{position:absolute;bottom:10px;right:10px;z-index:3;display:flex;flex-direction:column;gap:4px}
.m-map-zoom button{width:32px;height:32px;border-radius:8px;border:none;background:rgba(15,15,25,.82);backdrop-filter:blur(8px);color:#fff;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);transition:background .15s}
.m-map-zoom button:hover{background:rgba(232,65,122,.7)}
/* 영업시간 테이블 */
.m-hours-table{width:100%;border-collapse:collapse}
.m-hours-table tr{border-bottom:1px solid rgba(255,255,255,.05)}
.m-hours-table tr:last-child{border-bottom:none}
.m-hours-table td{padding:7px 4px;font-size:12px;line-height:1.4}
.m-hours-td-day{color:rgba(255,255,255,.5);font-weight:600;width:88px;white-space:nowrap}
.m-hours-td-time{color:rgba(255,255,255,.82);font-weight:500}
.m-hours-td-time.closed{color:rgba(255,100,100,.6);font-style:italic}
.m-hours-td-today{background:rgba(201,168,76,.07);border-radius:6px}
.m-hours-td-today .m-hours-td-day{color:var(--gold)}
.m-hours-td-today .m-hours-td-time{color:var(--gold);font-weight:700}
/* 리뷰 카드 */
.m-review-card{padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.m-review-card:last-child{border-bottom:none}
.m-review-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.m-review-author{font-size:12px;font-weight:700;color:rgba(255,255,255,.85)}
.m-review-stars{font-size:12px;color:var(--gold);letter-spacing:1px}
.m-review-text{font-size:12.5px;color:rgba(255,255,255,.62);line-height:1.75}
.m-review-time{font-size:10px;color:rgba(255,255,255,.28);margin-top:5px}
/* 모달 WHY CHOOSE */
.m-why-list{display:flex;flex-direction:column;gap:8px}
.m-why-item{font-size:13px;color:rgba(255,255,255,.75);line-height:1.6;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;border-left:3px solid var(--pk2)}
/* 모달 SEO 텍스트 블록 */
.m-seo-block{margin-top:4px;margin-bottom:14px;padding:18px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px}
.m-seo-h2{font-size:14px;font-weight:700;color:rgba(255,255,255,.8);margin:0 0 8px 0;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.07);line-height:1.4}
.m-seo-p{font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.8;margin:0 0 14px}
.m-seo-p:last-child{margin-bottom:0}
/* 사진 그리드 */
.m-photos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;border-radius:12px;overflow:hidden}
.m-photos-grid img{width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;transition:opacity .2s}
.m-photos-grid img:hover{opacity:.85}
/* 모달 영상 그리드 — full-bleed (패딩 돌파) */
.m-vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 -20px;overflow:hidden}
.m-vid-card{border-radius:0;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16;background:#0a0a14}
/* 홀수 마지막 카드 → 항상 가운데 full-width */
.m-vid-card:nth-child(odd):last-child{grid-column:1/-1;aspect-ratio:16/9}
@media(min-width:768px){
  .m-vid-grid{border-radius:0 0 20px 20px;overflow:hidden}
}
.m-vid-card:first-child{border-radius:0}
.m-vid-card video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .3s}
.m-vid-card.vid-on video{opacity:1}
.m-vid-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s}
.m-vid-card:active img{transform:scale(1.04)}
.m-vid-card.vid-on img{opacity:0}
.m-vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.88) 100%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:10px 8px;pointer-events:none}
.m-vid-card-title{font-size:12px;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-align:center}
.m-vid-card-views{display:none}
/* 모달 영상 소리 토글 버튼 */
.m-vid-mute-btn{position:absolute;bottom:44px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);font-size:12px;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:10;transition:all .2s;backdrop-filter:blur(4px)}
.m-vid-card.vid-on .m-vid-mute-btn{display:flex}
.m-vid-play-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:38px;height:38px;background:rgba(0,0,0,.48);border:1.5px solid rgba(255,255,255,.65);border-radius:50%;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);transition:opacity .2s,transform .2s;pointer-events:none}
.m-vid-play-ic i{font-size:12px;color:#fff;margin-left:2px}
.m-vid-card.vid-on .m-vid-play-ic{opacity:0;transform:translate(-50%,-60%) scale(.8)}
/* 버튼 */
.m-btns{flex-shrink:0;padding:10px 20px 28px;background:linear-gradient(0deg,#0d0d14 60%,transparent);display:flex;flex-direction:column;gap:8px}
.m-wa{
  display:flex;align-items:center;justify-content:center;gap:10px;
  padding:15px 20px;
  background:linear-gradient(135deg,#25D366 0%,#128C5E 100%);
  border:none;border-radius:16px;color:#fff;
  text-decoration:none;cursor:pointer;
  box-shadow:0 6px 20px rgba(37,211,102,.32),inset 0 1px 0 rgba(255,255,255,.18);
  transition:transform .16s,box-shadow .16s;
  position:relative;overflow:hidden;
}
.m-wa:active{transform:scale(.98)}
.m-wa:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(37,211,102,.42)}
.m-wa-icon{width:32px;height:32px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px}
.m-wa-text{display:flex;flex-direction:row;align-items:center;gap:6px;white-space:nowrap;overflow:hidden}
.m-wa-text b{font-size:14px;font-weight:800;letter-spacing:.2px;flex-shrink:0}
.m-wa-text span{font-size:13px;opacity:.82;font-weight:600;overflow:hidden;text-overflow:ellipsis}
/* 모달 하단 2차 버튼 행 */
.m-btns-row2{display:none}
/* \uac80\uc0c9 */
/* hd-right: 소리버튼·검색버튼 세로 배치로 공간 절약 */
.hd-right{display:flex;flex-direction:column;align-items:center;gap:4px}
.srch-btn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.srch-btn:hover,.srch-btn.on{background:rgba(232,65,122,.15);color:var(--pk2);border-color:rgba(232,65,122,.3)}
#search-bar{overflow:hidden;max-height:0;transition:max-height .32s cubic-bezier(.4,0,.2,1),opacity .28s;opacity:0;padding:0 0 0}
#search-bar.open{max-height:60px;opacity:1;padding:0 0 10px}
.srch-wrap{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:9px 14px;transition:border-color .2s}
.srch-wrap:focus-within{border-color:rgba(232,65,122,.4);background:rgba(232,65,122,.04)}
#srchInput{flex:1;background:none;border:none;outline:none;color:#fff;font-size:14px;font-family:var(--ff-sans)}
#srchInput::placeholder{color:rgba(255,255,255,.28)}
.srch-clear{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:13px;padding:0;line-height:1;transition:color .15s;display:none}
.srch-clear.on{display:block}
.srch-clear:hover{color:rgba(255,255,255,.7)}
/* \uac80\uc0c9 \uacb0\uacfc \uc624\ubc84\ub808\uc774 */
#search-overlay{display:none;position:fixed;inset:0;z-index:800;background:rgba(8,8,14,.97);backdrop-filter:blur(16px);flex-direction:column;overflow:hidden}
#search-overlay.open{display:flex}
.so-topbar{flex-shrink:0;display:flex;align-items:center;gap:10px;padding:52px 14px 10px}
.so-back-btn{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:20px;color:rgba(255,255,255,.7);font-size:11px;font-weight:700;padding:7px 12px;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0}
.so-back-btn:hover,.so-back-btn:active{background:rgba(232,65,122,.15);border-color:rgba(232,65,122,.4);color:var(--pk2)}
.so-srch-wrap{flex:1;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:9px 14px;transition:border-color .2s}
.so-srch-wrap:focus-within{border-color:rgba(232,65,122,.4);background:rgba(232,65,122,.04)}
#soInput{flex:1;background:none;border:none;outline:none;color:#fff;font-size:14px;font-family:var(--ff-sans)}
#soInput::placeholder{color:rgba(255,255,255,.28)}
.so-srch-x{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:12px;padding:0;line-height:1;display:none}
.so-srch-x.on{display:block}
.so-chips-row{flex-shrink:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 14px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
.so-chips-row::-webkit-scrollbar{display:none}
.so-chip{flex-shrink:0;padding:5px 12px;border-radius:16px;font-size:11px;font-weight:700;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.45);cursor:pointer;transition:all .18s;white-space:nowrap}
.so-chip.on{background:rgba(232,65,122,.18);border-color:rgba(232,65,122,.5);color:var(--pk2)}
.so-body{flex:1;overflow-y:auto;padding-top:6px}
.so-header{padding:8px 16px 8px;font-size:11px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:1px;text-transform:uppercase}
.so-grid{display:flex;flex-direction:column;gap:8px;padding:0 14px 40px}
/* ── 검색 카드 (가로형 리스트) ── */
.so-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;cursor:pointer;transition:background .18s,border-color .18s;text-decoration:none;display:flex;flex-direction:row;align-items:center;gap:0;position:relative}
.so-card:active{background:rgba(232,65,122,.07);border-color:rgba(232,65,122,.4)}
/* 이미지 영역 — 정사각형 썸네일 */
.so-card-img-wrap{width:74px;height:74px;flex-shrink:0;position:relative;background:#0c0c1c;overflow:hidden}
.so-card-img-wrap::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(105deg,#0c0c1e 40%,rgba(255,255,255,.04) 50%,#0c0c1e 60%);background-size:200% 100%;animation:sc-shimmer 1.6s infinite linear}
.so-card-img-wrap.loaded::before{display:none}
.so-card-img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;z-index:2;transition:transform .45s}
.so-card-img-wrap.loaded .so-card-img{transform:scale(1)}
/* 영상 미리보기 (가로형에서는 비활성) */
.so-card-vid{display:none}
/* 플레이 아이콘 숨김 (가로형) */
.so-card-play{display:none}
/* 카드 오버레이 — 카테고리 컬러 바 */
.so-card-ov{position:absolute;left:0;top:0;bottom:0;width:3px;z-index:5;border-radius:0;pointer-events:none}
.so-card-cat-badge{display:none}
/* 카드 정보 영역 */
.so-card-body{flex:1;padding:12px 14px 12px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
.so-card-name{font-size:14px;font-weight:800;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.so-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.so-card-loc{font-size:11px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.so-card-rating{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--gold);font-weight:700;flex-shrink:0}
.so-card-cat{font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.55);text-transform:capitalize;flex-shrink:0}
.so-card-arrow{width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.18);font-size:11px}
.so-empty{padding:60px 20px;text-align:center;color:rgba(255,255,255,.25);font-size:14px}
/* 토스트 */
#toast{position:fixed;bottom:72px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(232,65,122,.92);color:#fff;padding:8px 18px;border-radius:18px;font-size:12px;font-weight:700;z-index:600;opacity:0;transition:all .28s;white-space:nowrap;pointer-events:none;backdrop-filter:blur(8px)}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<div id="ld">
  <div class="ld-pre">Welcome to</div>
  <div class="ld-logo">Seoul Beauty Trip</div>
  <div class="ld-sub">Korean Beauty Experience</div>
  <div class="ld-line"></div>
  <div class="ld-bar"><div class="ld-prog"></div></div>
  <div class="ld-tips" id="ldTips"></div>
</div>

<header id="hd">
  <div class="hd-top">
    <div class="logo" id="logoBtn">
      <div class="logo-mark"></div>
      <div class="logo-text">
        <div class="logo-name">Seoul Beauty Trip</div>
        <div class="logo-tag">Korean Beauty Experience</div>
      </div>
    </div>
    <div class="hd-right">
      <button class="srch-btn" id="srchToggle" onclick="toggleSearch()" aria-label="Search shops"><i class="fas fa-search"></i></button>
      <button class="mute-btn" id="muteBtn" onclick="toggleMute()"><i class="fas fa-volume-mute"></i></button>
    </div>
  </div>
  <div id="search-bar">
    <div class="srch-wrap">
      <i class="fas fa-search" style="color:rgba(255,255,255,.28);font-size:12px;flex-shrink:0"></i>
      <input id="srchInput" type="search" placeholder="Search shops, area, category..." autocomplete="off" oninput="onSearch(this.value)">
      <button class="srch-clear" id="srchClear" onclick="clearSearch()"><i class="fas fa-times"></i></button>
    </div>
  </div>
  <nav class="cats" id="cats" aria-label="Beauty categories">
    <button class="cat on" data-cat="all"><i class="fas fa-star"></i> All</button>
    <button class="cat" data-cat="clinic"><i class="fas fa-briefcase-medical"></i> Clinic</button>
    <button class="cat" data-cat="headspa"><i class="fas fa-spa"></i> Head Spa</button>
    <button class="cat" data-cat="skincare"><i class="fas fa-leaf"></i> Skincare</button>
    <button class="cat" data-cat="hair"><i class="fas fa-cut"></i> Hair</button>
    <button class="cat" data-cat="nail"><i class="fas fa-hand-sparkles"></i> Nail</button>
    <button class="cat" data-cat="makeup"><i class="fas fa-magic"></i> Makeup</button>
    <button class="cat" data-cat="spa"><i class="fas fa-hot-tub"></i> Spa</button>
  </nav>
</header>

<!-- 검색 결과 오버레이 -->
<div id="search-overlay" role="dialog" aria-label="Search results">
  <div class="so-topbar">
    <button class="so-back-btn" id="soBackBtn" onclick="closeSearch()"><i class="fas fa-arrow-left" style="font-size:11px"></i> <span id="soBackLabel">Main</span></button>
    <div class="so-srch-wrap">
      <i class="fas fa-search" style="color:rgba(255,255,255,.3);font-size:12px;flex-shrink:0"></i>
      <input id="soInput" type="search" placeholder="Shop, area, category..." autocomplete="off" oninput="onSearch(this.value)">
      <button class="so-srch-x" id="soX" onclick="clearSoInput()"><i class="fas fa-times"></i></button>
    </div>
  </div>
  <div class="so-chips-row" id="so-filters">
    <button class="so-chip on" data-filter="all">All</button>
    <button class="so-chip" data-filter="clinic">Clinic</button>
    <button class="so-chip" data-filter="headspa">Head Spa</button>
    <button class="so-chip" data-filter="skincare">Skincare</button>
    <button class="so-chip" data-filter="hair">Hair</button>
    <button class="so-chip" data-filter="nail">Nail</button>
    <button class="so-chip" data-filter="makeup">Makeup</button>
    <button class="so-chip" data-filter="spa">Spa</button>
    <button class="so-chip" data-filter="Gangnam">Gangnam</button>
    <button class="so-chip" data-filter="Hongdae">Hongdae</button>
    <button class="so-chip" data-filter="Myeongdong">Myeongdong</button>
    <button class="so-chip" data-filter="Sinsa">Sinsa</button>
    <button class="so-chip" data-filter="Itaewon">Itaewon</button>
    <button class="so-chip" data-filter="Apgujeong">Apgujeong</button>
  </div>
  <div class="so-body">
    <div class="so-header" id="so-header"></div>
    <div class="so-grid" id="so-grid"></div>
  </div>
</div>

<!-- PC 레이아웃 래퍼 -->
<div id="pc-layout">
  <div id="feed-col" style="position:relative">
    <div id="dots" aria-hidden="true"></div>
    <div id="feed" role="feed" aria-label="Beauty videos"></div>
    <div id="cat-loading"><div class="cat-spin"></div></div>
  </div>
  <!-- PC 우측 업체 카탈로그 -->
  <aside id="shop-panel" aria-label="Shop catalog">
    <div class="sp-header">
      <div class="sp-title">Seoul Beauty Catalog</div>
      <div class="sp-subtitle" id="sp-count">__SSR_SHOP_COUNT__</div>
    </div>
    <div class="sp-filter" id="sp-filter">__SSR_FILTER_BTNS__</div>
    <div class="sp-grid" id="sp-grid">__SSR_SHOP_CARDS__</div>
  </aside>
</div>
<div id="toast" role="status" aria-live="polite"></div>

<!-- 관리자 모달: JS로 동적 삽입 (크롤러 HTML에 노출 방지) -->
<div id="adminModal"></div>

<!-- 업체 정보 모달 -->
<div class="modal-bg" id="shopModal" role="dialog" aria-modal="true" aria-label="Shop information">
  <div class="modal" id="modalPanel">
    <div class="modal-handle-area" id="modalHandle">
      <div class="mhdl"></div>
      <div class="modal-top-row">
        <button class="modal-back-btn" onclick="closeModal()" aria-label="Back"><i class="fas fa-arrow-left" style="font-size:11px"></i> <span>Back</span></button>
        <button class="mcls" onclick="closeModal()" aria-label="Close">&#10005;</button>
      </div>
    </div>
    <div class="modal-scroll" id="modalScroll">
      <div id="modalHero"></div>
      <div class="m-body" id="modalContent"></div>
    </div>
    <div class="m-btns" id="modalBtns"></div>
  </div>
</div>

__INLINE_DATA_PLACEHOLDER__
<script>
var vids = [], isMuted = true, liked = {}, platform = {}, allShopsData = [];
var shopCache = {}; // 모달 캐시: shopId → shop 객체
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',headspa:'&#129496;',nail:'&#128133;',clinic:'&#127973;',spa:'&#129510;',tattoo:'&#9998;'};
var catFaIcons = {skincare:'fa-leaf',makeup:'fa-magic',hair:'fa-cut',headspa:'fa-spa',nail:'fa-hand-sparkles',clinic:'fa-briefcase-medical',spa:'fa-hot-tub',tattoo:'fa-pen-nib'};

if(window.__INIT_PLATFORM__) { platform = window.__INIT_PLATFORM__; }
else { fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; }); }

/* ── 로딩 팁 ── */
var _ldTips = [
  'Swipe up to explore more looks',
  'Tap the shop name to book',
  'Real shops in Seoul, Korea',
  'Curated K-beauty experiences',
  'Contact via WhatsApp to reserve'
];
(function(){
  var el = document.getElementById('ldTips');
  if(!el) return;
  var idx = 0;
  el.textContent = _ldTips[0];
  setInterval(function(){
    el.style.opacity = '0';
    setTimeout(function(){
      idx = (idx + 1) % _ldTips.length;
      el.textContent = _ldTips[idx];
      el.style.opacity = '1';
    }, 400);
  }, 2200);
})();

/* ── 스켈레톤 슬라이드 ── */
function buildSkeleton() {
  return '<div class="skeleton-feed">'
    +'<div class="sk-bg"></div>'
    +'<div class="sk-shimmer"></div>'
    +'<div class="sk-actions">'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
      +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div class="sk-act-btn"></div><div class="sk-act-label"></div></div>'
    +'</div>'
    +'<div class="sk-info">'
      +'<div class="sk-badge"></div>'
      +'<div class="sk-title"></div>'
      +'<div class="sk-desc"></div>'
      +'<div class="sk-shop">'
        +'<div class="sk-avatar"></div>'
        +'<div class="sk-shop-info"><div class="sk-shop-name"></div><div class="sk-shop-loc"></div></div>'
      +'</div>'
    +'</div>'
  +'</div>';
}
function showSkeletonFeed() {
  var feed = document.getElementById('feed');
  if(!feed) return;
  feed.innerHTML = buildSkeleton();
}

/* ── 이미지 blur-up 헬퍼 함수 ──
   HTML onload/onerror 속성 내 따옴표 충돌을 피하기 위해 함수 분리 */
function imgLoaded(el){ el.classList.add('loaded'); }
function parentLoaded(el){ if(el.parentElement) el.parentElement.classList.add('loaded'); }
function heroImgLoaded(el){ var w=el.closest('.m-hero'); if(w) w.classList.add('loaded'); }
function thumbImgLoaded(el){ el.classList.add('img-loaded'); if(el.parentElement) el.parentElement.classList.add('img-loaded'); }

/* ── 스플래시 로딩 조율 ──
   흐름:
   1) shops + videos 목록 완료 → _checkLdReady()
   2) 즉시 첫 영상 src 세팅 (다운로드 시작)
   3) 스플래시 페이드(400ms)하는 동안 동시에 다운로드
   4) 페이드 끝 → setupObs() → play()
   최대 fallback: 5초 */
var _ldStartTime = Date.now();
var _MIN_SPLASH_MS = 600;
var _ldReadyFlags = { shops: false, videos: false };
var _ldFallbackTimer = null;

/* 프로그레스 바 단계 제어 */
function setLdProgress(pct) {
  var prog = document.querySelector('.ld-prog');
  if(!prog) return;
  prog.style.animation = 'none';
  prog.style.transition = 'width .4s ease';
  prog.style.width = pct + '%';
}

/* loading hide */
var _ldHidden = false;
function hideLd(){
  if(_ldHidden) return;
  _ldHidden = true;
  if(_ldFallbackTimer){ clearTimeout(_ldFallbackTimer); _ldFallbackTimer = null; }
  var ld = document.getElementById('ld');
  if(!ld){ setupObs(); return; }
  setLdProgress(100);
  // 페이드 시작과 동시에 첫 영상 src 세팅 → 다운로드 병행
  _preloadFirstVideo();
  ld.style.transition = 'opacity .4s';
  ld.style.opacity = '0';
  setTimeout(function(){
    ld.style.display = 'none';
    setupObs(); // 이미 다운로드 시작된 상태 → play()만
  }, 420);
}

/* 스플래시 페이드 중에 첫 영상 src 세팅 (다운로드 선행) */
function _preloadFirstVideo(){
  var v0 = document.getElementById('vid0');
  if(!v0 || v0.src || !v0.dataset.src) return;
  v0.preload = 'auto';
  v0.src = v0.dataset.src;
  v0.load();
}

/* shops + videos 둘 다 준비되면 최소시간 후 hideLd() */
function _checkLdReady() {
  if(!_ldReadyFlags.shops || !_ldReadyFlags.videos) return;
  // vids의 shopId → videoUrl/thumbnail 을 allShopsData에 주입
  _injectVideoIntoShops();
  var elapsed = Date.now() - _ldStartTime;
  var delay = Math.max(0, _MIN_SPLASH_MS - elapsed);
  // DOM이 준비된 후에 hideLd 실행 보장
  // (prefetchShops가 스크립트 파싱 시점에 즉시 완료되면 DOM이 아직 없을 수 있음)
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(hideLd, delay); }, {once: true});
  } else {
    setTimeout(hideLd, delay);
  }
}

/* vids 배열에서 shopId 기준으로 영상 정보를 allShopsData에 주입 */
function _injectVideoIntoShops() {
  if(!vids || !vids.length || !allShopsData || !allShopsData.length) return;
  // shopId → 첫 번째 video 매핑
  var vidMap = {};
  vids.forEach(function(v){
    if(v && v.shopId && !vidMap[v.shopId]) vidMap[v.shopId] = v;
  });
  allShopsData.forEach(function(s){
    var v = vidMap[s.id];
    if(v){
      if(!s.videoUrl && v.videoUrl) s.videoUrl = v.videoUrl;
      if(!s.videoThumb && (v.thumbnail || s.thumbnail)) s.videoThumb = v.thumbnail || s.thumbnail;
    }
  });
}

/* ── 스플래시 중 shops 데이터 Prefetch ──
   스플래시가 보이는 동안 /api/shops 를 미리 가져와서
   shopCache 에 채워둠 → 모달 열 때 fetch 없이 즉시 렌더
   
   [버그 수정] __INIT_SHOPS__ 인라인 데이터가 있으면 즉시 사용 (fetch 불필요)
   → Neon cold start로 fetch가 느려지면 로딩 화면이 무한 대기하는 문제 방지 */
var _prefetchDone = false;
function prefetchShops(){
  if(_prefetchDone) return;
  _prefetchDone = true;
  setLdProgress(10);
  // SSR 인라인 데이터가 있으면 fetch 없이 즉시 완료
  if(window.__INIT_SHOPS__ && window.__INIT_SHOPS__.length) {
    var inlineList = window.__INIT_SHOPS__;
    window.__INIT_SHOPS__ = null;
    inlineList.forEach(function(s){
      if(s && s.id && !shopCache[s.id]) shopCache[s.id] = s;
    });
    setLdProgress(40);
    _ldReadyFlags.shops = true;
    _checkLdReady();
    return;
  }
  // 인라인 데이터 없을 때만 fetch
  fetch('/api/shops')
    .then(function(r){ return r.json(); })
    .then(function(d){
      var list = d.shops || [];
      list.forEach(function(s){
        if(s && s.id && !shopCache[s.id]) {
          shopCache[s.id] = s;
        }
      });
      setLdProgress(40);
      _ldReadyFlags.shops = true;
      _checkLdReady();
    })
    .catch(function(){
      setLdProgress(40);
      _ldReadyFlags.shops = true;
      _checkLdReady();
    });
}
// 페이지 로드 즉시 시작
prefetchShops();

/* 카테고리 전환 스피너 */
function showCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.add('on'); }
function hideCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.remove('on'); }

function loadVideos(cat) {
  // 첫 로드이고 cat='all'이면 SSR 인라인 데이터 즉시 사용
  if((cat === 'all' || !cat) && window.__INIT_VIDEOS__ && window.__INIT_VIDEOS__.length) {
    vids = window.__INIT_VIDEOS__;
    window.__INIT_VIDEOS__ = null;
    for(var i=vids.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
    }
    renderFeed();
    setLdProgress(85);
    _ldReadyFlags.videos = true;
    // [버그 수정] 인라인 데이터로 즉시 완료해도 fallback timer는 반드시 세팅
    // prefetchShops가 느릴 경우 shops 플래그를 기다리다 무한 대기하는 것 방지
    if(!_ldFallbackTimer) {
      _ldFallbackTimer = setTimeout(function(){ hideLd(); hideCatLoading(); }, 5000);
    }
    _checkLdReady();
    return;
  }
  // 카테고리 전환
  var isCatSwitch = _ldHidden;
  if(isCatSwitch) {
    showSkeletonFeed();
    showCatLoading();
  }
  fetch('/api/videos?category='+(cat||'all'))
    .then(function(r){ return r.json(); })
    .then(function(d){
      vids = d.videos || [];
      for(var i=vids.length-1;i>0;i--){
        var j=Math.floor(Math.random()*(i+1));
        var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
      }
      hideCatLoading();
      renderFeed();
      // 카테고리 전환 후 setupObs 강제 실행 보장
      if(_ldHidden) { setupObs(); }
      if(!_ldHidden){
        setLdProgress(85);
        _ldReadyFlags.videos = true;
        _checkLdReady();
      }
    })
    .catch(function(){
      vids = [];
      hideCatLoading();
      renderFeed();
      if(_ldHidden) { setupObs(); }
      if(!_ldHidden){ hideLd(); }
    });
  // 최대 8초 fallback (Neon DB cold start 대응)
  _ldFallbackTimer = setTimeout(function(){ hideLd(); hideCatLoading(); }, 8000);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function openMapUrl(el){
  var u=el.getAttribute('data-map-url');
  if(!u) return;
  // 구글맵을 iframe embed URL로 변환
  // maps.google.com/?q=lat,lng&hl=en → embed 형식
  var embedUrl = u;
  var qMatch = u.match(/[?&]q=([^&]+)/);
  if(qMatch) {
    embedUrl = 'https://www.google.com/maps?q='+qMatch[1]+'&hl=en&output=embed';
  }
  // 제목: 주소 뱃지 텍스트 사용
  var badge = el.querySelector('[style*="bottom:8px"]');
  var title = badge ? badge.textContent.trim() : 'Google Maps';
  var ov = document.getElementById('mapOverlay');
  var frame = document.getElementById('mapOverlayFrame');
  var titleEl = document.getElementById('mapOverlayTitle');
  if(!ov || !frame) return;
  titleEl.textContent = title;
  frame.src = embedUrl;
  ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // GA4: 지도 클릭 이벤트
  if(typeof gtag==='function') gtag('event','map_click',{event_category:'engagement',event_label:title,page_location:window.location.href});
}
function closeMapOverlay(){
  var ov = document.getElementById('mapOverlay');
  var frame = document.getElementById('mapOverlayFrame');
  if(ov){ ov.style.display='none'; document.body.style.overflow=''; }
  if(frame){ frame.src=''; }
}
function areaOnly(loc) {
  if(!loc) return '';
  return String(loc).split(',')[0].trim();
}

function renderFeed() {
  var feed = document.getElementById('feed');
  var dots = document.getElementById('dots');
  feed.innerHTML = ''; dots.innerHTML = '';
  if(!vids.length){
    feed.innerHTML = '<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:rgba(255,255,255,.28);font-size:14px"><i class="fas fa-film" style="font-size:40px;margin-bottom:4px;color:rgba(232,65,122,.3)"></i><div>No videos yet</div><div style="font-size:12px;color:rgba(255,255,255,.18)">Add shops and videos from the admin panel</div></div>';
    if(!_ldHidden) hideLd();
    return;
  }
  for(var i=0;i<vids.length;i++){
    var dot=document.createElement('div');
    dot.className='dot'+(i===0?' on':''); dot.id='dot'+i;
    dots.appendChild(dot);
  }
  for(var i=0;i<vids.length;i++){ buildSlide(vids[i],i); }
  // 카테고리 전환(스플래시 이미 없음)이면 즉시 setupObs
  if(_ldHidden) setupObs();
  // 첫 로드면 _startFirstVideoLoad()가 따로 호출됨 → setupObs는 hideLd 후 실행
}

function getAutoThumb(videoUrl) {
  if(!videoUrl) return '';
  if(videoUrl.indexOf('cloudinary.com') === -1) return '';
  // 9:16 세로 썸네일, WebP, 저화질(q_auto:low) → 빠른 poster 표시
  var u = videoUrl.replace('/video/upload/', '/video/upload/so_0,w_420,h_748,c_fill,q_auto:low,f_webp/');
  var dot = u.lastIndexOf('.');
  return dot !== -1 ? u.slice(0, dot) + '.webp' : u + '.webp';
}

function cdnImg(url, w, h) {
  // Cloudinary 이미지 최적화: WebP 변환 + 크기 조정 + 자동 압축
  if(!url || url.indexOf('res.cloudinary.com') === -1) return url;
  var transform = 'w_'+w+(h?',h_'+h:'')+',c_fill,q_auto:good,f_webp,dpr_auto';
  return url.replace('/image/upload/', '/image/upload/'+transform+'/');
}

function cdnVideo(url) {
  // Cloudinary 영상 스트리밍 최적화: 화질 자동, 스트리밍 힌트
  if(!url || url.indexOf('res.cloudinary.com') === -1) return url;
  return url.replace('/video/upload/', '/video/upload/q_auto:low,vc_auto,br_800k/');
}

function buildSlide(v, idx) {
  var feed = document.getElementById('feed');
  var shop = v.shop || {};
  var s = document.createElement('article');
  s.className='slide'; s.id='sl'+idx;
  // microdata(itemscope/itemprop) 제거 → JSON-LD만 사용 (Google은 둘 다 읽으면 충돌 오류 발생)
  var tags = (v.tags||[]).map(function(t){return '<span class="vtag">'+esc(t)+'</span>';}).join('');
  // 썸네일: DB 저장값 → Cloudinary so_0 자동생성 순서
  var thumb = v.thumbnail || getAutoThumb(v.videoUrl) || '';
  // 첫번째 슬라이드는 eager load, 나머지는 lazy
  var imgLoading = idx === 0 ? 'eager' : 'lazy';
  var imgPriority = idx === 0 ? ' fetchpriority="high"' : '';

  s.innerHTML =
    (thumb ? '<img class="bg-img" src="'+esc(thumb)+'" alt="'+esc(v.title||shop.name||'')+'" loading="'+imgLoading+'" decoding="async"'+imgPriority+' onload="imgLoaded(this)" onerror="imgLoaded(this)">' : '<div class="bg-img loaded" style="background:linear-gradient(135deg,#1a0a14 0%,#1c0e22 40%,#0f0816 100%)"></div>') +
    '<video id="vid'+idx+'" loop muted playsinline preload="'+(idx===0?'auto':'none')+'" poster="'+esc(thumb)+'"></video>' +
    '<div id="playic'+idx+'" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:4;width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.55);align-items:center;justify-content:center;pointer-events:none;backdrop-filter:blur(4px)"><i class="fas fa-pause" style="font-size:20px;color:#fff"></i></div>' +
    '<div id="bufic'+idx+'" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;pointer-events:none"><div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.15);border-top-color:rgba(255,255,255,.8);border-radius:50%;animation:spin .7s linear infinite"></div></div>' +
    '<div class="ov"></div>' +
    '<div class="info">' +
      '<div class="slide-cat-badge"><i class="fas '+(catFaIcons[shop.category]||'fa-star')+'"></i> '+esc((shop.category||'').toUpperCase())+'</div>' +
      '<div class="btns-row">' +
        '<div class="shop-info-block">'
          +'<div class="shop-info-name"><i class="fas fa-store si-icon"></i>'+esc(shop.name||'')+'</div>'
          +(areaOnly(shop.location||'')
            ?'<div class="shop-info-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location||''))+'</div>'
            :'')
        +'</div>' +
        '<button class="wa-btn" id="wabtn'+idx+'"><i class="fab fa-whatsapp" style="font-size:14px"></i> Book</button>' +
      '</div>' +
    '</div>' +
    '<div class="hint"><i class="fas fa-chevron-up" style="font-size:10px"></i><span>Swipe Up</span></div>';

  feed.appendChild(s);

  (function(vid, vidIdx, shopData) {
    var ve     = document.getElementById('vid'+vidIdx);
    var ov     = s.querySelector('.ov');
    var playIc = document.getElementById('playic'+vidIdx);
    var bufIc  = document.getElementById('bufic'+vidIdx);

    if(ve) {
      ve.setAttribute('data-src', esc(cdnVideo(v.videoUrl)));

      // ── 버퍼링 스피너 제어 ──
      function showBuf(){ if(bufIc) bufIc.style.display='flex'; }
      function hideBuf(){ if(bufIc) bufIc.style.display='none'; }

      ve.addEventListener('waiting',  showBuf);   // 버퍼 비면 스피너
      ve.addEventListener('stalled',  showBuf);   // 네트워크 지연
      ve.addEventListener('seeking',  showBuf);
      ve.addEventListener('canplay',  hideBuf);   // 재생 준비 완료
      ve.addEventListener('playing',  hideBuf);   // 실제 재생 시작
      ve.addEventListener('play',     function(){ hideBuf(); if(playIc) playIc.style.display='none'; });
      ve.addEventListener('pause',    function(){ hideBuf(); if(playIc) playIc.style.display='flex'; });

      // ── 에러 시 자동 재시도 (1회) ──
      ve.addEventListener('error', function(){
        hideBuf();
        if(ve.dataset.src && !ve.dataset.retried){
          ve.dataset.retried = '1';
          setTimeout(function(){
            ve.src = ve.dataset.src;
            ve.load();
            ve.play().catch(function(){});
          }, 1500);
        }
      });

      // ── stalled: 5초 지속 시에만 src 재세팅 (load() 남용 금지) ──
      var _stallTimer = null;
      ve.addEventListener('stalled', function(){
        clearTimeout(_stallTimer);
        _stallTimer = setTimeout(function(){
          // NETWORK_IDLE(1) or NETWORK_NO_SOURCE(3) → src 재세팅
          if(ve.dataset.src && ve.paused === false && ve.networkState !== 2){
            ve.src = ve.dataset.src;
            ve.load();
            ve.play().catch(function(){});
          }
        }, 5000);
      });
      ve.addEventListener('playing', function(){ clearTimeout(_stallTimer); });
      ve.addEventListener('pause',   function(){ clearTimeout(_stallTimer); });
    }

    if(ov && ve) {
      ov.addEventListener('click', function(e){
        e.stopPropagation();
        if(ve.paused){ ve.muted=isMuted; ve.play().catch(function(){}); }
        else { ve.pause(); }
      });
    }

    document.getElementById('wabtn'+vidIdx).onclick = function(e){
      e.stopPropagation();
      // GA4: Book 버튼 클릭 (비디오 피드)
      if(typeof gtag==='function') gtag('event','book_btn_click',{event_category:'engagement',event_label:shopData?shopData.name:'unknown',shop_name:shopData?shopData.name:'',page_location:window.location.href});
      // 항상 모달 열기 (상세 페이지와 동일 콘텐츠)
      openShopModal(vid.shopId||shopData.id);
    };

    var infoEl = s.querySelector('.info');
    if(infoEl) infoEl.addEventListener('click', function(e){ e.stopPropagation(); });

    fetch('/api/videos/'+vid.id+'/view', {method:'POST'}).catch(function(){});
  })(v, idx, shop);
}

function loadVidSrc(vid){
  if(vid && !vid.src && vid.dataset.src){
    vid.preload = 'auto';
    vid.src = vid.dataset.src;
  }
}
function preloadNext(idx){
  // 다음 1개만 preload — 2개 동시 다운로드는 모바일 대역폭 경쟁 유발
  var next = document.getElementById('vid'+(idx+1));
  if(next && !next.src && next.dataset.src){
    next.preload = 'auto';
    next.src = next.dataset.src;
    // load()는 호출하지 않음 — src 세팅만으로 브라우저가 알아서 버퍼링
  }
}

function _playVid(vid, bufIc){
  if(!vid) return;
  vid.muted = isMuted;

  // src 미세팅이면 지금 세팅 (load()는 호출 안 함 — play()가 암묵적으로 호출)
  if(!vid.src && vid.dataset.src){
    vid.preload = 'auto';
    vid.src = vid.dataset.src;
  }

  // 이미 충분히 버퍼됐으면 스피너 없이 바로 재생
  if(vid.readyState >= 3){
    if(bufIc) bufIc.style.display = 'none';
  } else {
    if(bufIc) bufIc.style.display = 'flex';
  }

  var _retried = false;
  var p = vid.play();
  if(!p) return;
  p.then(function(){
    if(bufIc) bufIc.style.display = 'none';
    vid.muted = isMuted; // 재생 직후 mute 상태 재확인
  }).catch(function(err){
    // NotAllowedError: unmuted autoplay 차단 → muted 강제 후 재시도
    if(!_retried){
      _retried = true;
      vid.muted = true;
      if(isMuted === false){ isMuted = true; _syncMuteUI(); }
      vid.play().then(function(){
        if(bufIc) bufIc.style.display = 'none';
      }).catch(function(){
        if(bufIc) bufIc.style.display = 'none';
      });
    } else {
      if(bufIc) bufIc.style.display = 'none';
    }
  });
}

function setupObs(){
  // _obsReady: observe() 직후 즉시 fire되는 콜백을 무시하기 위한 플래그
  var _obsReady = false;
  // 현재 재생 중인 슬라이드 인덱스 추적 (중복 play 방지)
  var _curIdx = 0;

  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var idx = parseInt(e.target.id.replace('sl',''));
      var vid = document.getElementById('vid'+idx);
      var bufIc = document.getElementById('bufic'+idx);

      if(e.isIntersecting){
        // 인디케이터 도트 업데이트
        document.querySelectorAll('.dot').forEach(function(d,i){ d.classList.toggle('on',i===idx); });

        if(_obsReady && idx !== _curIdx){
          // 이전 슬라이드 정지 (currentTime 유지 — 루프 영상은 위치 보존이 낫다)
          var prevVid = document.getElementById('vid'+_curIdx);
          if(prevVid && !prevVid.paused){ prevVid.pause(); }
          _curIdx = idx;
          _playVid(vid, bufIc);
          preloadNext(idx);
        } else if(!_obsReady){
          preloadNext(idx); // 초기화 중 → preload만
        }
      } else {
        // 화면 밖으로 완전히 벗어나면 정지 + 스피너 제거
        if(vid && !vid.paused){ vid.pause(); }
        if(bufIc) bufIc.style.display = 'none';
      }
    });
  // threshold를 낮춰 스와이프 중 경계에서 이벤트 이중 발생 방지
  },{threshold: 0.8});

  document.querySelectorAll('.slide').forEach(function(s){ obs.observe(s); });

  // 첫 슬라이드 직접 재생 → 이후 obs에 제어권 넘김
  var v0 = document.getElementById('vid0');
  var buf0 = document.getElementById('bufic0');
  var dot0 = document.getElementById('dot0');
  if(dot0) dot0.classList.add('on');
  _playVid(v0, buf0);
  preloadNext(0);
  setTimeout(function(){ _obsReady = true; }, 600);
}

function openShopModal(shopId) {
  if(!shopId) return;
  document.getElementById('modalHero').innerHTML = '';
  document.getElementById('modalBtns').innerHTML = '';
  document.getElementById('shopModal').classList.add('open');
  document.getElementById('modalScroll').scrollTop = 0;
  // GA4: 업체 모달 열기 이벤트
  if(typeof gtag==='function'){
    var sc = shopCache[shopId];
    gtag('event','shop_view',{event_category:'engagement',event_label:sc?sc.name:shopId,shop_id:shopId,shop_name:sc?sc.name:'',shop_category:sc?sc.category:'',page_location:window.location.href});
  }

  // 1) 캐시에 있고 상세 정보(services 등)도 있으면 → 즉시 렌더, 백그라운드 갱신은 생략
  var cached = shopCache[shopId];
  if(cached && cached._detail) {
    renderShopModal(cached);
    return;
  }

  // 2) prefetch 로 기본 정보만 있는 캐시 → 즉시 기본 렌더 후 상세 정보 백그라운드 보완
  if(cached && cached.name) {
    renderShopModal(cached); // 스피너 없이 기본 정보로 먼저 표시
    // 상세 정보 백그라운드 fetch → videos 병합 후 조용히 업데이트
    fetch('/api/shops/'+shopId)
      .then(function(r){ return r.json(); })
      .then(function(d){
        var detailShop = d.shop; if(!detailShop) return;
        var merged = detailShop;
        merged._detail = true;
        merged._videos = d.videos || [];
        // prefetch 캐시에 있던 데이터로 빈 필드 보완
        if(cached) {
          if(!merged.whyChoose || !merged.whyChoose.length) merged.whyChoose = cached.whyChoose || [];
          if(!merged.description) merged.description = cached.description || '';
          if(!merged.reviews || !merged.reviews.length) merged.reviews = cached.reviews || [];
        }
        shopCache[shopId] = merged;
        // 모달이 아직 열려있으면 자연스럽게 업데이트
        if(document.getElementById('shopModal').classList.contains('open')) {
          renderShopModal(merged);
        }
      }).catch(function(){});
    return;
  }

  // 3) 캐시 없음: vids 배열에서 shop 기본정보 찾아 스켈레톤 즉시 표시
  var quickShop = null;
  for(var i=0;i<vids.length;i++){
    if(vids[i].shopId===shopId || (vids[i].shop&&vids[i].shop.id===shopId)){
      quickShop = vids[i].shop || null; break;
    }
  }
  if(quickShop && quickShop.name) {
    document.getElementById('modalContent').innerHTML =
      '<div class="m-shop-header">'
        +'<div class="m-shop-name">'+esc(quickShop.name||'')+'</div>'
        +(quickShop.location?'<div class="m-shop-sub"><div class="m-shop-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(quickShop.location))+'</div></div>':'')
      +'</div>'
      +'<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.2)"><i class="fas fa-spinner fa-spin" style="font-size:18px"></i></div>';
  } else {
    document.getElementById('modalContent').innerHTML = '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,.25)"><i class="fas fa-spinner fa-spin" style="font-size:22px"></i></div>';
  }

  // 4) 상세 API fetch → 캐시 저장 후 렌더
  // allShopsData에도 있으면 즉시 렌더 (prefetch보다 먼저 올 수도 있음)
  var fromAll = allShopsData.find(function(s){ return s.id === shopId; });
  if(fromAll && fromAll.name) {
    if(fromAll.description || (fromAll.whyChoose && fromAll.whyChoose.length)) fromAll._detail = true;
    shopCache[shopId] = fromAll;
    renderShopModal(fromAll);
    return;
  }
  fetch('/api/shops/'+shopId).then(function(r){ return r.json(); }).then(function(d){
    var shop = d.shop;
    if(!shop){ document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">Shop information unavailable.</div>'; return; }
    shop._detail = true;
    shop._videos = d.videos || [];
    shopCache[shopId] = shop;
    renderShopModal(shop);
  }).catch(function(){
    document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">An error occurred.</div>';
  });
}

/* ── HTML 엔티티 디코딩 (DB에 &amp; 등으로 저장된 경우 복원) ── */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…');
}

function renderShopModal(shop) {
  var waNum = platform.whatsapp || '8201058947690';
  /* ── 업체별 구조화된 예약 메시지 ── */
  var shopName = shop.name || 'your shop';
  var NL = String.fromCharCode(10);
  var shopLocation = shop.location ? ' ('+areaOnly(shop.location)+')' : '';
  var waMsg =
    '[ Booking Request ]' + NL
    + 'Shop: ' + shopName + shopLocation + NL
    + NL
    + 'Date: ' + NL
    + 'Time: ' + NL
    + 'Service: ' + NL
    + 'Name: ' + NL
    + 'People: ';
  var waUrl = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(waMsg);

  /* ── 사진 배열 (thumbnail + photos, 중복 제거) ── */
  var allPhotos = [];
  if(shop.thumbnail) allPhotos.push(shop.thumbnail);
  (shop.photos||[]).forEach(function(p){ if(p && p!==shop.thumbnail) allPhotos.push(p); });

  /* ── 히어로 (풀블리드) ── */
  var heroHtml = '';
  if(allPhotos.length > 0) {
    heroHtml =
      '<div class="m-hero" id="mHeroWrap">'
        +'<img class="m-hero-img" id="mHeroImg" src="'+esc(cdnImg(allPhotos[0],800,600))+'" alt="'+esc(shop.name)+'" loading="eager" fetchpriority="high" decoding="async"'
          +' onload="heroImgLoaded(this)" onerror="heroImgLoaded(this)">'
        +'<div class="m-hero-ov"></div>'
        +'<div class="m-hero-badge">'+(catIcons[shop.category]||'')+'&nbsp;'+esc((shop.category||'').toUpperCase())+'</div>'
      +'</div>';

    /* 히어로 바로 아래 전체 썸네일 스트립 (최대 6장) */
    if(allPhotos.length > 1) {
      var stripPhotos = allPhotos.slice(0, 6);
      var strips = stripPhotos.map(function(url, i){
        return '<div class="m-ts-thumb'+(i===0?' on':'')+'" data-photo-url="'+esc(cdnImg(url,800,600))+'" onclick="setMHero(this.dataset.photoUrl,this)">'
          +'<img src="'+esc(cdnImg(url,120,120))+'" alt="" loading="lazy" decoding="async" onload="thumbImgLoaded(this)" onerror="this.parentElement.remove()">'
          +'</div>';
      }).join('');
      heroHtml += '<div class="m-thumbstrip">'+strips+'</div>';
    }
  }
  document.getElementById('modalHero').innerHTML = heroHtml;

  /* ── 별점 ── */
  var rating = shop.rating || 5.0;
  var reviewCount = shop.reviewCount || 0;
  var starsHtml = '';
  for(var si=0; si<5; si++) starsHtml += (si < Math.round(rating)) ? '&#9733;' : '&#9734;';

  /* ── 영업시간 파싱 (요일별 테이블) ── */
  var hoursHtml = '';
  if(shop.hours) {
    // "Monday: 10:00 AM – 7:00 PM / Tuesday: ..." 또는 "| " 구분자 처리
    var days = shop.hours.split(/\s*[\/|]\s*/).map(function(s){ return s.trim(); }).filter(Boolean);
    var dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var today = new Date().getDay(); // 0=Sun
    if(days.length > 1) {
      // 구글 Places 포맷
      var hoursRows = days.map(function(line) {
        var col = line.indexOf(':');
        var dayPart = col > -1 ? line.slice(0, col).trim() : line;
        var timePart = col > -1 ? line.slice(col+1).trim() : '';
        var isToday = dayNames[today] && dayPart.toLowerCase().startsWith(dayNames[today].toLowerCase());
        var isClosed = timePart.toLowerCase().includes('closed');
        return '<tr class="'+(isToday?'m-hours-td-today':'')+'">'
          +'<td class="m-hours-td-day">'+esc(dayPart.slice(0,3).toUpperCase())+'</td>'
          +'<td class="m-hours-td-time'+(isClosed?' closed':'')+'">'+esc(timePart||'Closed')+'</td>'
          +'</tr>';
      }).join('');
      hoursHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div>'
        +'<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:6px 14px">'
        +'<table class="m-hours-table">'+hoursRows+'</table></div></div>';
    } else {
      // 단순 텍스트
      hoursHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-clock" style="color:var(--gold);margin-right:4px"></i>Hours</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.72)">'+esc(shop.hours)+'</div></div>';
    }
  }

  /* ── 정보 카드 그리드 ── */
  var infoCards = '';
  if(shop.location) {
    // Hours는 이제 별도 섹션으로 처리 — 여기선 제외
  }
  if(shop.location) {
    var locArea = areaOnly(shop.location);
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Area</div><div class="m-info-card-val"><i class="fas fa-map-marker-alt"></i>'+esc(locArea)+'</div></div>';
  }
  // Price Range 인포카드 제거
  if(reviewCount > 0) {
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Rating</div><div class="m-info-card-val"><span class="m-stars">'+starsHtml+'</span>&nbsp;'+rating+'</div></div>';
  }
  var infoGridHtml = infoCards ? '<div class="m-info-grid">'+infoCards+'</div>' : '';

  /* ── 주소 (전체) ── */
  var addrHtml = shop.address
    ? '<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:rgba(255,255,255,.42);margin-bottom:16px;line-height:1.5">'
        +'<i class="fas fa-location-dot" style="color:var(--pk2);margin-top:2px;flex-shrink:0"></i>'
        +'<span>'+esc(shop.address)+'</span>'
      +'</div>'
    : '';

  /* ── 소개 ── */
  var descHtml = shop.description
    ? '<div class="m-sec"><div class="m-sec-title">About</div>'
        +'<div style="font-size:13px;color:rgba(255,255,255,.62);line-height:1.8;letter-spacing:.1px">'+esc(shop.description)+'</div>'
      +'</div>'
    : '';

  /* ── Why Choose ── */
  var whyHtml = '';
  var wc = shop.whyChoose || [];
  if(wc.length > 0) {
    var wcItems = wc.map(function(b){ return '<div class="m-why-item">'+esc(b)+'</div>'; }).join('');
    whyHtml = '<div class="m-sec">'
      +'<div class="m-sec-title"><i class="fas fa-check-circle" style="color:var(--pk);margin-right:4px"></i>Why Choose '+esc(shop.name||'')+'</div>'
      +'<div class="m-why-list">'+wcItems+'</div>'
    +'</div>';
  }

  /* ── SEO 텍스트 (구글/방문자용 롱폼) — DB seo_text 우선, 없으면 fallback ── */
  var seoHtml = '';
  (function(){
    // DB에 고유 seo_text 있으면 그대로 사용 (상세 페이지와 동일 콘텐츠)
    // decodeHtmlEntities: DB에 &amp; 등 엔티티로 저장된 경우 복원
    if(shop.seoText && shop.seoText.trim()){
      var _mSeo = decodeHtmlEntities(shop.seoText);
      // H2 없으면 자동 삽입 (모바일뷰)
      if(!_mSeo.includes('<h2')){
        var _ma = (shop.location||'Seoul').split(',')[0].trim();
        var _mc = shop.category;
        var _mcLabel = {skincare:'Skincare',makeup:'Makeup',hair:'Hair Salon',nail:'Nail',clinic:'Dermatology Clinic',headspa:'Head Spa',spa:'Spa',tattoo:'Eyebrow Tattoo'};
        var _mcName = _mcLabel[_mc] || (_mc.charAt(0).toUpperCase()+_mc.slice(1));
        var _mArea = _ma.toLowerCase().includes('cheongdam')||_ma.toLowerCase().includes('apgujeong') ? 'Gangnam' : _ma;
        var _mh2s = [shop.name+' \u2014 '+_mcName+' in '+_mArea+', Seoul','Foreigner-Friendly '+_mcName+' in '+_mArea,'How to Book '+shop.name];
        var _pTagRe = new RegExp('<p[^>]*>[\\s\\S]*?<\\/p>', 'g');
        var _mps = _mSeo.match(_pTagRe) || [];
        if(_mps.length >= 2){
          _mSeo = _mps.map(function(p,i){ return '<h2 class="sp-seo-h2">'+(_mh2s[i]||shop.name)+'</h2>'+p; }).join('');
        } else {
          _mSeo = '<h2 class="sp-seo-h2">'+_mh2s[0]+'</h2>'+_mSeo;
        }
      }
      seoHtml = '<div class="m-seo-block">'+_mSeo+'</div>';
      return;
    }
    // fallback: DB seo_text 없을 때 템플릿
    var area3 = (shop.location||'Seoul').split(',')[0].trim();
    var cat3  = (shop.category||'beauty').charAt(0).toUpperCase()+(shop.category||'beauty').slice(1);
    var svcList = (shop.services&&shop.services.length>0) ? shop.services.slice(0,4).join(', ') : cat3+' treatments';
    var areaGn  = (area3.toLowerCase().indexOf('cheongdam')>-1||area3.toLowerCase().indexOf('apgujeong')>-1) ? 'Gangnam' : area3;
    var revTxt  = (shop.reviewCount>10) ? ' With '+shop.reviewCount+'+ verified reviews and a '+shop.rating+'-star rating, it' : ' It';

    if(shop.category==='clinic'){
      var treatments = (shop.services&&shop.services.length>0) ? shop.services.slice(0,6).join(', ') : 'laser toning, skin booster injections, RF lifting, acne treatment';
      seoHtml = '<div class="m-seo-block">'
        +'<h2 class="m-seo-h2">'+esc(shop.name)+' \u2014 Dermatology Clinic in '+esc(areaGn)+', Seoul for Foreigners</h2>'
        +'<p class="m-seo-p">'+esc(shop.name)+' is a foreigner-friendly dermatology clinic located in '+esc(area3)+', Seoul.'+revTxt+' is consistently rated as one of the top aesthetic clinics in '+esc(areaGn)+' by international patients. The clinic offers English-language consultations, transparent pricing, and easy WhatsApp booking \u2014 everything a foreign visitor needs to get world-class Korean dermatology treatments without the language barrier.</p>'
        +'<h2 class="m-seo-h2">Why Foreign Patients Choose '+esc(shop.name)+'</h2>'
        +'<p class="m-seo-p">For foreigners visiting Seoul, finding a dermatology clinic with English-speaking staff and no hidden fees is the biggest challenge. '+esc(shop.name)+' solves this with dedicated English-speaking coordinators, a clear treatment menu with prices listed in advance, and a seamless booking experience via WhatsApp. Whether you are a first-time medical tourist or a returning patient, the team ensures your comfort from initial consultation through aftercare.</p>'
        +'<h2 class="m-seo-h2">How to Book '+esc(shop.name)+' as a Foreigner</h2>'
        +'<p class="m-seo-p">Booking '+esc(shop.name)+' through Seoul Beauty Trip takes under 2 minutes. Simply tap the WhatsApp button below, describe your desired treatment, and our English-speaking team will confirm your appointment, explain pricing, and prepare the clinic for your visit. No Korean language skills needed. Same-day and advance bookings both available.</p>'
      +'</div>';
    } else {
      seoHtml = '<div class="m-seo-block">'
        +'<h2 class="m-seo-h2">'+esc(shop.name)+' \u2014 '+esc(cat3)+' in '+esc(area3)+', Seoul</h2>'
        +'<p class="m-seo-p">Looking for the best '+esc(shop.category)+' experience in '+esc(area3)+', Seoul? '+esc(shop.name)+' is a top-rated '+esc(shop.category)+' destination welcoming foreign visitors with English-friendly service and easy WhatsApp booking.'+revTxt+' offers an authentic Korean beauty experience tailored for international guests.</p>'
        +'<h2 class="m-seo-h2">Foreigner-Friendly '+esc(cat3)+' in '+esc(area3)+'</h2>'
        +'<p class="m-seo-p">Located in '+esc(area3)+', one of the top beauty districts in Seoul, '+esc(shop.name)+' specializes in '+esc(svcList)+'. The team provides English support throughout your visit \u2014 from consultation to aftercare \u2014 so you can relax and enjoy your treatment without language barriers. Book easily via WhatsApp through Seoul Beauty Trip.</p>'
      +'</div>';
    }
  })();

  /* ── 가격 섹션 — 가격 있으면 테이블, 없으면 상담 안내 ── */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    // 가격 공개 업체 → Price List 테이블
    var priceRows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+esc(p.name||'')+'</span><span class="m-price-val">'+esc(p.price||'')+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Price List</div><div class="m-price-list">'+priceRows+'</div></div>';
  } else {
    // 가격 비공개 업체 → 안내 텍스트만 표시
    priceHtml = '<div class="m-sec">'
      +'<div class="m-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Pricing</div>'
      +'<div style="font-size:13px;color:rgba(255,255,255,.55);line-height:1.7;padding:4px 0">'
        +'Prices vary by treatment &amp; consultation. '
        +'<span style="color:rgba(255,255,255,.35)">Contact us via WhatsApp below for a free quote.</span>'
      +'</div>'
    +'</div>';
  }

  /* ── 서비스 태그 ── */
  var svcHtml = '';
  if(shop.services && shop.services.length > 0) {
    var svcs = shop.services.map(function(s){ return '<span class="m-svc-tag">'+esc(s)+'</span>'; }).join('');
    svcHtml = '<div class="m-sec"><div class="m-sec-title">Services</div><div class="m-svc-tags">'+svcs+'</div></div>';
  }

  /* ── 지도: lat/lng 있으면 OSM 타일 이미지, 클릭 시 구글맵 이동 ── */
  var mapHtml = '';
  if(shop.lat && shop.lng) {
    var mlat = parseFloat(shop.lat), mlng = parseFloat(shop.lng);
    var zoom = 16;
    var tileX = Math.floor((mlng+180)/360*Math.pow(2,zoom));
    var tileY = Math.floor((1-Math.log(Math.tan(mlat*Math.PI/180)+1/Math.cos(mlat*Math.PI/180))/Math.PI)/2*Math.pow(2,zoom));
    var osmUrl = 'https://tile.openstreetmap.org/'+zoom+'/'+tileX+'/'+tileY+'.png';
    var osmUrl2 = 'https://tile.openstreetmap.org/'+zoom+'/'+(tileX+1)+'/'+tileY+'.png';
    var mapsLink = 'https://maps.google.com/?q='+mlat+','+mlng+'&hl=en';
    var addrLabel = (shop.address || shop.location || '').trim();
    var addrBadge = addrLabel
      ? '<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.65);backdrop-filter:blur(4px);color:#fff;font-size:11px;padding:4px 10px;border-radius:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:88%;pointer-events:none"><i class="fas fa-map-marker-alt" style="margin-right:4px;color:#FF4D8D"></i>'+addrLabel+'</div>'
      : '';
    mapHtml = '<div class="m-sec"><div class="m-sec-title">Location</div>'
      +'<div class="m-map" style="cursor:pointer;overflow:hidden;position:relative" data-map-url="'+esc(mapsLink)+'" onclick="openMapUrl(this)">'
        +'<div style="display:flex;height:100%;filter:saturate(0.8) brightness(0.75)">'
          +'<img src="'+osmUrl+'" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy">'
          +'<img src="'+osmUrl2+'" style="width:50%;height:100%;object-fit:cover;flex-shrink:0" loading="lazy">'
        +'</div>'
        +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">'
          +'<i class="fas fa-map-marker-alt" style="font-size:32px;color:#e8414a;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))"></i>'
        +'</div>'
        +addrBadge
      +'</div>'
    +'</div>';
  } else if(shop.address || shop.location) {
    mapHtml = '<div class="m-sec"><div class="m-sec-title">Location</div>'
      +'<div style="padding:14px;background:rgba(255,255,255,.04);border-radius:12px;font-size:13px;color:rgba(255,255,255,.75)">'
        +(shop.address ? '<div><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>'+esc(shop.address)+'</div>' : '')
        +(shop.location && shop.location !== shop.address ? '<div style="margin-top:5px;color:rgba(255,255,255,.4);font-size:12px">'+esc(shop.location)+'</div>' : '')
      +'</div>'
    +'</div>';
  }

  /* ── 구글 리뷰 섹션 ── */
  var reviewsHtml = '';
  var shopReviews = shop.reviews || [];
  if (shopReviews.length > 0) {
    var reviewCards = shopReviews.map(function(rv) {
      var rvRating = Number(rv.rating) || 5;
      var rvStars = '★'.repeat(Math.min(5,Math.max(0,rvRating))) + '☆'.repeat(Math.max(0,5-rvRating));
      return '<div class="m-review-card">'
        +'<div class="m-review-top">'
          +'<span class="m-review-author">'+esc(rv.author||'Guest')+'</span>'
          +'<span class="m-review-stars">'+rvStars+'</span>'
        +'</div>'
        +'<div class="m-review-text">'+esc(rv.text||'')+'</div>'
        +(rv.time?'<div class="m-review-time">'+esc(rv.time)+'</div>':'')
      +'</div>';
    }).join('');
    reviewsHtml = '<div class="m-sec">'
      +'<div class="m-sec-title"><i class="fas fa-star" style="color:var(--gold);margin-right:4px"></i>Google Reviews'
        +(reviewCount?' <span style="font-size:10px;color:rgba(255,255,255,.35);font-weight:400">('+rating+'★ &nbsp;·&nbsp; '+reviewCount.toLocaleString()+' reviews)</span>':'')
      +'</div>'
      +'<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px 14px">'+reviewCards+'</div>'
    +'</div>';
  }

  /* ── 영상 섹션 ── */
  var videosHtml = '';
  var shopVideos = shop._videos || [];
  if(shopVideos.length > 0) {
    var vidCards = shopVideos.map(function(v, vi) {
      var vThumb = v.thumbnail || shop.thumbnail || '';
      var vUrl   = v.videoUrl  || '';
      var vTitle = (function(){
        var t = (v.title || '').trim();
        if(!t) return shop.name;
        // 파일명 패턴 감지: 영문+숫자+_.- 8글자 이상이고 공백 없음 → shop.name으로 대체
        if(/^[a-zA-Z0-9_.~-]{8,}$/.test(t)) return shop.name;
        // shop.name과 동일하거나 거의 같으면 그대로 shop.name
        if(t === shop.name) return shop.name;
        return t;
      })();
      var vViews = v.views >= 1000 ? (v.views/1000).toFixed(1)+'K' : String(v.views||0);
      return '<div class="m-vid-card" id="mVidCard'+vi+'" onclick="mVidPlay('+vi+',this)">'
        +(vUrl?'<video data-src="'+esc(vUrl)+'" loop muted playsinline preload="none"></video>':'')
        +(vThumb?'<img src="'+esc(vThumb)+'" alt="'+esc(vTitle)+'" loading="lazy" decoding="async">':'<div style="position:absolute;inset:0;background:#111"></div>')
        +'<div class="m-vid-card-ov">'
          +'<div class="m-vid-card-title">'+esc(vTitle)+'</div>'
          +'<div class="m-vid-card-views"><i class="fas fa-eye"></i>'+vViews+'</div>'
        +'</div>'
        +'<div class="m-vid-play-ic"><i class="fas fa-play"></i></div>'
        // 소리 토글 버튼 (재생 중에만 표시)
        +'<button class="m-vid-mute-btn" onclick="mVidMute(event,this)" title="Toggle sound">'
          +'<i class="fas fa-volume-mute"></i>'
        +'</button>'
      +'</div>';
    }).join('');
    videosHtml = '<div class="m-sec" style="margin-bottom:0">'
      +'<div class="m-sec-title"><i class="fas fa-play-circle" style="color:var(--pk);margin-right:4px"></i>Videos'
        +' <span style="font-size:10px;color:rgba(255,255,255,.3);font-weight:400;letter-spacing:0">('+shopVideos.length+')</span>'
      +'</div>'
      +'<div class="m-vid-grid">'+vidCards+'</div>'
    +'</div>';
  }

  /* ── 본문 조립 ── */
  document.getElementById('modalContent').innerHTML =
    '<div class="m-shop-header">'
      +'<div class="m-shop-name">'+esc(shop.name||'')+'</div>'
      +'<div class="m-shop-sub">'
        +(shop.location ? '<div class="m-shop-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location))+'</div>' : '')
        +(reviewCount > 0 ? '<div class="m-divider"></div><span class="m-stars">'+starsHtml+'</span><span class="m-rating-txt">'+rating+' ('+reviewCount.toLocaleString()+')</span>' : '')
      +'</div>'
    +'</div>'
    + addrHtml
    + infoGridHtml
    + descHtml
    + whyHtml
    + priceHtml
    + svcHtml
    + reviewsHtml
    + hoursHtml
    + mapHtml
    + videosHtml
    + seoHtml;

  /* ── 버튼 영역 ── */
  var shopSlug = shop.slug || '';
  var pageUrl = shopSlug ? '/shop/'+shopSlug : '';
  var shareSupported = !!navigator.share;

  var btn2Row = '';

  // 가격 없는 업체: WhatsApp 버튼 없이 안내 텍스트만 있으면 버튼 행도 심플하게
  var waBtn = '';
  if(shop.priceRange || (shop.servicePrices && shop.servicePrices.length > 0)) {
    waBtn = '<a href="'+waUrl+'" target="_blank" rel="noopener" class="m-wa">'
      +'<span class="m-wa-icon"><i class="fab fa-whatsapp"></i></span>'
      +'<span class="m-wa-text">'
        +'<b>Book via WhatsApp</b>'
        +'<span>· '+esc(shop.name||'this shop')+'</span>'
      +'</span>'
    +'</a>';
  } else {
    waBtn = '<a href="'+waUrl+'" target="_blank" rel="noopener" class="m-wa" style="background:linear-gradient(135deg,rgba(37,211,102,.7),rgba(18,140,94,.7))">'
      +'<span class="m-wa-icon"><i class="fab fa-whatsapp"></i></span>'
      +'<span class="m-wa-text">'
        +'<b>Ask via WhatsApp</b>'
        +'<span>· Free quote</span>'
      +'</span>'
    +'</a>';
  }

  document.getElementById('modalBtns').innerHTML = waBtn + btn2Row;

  // GA4: WhatsApp 버튼 클릭 추적
  var waEl = document.getElementById('modalBtns').querySelector('a.m-wa');
  if(waEl && typeof gtag==='function'){
    waEl.addEventListener('click', function(){
      gtag('event','whatsapp_click',{
        event_category:'conversion',
        event_label: shop ? (shop.name||'unknown') : 'unknown',
        shop_name: shop ? (shop.name||'') : '',
        shop_category: shop ? (shop.category||'') : '',
        page_location: window.location.href
      });
    });
  }
}

/* ── 모달 내 영상 재생/정지 ── */
var _mVidMuted = true; // 모달 영상 소리 상태 (기본 음소거)
function mVidPlay(idx, card) {
  var vid = card.querySelector('video');
  if(!vid) return;
  // 다른 카드 정지
  document.querySelectorAll('.m-vid-card').forEach(function(c){
    if(c !== card) {
      c.classList.remove('vid-on');
      var v = c.querySelector('video');
      if(v) { v.pause(); v.currentTime = 0; }
    }
  });
  if(card.classList.contains('vid-on')) {
    // 이미 재생중 → 정지
    card.classList.remove('vid-on');
    vid.pause();
    vid.currentTime = 0;
  } else {
    // src 로드 후 재생
    if(vid.dataset.src && !vid.src) { vid.src = vid.dataset.src; }
    card.classList.add('vid-on');
    vid.muted = _mVidMuted;
    var p = vid.play();
    if(p && p.catch) p.catch(function(){});
    // 소리 버튼 아이콘 업데이트
    _mVidUpdateMuteBtn(card);
  }
}
function mVidMute(e, btn) {
  e.stopPropagation(); // 카드 클릭 이벤트 차단
  _mVidMuted = !_mVidMuted;
  // 현재 재생중인 모든 카드 영상에 적용
  document.querySelectorAll('.m-vid-card.vid-on').forEach(function(c){
    var v = c.querySelector('video');
    if(v) v.muted = _mVidMuted;
    _mVidUpdateMuteBtn(c);
  });
}
function _mVidUpdateMuteBtn(card) {
  var btn = card.querySelector('.m-vid-mute-btn i');
  if(btn) {
    btn.className = 'fas ' + (_mVidMuted ? 'fa-volume-mute' : 'fa-volume-up');
  }
  var muteBtn = card.querySelector('.m-vid-mute-btn');
  if(muteBtn) {
    muteBtn.style.opacity = _mVidMuted ? '0.6' : '1';
    muteBtn.style.borderColor = _mVidMuted ? 'rgba(255,255,255,.2)' : 'rgba(232,65,122,.6)';
    muteBtn.style.color = _mVidMuted ? 'rgba(255,255,255,.7)' : '#FF4D8D';
  }
}

function shareShopBtn(btn) {
  var name = btn.getAttribute('data-name') || '';
  var path = btn.getAttribute('data-url') || '';
  shareShop(name, path);
}
function shareShop(name, path) {
  var url = path ? (location.origin + path) : location.href;
  if(navigator.share) {
    navigator.share({ title: name + ' | Seoul Beauty Trip', url: url }).catch(function(){});
  } else {
    // 클립보드 복사 fallback
    try {
      navigator.clipboard.writeText(url).then(function(){
        showToast('Link copied!');
      });
    } catch(e) {
      // 구형 브라우저
      var ta = document.createElement('textarea');
      ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showToast('Link copied!'); } catch(e2) {}
      document.body.removeChild(ta);
    }
  }
}

function mapZoom(frameId, dir) {
  var fr = document.getElementById(frameId);
  if(!fr) return;
  var src = fr.src || fr.getAttribute('src') || '';
  /* zoom= 파라미터 조정 (없으면 15 기본) */
  var zMatch = src.match(/[?&]z=(\d+)/);
  var cur = zMatch ? parseInt(zMatch[1]) : 15;
  var next = Math.min(20, Math.max(10, cur + dir));
  if(src.indexOf('z=') !== -1) {
    src = src.replace(/([?&]z=)\d+/, '$1'+next);
  } else {
    src += (src.indexOf('?') !== -1 ? '&' : '?') + 'z='+next;
  }
  fr.src = src;
}

function setMHero(url, el) {
  var wrap = document.getElementById('mHeroWrap');
  var img  = document.getElementById('mHeroImg');
  if(img) {
    // 새 이미지로 교체 시 blur-up 다시 실행
    if(wrap) wrap.classList.remove('loaded');
    img.onload  = function(){ if(wrap) wrap.classList.add('loaded'); };
    img.onerror = function(){ if(wrap) wrap.classList.add('loaded'); };
    img.src = url;
  }
  document.querySelectorAll('.m-ts-thumb').forEach(function(t){ t.classList.remove('on'); });
  if(el) el.classList.add('on');
}

/* fullscreen viewer */
function openPhotoViewer(url) {
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;cursor:pointer';
  ov.innerHTML = '<img src="'+esc(url)+'" style="max-width:95vw;max-height:90vh;object-fit:contain;border-radius:8px">'
    +'<button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:18px;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">&#10005;</button>';
  ov.addEventListener('click', function(){ document.body.removeChild(ov); });
  document.body.appendChild(ov);
}

function closeModal(){
  // 모달 내 재생 중인 영상 모두 정지
  document.querySelectorAll('.m-vid-card').forEach(function(c){
    c.classList.remove('vid-on');
    var v = c.querySelector('video');
    if(v) { v.pause(); v.currentTime = 0; }
  });
  var bg = document.getElementById('shopModal');
  var panel = document.getElementById('modalPanel');
  panel.style.transition='transform .28s cubic-bezier(.32,1,.32,1)';
  panel.style.transform='translateY(100%)';
  setTimeout(function(){
    bg.classList.remove('open');
    panel.style.transition='';
    panel.style.transform='';
    // 검색 오버레이가 열려있었으면 다시 표시 (카탈로그 복귀)
    if(_searchOpen){
      var overlay = document.getElementById('search-overlay');
      if(overlay) overlay.classList.add('open');
    }
    // 검색 오버레이가 닫힌 경우가 아닐 때만 피드 영상 재개
    if(!_searchOpen){
      document.querySelectorAll('.slide').forEach(function(sl){
        var rect = sl.getBoundingClientRect();
        if(rect.top >= -50 && rect.bottom <= window.innerHeight + 50){
          var idx = parseInt(sl.id.replace('sl',''));
          var fv = document.getElementById('vid'+idx);
          var fb = document.getElementById('bufic'+idx);
          if(fv && fv.paused){
            fv.muted = isMuted; // 현재 소리 상태 반영
            _playVid(fv, fb);
          }
        }
      });
    }
  }, 280);
}

/* close on backdrop click */
document.getElementById('shopModal').addEventListener('click', function(e){
  if(e.target === this) closeModal();
});

/* close on swipe down */
(function(){
  var panel = document.getElementById('modalPanel');
  var handle = document.getElementById('modalHandle');
  var startY = 0, startScrollTop = 0, dragging = false, isDragFromHandle = false;

  function onStart(e) {
    var touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    startScrollTop = document.getElementById('modalScroll').scrollTop;
    dragging = true;
    isDragFromHandle = e.currentTarget === handle;
    panel.style.transition = 'none';
  }
  function onMove(e) {
    if(!dragging) return;
    var touch = e.touches ? e.touches[0] : e;
    var dy = touch.clientY - startY;
    if(isDragFromHandle || (startScrollTop <= 0 && dy > 0)) {
      if(dy > 0) {
        e.preventDefault();
        panel.style.transform = 'translateY('+dy+'px)';
      }
    }
  }
  function onEnd(e) {
    if(!dragging) return;
    dragging = false;
    var touch = e.changedTouches ? e.changedTouches[0] : e;
    var dy = touch.clientY - startY;
    panel.style.transition = '';
    if(dy > 100) {
      closeModal();
    } else {
      panel.style.transition = 'transform .22s ease';
      panel.style.transform = 'translateY(0)';
      setTimeout(function(){ panel.style.transition=''; }, 220);
    }
  }

  handle.addEventListener('touchstart', onStart, {passive:true});
  panel.addEventListener('touchmove', onMove, {passive:false});
  panel.addEventListener('touchend', onEnd, {passive:true});
  handle.addEventListener('mousedown', function(e){
    onStart(e);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', function mu(e2){
      onEnd(e2);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', mu);
    });
  });
})();

function _syncMuteUI(){
  var btn = document.getElementById('muteBtn');
  if(btn){
    btn.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    btn.classList.toggle('on', !isMuted);
  }
}
window.toggleMute=function(){
  isMuted=!isMuted;
  _syncMuteUI();
  // 현재 재생 중인 모든 video에 즉시 반영
  document.querySelectorAll('video').forEach(function(v){v.muted=isMuted;});
};
function showToast(msg){
  var t=document.getElementById('toast');
  t.innerHTML=msg; t.classList.add('on');
  setTimeout(function(){t.classList.remove('on');},3000);
}

/* ── 검색 기능 ── */
var _searchOpen = false;
var _soFilter = 'all'; // 현재 선택된 필터 칩

function toggleSearch(){
  _searchOpen = !_searchOpen;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  var overlay = document.getElementById('search-overlay');
  bar.classList.toggle('open', _searchOpen);
  btn.classList.toggle('on', _searchOpen);
  if(_searchOpen){
    overlay.classList.add('open');
    _soFilter = 'all';
    _resetChips();
    _renderSearchResults('', 'all');
    // 오버레이 열릴 때: 뒤로가기 = Main
    var lbl = document.getElementById('soBackLabel');
    if(lbl) lbl.textContent = 'Main';
    setTimeout(function(){ var inp = document.getElementById('soInput'); if(inp) inp.focus(); }, 200);
    // 피드 영상 일시정지 (오버레이 위에 가려져서)
    document.querySelectorAll('#feed video').forEach(function(v){ v.pause(); });
  } else {
    clearSearch();
    overlay.classList.remove('open');
    // 오버레이 닫힐 때 피드 영상 재개 (소리 상태 반영)
    document.querySelectorAll('.slide').forEach(function(sl){
      var rect = sl.getBoundingClientRect();
      if(rect.top >= -50 && rect.bottom <= window.innerHeight + 50){
        var idx = parseInt(sl.id.replace('sl',''));
        var fv = document.getElementById('vid'+idx);
        var fb = document.getElementById('bufic'+idx);
        if(fv && fv.paused){
          fv.muted = isMuted;
          _playVid(fv, fb);
        }
      }
    });
  }
}

function _resetChips(){
  document.querySelectorAll('.so-chip').forEach(function(c){
    c.classList.toggle('on', c.getAttribute('data-filter') === _soFilter);
  });
}

function _renderSearchResults(q, filter){
  var grid   = document.getElementById('so-grid');
  var header = document.getElementById('so-header');
  if(!grid) return;
  var kw = (q||'').toLowerCase().trim();
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa',tattoo:'#e879f9'};
  var CAT_LIST = ['clinic','headspa','skincare','hair','nail','makeup','spa','tattoo'];
  var AREA_LIST = ['gangnam','hongdae','myeongdong','sinsa','itaewon','insadong','jongno','mapo','yongsan','apgujeong','cheongdam','bukchon'];

  var results = allShopsData.filter(function(s){
    // 카테고리/지역 칩 필터
    if(filter && filter !== 'all'){
      var fl = filter.toLowerCase();
      var matchCat  = CAT_LIST.indexOf(fl) !== -1 && (s.category||'').toLowerCase() === fl;
      var matchArea = AREA_LIST.indexOf(fl) !== -1 && (s.location||'').toLowerCase().indexOf(fl) !== -1;
      // 지역도 카테고리도 아니면 location 포함 여부
      var matchLoc  = !matchCat && !matchArea && (s.location||'').toLowerCase().indexOf(fl) !== -1;
      if(!matchCat && !matchArea && !matchLoc) return false;
    }
    // 텍스트 검색
    if(!kw) return true;
    return (s.name||'').toLowerCase().indexOf(kw) !== -1
      || (s.category||'').toLowerCase().indexOf(kw) !== -1
      || (s.location||'').toLowerCase().indexOf(kw) !== -1
      || (s.description||'').toLowerCase().indexOf(kw) !== -1
      || (s.services||[]).some(function(sv){ return sv.toLowerCase().indexOf(kw) !== -1; });
  });

  var label = kw ? '"' + q + '"' : (filter && filter !== 'all' ? filter : 'All shops');
  if(header) header.textContent = results.length + ' result' + (results.length!==1?'s':'') + ' — ' + label;

  if(!results.length){
    grid.innerHTML = '<div class="so-empty" style="grid-column:1/-1;padding:60px 20px;text-align:center"><i class="fas fa-search" style="font-size:32px;margin-bottom:12px;display:block;opacity:.3"></i>No shops found</div>';
    return;
  }
  grid.innerHTML = results.map(function(s){
    var col = catColors[s.category] || 'var(--pk)';
    var thumb = s.thumbnail || s.videoThumb || '';
    var area = (s.location||'').split(',')[0].trim();
    var ratingStr = s.rating ? '<span class="so-card-rating"><i class="fas fa-star" style="font-size:8px"></i>'+Number(s.rating).toFixed(1)+'</span>' : '';
    var catLabel = catIcons[s.category] ? catIcons[s.category]+' ' : '';
    return '<a class="so-card" href="#" onclick="event.preventDefault();openShopFromSearch(&quot;'+s.id+'&quot;)">'
      +'<div class="so-card-img-wrap" style="position:relative">'
        +'<img class="so-card-img" src="'+esc(thumb)+'" alt="'+esc(s.name)+'" loading="lazy" decoding="async"'
          +' onload="parentLoaded(this)" onerror="parentLoaded(this)">'
        +'<div class="so-card-ov" style="background:'+col+'"></div>'
      +'</div>'
      +'<div class="so-card-body">'
        +'<div class="so-card-name">'+esc(s.name)+'</div>'
        +'<div class="so-card-meta">'
          +'<span class="so-card-loc"><i class="fas fa-map-marker-alt" style="font-size:8px;color:var(--pk)"></i>'+esc(area)+'</span>'
          +(s.category?'<span class="so-card-cat">'+catLabel+esc(s.category)+'</span>':'')
          +ratingStr
        +'</div>'
        +(s.description?'<div style="font-size:11px;color:rgba(255,255,255,.38);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;width:100%">'+esc((s.description||'').slice(0,150))+'</div>':'')
      +'</div>'
      +'<div class="so-card-arrow"><i class="fas fa-chevron-right"></i></div>'
    +'</a>';
  }).join('');
}

function onSearch(q){
  var x = document.getElementById('soX');
  if(x) x.classList.toggle('on', q.length > 0);
  _renderSearchResults(q, _soFilter);
}

function clearSoInput(){
  var inp = document.getElementById('soInput');
  var x = document.getElementById('soX');
  if(inp){ inp.value = ''; inp.focus(); }
  if(x) x.classList.remove('on');
  _renderSearchResults('', _soFilter);
}

function clearSearch(){
  var inp = document.getElementById('soInput');
  var x = document.getElementById('soX');
  var overlay = document.getElementById('search-overlay');
  if(inp) inp.value = '';
  if(x) x.classList.remove('on');
  if(overlay) overlay.classList.remove('open');
}

function closeSearch(){
  _searchOpen = false;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  if(bar) bar.classList.remove('open');
  if(btn) btn.classList.remove('on');
  clearSearch();
}

// 검색 오버레이에서 업체 클릭 → 오버레이는 뒤로 숨기고 모달만 열기
// closeModal() 시 _searchOpen=true 이면 오버레이 다시 복원
function openShopFromSearch(sid){
  var overlay = document.getElementById('search-overlay');
  if(overlay) overlay.classList.remove('open');
  openShopModal(sid);
}

// 검색 카드 영상 미리보기 — 탭/호버 시 재생
function soCardPreview(wrap){
  var vid = wrap.querySelector('.so-card-vid');
  if(!vid) return;
  if(!vid.src && vid.dataset.src){ vid.src = vid.dataset.src; vid.load(); }
  wrap.classList.add('vid-playing');
  vid.currentTime = 0;
  vid.play().catch(function(){});
}

// 검색 카드 영상 정지 (마우스 이탈 / 터치 후 자동정지)
function soCardStop(wrap){
  var vid = wrap.querySelector('.so-card-vid');
  wrap.classList.remove('vid-playing');
  if(vid){ vid.pause(); vid.currentTime = 0; }
}

// 필터 칩 클릭
document.getElementById('so-filters').addEventListener('click', function(e){
  var chip = e.target.closest('.so-chip');
  if(!chip) return;
  _soFilter = chip.getAttribute('data-filter');
  _resetChips();
  var q = (document.getElementById('soInput')||{}).value || '';
  _renderSearchResults(q, _soFilter);
});
// ESC 키로 검색 닫기
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeSearch();
});
/* ★ 핵심 수정: window 'load' → 'DOMContentLoaded' 로 변경
   'load'는 모든 이미지·CDN·폰트가 다 받아질 때까지 기다림 (5~15초 지연 가능)
   'DOMContentLoaded'는 HTML 파싱 완료 즉시 실행 (0.1~0.3초) → 로딩 화면 즉시 해제 가능 */
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.cat').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.cat').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      loadVideos(b.getAttribute('data-cat'));
      document.getElementById('feed').scrollTo({top:0});
    });
  });

  /* logo 3x click -> admin */
  var clickCount = 0, clickTimer = null;
  var ADMIN_PW = '0907';

  document.getElementById('logoBtn').addEventListener('click', function(){
    clickCount++;
    if(clickTimer) clearTimeout(clickTimer);
    if(clickCount >= 3){
      clickCount = 0;
      showAdminModal();
    } else {
      clickTimer = setTimeout(function(){ clickCount = 0; }, 1500);
    }
  });

  // Admin 모달 HTML을 JS로 동적 생성 (크롤러 HTML에 "Admin Login" 텍스트 노출 방지)
  window.showAdminModal = function(){
    var m = document.getElementById('adminModal');
    if(!m._built){
      m._built = true;
      m.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center';
      m.innerHTML = '<div style="background:var(--cd);border:1px solid rgba(232,65,122,.2);border-radius:20px;padding:28px 24px;width:280px;max-width:90vw;text-align:center">'
        +'<div style="font-size:28px;margin-bottom:8px">&#128274;</div>'
        +'<div style="font-family:var(--ff-serif);font-size:15px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,var(--pk),var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent">Admin Access</div>'
        +'<div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:18px">Enter password to continue</div>'
        +'<form onsubmit="checkAdminPw();return false;" autocomplete="off">'
        +'<input type="text" name="username" style="display:none" autocomplete="username">'
        +'<input id="adminPwInput" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(232,65,122,.2);border-radius:11px;color:#fff;font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:12px;font-family:var(--ff-sans)">'
        +'<div style="display:flex;gap:8px">'
        +'<button type="submit" style="flex:1;padding:11px;background:linear-gradient(135deg,var(--pk),#7C3AED);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Confirm</button>'
        +'<button type="button" onclick="closeAdminModal()" style="flex:1;padding:11px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:11px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer">Cancel</button>'
        +'</div></form>'
        +'<div id="adminPwErr" style="font-size:11px;color:#ef4444;margin-top:10px;display:none">&#10060; Incorrect password</div>'
        +'</div>';
      m.addEventListener('click', function(e){ if(e.target===m) window.closeAdminModal(); });
    } else {
      m.style.display = 'flex';
    }
    var inp = document.getElementById('adminPwInput');
    if(inp){ inp.value=''; setTimeout(function(){inp.focus();},150); }
    var err = document.getElementById('adminPwErr');
    if(err) err.style.display='none';
  };
  window.closeAdminModal = function(){
    document.getElementById('adminModal').style.display = 'none';
  };
  window.checkAdminPw = function(){
    var pw = document.getElementById('adminPwInput').value;
    if(pw === ADMIN_PW){
      window.location.href = '/admin';
    } else {
      var err = document.getElementById('adminPwErr');
      if(err) err.style.display='block';
      var inp = document.getElementById('adminPwInput');
      if(inp){ inp.value=''; inp.style.borderColor='#ef4444'; setTimeout(function(){inp.style.borderColor='rgba(232,65,122,.2)';},1200); }
    }
  };

  /* ── PC: cats bar wheel → horizontal scroll ── */
  var catsEl = document.getElementById('cats');
  if(catsEl) {
    catsEl.addEventListener('wheel', function(e) {
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        catsEl.scrollLeft += e.deltaY;
      }
    }, {passive: false});
  }

  /* ── PC: feed wheel + keyboard navigation ── */
  var feedEl = document.getElementById('feed');
  var wheelLocked = false;
  if(feedEl) {
    feedEl.addEventListener('wheel', function(e) {
      e.preventDefault();
      if(wheelLocked) return;
      wheelLocked = true;
      var dir = e.deltaY > 0 ? 1 : -1;
      var slides = document.querySelectorAll('.slide');
      var feedRect = feedEl.getBoundingClientRect();
      var current = 0;
      slides.forEach(function(sl, i) {
        var r = sl.getBoundingClientRect();
        if(Math.abs(r.top - feedRect.top) < feedRect.height * 0.5) current = i;
      });
      var next = Math.max(0, Math.min(slides.length - 1, current + dir));
      slides[next].scrollIntoView({behavior:'smooth', block:'start'});
      setTimeout(function(){ wheelLocked = false; }, 700);
    }, {passive: false});
  }

  document.addEventListener('keydown', function(e) {
    var modal = document.getElementById('shopModal');
    if(modal && modal.classList.contains('open')) return;
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var feedEl2 = document.getElementById('feed');
    if(!feedEl2) return;
    var delta = 0;
    if(e.key === 'ArrowDown' || e.key === 'PageDown') delta = 1;
    if(e.key === 'ArrowUp'   || e.key === 'PageUp')   delta = -1;
    if(delta === 0) return;
    e.preventDefault();
    var slides = document.querySelectorAll('.slide');
    var feedRect2 = feedEl2.getBoundingClientRect();
    var current2 = 0;
    slides.forEach(function(sl, i) {
      var r = sl.getBoundingClientRect();
      if(Math.abs(r.top - feedRect2.top) < feedRect2.height * 0.5) current2 = i;
    });
    var next2 = Math.max(0, Math.min(slides.length - 1, current2 + delta));
    slides[next2].scrollIntoView({behavior:'smooth', block:'start'});
  });

  // 스플래시 프로그레스 바 CSS 애니메이션 → JS 직접 제어로 전환
  setLdProgress(0);
  loadVideos('all');

  // ── 카테고리 탭 마우스 드래그 스크롤 (PC) ──
  var catsEl = document.getElementById('cats');
  if(catsEl) {
    var isDragging = false, startX = 0, scrollLeft = 0;
    catsEl.addEventListener('mousedown', function(e){
      isDragging = true; startX = e.pageX - catsEl.offsetLeft; scrollLeft = catsEl.scrollLeft;
      catsEl.style.cursor = 'grabbing';
    });
    document.addEventListener('mouseup', function(){ isDragging = false; catsEl.style.cursor = 'grab'; });
    catsEl.addEventListener('mousemove', function(e){
      if(!isDragging) return;
      e.preventDefault();
      var x = e.pageX - catsEl.offsetLeft;
      catsEl.scrollLeft = scrollLeft - (x - startX);
    });
    catsEl.addEventListener('mouseleave', function(){ isDragging = false; catsEl.style.cursor = 'grab'; });
  }

  // ── PC 카탈로그 패널 (항상 로드, CSS로 표시/숨김 제어) ──
  fetch('/api/shops').then(function(r){ return r.json(); }).then(function(d){
    allShopsData = d.shops || [];
    _injectVideoIntoShops(); // 검색 카드용 videoUrl/videoThumb 주입
    renderShopPanel('all');
  });
  document.querySelectorAll('#sp-filter .sp-flt').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('#sp-filter .sp-flt').forEach(function(b){ b.classList.remove('on'); });
      btn.classList.add('on');
      renderShopPanel(btn.getAttribute('data-cat'));
    });
  });
});

function renderShopPanel(cat) {
  var grid = document.getElementById('sp-grid');
  var countEl = document.getElementById('sp-count');
  if(!grid) return;
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa',tattoo:'#e879f9'};
  var filtered = cat === 'all' ? allShopsData : allShopsData.filter(function(s){ return s.category === cat; });
  if(countEl) countEl.textContent = filtered.length + ' shops';
  if(!filtered.length){
    grid.innerHTML = '<div class="sp-empty"><div style="font-size:28px;margin-bottom:8px">&#128269;</div>No shops in this category</div>';
    return;
  }
  grid.innerHTML = filtered.map(function(s){
    var col = catColors[s.category] || '#aaa';
    var sid = s.id.replace(/'/g, '');
    var hasSlug = s.slug && s.slug.length > 0;
    var clickAttr = hasSlug
      ? 'data-slug="/shop/'+s.slug+'" onclick="location.href=this.dataset.slug"'
      : 'onclick="openShopModal(&quot;'+sid+'&quot;)"';
    return '<div class="sp-card" '+clickAttr+'>'+
      '<img class="sp-card-img" src="'+(s.thumbnail||'')+'" alt="'+esc(s.name)+'" loading="lazy" onerror="this.style.background=&quot;#1a1a2e&quot;">'+
      '<div class="sp-card-rating"><i class="fas fa-star" style="font-size:8px"></i> '+s.rating+'</div>'+
      (hasSlug ? '<div style="position:absolute;top:7px;left:7px;background:rgba(232,65,122,.85);border-radius:6px;padding:2px 6px;font-size:9px;font-weight:800;color:#fff;letter-spacing:.5px"><i class="fas fa-link" style="font-size:8px"></i></div>' : '')+
      '<div class="sp-card-body">'+
        '<div class="sp-card-cat" style="color:'+col+'">'+esc(s.category)+'</div>'+
        '<div class="sp-card-name">'+esc(s.name)+'</div>'+
        '<div class="sp-card-loc"><i class="fas fa-map-marker-alt"></i>'+esc((s.location||'').split(',')[0])+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}
</script>

<!-- ★ Best 랜딩 페이지 내부 링크 — 구글 크롤러가 발견하도록 DOM에 삽입 -->
<nav aria-label="Browse by category and area" style="background:#fff;border-top:1px solid #f0f0f0;padding:32px 16px 40px">
  <div style="max-width:700px;margin:0 auto">
    <h2 style="font-size:1rem;font-weight:700;color:#1a1a2e;margin-bottom:6px;text-align:center">Browse Korean Beauty by Area</h2>
    <p style="font-size:.82rem;color:#888;text-align:center;margin-bottom:20px">Foreigner-friendly salons in Seoul — find your area</p>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">🧖 Head Spa</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/headspa/gangnam" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/headspa/hongdae" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/headspa/itaewon" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/headspa/myeongdong" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Myeongdong</a>
          <a href="/best/headspa/apgujeong" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Apgujeong</a>
          <a href="/best/headspa/seoul" style="background:#fdf2f8;color:#be185d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">🌿 Skincare</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/skincare/gangnam" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/skincare/hongdae" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/skincare/itaewon" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/skincare/myeongdong" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Myeongdong</a>
          <a href="/best/skincare/seoul" style="background:#f0fdf4;color:#15803d;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">💇 Hair Salon</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/hair/gangnam" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Gangnam</a>
          <a href="/best/hair/hongdae" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Hongdae</a>
          <a href="/best/hair/itaewon" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Itaewon</a>
          <a href="/best/hair/sinchon" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">Sinchon</a>
          <a href="/best/hair/seoul" style="background:#eff6ff;color:#1d4ed8;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">All Seoul</a>
        </div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:700;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">💅 Nail · 🏥 Clinic · 💋 Makeup · 🛁 Spa</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <a href="/best/nail/hongdae" style="background:#faf5ff;color:#7c3aed;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">💅 Nail Hongdae</a>
          <a href="/best/nail/gangnam" style="background:#faf5ff;color:#7c3aed;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">💅 Nail Gangnam</a>
          <a href="/best/clinic/gangnam" style="background:#fff7ed;color:#c2410c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">🏥 Clinic Gangnam</a>
          <a href="/best/clinic/apgujeong" style="background:#fff7ed;color:#c2410c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">🏥 Clinic Apgujeong</a>
          <a href="/best/makeup/hongdae" style="background:#fff1f2;color:#be123c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">💋 Makeup Hongdae</a>
          <a href="/best/makeup/myeongdong" style="background:#fff1f2;color:#be123c;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">💋 Makeup Myeongdong</a>
          <a href="/best/spa/itaewon" style="background:#f0f9ff;color:#0369a1;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">🛁 Spa Itaewon</a>
          <a href="/best/spa/gangnam" style="background:#f0f9ff;color:#0369a1;border-radius:20px;padding:5px 14px;font-size:.8rem;font-weight:600;text-decoration:none">🛁 Spa Gangnam</a>
        </div>
      </div>
    </div>
  </div>
</nav>

<!-- ★ SEO 콘텐츠 섹션 — 구글 검색 상위 노출용 롱폼 텍스트 -->
<section aria-label="About Seoul Beauty Trip" style="background:#fff;padding:40px 16px 48px;border-top:1px solid #f0f0f0">
  <div style="max-width:700px;margin:0 auto">

    <h2 style="font-size:1.25rem;font-weight:800;color:#1a1a2e;margin-bottom:12px;text-align:center">
      Your Ultimate Guide to K-Beauty in Seoul
    </h2>
    <p style="font-size:.92rem;color:#374151;line-height:1.9;margin-bottom:20px;text-align:center;max-width:580px;margin-left:auto;margin-right:auto">
      Seoul Beauty Trip is the #1 curated directory for foreigners seeking authentic Korean beauty experiences in Seoul.
      Every salon is hand-verified for English support, transparent pricing, and quality service.
    </p>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:32px">
      <div style="background:#fdf2f8;border-radius:16px;padding:20px">
        <div style="font-size:1.5rem;margin-bottom:6px">🧖</div>
        <div style="font-weight:700;color:#1a1a2e;font-size:.95rem;margin-bottom:6px">Head Spa</div>
        <div style="font-size:.82rem;color:#555;line-height:1.6">Experience Seoul's viral 18-step scalp ritual. Deep cleanse, scalp analysis, and total relaxation — perfect for every hair type.</div>
      </div>
      <div style="background:#f0fdf4;border-radius:16px;padding:20px">
        <div style="font-size:1.5rem;margin-bottom:6px">🌿</div>
        <div style="font-weight:700;color:#1a1a2e;font-size:.95rem;margin-bottom:6px">Skincare</div>
        <div style="font-size:.82rem;color:#555;line-height:1.6">Korean glass-skin facials, LED therapy, and customized prescription care. World-renowned K-beauty results you won't find at home.</div>
      </div>
      <div style="background:#eff6ff;border-radius:16px;padding:20px">
        <div style="font-size:1.5rem;margin-bottom:6px">💇</div>
        <div style="font-weight:700;color:#1a1a2e;font-size:.95rem;margin-bottom:6px">Hair Salon</div>
        <div style="font-size:.82rem;color:#555;line-height:1.6">K-pop inspired cuts, balayage, and Korean perms from English-friendly stylists experienced with all hair textures.</div>
      </div>
      <div style="background:#fff7ed;border-radius:16px;padding:20px">
        <div style="font-size:1.5rem;margin-bottom:6px">🏥</div>
        <div style="font-weight:700;color:#1a1a2e;font-size:.95rem;margin-bottom:6px">Derma Clinic</div>
        <div style="font-size:.82rem;color:#555;line-height:1.6">Laser toning, skin boosters, and RF lifting — 30-50% less than Western prices with English-speaking consultants.</div>
      </div>
    </div>

    <h2 style="font-size:1.1rem;font-weight:700;color:#1a1a2e;margin-bottom:10px">
      Why Foreigners Choose Seoul Beauty Trip
    </h2>
    <ul style="list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:8px">
      <li style="display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#374151;line-height:1.7">
        <span style="color:#e91e8c;font-size:1rem;flex-shrink:0;margin-top:2px">✓</span>
        <span><strong>100% English booking via WhatsApp</strong> — No Korean needed. Our team and partner salons speak English fluently.</span>
      </li>
      <li style="display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#374151;line-height:1.7">
        <span style="color:#e91e8c;font-size:1rem;flex-shrink:0;margin-top:2px">✓</span>
        <span><strong>Real customer reviews</strong> from international visitors — honest ratings from travelers like you.</span>
      </li>
      <li style="display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#374151;line-height:1.7">
        <span style="color:#e91e8c;font-size:1rem;flex-shrink:0;margin-top:2px">✓</span>
        <span><strong>Transparent pricing</strong> — Know exactly what you'll pay before you arrive. No hidden fees.</span>
      </li>
      <li style="display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#374151;line-height:1.7">
        <span style="color:#e91e8c;font-size:1rem;flex-shrink:0;margin-top:2px">✓</span>
        <span><strong>Hand-verified salons</strong> — Every listing is manually checked for foreigner-friendliness and service quality.</span>
      </li>
      <li style="display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:#374151;line-height:1.7">
        <span style="color:#e91e8c;font-size:1rem;flex-shrink:0;margin-top:2px">✓</span>
        <span><strong>Salons across all major areas</strong> — Gangnam, Hongdae, Itaewon, Myeongdong, Apgujeong &amp; more.</span>
      </li>
    </ul>

    <h2 style="font-size:1.1rem;font-weight:700;color:#1a1a2e;margin-bottom:10px">
      Popular Areas for K-Beauty
    </h2>
    <p style="font-size:.88rem;color:#374151;line-height:1.8;margin-bottom:16px">
      <strong>Gangnam</strong> is Seoul's luxury beauty district, home to premium skincare clinics and dermatology centers.
      <strong>Hongdae</strong> is the trendy hub for unique nail art, creative hair styling, and indie beauty salons.
      <strong>Itaewon</strong> is the most foreigner-friendly neighborhood, with multilingual staff and international menus.
      <strong>Myeongdong</strong> is perfect for tourists — centrally located with makeup studios, skincare shops, and spa experiences.
      <strong>Apgujeong</strong> (Rodeo Street) is Seoul's fashion and beauty elite zone, known for cutting-edge aesthetic clinics and luxury head spas.
    </p>

    <div style="background:linear-gradient(135deg,#e91e8c15,#9c27b015);border-radius:16px;padding:20px;text-align:center">
      <div style="font-size:.95rem;font-weight:700;color:#1a1a2e;margin-bottom:6px">Ready to book your K-beauty experience?</div>
      <div style="font-size:.85rem;color:#555;margin-bottom:14px">Browse salons above and contact any shop directly via WhatsApp in English.</div>
      <a href="/shops" style="display:inline-block;background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;padding:10px 28px;border-radius:24px;font-size:.88rem;font-weight:700;text-decoration:none">
        View All Salons →
      </a>
    </div>

  </div>
</section>


<!-- ── 구글맵 오버레이 ── -->
<div id="mapOverlay" style="display:none;position:fixed;inset:0;z-index:2000;flex-direction:column;background:#000">
  <!-- 상단 바 -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#111;flex-shrink:0">
    <span id="mapOverlayTitle" style="color:#fff;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:10px"></span>
    <button onclick="closeMapOverlay()" style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.12);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">&times;</button>
  </div>
  <!-- iframe -->
  <iframe id="mapOverlayFrame" src="" style="flex:1;border:0;width:100%;display:block" allowfullscreen loading="lazy"></iframe>
</div>

</body>
</html>`

// ════════════════════════════════════════════
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1N9ZQRHLJ0"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1N9ZQRHLJ0');
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Trip - Admin</title>
<script>
// 서버에서 주입된 토큰 우선, 없으면 localStorage에서 복원
var _GSK_TOKEN = '__GSK_TOKEN__' || localStorage.getItem('_gsk_token') || '';
// localStorage에 저장 (다음 방문 시 재사용)
if(_GSK_TOKEN) localStorage.setItem('_gsk_token', _GSK_TOKEN);
</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30;--green:#10b981;--yellow:#f59e0b;--red:#ef4444;--blue:#3b82f6}
@keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
body{background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
/* NAV */
.nav{background:var(--bg2);border-bottom:1px solid rgba(255,77,141,.18);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-logo{font-size:16px;font-weight:900;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-back{color:#aaa;text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px;padding:6px 13px;border:1px solid rgba(255,255,255,.12);border-radius:16px}
/* TABS */
.tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.08);background:var(--bg2);overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:13px 18px;font-size:12px;font-weight:700;color:rgba(255,255,255,.4);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;display:flex;align-items:center;gap:5px}
.tab.on{color:var(--pk);border-bottom-color:var(--pk)}
.tab-content{display:none;padding:20px;max-width:900px;margin:0 auto}
.tab-content.on{display:block}
/* STATS */
.stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
.stat-card{background:var(--cd);border-radius:14px;padding:16px;border:1px solid rgba(255,255,255,.06)}
.stat-val{font-size:28px;font-weight:900;margin-bottom:2px}
.stat-lbl{font-size:11px;color:rgba(255,255,255,.45);font-weight:600}
.stat-icon{font-size:22px;margin-bottom:6px}
/* CARDS */
.card{background:var(--cd);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;margin-bottom:12px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.card-title{font-size:14px;font-weight:800;color:#fff;display:flex;align-items:center;gap:6px}
/* FORM */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.full{grid-column:1/-1}
label{font-size:11px;color:rgba(255,255,255,.38);display:block;margin-bottom:3px}
input,select,textarea{width:100%;padding:10px 13px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,77,141,.18);border-radius:10px;color:#fff;font-size:13px;outline:none;transition:border-color .2s}
input:focus,select:focus,textarea:focus{border-color:var(--pk)}
select option{background:var(--bg2)}
textarea{height:80px;resize:none}
.btn-pk{padding:10px 20px;background:linear-gradient(135deg,var(--pk),var(--pu));border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;cursor:pointer}
.btn-sm{padding:6px 12px;border-radius:8px;border:none;font-size:11.5px;font-weight:700;cursor:pointer}
.btn-red{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#ef4444}
.btn-green{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#10b981}
.btn-blue{background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:#60a5fa}
/* TABLE */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:11px;color:rgba(255,255,255,.38);font-weight:700;padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06)}
.tbl td{font-size:12.5px;padding:10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:top}
.tbl tr:hover td{background:rgba(255,255,255,.02)}
/* BADGES */
.bdg{display:inline-block;padding:3px 9px;border-radius:8px;font-size:10px;font-weight:800}
.bdg-new{background:rgba(59,130,246,.2);color:#60a5fa}
.bdg-contacted{background:rgba(245,158,11,.2);color:#f59e0b}
.bdg-confirmed{background:rgba(16,185,129,.2);color:#10b981}
.bdg-completed{background:rgba(139,92,246,.2);color:#a78bfa}
.bdg-cancelled{background:rgba(239,68,68,.2);color:#ef4444}
.bdg-cat{background:rgba(255,77,141,.15);color:var(--pk)}
/* SHOP CARD */
.shop-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;display:flex;gap:14px;align-items:flex-start;transition:border-color .2s}
.shop-card:hover{border-color:rgba(255,77,141,.4)}
.shop-row{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.shop-row:last-child{border:none}
.shop-row img{width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0}
.shop-meta{flex:1}
.shop-meta h4{font-size:14px;font-weight:700;margin-bottom:3px}
.shop-meta p{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px}
.shop-meta .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
/* VIDEO CARD */
.vid-row{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.vid-row:last-child{border:none}
.vid-row img{width:48px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0}
/* TOP VIDEO */
.top-vid{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.top-vid:last-child{border:none}
.top-vid img{width:40px;height:52px;border-radius:7px;object-fit:cover;flex-shrink:0}
.top-rank{font-size:18px;font-weight:900;color:var(--pk);width:24px;flex-shrink:0}
@media(max-width:540px){.stats-grid{grid-template-columns:1fr 1fr!important}.form-grid{grid-template-columns:1fr}}
.bar-wrap{display:flex;align-items:center;gap:8px;font-size:12px}
.bar-bg{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .6s cubic-bezier(.4,0,.2,1)}
.bar-label{min-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.7);font-size:11px}
.bar-val{min-width:36px;text-align:right;color:rgba(255,255,255,.45);font-size:11px}
/* SHOP SLUG LINK */
.shop-slug-link{display:block;font-size:10px;color:rgba(99,179,237,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;text-decoration:none;margin-top:2px}
.shop-slug-link:hover{color:#93c5fd;text-decoration:underline}
/* SEO TAB LINKS */
.seo-url-link{font-size:11px;color:#60a5fa;text-decoration:none;display:flex;align-items:center;gap:4px}
.seo-url-link:hover{text-decoration:underline}
.seo-view-btn{flex-shrink:0;margin-left:10px;padding:5px 10px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.25);border-radius:7px;color:#60a5fa;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap}
.seo-view-btn:hover{background:rgba(96,165,250,.22)}
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-logo">&#10024; Seoul Beauty Trip — 관리자</div>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> 사이트로</a>
</nav>

<div class="tabs">
  <div class="tab on" data-tab="dashboard"><i class="fas fa-chart-bar"></i> 대시보드</div>
  <div class="tab" data-tab="analytics"><i class="fas fa-chart-line"></i> 방문자 분석</div>
  <div class="tab" data-tab="bookings"><i class="fas fa-calendar-check"></i> 예약관리 <span style="font-size:9px;background:rgba(251,191,36,.2);color:#fbbf24;border-radius:10px;padding:1px 5px;vertical-align:middle">준비중</span></div>
  <div class="tab" data-tab="shops"><i class="fas fa-store"></i> 업체 · 영상</div>
  <div class="tab" data-tab="blog"><i class="fas fa-blog"></i> 블로그</div>
  <div class="tab" data-tab="settings"><i class="fas fa-cog"></i> 설정</div>
</div>

<!-- 대시보드 -->
<div class="tab-content on" id="tab-dashboard">
  <!-- 핵심 지표 카드 6개 -->
  <div class="stats-grid" id="statsGrid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
    <div class="stat-card"><div class="stat-icon">&#128065;</div><div class="stat-val" id="st-views">-</div><div class="stat-lbl">총 조회수</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#10b981">&#127968;</div><div class="stat-val" id="st-shops" style="color:#10b981">-</div><div class="stat-lbl">등록 업체</div></div>
    <div class="stat-card"><div class="stat-icon">&#128197;</div><div class="stat-val" id="st-bookings">-</div><div class="stat-lbl">총 예약</div></div>
    <div class="stat-card" style="background:rgba(59,130,246,.08);border-color:rgba(59,130,246,.2)"><div class="stat-icon" style="color:#60a5fa">&#128276;</div><div class="stat-val" id="st-new" style="color:#60a5fa">-</div><div class="stat-lbl">신규 예약</div></div>
    <div class="stat-card" style="background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.2)"><div class="stat-icon" style="color:#34d399">&#9989;</div><div class="stat-val" id="st-confirmed" style="color:#34d399">-</div><div class="stat-lbl">확정 예약</div></div>
    <div class="stat-card" style="background:rgba(251,146,60,.08);border-color:rgba(251,146,60,.2)"><div class="stat-icon" style="color:#fb923c">&#128172;</div><div class="stat-val" id="st-contacted" style="color:#fb923c">-</div><div class="stat-lbl">연락 완료</div></div>
  </div>

  <!-- 차트 행 -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <!-- 카테고리별 업체 분포 -->
    <div class="card" style="margin-bottom:0;padding:16px">
      <div class="card-title" style="font-size:12px;margin-bottom:12px"><i class="fas fa-chart-pie" style="color:#a78bfa"></i> 카테고리별 업체</div>
      <canvas id="catChart" height="180"></canvas>
    </div>
    <!-- 예약 상태 도넛 -->
    <div class="card" style="margin-bottom:0;padding:16px">
      <div class="card-title" style="font-size:12px;margin-bottom:12px"><i class="fas fa-chart-donut" style="color:#f472b6"></i> 예약 상태 현황</div>
      <canvas id="bookingChart" height="180"></canvas>
    </div>
  </div>

  <!-- 업체별 조회수 TOP5 -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><div class="card-title"><i class="fas fa-trophy" style="color:#fbbf24"></i> 업체별 조회수 TOP 5</div></div>
    <div id="shopViewStats" style="display:flex;flex-direction:column;gap:8px;padding:0 4px"></div>
  </div>

  <!-- 인기 영상 TOP5 -->
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fas fa-fire" style="color:#FF4D8D"></i> 인기 영상 TOP 5</div></div>
    <div id="topVids"></div>
  </div>

  <!-- SEO 관리 카드 -->
  <div class="card" style="border:1px solid rgba(99,102,241,.3)">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-search" style="color:#6366f1"></i> SEO 관리</div>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:14px">업체별 Google 상위노출을 위한 SEO 자동 관리 도구</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <button onclick="regenSeoAll(false)" id="regen-btn" class="btn-sm btn-blue" style="font-size:12px;padding:8px 16px">
        <i class="fas fa-magic"></i> SEO 미생성 업체 일괄 생성
      </button>
      <button onclick="regenSeoAll(true)" id="regen-force-btn" class="btn-sm" style="font-size:12px;padding:8px 16px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#a78bfa">
        <i class="fas fa-sync"></i> 전체 업체 SEO 강제 재생성
      </button>
      <button onclick="fixAllSlugs()" id="fix-slugs-btn" class="btn-sm" style="font-size:12px;padding:8px 16px;background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.3);color:#fbbf24">
        <i class="fas fa-link"></i> 전체 Slug 정리 (업체명-지역명)
      </button>
      <a href="/sitemap.xml" target="_blank" class="btn-sm btn-green" style="font-size:12px;padding:8px 16px;display:inline-flex;align-items:center;gap:5px">
        <i class="fas fa-sitemap"></i> sitemap.xml 확인
      </a>
    </div>
    <div id="regen-status" style="font-size:12px;color:rgba(255,255,255,.5)"></div>
    <div id="regen-results" style="margin-top:10px;max-height:200px;overflow-y:auto"></div>
    <!-- Best 랜딩 페이지 링크 -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.45);margin-bottom:10px">📍 카테고리×지역 랜딩 페이지 (Google 상위노출 타겟)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="best-pages-grid">
        <a href="/best/headspa/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">🧖 Head Spa Gangnam</a>
        <a href="/best/headspa/hongdae" target="_blank" class="btn-sm btn-blue" style="font-size:10px">🧖 Head Spa Hongdae</a>
        <a href="/best/skincare/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">🌿 Skincare Gangnam</a>
        <a href="/best/hair/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">💇 Hair Gangnam</a>
        <a href="/best/nail/hongdae" target="_blank" class="btn-sm btn-blue" style="font-size:10px">💅 Nail Hongdae</a>
        <a href="/best/clinic/gangnam" target="_blank" class="btn-sm btn-blue" style="font-size:10px">🏥 Clinic Gangnam</a>
        <a href="/best/spa/itaewon" target="_blank" class="btn-sm btn-blue" style="font-size:10px">🛁 Spa Itaewon</a>
        <a href="/best/makeup/myeongdong" target="_blank" class="btn-sm btn-blue" style="font-size:10px">💋 Makeup Myeongdong</a>
      </div>
    </div>
  </div>
</div>

<!-- 방문자 분석 (GA4) -->
<div class="tab-content" id="tab-analytics" style="padding:0">
  <!-- 헤더 -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;flex-wrap:wrap;gap:8px">
    <div style="font-size:15px;font-weight:900;color:#fff"><i class="fas fa-chart-line" style="color:#FF4D8D;margin-right:6px"></i> 방문자 분석</div>
    <a href="https://lookerstudio.google.com/reporting/66f7ff82-9ee4-46aa-b1cf-1931cc015798" target="_blank" class="btn-sm btn-blue" style="font-size:11px;padding:6px 12px;display:inline-flex;align-items:center;gap:5px">
      <i class="fas fa-external-link-alt"></i> 새 탭으로 보기
    </a>
  </div>

  <!-- 안내 배너 -->
  <div style="margin:0 20px 12px;padding:10px 14px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:10px;font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px">
    <i class="fas fa-lightbulb" style="color:#a78bfa"></i>
    Looker Studio 보고서는 흰 배경으로 표시됩니다. <b style="color:#a78bfa;margin-left:4px">아래 방법으로 어둡게 바꿀 수 있어요 ↓</b>
    <button onclick="document.getElementById('an-guide').style.display=document.getElementById('an-guide').style.display==='none'?'block':'none'" style="margin-left:auto;background:rgba(167,139,250,.2);border:1px solid rgba(167,139,250,.3);color:#a78bfa;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer">방법 보기</button>
  </div>

  <!-- 다크모드 적용 가이드 -->
  <div id="an-guide" style="display:none;margin:0 20px 12px;padding:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:12px;line-height:2;color:rgba(255,255,255,.7)">
    <b style="color:#fff;font-size:13px">📌 Looker Studio 배경 어둡게 바꾸기</b><br>
    1. <a href="https://lookerstudio.google.com/reporting/66f7ff82-9ee4-46aa-b1cf-1931cc015798" target="_blank" style="color:#60a5fa">Looker Studio 보고서</a> 접속 → 수정 모드<br>
    2. 상단 메뉴 <b style="color:#fff">테마 및 레이아웃</b> 클릭<br>
    3. <b style="color:#fff">배경색</b> → 어두운 색 선택 (예: #0d0d18 또는 #1a1a2e)<br>
    4. <b style="color:#fff">텍스트색</b> → 흰색으로 변경<br>
    5. 저장 → 여기서 새로고침
  </div>

  <!-- Looker Studio iframe - 전체 너비 -->
  <div style="position:relative;margin:0;background:#fff">
    <div id="an-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#13132a;z-index:2;flex-direction:column;gap:10px;min-height:200px">
      <i class="fas fa-chart-line" style="font-size:32px;color:rgba(255,77,141,.5);animation:pulse 1.5s infinite"></i>
      <div style="font-size:13px;color:rgba(255,255,255,.4)">대시보드 불러오는 중...</div>
      <div style="font-size:11px;color:rgba(255,255,255,.25)">처음 로딩은 5~10초 걸릴 수 있어요</div>
    </div>
    <iframe
      src="https://datastudio.google.com/embed/reporting/66f7ff82-9ee4-46aa-b1cf-1931cc015798/page/WLqzF"
      style="width:100%;height:800px;border:0;display:block"
      allowfullscreen
      sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onload="document.getElementById('an-loading').style.display='none'"
    ></iframe>
  </div>
  <div style="padding:8px 20px 16px;font-size:11px;color:rgba(255,255,255,.2);text-align:center">
    <i class="fas fa-sync-alt"></i> Google Looker Studio · GA4 실시간 연동
  </div>
</div>

<!-- 예약관리 -->
<div class="tab-content" id="tab-bookings">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-calendar-check" style="color:#FF4D8D"></i> 예약 관리</div>
    </div>
    <div style="text-align:center;padding:40px 20px">
      <i class="fas fa-calendar-clock" style="font-size:40px;color:rgba(251,191,36,.4);margin-bottom:16px;display:block"></i>
      <div style="font-size:15px;font-weight:700;color:rgba(255,255,255,.6);margin-bottom:8px">예약 관리 기능 준비 중</div>
      <div style="font-size:12px;color:rgba(255,255,255,.3);line-height:1.7">고객 예약 요청은 현재 WhatsApp을 통해 직접 접수됩니다.<br>예약 관리 시스템은 추후 업데이트 예정입니다.</div>
    </div>
  </div>
</div>

<!-- 업체·영상 통합관리 -->
<div class="tab-content" id="tab-shops">

  <!-- ⚡ 원클릭 빠른 등록 -->
  <div class="card" style="margin-bottom:16px;border:2px solid rgba(255,77,141,.4);background:linear-gradient(135deg,rgba(255,77,141,.08),rgba(155,89,182,.06))">
    <div class="card-header" style="margin-bottom:14px">
      <div class="card-title" style="font-size:15px"><i class="fas fa-bolt" style="color:#fbbf24"></i> 빠른 등록 <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,.4)">— 구글맵 URL + 영상 URL만 넣으면 끝!</span></div>
    </div>

    <!-- 카테고리 -->
    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px">카테고리 *</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="qr-cat-btns">
        <button onclick="qrSetCat('clinic')" class="qr-cat-btn" data-cat="clinic" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,77,141,.4);background:rgba(255,77,141,.15);color:#FF4D8D;font-size:12px;font-weight:700;cursor:pointer">🏥 클리닉</button>
        <button onclick="qrSetCat('headspa')" class="qr-cat-btn" data-cat="headspa" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">🧖 헤드스파</button>
        <button onclick="qrSetCat('skincare')" class="qr-cat-btn" data-cat="skincare" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">✨ 스킨케어</button>
        <button onclick="qrSetCat('hair')" class="qr-cat-btn" data-cat="hair" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">💇 헤어</button>
        <button onclick="qrSetCat('nail')" class="qr-cat-btn" data-cat="nail" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">💅 네일</button>
        <button onclick="qrSetCat('makeup')" class="qr-cat-btn" data-cat="makeup" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">💄 메이크업</button>
        <button onclick="qrSetCat('tattoo')" class="qr-cat-btn" data-cat="tattoo" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">✒️ 타투</button>
        <button onclick="qrSetCat('spa')" class="qr-cat-btn" data-cat="spa" style="padding:7px 14px;border-radius:20px;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer">🛁 스파</button>
      </div>
      <input type="hidden" id="qr-category" value="clinic">
    </div>

    <!-- 구글맵 URL -->
    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px"><i class="fab fa-google" style="color:#4285F4"></i> 구글맵 URL * <span style="color:rgba(255,255,255,.3)">(maps.app.goo.gl 또는 google.com/maps)</span></label>
      <input id="qr-gmap" placeholder="https://maps.app.goo.gl/..." style="width:100%;font-size:13px;border-color:rgba(66,133,244,.4)">
    </div>

    <!-- 영상 파일 업로드 -->
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:rgba(255,255,255,.5);display:block;margin-bottom:5px"><i class="fas fa-video" style="color:#FF4D8D"></i> 영상 파일 <span style="color:rgba(255,255,255,.3)">(선택 · 업로드 후 자동 등록)</span></label>
      <!-- 숨겨진 파일 input -->
      <input type="file" id="qr-video-file" accept="video/*" style="display:none">
      <!-- hidden: 업로드 완료 후 URL 저장 -->
      <input type="hidden" id="qr-video">
      <!-- 업로드 버튼 영역 -->
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" id="qr-video-btn"
          onclick="document.getElementById('qr-video-file').click()"
          style="flex:1;padding:10px 14px;background:rgba(255,77,141,.1);border:1.5px dashed rgba(255,77,141,.4);border-radius:10px;color:rgba(255,77,141,.8);font-size:12px;font-weight:700;cursor:pointer;text-align:center;transition:all .2s">
          <i class="fas fa-cloud-upload-alt"></i> 영상 파일 선택
        </button>
        <!-- 선택된 파일명 / 완료 표시 -->
        <span id="qr-video-name" style="font-size:11px;color:rgba(255,255,255,.4);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">파일 미선택</span>
      </div>
      <!-- 업로드 진행률 바 -->
      <div id="qr-video-progress-wrap" style="display:none;margin-top:8px">
        <div style="background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;height:5px">
          <div id="qr-video-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#FF4D8D,#9B59B6);transition:width .3s"></div>
        </div>
        <div id="qr-video-progress-text" style="font-size:11px;color:#fbbf24;margin-top:4px;text-align:center"></div>
      </div>
    </div>

    <!-- 등록 버튼 -->
    <button onclick="quickRegister()" id="qr-btn" style="width:100%;padding:15px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .2s">
      <i class="fas fa-bolt"></i> 업체 + 영상 자동 등록
    </button>

    <!-- 상태 표시 -->
    <div id="qr-status" style="margin-top:10px;min-height:20px;font-size:13px;text-align:center"></div>

    <!-- 등록 성공 결과 -->
    <div id="qr-result" style="display:none;margin-top:12px;padding:14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:12px">
      <div style="font-size:13px;font-weight:800;color:#34d399;margin-bottom:6px"><i class="fas fa-check-circle"></i> 등록 완료!</div>
      <div id="qr-result-detail" style="font-size:12px;color:rgba(255,255,255,.6);line-height:1.8"></div>
      <a id="qr-result-link" href="#" target="_blank" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:7px 14px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.3);border-radius:8px;color:#34d399;font-size:12px;font-weight:700;text-decoration:none">
        <i class="fas fa-external-link-alt"></i> 등록된 페이지 보기
      </a>
    </div>
  </div>

  <!-- ① 업체 등록 폼 (상세) -->
  <details style="margin-bottom:16px">
    <summary style="cursor:pointer;padding:14px 16px;background:var(--cd);border-radius:14px;border:1px solid rgba(255,255,255,.07);font-size:13px;font-weight:700;color:rgba(255,255,255,.6);list-style:none;display:flex;align-items:center;gap:8px">
      <i class="fas fa-sliders-h" style="color:rgba(255,255,255,.4)"></i> 상세 등록 폼 (선택사항 직접 입력)
      <i class="fas fa-chevron-down" style="margin-left:auto;font-size:10px;color:rgba(255,255,255,.3)"></i>
    </summary>
  <div style="padding-top:12px">
  <div class="card" style="margin-bottom:0">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-store" style="color:#FF4D8D"></i> 업체 등록 (상세)</div>
    </div>

    <!-- STEP 1: 구글 자동가져오기 (최우선) -->
    <div style="background:linear-gradient(135deg,rgba(66,133,244,.12),rgba(52,168,83,.08));border:1px solid rgba(66,133,244,.35);border-radius:16px;padding:16px;margin-bottom:18px">
      <div style="font-size:13px;font-weight:800;color:#60a5fa;margin-bottom:12px">
        <i class="fab fa-google"></i> STEP 1 — 구글에서 업체 정보 자동가져오기
        <div style="font-size:11px;font-weight:400;color:rgba(255,255,255,.4);margin-top:3px">업체명 입력 후 버튼 클릭 → 영문주소·영업시간·사진·리뷰 한번에 자동입력</div>
      </div>
      <!-- 구글맵 링크 붙여넣기 -->
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:5px"><i class="fas fa-link"></i> 구글맵 링크로 자동입력 (선택)</div>
        <div style="display:flex;gap:8px">
          <input id="sh-gmap-raw" placeholder="https://maps.app.goo.gl/... 붙여넣기" style="flex:1;font-size:13px;margin-bottom:0">
          <button type="button" id="sh-gmap-btn" style="padding:0 16px;background:rgba(66,133,244,.25);border:1px solid rgba(66,133,244,.4);border-radius:10px;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0"><i class="fas fa-magic"></i> 링크입력</button>
        </div>
        <div id="sh-gmap-status" style="font-size:11px;color:rgba(255,255,255,.4);min-height:16px;margin-top:4px"></div>
      </div>
      <!-- 구글 전체 자동가져오기 버튼 -->
      <button type="button" onclick="fetchPlacesInfo('sh')" id="sh-places-btn"
        style="width:100%;padding:11px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:12px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
        <i class="fab fa-google"></i> 구글 Places API로 전체 정보 자동가져오기
        <span style="font-size:10px;opacity:.7">(주소·영업시간·평점·리뷰·사진)</span>
      </button>
      <div id="sh-places-status" style="margin-top:8px;min-height:16px"></div>
    </div>

    <!-- STEP 2: 기본 정보 입력 -->
    <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.4);margin-bottom:10px">STEP 2 — 기본 정보 <span style="font-weight:400;color:rgba(255,255,255,.25)">(자동입력 또는 직접 수정)</span></div>
    <div class="form-grid">
      <div class="full">
        <label>업체명 * <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동가져오기 전에 한국어 업체명 입력)</span></label>
        <input id="sh-name" placeholder="예: 압구정 헤어팩토리" oninput="updateSlugPreview()">
        <div id="sh-slug-preview" style="margin-top:5px;font-size:11px;color:rgba(255,255,255,.35);display:none">
          🔗 URL 미리보기: <span style="color:#fbbf24;font-family:monospace" id="sh-slug-preview-val"></span>
        </div>
      </div>
      <div>
        <label>카테고리 *</label>
        <select id="sh-cat">
          <option value="clinic">클리닉 (의원)</option>
          <option value="skincare">스킨케어</option>
          <option value="makeup">메이크업</option>
          <option value="hair">헤어</option>
          <option value="headspa">헤드스파</option>
          <option value="nail">네일</option>
          <option value="tattoo">눈썹 타투·반영구</option>
          <option value="spa">스파·마사지</option>
        </select>
      </div>
      <div>
        <label>지역 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동입력)</span></label>
        <input id="sh-loc" placeholder="예: Gangnam, Seoul" oninput="updateSlugPreview()">
      </div>
      <div class="full">
        <label>영문 주소 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동가져오기로 영문 자동입력)</span></label>
        <input id="sh-addr" placeholder="자동가져오기 후 자동입력됩니다">
      </div>
      <div class="full">
        <label>영업시간 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동가져오기로 요일별 자동입력)</span></label>
        <input id="sh-hours" placeholder="자동가져오기 후 자동입력됩니다">
      </div>
      <div class="full">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>업체 소개 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(선택)</span></span>
          <button type="button" onclick="genAiSeo('sh')" style="display:flex;align-items:center;gap:5px;padding:4px 12px;background:linear-gradient(135deg,#7C3AED,#E8417A);border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;transition:opacity .2s" id="sh-ai-btn">
            <i class="fas fa-magic"></i> AI SEO 자동생성
          </button>
        </label>
        <textarea id="sh-desc" placeholder="AI SEO 자동생성 버튼을 누르거나 직접 입력하세요..."></textarea>
        <div id="sh-ai-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
      </div>
      <div class="full">
        <label style="color:#60a5fa;font-weight:800">🗺️ 지도 embed URL <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,.5)">(모달에서 지도 표시)</span></label>
        <div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:6px;line-height:1.6">
          Google Maps에서 업체 검색 → <b style="color:rgba(255,255,255,.7)">공유</b> → <b style="color:rgba(255,255,255,.7)">지도 퍼가기</b> → HTML 코드 안의 <code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:10px">src="..."</code> 값만 복사
        </div>
        <input id="sh-gmap-embed" placeholder="https://www.google.com/maps/embed?pb=..." oninput="updateGmapEmbedPreview('sh-gmap-embed-preview','sh-gmap-embed')" style="border-color:rgba(96,165,250,.4)">
        <div id="sh-gmap-embed-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:180px;border:1px solid rgba(96,165,250,.3)">
          <iframe id="sh-gmap-embed-frame" src="" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0"></iframe>
        </div>
      </div>
    </div>
    <input type="hidden" id="sh-lat" value="">
    <input type="hidden" id="sh-lng" value="">
    <input type="hidden" id="sh-rating" value="">
    <input type="hidden" id="sh-review-count" value="">
    <input type="hidden" id="sh-reviews" value="[]">
    <input type="hidden" id="sh-place-id" value="">
    <input type="hidden" id="sh-photos" value="[]">
    <div id="sh-photos-preview" style="display:none;flex-wrap:wrap;gap:4px;margin-top:4px"></div>

    <!-- 서비스 동적 추가 -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:10px">STEP 3 — 서비스 목록 <span style="font-weight:400;color:rgba(255,255,255,.3)">(이름 + 가격)</span></div>
      <div id="svc-list"></div>
      <button type="button" id="svc-add-btn" style="margin-top:8px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:rgba(255,255,255,.5);padding:8px 16px;font-size:12px;cursor:pointer;width:100%">+ 서비스 추가</button>
    </div>

    <!-- 영상 업로드 -->
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:10px">대표 영상 <span style="font-weight:400;color:rgba(255,255,255,.3)">(선택 · 나중에 추가 가능)</span></div>
      <div id="vid-list"></div>
      <button type="button" id="vid-add-btn" style="margin-top:8px;background:rgba(255,77,141,.06);border:1px dashed rgba(255,77,141,.3);border-radius:10px;color:rgba(255,77,141,.7);padding:8px 16px;font-size:12px;cursor:pointer;width:100%">+ 영상 추가</button>
    </div>

    <button class="btn-pk" style="margin-top:16px;width:100%;padding:14px;font-size:15px" id="sh-submit-btn"><i class="fas fa-check"></i> 업체 등록 완료</button>
  </div>
  </div>
  </details>

  <!-- ② 영상 AI description 일괄 생성 -->
  <div class="card" style="margin-bottom:16px;border:1px solid rgba(99,102,241,.3)">
    <div class="card-header" style="margin-bottom:10px">
      <div class="card-title"><i class="fas fa-magic" style="color:#a5b4fc"></i> 영상 SEO Description AI 자동생성</div>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:12px">
      description이 없는 영상에 AI가 SEO 최적화된 설명을 자동으로 작성합니다. 구글 동영상 검색 노출에 필수입니다.
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" onclick="bulkGenVideoDesc(false)" id="bulk-desc-btn"
        style="padding:10px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
        <i class="fas fa-magic"></i> 빈 description 일괄 생성
      </button>
      <button type="button" onclick="bulkGenVideoDesc(true)" id="bulk-desc-force-btn"
        style="padding:10px 18px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);border-radius:10px;color:#a5b4fc;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px">
        <i class="fas fa-sync"></i> 전체 재생성
      </button>
    </div>
    <div id="bulk-desc-status" style="margin-top:10px;font-size:12px;color:#a5b4fc;display:none"></div>
  </div>

  <!-- ③ 등록된 업체 목록 (클릭하면 영상 추가) -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-list" style="color:#FF4D8D"></i> 등록된 업체 <span style="font-size:12px;color:rgba(255,255,255,.4);font-weight:400">— 업체 클릭 시 영상 추가</span></div>
    <div id="shopList"></div>
  </div>

  <!-- ② 업체 수정 패널 -->
  <div class="card" id="editShopPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(59,130,246,.4)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-edit" style="color:#60a5fa"></i> 업체 수정 — <span id="edit-shop-name-label" style="color:#93c5fd"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="edit-panel-close">✕</button>
    </div>
    <!-- 구글 자동가져오기 섹션 -->
    <div style="background:linear-gradient(135deg,rgba(66,133,244,.1),rgba(52,168,83,.07));border:1px solid rgba(66,133,244,.3);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:800;color:#60a5fa;margin-bottom:10px"><i class="fab fa-google"></i> 구글 Places API 자동가져오기
        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.4);margin-left:6px">영문주소·영업시간·평점·리뷰·사진 한번에</span>
      </div>
      <button type="button" onclick="fetchPlacesInfo('edit-sh')" id="edit-sh-places-btn"
        style="width:100%;padding:10px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
        <i class="fab fa-google"></i> 구글에서 전체 정보 다시 가져오기
      </button>
      <div id="edit-sh-places-status" style="margin-top:8px;min-height:16px"></div>
    </div>

    <div class="form-grid">
      <div class="full"><label>업체명 *</label><input id="edit-sh-name" placeholder="업체명"></div>
      <div>
        <label>카테고리</label>
        <select id="edit-sh-cat">
          <option value="clinic">클리닉 (의원)</option>
          <option value="skincare">스킨케어</option>
          <option value="makeup">메이크업</option>
          <option value="hair">헤어</option>
          <option value="headspa">헤드스파</option>
          <option value="nail">네일</option>
          <option value="tattoo">눈썹 타투·반영구</option>
          <option value="spa">스파·마사지</option>
        </select>
      </div>
      <div><label>지역</label><input id="edit-sh-loc" placeholder="예: Gangnam, Seoul"></div>
      <div class="full">
        <label>영문 주소 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동가져오기로 영문 주소 자동입력)</span></label>
        <input id="edit-sh-addr" placeholder="자동가져오기 후 영문 주소 자동입력">
      </div>
      <div class="full">
        <label>영업시간 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동가져오기로 요일별 자동입력)</span></label>
        <input id="edit-sh-hours" placeholder="자동가져오기 후 자동입력">
      </div>
      <div class="full">
        <label style="color:#60a5fa;font-weight:800">🗺️ 지도 embed URL <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.45)">(모달에서 지도 표시)</span></label>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px">Google Maps → 공유 → 지도 퍼가기 → src="..." 값만 복사</div>
        <input id="edit-sh-gmap-embed" placeholder="https://www.google.com/maps/embed?pb=..." oninput="updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed')" style="border-color:rgba(96,165,250,.4)">
        <input type="hidden" id="edit-sh-gmap-url" value="">
        <input type="hidden" id="edit-sh-lat" value="">
        <input type="hidden" id="edit-sh-lng" value="">
        <div id="edit-gmap-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:180px;border:1px solid rgba(96,165,250,.3)">
          <iframe id="edit-gmap-frame" src="" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0"></iframe>
        </div>
      </div>
      <div class="full">
        <label>대표 썸네일</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="edit-sh-thumb" placeholder="https://...image.jpg" style="flex:1">
          <button type="button" id="edit-thumb-upload-btn" style="padding:8px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0"><i class="fas fa-upload"></i> 업로드</button>
          <input type="file" id="edit-thumb-file" accept="image/*" style="display:none">
        </div>
        <div id="edit-thumb-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
        <div id="edit-thumb-preview" style="margin-top:6px;display:none"><img id="edit-thumb-preview-img" style="width:80px;height:60px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.1)"></div>
      </div>
      <div><label>수수료 (%)</label><input id="edit-sh-commission" type="number" min="0" max="100" placeholder="15"></div>
      <div></div>
      <div class="full">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>업체 소개</span>
          <button type="button" onclick="genAiSeo('edit-sh')" style="display:flex;align-items:center;gap:5px;padding:4px 12px;background:linear-gradient(135deg,#7C3AED,#E8417A);border:none;border-radius:20px;color:#fff;font-size:11px;font-weight:700;cursor:pointer" id="edit-sh-ai-btn">
            <i class="fas fa-magic"></i> AI SEO 자동생성
          </button>
        </label>
        <textarea id="edit-sh-desc" placeholder="AI SEO 자동생성 버튼을 누르거나 직접 입력..."></textarea>
        <div id="edit-sh-ai-status" style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;min-height:16px"></div>
      </div>
    </div>
    <!-- 추가 사진 업로드 -->
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:8px"><i class="fas fa-images" style="color:#a78bfa;margin-right:4px"></i>추가 사진 <span style="font-weight:400;color:rgba(255,255,255,.3)">(고객에게 보여질 업체 사진)</span></div>
      <div id="edit-photos-list" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>
      <button type="button" id="edit-photo-add-btn" style="background:rgba(167,139,250,.08);border:1px dashed rgba(167,139,250,.35);border-radius:10px;color:rgba(167,139,250,.8);padding:8px 16px;font-size:12px;cursor:pointer;width:100%"><i class="fas fa-plus"></i> 사진 추가</button>
      <input type="file" id="edit-photo-file" accept="image/*" style="display:none">
    </div>
    <!-- 서비스 목록 수정 -->
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5)"><i class="fas fa-list-ul" style="margin-right:5px"></i>서비스 목록 (이름 + 가격)</div>
        <button type="button" id="edit-price-img-btn"
          style="display:flex;align-items:center;gap:6px;padding:7px 14px;background:linear-gradient(135deg,#7C3AED,#E8417A);border:none;border-radius:10px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">
          <i class="fas fa-camera"></i> AI 요금표 사진 분석
        </button>
        <input type="file" id="edit-price-img-file" accept="image/*" style="display:none">
      </div>
      <!-- AI 분석 상태 -->
      <div id="edit-price-img-status" style="display:none;margin-bottom:10px;padding:10px 14px;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.3);border-radius:10px;font-size:12px;color:#c4b5fd"></div>
      <!-- 미리보기 + 결과 -->
      <div id="edit-price-img-preview" style="display:none;margin-bottom:10px;border-radius:12px;overflow:hidden;max-height:200px;border:1px solid rgba(255,255,255,.1);position:relative">
        <img id="edit-price-img-thumb" style="width:100%;object-fit:contain;max-height:200px;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 60%,rgba(0,0,0,.7));pointer-events:none"></div>
      </div>
      <div id="edit-svc-list"></div>
      <button type="button" id="edit-svc-add-btn" style="margin-top:6px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:rgba(255,255,255,.5);padding:7px 14px;font-size:12px;cursor:pointer;width:100%"><i class="fas fa-plus" style="margin-right:4px"></i>서비스 직접 추가</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn-pk" style="flex:1;padding:13px;font-size:14px" id="edit-sh-submit-btn"><i class="fas fa-save"></i> 수정 저장</button>
      <button type="button" id="edit-panel-cancel" style="padding:13px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(255,255,255,.5);font-size:13px;font-weight:600;cursor:pointer">취소</button>
    </div>
  </div>

  <!-- ③-1 영상 수정 패널 -->
  <div class="card" id="videoEditPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(99,102,241,.45)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-pen" style="color:#a5b4fc"></i> 영상 수정 — <span id="ve-title-label" style="color:#a5b4fc;font-size:13px"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="ve-panel-close">✕</button>
    </div>
    <div class="form-grid">
      <div class="full"><label>영상 제목 *</label><input id="ve-title" placeholder="영상 제목을 입력하세요"></div>
      <div class="full">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>영상 설명 <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택)</span></span>
          <button type="button" id="ve-ai-desc-btn" onclick="genVideoDescSingle()" style="padding:4px 10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:7px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">
            <i class="fas fa-magic"></i> AI 자동생성
          </button>
        </label>
        <input id="ve-desc" placeholder="짧은 설명... (비워두면 저장 시 AI 자동생성)">
        <div id="ve-ai-status" style="display:none;margin-top:5px;font-size:11px;color:#a5b4fc"></div>
      </div>
      <div class="full"><label>태그 <span style="font-size:11px;color:rgba(255,255,255,.4)">(쉼표 구분)</span></label><input id="ve-tags" placeholder="#KBeauty, #강남, #스킨케어"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn-pk" style="flex:1;padding:12px;font-size:14px" id="ve-submit-btn"><i class="fas fa-save"></i> 저장</button>
      <button type="button" id="ve-panel-cancel" style="padding:12px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:rgba(255,255,255,.5);font-size:13px;font-weight:600;cursor:pointer">취소</button>
    </div>
  </div>

  <!-- ③-2 영상 추가 패널 (업체 클릭 시 슬라이드다운) -->
  <div class="card" id="videoAddPanel" style="display:none;margin-bottom:16px;border:1px solid rgba(255,77,141,.35)">
    <div class="card-header" style="margin-bottom:12px">
      <div class="card-title"><i class="fas fa-film" style="color:#FF4D8D"></i> 영상 추가 — <span id="vd-shop-name" style="color:#FF85B3"></span></div>
      <button style="background:none;border:none;color:rgba(255,255,255,.4);font-size:18px;cursor:pointer" id="vd-panel-close">✕</button>
    </div>
    <div class="form-grid">
      <div class="full"><label>영상 제목 *</label><input id="vd-title" placeholder="예: 강남 럭셔리 페이셜 60분 풀코스"></div>
      <div class="full">
        <label>영상 URL *</label>
        <div style="background:rgba(255,77,141,.06);border:1px solid rgba(255,77,141,.15);border-radius:10px;padding:10px;margin-bottom:8px;font-size:12px;color:rgba(255,255,255,.6)">
          구글 드라이브 공유 링크를 그대로 붙여넣으면 자동 변환됩니다 ✨
        </div>
        <div style="position:relative">
          <input id="vd-url" placeholder="영상 URL 또는 구글 드라이브 링크" oninput="handleVideoUrlInput(this.value)" style="padding-right:100px">
          <div id="vd-url-badge" style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800"></div>
        </div>
        <div id="vd-url-hint" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.25);border-radius:8px;font-size:12px;color:#4ade80"></div>
        <div id="vd-url-preview" style="display:none;margin-top:8px"></div>
      </div>
      <div class="full"><label>썸네일 URL <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택)</span></label><input id="vd-thumb" placeholder="https://...image.jpg (비워두면 업체 썸네일 사용)"></div>
      <div class="full"><label>영상 설명 <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택)</span></label><input id="vd-desc" placeholder="짧은 설명..."></div>
      <div class="full"><label>태그 <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택, 쉼표 구분)</span></label><input id="vd-tags" placeholder="#KBeauty, #강남, #스킨케어"></div>
    </div>
    <button class="btn-pk" style="margin-top:12px" id="vd-submit-btn"><i class="fas fa-plus"></i> 영상 등록</button>
  </div>

</div>

<!-- 설정 -->
<!-- ════ 블로그 탭 ════ -->
<div class="tab-content" id="tab-blog">
  <!-- 블로그 빠른 생성 -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-magic" style="color:#FF4D8D"></i> AI 블로그 글 생성</div>
      <a href="/blog" target="_blank" style="font-size:12px;color:#93c5fd;text-decoration:none"><i class="fas fa-external-link-alt"></i> 블로그 보기</a>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,.4);margin-bottom:14px">제목만 입력하면 Claude AI가 SEO 최적화 블로그 글을 자동 생성합니다.</p>

    <!-- 빠른 주제 버튼 -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:8px">💡 추천 주제 (클릭하면 자동 입력)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button class="quick-topic-btn" data-title="Best Head Spa in Gangnam Seoul 2026" data-cat="headspa" data-area="Gangnam" data-kw="head spa gangnam,korean head spa,scalp treatment seoul">Head Spa Gangnam</button>
        <button class="quick-topic-btn" data-title="Best Korean Hair Salon in Hongdae for Foreigners 2026" data-cat="hair" data-area="Hongdae" data-kw="hair salon hongdae,korean hair,foreigner friendly">Hair Hongdae</button>
        <button class="quick-topic-btn" data-title="Top Skincare Clinics in Gangnam Seoul: A Foreigner's Guide" data-cat="skincare" data-area="Gangnam" data-kw="skincare gangnam,korean skincare,skin clinic seoul">Skincare Gangnam</button>
        <button class="quick-topic-btn" data-title="Korean Nail Art in Myeongdong: Best Salons for Tourists" data-cat="nail" data-area="Myeongdong" data-kw="nail art myeongdong,korean nail,nail salon seoul">Nail Myeongdong</button>
        <button class="quick-topic-btn" data-title="How to Book a Korean Beauty Salon as a Foreigner in Seoul" data-cat="headspa" data-area="Seoul" data-kw="book korean beauty,foreigner seoul beauty,english booking korea">Booking Guide</button>
        <button class="quick-topic-btn" data-title="Best Head Spa in Hongdae Seoul for English Speakers 2026" data-cat="headspa" data-area="Hongdae" data-kw="head spa hongdae,english head spa seoul">Head Spa Hongdae</button>
        <button class="quick-topic-btn" data-title="K-Beauty Treatments Worth Trying in Seoul: Complete Guide 2026" data-cat="skincare" data-area="Seoul" data-kw="kbeauty treatments,korean beauty seoul,what to try korea">K-Beauty Guide</button>
        <button class="quick-topic-btn" data-title="Best Makeup Studios in Seoul for Foreigners 2026" data-cat="makeup" data-area="Seoul" data-kw="makeup studio seoul,korean makeup,beauty transformation seoul">Makeup Seoul</button>
      </div>
    </div>

    <div class="form-grid">
      <div class="full">
        <label>블로그 제목 (영어) *</label>
        <input id="bl-title" placeholder="e.g. Best Head Spa in Gangnam Seoul 2026" style="font-size:14px">
      </div>
      <div>
        <label>카테고리</label>
        <select id="bl-cat">
          <option value="headspa">Head Spa</option>
          <option value="hair">Hair Salon</option>
          <option value="skincare">Skincare</option>
          <option value="nail">Nail Art</option>
          <option value="clinic">Skin Clinic</option>
          <option value="makeup">Makeup</option>
          <option value="spa">Spa</option>
        </select>
      </div>
      <div>
        <label>지역 (Area)</label>
        <input id="bl-area" placeholder="e.g. Gangnam">
      </div>
      <div class="full">
        <label>타겟 키워드 (쉼표로 구분)</label>
        <input id="bl-kw" placeholder="head spa gangnam, korean head spa, scalp treatment seoul">
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button id="bl-gen-btn" onclick="genBlog()" style="flex:1;padding:12px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">
        <i class="fas fa-magic"></i> AI로 생성하기
      </button>
      <button onclick="genBlogBatch()" style="padding:12px 16px;background:rgba(255,77,141,.15);border:1px solid rgba(255,77,141,.3);border-radius:10px;color:#FF4D8D;font-weight:700;font-size:13px;cursor:pointer" title="추천 주제 전체 일괄 생성">
        <i class="fas fa-layer-group"></i> 일괄생성
      </button>
    </div>
    <div id="bl-gen-result" style="display:none;margin-top:12px;padding:12px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;font-size:13px;color:#6ee7b7"></div>
  </div>

  <!-- 블로그 목록 -->
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-list" style="color:#60a5fa"></i> 블로그 글 목록</div>
      <button onclick="loadBlogList()" style="padding:6px 12px;background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.3);border-radius:8px;color:#93c5fd;font-size:12px;cursor:pointer"><i class="fas fa-sync"></i> 새로고침</button>
    </div>
    <div id="blog-list"><div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:13px">로딩 중...</div></div>
  </div>
</div>

<div class="tab-content" id="tab-settings">
  <!-- API 토큰 설정 카드 -->
  <div class="card" style="margin-bottom:16px;border-color:rgba(251,191,36,.25);background:rgba(251,191,36,.05)">
    <div class="card-title" style="margin-bottom:4px"><i class="fas fa-key" style="color:#fbbf24"></i> AI API 토큰 설정</div>
    <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:14px">블로그 AI 생성 / SEO 자동생성에 필요. Vercel 환경변수에 없을 때 여기서 입력하세요.</div>
    <div style="display:flex;gap:8px;align-items:center">
      <input id="token-input" type="password" placeholder="gsk-eyJ..." value=""
        style="flex:1;padding:10px 13px;background:rgba(255,255,255,.05);border:1.5px solid rgba(251,191,36,.3);border-radius:10px;color:#fff;font-size:13px;outline:none">
      <button onclick="saveToken()" style="padding:10px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">
        <i class="fas fa-save"></i> 저장
      </button>
    </div>
    <div id="token-status" style="font-size:11px;margin-top:8px;color:rgba(255,255,255,.4)"></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title" style="margin-bottom:16px"><i class="fas fa-link" style="color:#60a5fa"></i> 사이트 링크 모음</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <a href="/" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-home" style="color:#60a5fa;width:16px"></i> 메인 피드 (홈)
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/</span>
      </a>
      <a href="/shops" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-store" style="color:#a78bfa;width:16px"></i> 업체 카탈로그
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/shops</span>
      </a>
      <a href="/sitemap.xml" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-sitemap" style="color:#4ade80;width:16px"></i> Sitemap (SEO)
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/sitemap.xml</span>
      </a>
      <a href="/robots.txt" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#93c5fd;text-decoration:none;font-size:13px">
        <i class="fas fa-robot" style="color:#fbbf24;width:16px"></i> robots.txt
        <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.3)">/robots.txt</span>
      </a>
    </div>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-search" style="color:#6366f1"></i> SEO 페이지 링크</div>
    <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:12px">업체별 Google 검색 노출 URL — 클릭해서 확인하세요</div>
    <div id="seoLinks"></div>
  </div>
</div>

<script>
var shops=[], videos=[], bookings=[];

// safe-img: data-fallback / data-fallback-text 속성으로 onerror 대체
document.addEventListener('error', function(e){
  var t = e.target;
  if(t && t.tagName === 'IMG' && t.classList.contains('safe-img')){
    var fb = t.getAttribute('data-fallback');
    var fbText = t.getAttribute('data-fallback-text');
    if(fb){ t.src = fb; }
    else if(fbText && t.parentElement){ t.parentElement.textContent = fbText; }
    else { t.style.display = 'none'; }
  }
}, true);

document.addEventListener('DOMContentLoaded', function(){

// ── 토큰 저장/복원 ──
window.saveToken = function(){
  var val = document.getElementById('token-input').value.trim();
  if(!val){ alert('토큰을 입력해주세요'); return; }
  _GSK_TOKEN = val;
  localStorage.setItem('_gsk_token', val);
  var st = document.getElementById('token-status');
  st.style.color = '#34d399';
  st.textContent = '✅ 저장됨 — AI 기능이 활성화됩니다';
  document.getElementById('token-input').value = '';
};
// 토큰 상태 표시
(function(){
  var st = document.getElementById('token-status');
  var inp = document.getElementById('token-input');
  if(!st || !inp) return;
  if(_GSK_TOKEN){
    st.style.color = '#34d399';
    st.textContent = '✅ 토큰 활성화됨 (' + _GSK_TOKEN.substring(0,16) + '...)';
  } else {
    st.style.color = '#fbbf24';
    st.textContent = '⚠️ 토큰 없음 — 블로그/SEO AI 생성 불가. 위에 토큰을 입력하세요.';
  }
})();

// ── 탭 전환 ──
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    var tabId = t.getAttribute('data-tab');
    document.getElementById('tab-' + tabId).classList.add('on');
    if(tabId === 'blog') loadBlogList();
    if(tabId === 'analytics') loadAnalytics(7);
  });
});

// ── 빠른 주제 버튼 ──
document.querySelectorAll('.quick-topic-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.getElementById('bl-title').value = btn.getAttribute('data-title') || '';
    document.getElementById('bl-cat').value = btn.getAttribute('data-cat') || 'headspa';
    document.getElementById('bl-area').value = btn.getAttribute('data-area') || '';
    document.getElementById('bl-kw').value = btn.getAttribute('data-kw') || '';
  });
});

// ── 블로그 생성 ──
window.genBlog = async function genBlog(){
  var title = document.getElementById('bl-title').value.trim();
  if(!title){ alert('제목을 입력해주세요'); return; }
  var btn = document.getElementById('bl-gen-btn');
  var res = document.getElementById('bl-gen-result');
  btn.disabled = true;
  res.style.display='block';
  res.style.background='rgba(251,191,36,.08)'; res.style.borderColor='rgba(251,191,36,.2)'; res.style.color='#fde68a';

  // 진행 카운터
  var secs = 0;
  var timer = setInterval(function(){
    secs++;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 생성 중... ' + secs + '초';
    res.innerHTML = '⏳ Claude AI가 블로그 글을 작성하고 있어요... (' + secs + '초 경과)<br><span style="font-size:11px;opacity:.6">보통 20~40초 소요됩니다. 창을 닫지 마세요.</span>';
  }, 1000);

  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function(){ controller.abort(); }, 55000); // 55초 타임아웃

    var r = await fetch('/api/blogs', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_GSK_TOKEN},
      signal: controller.signal,
      body: JSON.stringify({
        title: title,
        category: document.getElementById('bl-cat').value,
        area: document.getElementById('bl-area').value.trim() || 'Seoul',
        keywords: document.getElementById('bl-kw').value.split(',').map(function(k){ return k.trim(); }).filter(Boolean),
        status: 'published'
      })
    });
    clearTimeout(timeoutId);
    var d = await r.json();
    if(d.ok){
      res.style.background='rgba(16,185,129,.1)'; res.style.borderColor='rgba(16,185,129,.3)'; res.style.color='#6ee7b7';
      res.innerHTML = '✅ 생성 완료! (' + secs + '초)<br><a href="/blog/'+d.slug+'" target="_blank" style="color:#34d399;font-weight:700;font-size:13px">/blog/'+d.slug+' 미리보기 →</a>';
      document.getElementById('bl-title').value = '';
      document.getElementById('bl-kw').value = '';
      loadBlogList();
    } else {
      res.style.background='rgba(239,68,68,.1)'; res.style.borderColor='rgba(239,68,68,.3)'; res.style.color='#fca5a5';
      res.innerHTML = '❌ 오류: ' + JSON.stringify(d);
    }
  } catch(e){
    res.style.background='rgba(239,68,68,.1)'; res.style.borderColor='rgba(239,68,68,.3)'; res.style.color='#fca5a5';
    if(e.name === 'AbortError'){
      res.innerHTML = '⏱️ 타임아웃 (55초 초과) — Vercel 서버 제한입니다. 다시 시도해보세요.';
    } else {
      res.innerHTML = '❌ 네트워크 오류: ' + e.message;
    }
  }
  clearInterval(timer);
  btn.disabled=false; btn.innerHTML='<i class="fas fa-magic"></i> AI로 생성하기';
}

// ── 일괄 생성 (추천 주제 전체) ──
window.genBlogBatch = async function genBlogBatch(){
  if(!confirm('추천 주제 8개를 모두 AI로 생성합니다. 약 3~5분 소요됩니다. 계속하시겠습니까?')) return;
  var topics = Array.from(document.querySelectorAll('.quick-topic-btn')).map(function(btn){
    return {
      title: btn.getAttribute('data-title'),
      category: btn.getAttribute('data-cat'),
      area: btn.getAttribute('data-area'),
      keywords: (btn.getAttribute('data-kw')||'').split(',').map(function(k){ return k.trim(); })
    };
  });
  var res = document.getElementById('bl-gen-result');
  res.style.display='block'; res.style.background='rgba(251,191,36,.08)'; res.style.borderColor='rgba(251,191,36,.2)'; res.style.color='#fde68a';
  res.innerHTML = '⏳ 일괄 생성 중... 탭을 닫지 마세요.';
  try {
    var r = await fetch('/api/admin/generate-blog', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_GSK_TOKEN},
      body: JSON.stringify({ topics })
    });
    var d = await r.json();
    var ok = d.results.filter(function(x){ return x.status==='created'; }).length;
    res.style.background='rgba(16,185,129,.1)'; res.style.borderColor='rgba(16,185,129,.3)'; res.style.color='#6ee7b7';
    res.innerHTML = '✅ 완료! ' + ok + '/' + d.total + '개 생성됨';
    loadBlogList();
  } catch(e){ res.innerHTML='❌ 오류: '+e.message; }
}

// ══════════════════════════════════════════════
// 📊 GA4 Analytics 대시보드
// ══════════════════════════════════════════════
var _anDailyChart = null;
var _anSourceChart = null;

window.loadAnalytics = async function loadAnalytics(days) {
  days = days || 7;
  // 버튼 활성화 상태 변경
  [7,28,90].forEach(function(d){
    var btn = document.getElementById('an-btn-'+d);
    if(!btn) return;
    if(d === days){
      btn.style.background = 'linear-gradient(135deg,#FF4D8D,#9B59B6)';
      btn.style.border = 'none'; btn.style.color = '#fff';
    } else {
      btn.style.background = 'rgba(255,255,255,.07)';
      btn.style.border = '1px solid rgba(255,255,255,.12)';
      btn.style.color = 'rgba(255,255,255,.6)';
    }
  });

  // 로딩 표시
  ['an-users','an-pageviews','an-new-users','an-duration'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.textContent = '...';
  });

  try {
    var res = await fetch('/api/analytics?days=' + days);
    var data = await res.json();

    if(data.error === 'GA4_NOT_CONFIGURED') {
      var notice = document.getElementById('an-setup-notice');
      if(notice) notice.style.display = 'block';
      return;
    }
    if(data.error) throw new Error(data.error);

    var notice2 = document.getElementById('an-setup-notice');
    if(notice2) notice2.style.display = 'none';

    // ── 핵심 지표 ──
    var ov = data.overview && data.overview.rows && data.overview.rows[0];
    if(ov) {
      var vals = ov.metricValues;
      var users = parseInt(vals[0].value || 0);
      var pvs   = parseInt(vals[1].value || 0);
      var newU  = parseInt(vals[2].value || 0);
      var dur   = parseFloat(vals[3].value || 0);
      var durMin = Math.floor(dur/60) + 'm ' + Math.floor(dur%60) + 's';

      document.getElementById('an-users').textContent = users.toLocaleString();
      document.getElementById('an-users-sub').textContent = '선택 기간 합계';
      document.getElementById('an-pageviews').textContent = pvs.toLocaleString();
      document.getElementById('an-pv-sub').textContent = '평균 ' + (users > 0 ? (pvs/users).toFixed(1) : 0) + ' 페이지/인';
      document.getElementById('an-new-users').textContent = newU.toLocaleString();
      document.getElementById('an-new-sub').textContent = users > 0 ? '전체의 ' + Math.round(newU/users*100) + '%' : '';
      document.getElementById('an-duration').textContent = durMin;
      document.getElementById('an-dur-sub').textContent = '평균 세션 시간';
    }

    // ── 일별 차트 ──
    if(data.daily && data.daily.rows) {
      var labels = data.daily.rows.map(function(r){ 
        var d2 = r.dimensionValues[0].value;
        return d2.slice(4,6)+'/'+d2.slice(6,8);
      });
      var uData = data.daily.rows.map(function(r){ return parseInt(r.metricValues[0].value||0); });
      var pvData = data.daily.rows.map(function(r){ return parseInt(r.metricValues[1].value||0); });

      var ctx = document.getElementById('an-daily-chart');
      if(_anDailyChart) _anDailyChart.destroy();
      _anDailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: '방문자', data: uData, backgroundColor: 'rgba(255,77,141,.7)', borderRadius: 4, order: 2 },
            { label: '페이지뷰', data: pvData, type: 'line', borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.1)', tension: 0.4, fill: true, pointRadius: 3, order: 1 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { labels: { color: 'rgba(255,255,255,.6)', font: { size: 11 } } } },
          scales: {
            x: { ticks: { color: 'rgba(255,255,255,.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: 'rgba(255,255,255,.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } }
          }
        }
      });
    }

    // ── 국가별 ──
    var cntEl = document.getElementById('an-countries');
    if(cntEl && data.countries && data.countries.rows) {
      var maxC = parseInt(data.countries.rows[0].metricValues[0].value||1);
      var flags = {'South Korea':'🇰🇷','United States':'🇺🇸','Japan':'🇯🇵','China':'🇨🇳','United Kingdom':'🇬🇧','Australia':'🇦🇺','Canada':'🇨🇦','Singapore':'🇸🇬','Taiwan':'🇹🇼','Hong Kong':'🇭🇰','France':'🇫🇷','Germany':'🇩🇪','Thailand':'🇹🇭','Vietnam':'🇻🇳','Philippines':'🇵🇭','Indonesia':'🇮🇩','Malaysia':'🇲🇾'};
      cntEl.innerHTML = data.countries.rows.map(function(r){
        var cn = r.dimensionValues[0].value;
        var uv = parseInt(r.metricValues[0].value||0);
        var pct = Math.round(uv/maxC*100);
        var flag = flags[cn] || '🌍';
        return '<div style="display:flex;align-items:center;gap:6px;font-size:12px">'
          + '<span style="min-width:22px">' + flag + '</span>'
          + '<span style="flex:1;color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + cn + '</span>'
          + '<div style="width:80px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#FF4D8D,#9B59B6);border-radius:3px"></div></div>'
          + '<span style="min-width:28px;text-align:right;color:rgba(255,255,255,.5)">' + uv.toLocaleString() + '</span>'
          + '</div>';
      }).join('');
    }

    // ── 유입 경로 도넛 ──
    if(data.sources && data.sources.rows) {
      var srcLabels = data.sources.rows.map(function(r){ return r.dimensionValues[0].value; });
      var srcData = data.sources.rows.map(function(r){ return parseInt(r.metricValues[0].value||0); });
      var ctx2 = document.getElementById('an-source-chart');
      if(_anSourceChart) _anSourceChart.destroy();
      _anSourceChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: srcLabels,
          datasets: [{ data: srcData, backgroundColor: ['#FF4D8D','#60a5fa','#34d399','#fbbf24','#a78bfa','#fb923c'], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,.6)', font: { size: 10 }, padding: 8 } }
          }
        }
      });
    }

    // ── 인기 페이지 ──
    var pgEl = document.getElementById('an-pages');
    if(pgEl && data.pages && data.pages.rows) {
      var maxP = parseInt(data.pages.rows[0].metricValues[0].value||1);
      pgEl.innerHTML = data.pages.rows.map(function(r, i){
        var path = r.dimensionValues[0].value;
        var title = r.dimensionValues[1].value || path;
        var pvs2 = parseInt(r.metricValues[0].value||0);
        var uvs2 = parseInt(r.metricValues[1].value||0);
        var pct2 = Math.round(pvs2/maxP*100);
        var rankColors = ['#fbbf24','#94a3b8','#b45309','#6366f1','#6366f1'];
        return '<div style="padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
          + '<span style="font-size:11px;font-weight:900;color:'+(rankColors[i]||'rgba(255,255,255,.3)')+';min-width:16px">'+(i+1)+'</span>'
          + '<span style="font-size:12px;color:rgba(255,255,255,.85);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (title.length > 40 ? path : title) + '</span>'
          + '<span style="font-size:11px;color:rgba(255,255,255,.4)">' + pvs2.toLocaleString() + ' 뷰</span>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:6px">'
          + '<span style="font-size:10px;color:rgba(255,255,255,.3);min-width:16px"></span>'
          + '<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px"><div style="height:100%;width:'+pct2+'%;background:linear-gradient(90deg,rgba(255,77,141,.6),rgba(155,89,182,.6));border-radius:2px"></div></div>'
          + '<span style="font-size:10px;color:rgba(255,255,255,.3)">' + uvs2.toLocaleString() + '명</span>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    // ── 디바이스 ──
    var devEl = document.getElementById('an-devices');
    if(devEl && data.devices && data.devices.rows) {
      var totalDev = data.devices.rows.reduce(function(s,r){ return s + parseInt(r.metricValues[0].value||0); }, 0);
      var devIcons = { mobile:'📱', desktop:'💻', tablet:'📟' };
      var devColors = { mobile:'#FF4D8D', desktop:'#60a5fa', tablet:'#34d399' };
      devEl.innerHTML = data.devices.rows.map(function(r){
        var cat = r.dimensionValues[0].value.toLowerCase();
        var uv = parseInt(r.metricValues[0].value||0);
        var pct = totalDev > 0 ? Math.round(uv/totalDev*100) : 0;
        return '<div style="text-align:center;padding:12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.07)">'
          + '<div style="font-size:24px;margin-bottom:4px">' + (devIcons[cat]||'🖥') + '</div>'
          + '<div style="font-size:20px;font-weight:900;color:' + (devColors[cat]||'#fff') + '">' + pct + '%</div>'
          + '<div style="font-size:10px;color:rgba(255,255,255,.4);text-transform:capitalize">' + cat + '</div>'
          + '<div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:2px">' + uv.toLocaleString() + '명</div>'
          + '</div>';
      }).join('');
    }

  } catch(e) {
    console.error('Analytics load error:', e);
    ['an-users','an-pageviews','an-new-users','an-duration'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.textContent = 'ERR';
    });
  }
};

// ══════════════════════════════════════════════
// ⚡ 원클릭 빠른 등록
// ══════════════════════════════════════════════
var _qrCat = 'headspa';
window.qrSetCat = function(cat) {
  _qrCat = cat;
  document.getElementById('qr-category').value = cat;
  document.querySelectorAll('.qr-cat-btn').forEach(function(btn) {
    var bc = btn.getAttribute('data-cat');
    if (bc === cat) {
      btn.style.borderColor = 'rgba(255,77,141,.6)';
      btn.style.background = 'rgba(255,77,141,.25)';
      btn.style.color = '#FF4D8D';
    } else {
      btn.style.borderColor = 'rgba(255,255,255,.15)';
      btn.style.background = 'rgba(255,255,255,.05)';
      btn.style.color = 'rgba(255,255,255,.6)';
    }
  });
};

// ── 빠른 등록: 영상 파일 선택 핸들러 ──
(function(){
  var fileInput = document.getElementById('qr-video-file');
  if(!fileInput) return;
  fileInput.addEventListener('change', function(){
    var file = this.files && this.files[0];
    if(!file) return;
    var nameEl    = document.getElementById('qr-video-name');
    var btn       = document.getElementById('qr-video-btn');
    var progWrap  = document.getElementById('qr-video-progress-wrap');
    var progBar   = document.getElementById('qr-video-progress-bar');
    var progText  = document.getElementById('qr-video-progress-text');
    var hiddenUrl = document.getElementById('qr-video');

    // 파일명 표시
    nameEl.textContent = file.name;
    nameEl.style.color = '#fbbf24';

    // 진행 UI 표시
    progWrap.style.display = 'block';
    progBar.style.width = '0%';
    progText.textContent = '서명 발급 중...';
    btn.disabled = true;
    btn.style.opacity = '0.6';

    // ① 서버에서 서명 받기
    fetch('/api/upload-sign')
      .then(function(r){ return r.json(); })
      .then(function(sign){
        if(sign.error) throw new Error(sign.error);
        var mb = (file.size/1024/1024).toFixed(1);
        progText.textContent = '업로드 중... (' + mb + 'MB)';
        progBar.style.width = '20%';

        // ② Cloudinary에 직접 업로드 (XMLHttpRequest → 진행률)
        return new Promise(function(resolve, reject){
          var fd = new FormData();
          fd.append('file', file);
          fd.append('api_key', sign.apiKey);
          fd.append('timestamp', sign.timestamp);
          fd.append('signature', sign.signature);
          fd.append('folder', sign.folder);

          var xhr = new XMLHttpRequest();
          xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + sign.cloudName + '/video/upload');

          xhr.upload.addEventListener('progress', function(e){
            if(e.lengthComputable){
              var pct = Math.round((e.loaded / e.total) * 75) + 20; // 20~95%
              progBar.style.width = pct + '%';
              progText.textContent = '업로드 중... ' + pct + '%';
            }
          });
          xhr.addEventListener('load', function(){
            if(xhr.status >= 200 && xhr.status < 300){
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('HTTP ' + xhr.status));
            }
          });
          xhr.addEventListener('error', function(){ reject(new Error('네트워크 오류')); });
          xhr.send(fd);
        });
      })
      .then(function(data){
        if(data.secure_url){
          hiddenUrl.value = data.secure_url;
          progBar.style.width = '100%';
          progText.style.color = '#4ade80';
          progText.textContent = '✅ 업로드 완료!';
          btn.textContent = '✓ 완료 (재선택)';
          btn.style.background = 'rgba(16,185,129,.15)';
          btn.style.borderColor = 'rgba(16,185,129,.5)';
          btn.style.color = '#4ade80';
          btn.style.opacity = '1';
          btn.disabled = false;
          nameEl.style.color = '#4ade80';
        } else {
          var errMsg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
          throw new Error(errMsg);
        }
      })
      .catch(function(err){
        progText.style.color = '#f87171';
        progText.textContent = '❌ ' + (err.message || '오류');
        btn.style.opacity = '1';
        btn.disabled = false;
        nameEl.style.color = '#f87171';
        nameEl.textContent = '다시 선택해주세요';
        hiddenUrl.value = '';
      });

    this.value = ''; // 같은 파일 재선택 허용
  });
})();

window.quickRegister = async function quickRegister() {
  var gmapUrl   = (document.getElementById('qr-gmap').value || '').trim();
  var videoUrl  = (document.getElementById('qr-video').value || '').trim(); // 업로드 완료 후 자동 세팅
  var category  = document.getElementById('qr-category').value || 'clinic';
  var btn       = document.getElementById('qr-btn');
  var status    = document.getElementById('qr-status');
  var result    = document.getElementById('qr-result');

  if (!gmapUrl) {
    status.innerHTML = '<span style="color:#f87171"><i class="fas fa-exclamation-circle"></i> 구글맵 URL을 입력해주세요</span>';
    return;
  }

  // 영상 파일이 선택됐는데 아직 업로드 중인 경우 체크
  var nameEl = document.getElementById('qr-video-name');
  if(nameEl && nameEl.textContent !== '파일 미선택' &&
     nameEl.style.color !== 'rgb(74, 222, 128)' && // #4ade80
     nameEl.style.color !== '#4ade80' &&
     document.getElementById('qr-video-file').files && document.getElementById('qr-video-file').files.length === 0 &&
     !videoUrl){
    // 파일 선택됐으나 업로드 미완료 → 대기 안내
    status.innerHTML = '<span style="color:#fbbf24"><i class="fas fa-spinner fa-spin"></i> 영상 업로드 완료 후 등록 버튼을 눌러주세요</span>';
    return;
  }

  // 버튼 로딩
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 구글에서 정보 가져오는 중...';
  status.innerHTML = '<span style="color:#fbbf24"><i class="fas fa-circle-notch fa-spin"></i> 업체 정보 자동 수집 중... (10~20초 소요)</span>';
  result.style.display = 'none';

  try {
    var res = await fetch('/api/quick-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmapUrl, videoUrl, category })
    });
    var data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || '등록 실패');
    }

    // 성공!
    btn.innerHTML = '<i class="fas fa-bolt"></i> 업체 + 영상 자동 등록';
    btn.disabled = false;
    status.innerHTML = '';

    document.getElementById('qr-result-detail').innerHTML =
      '<b style="color:#fff">' + data.shopName + '</b> 등록 완료<br>' +
      '📍 ' + data.location + ' · ' + category + '<br>' +
      (data.videoId ? '🎬 영상도 함께 등록됨' : '📝 영상 없이 등록됨');
    document.getElementById('qr-result-link').href = data.url;
    result.style.display = 'block';

    // 입력 초기화
    document.getElementById('qr-gmap').value = '';
    document.getElementById('qr-video').value = '';

    // 영상 업로드 UI 초기화
    var resetName = document.getElementById('qr-video-name');
    if(resetName){ resetName.textContent = '파일 미선택'; resetName.style.color = 'rgba(255,255,255,.4)'; }
    var resetProg = document.getElementById('qr-video-progress-wrap');
    if(resetProg){ resetProg.style.display = 'none'; }
    var resetBtn2 = document.getElementById('qr-video-btn');
    if(resetBtn2){
      resetBtn2.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 영상 파일 선택';
      resetBtn2.style.background = 'rgba(255,77,141,.1)';
      resetBtn2.style.borderColor = 'rgba(255,77,141,.4)';
      resetBtn2.style.color = 'rgba(255,77,141,.8)';
      resetBtn2.style.opacity = '1';
      resetBtn2.disabled = false;
    }

    // 업체 목록 새로고침
    if (typeof loadShopList === 'function') loadShopList();

  } catch(e) {
    btn.innerHTML = '<i class="fas fa-bolt"></i> 업체 + 영상 자동 등록';
    btn.disabled = false;
    status.innerHTML = '<span style="color:#f87171"><i class="fas fa-exclamation-circle"></i> ' + (e.message || '오류 발생') + '</span>';
  }
};

// ── 블로그 목록 로드 ──
window.loadBlogList = async function loadBlogList(){
  var el = document.getElementById('blog-list');
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:13px"><i class="fas fa-spinner fa-spin"></i> 로딩...</div>';
  try {
    var r = await fetch('/api/blogs');
    var posts = await r.json();
    if(!posts.length){
      el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">아직 블로그 글이 없습니다.<br>위에서 AI로 생성해보세요!</div>';
      return;
    }
    el.innerHTML = posts.map(function(p){
      var tags = Array.isArray(p.tags) ? p.tags : (p.tags ? JSON.parse(p.tags||'[]') : []);
      var date = p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '';
      var statusColor = p.status==='published' ? '#10b981' : '#f59e0b';
      return '<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:flex-start;gap:10px">'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
            '<span style="font-size:10px;background:rgba(255,77,141,.15);color:#FF4D8D;padding:2px 8px;border-radius:8px;font-weight:700">'+(p.category||'')+'</span>'+
            '<span style="font-size:10px;color:rgba(255,255,255,.3)">'+(p.area||'Seoul')+'</span>'+
            '<span style="font-size:10px;color:'+statusColor+';font-weight:700">●  '+(p.status==='published'?'공개':'임시저장')+'</span>'+
          '</div>'+
          '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.title+'</div>'+
          '<div style="font-size:11px;color:rgba(255,255,255,.3)">'+(p.views||0)+' views · '+date+'</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px;flex-shrink:0">'+
          '<a href="/blog/'+p.slug+'" target="_blank" style="padding:5px 10px;background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.2);border-radius:7px;color:#93c5fd;font-size:11px;text-decoration:none;cursor:pointer"><i class="fas fa-eye"></i></a>'+
          '<button data-del-blog="'+p.id+'" style="padding:5px 10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.2);border-radius:7px;color:#fca5a5;font-size:11px;cursor:pointer"><i class="fas fa-trash"></i></button>'+
        '</div>'+
      '</div>';
    }).join('');
  } catch(e){ el.innerHTML='<div style="color:#fca5a5;padding:12px">오류: '+e.message+'</div>'; }
}

window.delBlog = async function delBlog(id){
  if(!confirm('이 블로그 글을 삭제하시겠습니까?')) return;
  await fetch('/api/blogs/'+id, { method:'DELETE', headers:{'Authorization':'Bearer '+_GSK_TOKEN} });
  loadBlogList();
}

// quick-topic 버튼 스타일
var styleEl = document.createElement('style');
styleEl.textContent = '.quick-topic-btn{padding:6px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;color:rgba(255,255,255,.6);font-size:11px;cursor:pointer;transition:.15s}.quick-topic-btn:hover{background:rgba(255,77,141,.15);border-color:rgba(255,77,141,.3);color:#FF4D8D}'
+'.shop-add-vid-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:10px;padding:10px;background:rgba(255,77,141,.07);border:1.5px dashed rgba(255,77,141,.35);border-radius:10px;color:rgba(255,77,141,.85);font-size:12px;font-weight:700;cursor:pointer;transition:.15s}.shop-add-vid-btn:hover{background:rgba(255,77,141,.16);border-color:rgba(255,77,141,.6)}'
+'.shop-accordion-hd:hover{background:rgba(255,255,255,.03)}';
document.head.appendChild(styleEl);

// ── 이벤트 위임 ──
document.addEventListener('click', function(e){
  var delShopBtn = e.target.closest('.del-shop-btn');
  if(delShopBtn){ delShop(delShopBtn.getAttribute('data-id')); return; }
  var editShopBtn = e.target.closest('.edit-shop-btn');
  if(editShopBtn){ openEditShopPanel(editShopBtn.getAttribute('data-id')); return; }
  var delVideoBtn = e.target.closest('.del-video-btn');
  if(delVideoBtn){ delVideo(delVideoBtn.getAttribute('data-id')); return; }
  var addVideoBtn = e.target.closest('[data-add-video]');
  if(addVideoBtn){ openVideoPanel(addVideoBtn.getAttribute('data-add-video')); return; }
  // ── 영상 수정 버튼 → 수정 패널 열기 ──
  var vidEditBtn = e.target.closest('.vid-edit-btn');
  if(vidEditBtn){ openVideoEditPanel(vidEditBtn.getAttribute('data-id')); return; }
  var delBlogBtn = e.target.closest('[data-del-blog]');
  if(delBlogBtn){ delBlog(delBlogBtn.getAttribute('data-del-blog')); return; }
  // ── 업체 아코디언 토글 ──
  var hd = e.target.closest('.shop-accordion-hd');
  if(hd){
    var sid = hd.getAttribute('data-shop-id');
    _shopExpanded[sid] = !_shopExpanded[sid];
    renderShops();
  }
});
document.addEventListener('change', function(e){
  var sel = e.target.closest('.status-select');
  if(sel){ updateStatus(sel.getAttribute('data-id'), sel.value); }
});

// ── 현재 영상 추가 중인 업체 ID ──
var currentShopId = null;

// ── 데이터 로드 ──
function loadAll(){
  fetch('/api/stats').then(function(r){return r.json();}).catch(function(){ return {}; }).then(function(d){
    // ── 핵심 지표 카드 ──
    var fmtNum = function(n){ return n>=1000?(n/1000).toFixed(1)+'K':n; };
    document.getElementById('st-views').textContent = fmtNum(d.totalViews);
    document.getElementById('st-bookings').textContent = d.totalBookings;
    document.getElementById('st-new').textContent = d.newBookings;
    document.getElementById('st-confirmed').textContent = d.confirmedBookings||0;
    document.getElementById('st-contacted').textContent = d.contactedBookings||0;
    document.getElementById('st-shops').textContent = d.totalShops;

    // ── 카테고리별 업체 도넛 차트 ──
    var catLabels = {skincare:'스킨케어',makeup:'메이크업',hair:'헤어',headspa:'헤드스파',nail:'네일',clinic:'클리닉',spa:'스파'};
    var catColors = ['#f472b6','#c084fc','#60a5fa','#67e8f9','#34d399','#fb923c','#a78bfa'];
    var cats = d.categoryStats||[];
    if(cats.length && document.getElementById('catChart')){
      new Chart(document.getElementById('catChart'), {
        type:'doughnut',
        data:{
          labels: cats.map(function(c){ return catLabels[c.category]||c.category; }),
          datasets:[{data: cats.map(function(c){ return c.count; }), backgroundColor: catColors.slice(0,cats.length), borderWidth:2, borderColor:'#1c1c30'}]
        },
        options:{plugins:{legend:{position:'right',labels:{color:'rgba(255,255,255,.6)',font:{size:11},boxWidth:12,padding:8}}},cutout:'62%'}
      });
    }

    // ── 예약 상태 도넛 차트 ──
    if(document.getElementById('bookingChart')){
      new Chart(document.getElementById('bookingChart'), {
        type:'doughnut',
        data:{
          labels:['신규','연락완료','확정'],
          datasets:[{data:[d.newBookings||0, d.contactedBookings||0, d.confirmedBookings||0],
            backgroundColor:['#60a5fa','#fb923c','#34d399'], borderWidth:2, borderColor:'#1c1c30'}]
        },
        options:{plugins:{legend:{position:'right',labels:{color:'rgba(255,255,255,.6)',font:{size:11},boxWidth:12,padding:8}}},cutout:'62%'}
      });
    }

    // ── 업체별 조회수 TOP5 바 차트 ──
    var svEl = document.getElementById('shopViewStats');
    var svData = d.shopViewStats||[];
    var maxV = svData.length ? svData[0].views : 1;
    var barColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',headspa:'#67e8f9',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
    svEl.innerHTML = svData.length ? svData.map(function(s,i){
      var pct = maxV>0 ? Math.round(s.views/maxV*100) : 0;
      var col = barColors[s.category]||'#aaa';
      return '<div class="bar-wrap">'+
        '<div class="bar-label">'+(i+1)+'. '+s.name+'</div>'+
        '<div class="bar-bg"><div class="bar-fill" style="width:'+pct+'%;background:'+col+'"></div></div>'+
        '<div class="bar-val">'+fmtNum(s.views)+'</div>'+
        '</div>';
    }).join('') : '<div style="color:rgba(255,255,255,.3);font-size:12px;padding:8px">데이터 없음</div>';

    // ── 인기 영상 TOP5 ──
    document.getElementById('topVids').innerHTML = (d.topVideos||[]).map(function(v,i){
      return '<div class="top-vid">'+
        '<div class="top-rank">#'+(i+1)+'</div>'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img">'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;margin-bottom:3px">'+v.title+'</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+fmtNum(v.views)+' 조회 &nbsp; '+v.likes+' 좋아요</div></div>'+
        '</div>';
    }).join('');
  });
  // shops + videos 같이 기다렸다가 렌더 (타이밍 문제 방지)
  // 개별 fetch에 .catch() 추가 → 어느 쪽이 실패해도 빈 배열로 fallback되어 renderShops() 항상 실행
  Promise.all([
    fetch('/api/shops').then(function(r){
      if(!r.ok) throw new Error('shops '+r.status);
      return r.json();
    }).catch(function(e){ console.warn('[loadAll] /api/shops 실패:', e); return {shops:[]}; }),
    fetch('/api/videos').then(function(r){
      if(!r.ok) throw new Error('videos '+r.status);
      return r.json();
    }).catch(function(e){ console.warn('[loadAll] /api/videos 실패:', e); return {videos:[]}; })
  ]).then(function(results){
    shops  = results[0].shops  || [];
    videos = results[1].videos || [];
    renderShops();
    renderVideos();
    renderSeoLinks();
  }).catch(function(e){ console.error('[loadAll] Promise.all 오류:', e); });
  fetch('/api/bookings').then(function(r){
    if(!r.ok) throw new Error('bookings '+r.status);
    return r.json();
  }).then(function(d){
    bookings = d.bookings||[];
    renderBookings();
  }).catch(function(e){ console.warn('[loadAll] /api/bookings 실패:', e); });
}

// ── 가격 포맷 (숫자 → ₩xx,xxx) ──
function fmtPrice(n){
  if(!n || isNaN(n)) return '';
  return '\u20a9'+Number(n).toLocaleString();
}

// ── 업체 목록 렌더 (아코디언) ──
var _shopExpanded = {}; // 열려있는 업체 ID 추적

function renderShops(){
  var el = document.getElementById('shopList');
  if(!el) return;
  if(!shops.length){
    el.innerHTML = '<div style="text-align:center;padding:40px 24px;color:rgba(255,255,255,.25);font-size:13px"><div style="font-size:32px;margin-bottom:8px">&#127978;</div>No shops registered<br><span style="font-size:11px">Add a shop using the form above</span></div>';
    return;
  }
  var catColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',headspa:'#67e8f9',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
  var catLabels  = {skincare:'스킨케어',makeup:'메이크업',hair:'헤어',headspa:'헤드스파',nail:'네일',clinic:'클리닉',spa:'스파'};

  // 업체명 알파벳 오름차순 정렬
  var sortedShops = shops.slice().sort(function(a, b){
    return (a.name||'').toLowerCase().localeCompare((b.name||'').toLowerCase());
  });
  el.innerHTML = '<div style="display:grid;gap:10px">' + sortedShops.map(function(s){
    var shopVids  = videos.filter(function(v){ return v.shopId === s.id; });
    var vcount    = shopVids.length;
    var catColor  = catColors[s.category] || '#aaa';
    var catLabel  = catLabels[s.category]  || s.category;
    var initial   = (s.name||'S')[0].toUpperCase();
    var isOpen    = !!_shopExpanded[s.id];

    // ── 영상 행 (아코디언 body) ──
    var vidRowsHtml = '';
    if(vcount){
      vidRowsHtml = shopVids.map(function(v){
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.05)">'
          // 썸네일
          +'<div style="position:relative;flex-shrink:0">'
            +'<img src="'+(v.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/44x60/1c1c30/FF4D8D?text=▶"'
              +' style="width:44px;height:60px;border-radius:8px;object-fit:cover;display:block">'
            +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.6"><i class="fas fa-play" style="font-size:10px;color:#fff;filter:drop-shadow(0 1px 2px #000)"></i></div>'
          +'</div>'
          // 정보
          +'<div style="flex:1;min-width:0">'
            +'<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">'+v.title+'</div>'
            +'<div style="font-size:10px;color:rgba(255,255,255,.3)"><i class="fas fa-eye" style="margin-right:3px"></i>'+v.views+' 조회</div>'
          +'</div>'
          // 버튼
          +'<div style="display:flex;gap:5px;flex-shrink:0">'
            +'<button class="vid-edit-btn" data-id="'+v.id+'"'
              +' style="padding:5px 11px;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);border-radius:7px;color:#a5b4fc;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">'
              +'<i class="fas fa-pen"></i> 수정</button>'
            +'<button class="del-video-btn" data-id="'+v.id+'"'
              +' style="padding:5px 9px;background:rgba(239,68,68,.13);border:1px solid rgba(239,68,68,.28);border-radius:7px;color:#f87171;font-size:11px;font-weight:600;cursor:pointer">'
              +'<i class="fas fa-trash"></i></button>'
          +'</div>'
        +'</div>';
      }).join('');
    } else {
      vidRowsHtml = '<div style="text-align:center;padding:18px 0 10px;border-top:1px solid rgba(255,255,255,.05)">'
        +'<i class="fas fa-film" style="font-size:22px;color:rgba(255,255,255,.1);margin-bottom:6px;display:block"></i>'
        +'<div style="font-size:12px;color:rgba(255,255,255,.25);margin-bottom:0">아직 등록된 영상이 없습니다</div>'
      +'</div>';
    }

    // ── 영상 추가 인라인 버튼 ──
    var addVidBtn = '<button data-add-video="'+s.id+'" class="shop-add-vid-btn">'
      +'<i class="fas fa-plus-circle"></i> 영상 추가하기</button>';

    // ── 카드 전체 ──
    return '<div style="background:rgba(255,255,255,.03);border:1px solid '+(isOpen?'rgba(255,77,141,.3)':'rgba(255,255,255,.08)')+';border-radius:14px;overflow:hidden">'

      // ── 헤더 (클릭 → 접기/펼치기) ──
      +'<div class="shop-accordion-hd" data-shop-id="'+s.id+'"'
        +' style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none">'

        // 썸네일 / 이니셜
        +'<div style="width:48px;height:48px;border-radius:10px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(255,77,141,.25),rgba(155,89,182,.2));display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#FF4D8D">'
          +(s.thumbnail ? '<img src="'+s.thumbnail+'" class="safe-img" style="width:100%;height:100%;object-fit:cover" data-fallback-text="'+initial+'">' : initial)
        +'</div>'

        // 업체명 + 뱃지
        +'<div style="flex:1;min-width:0">'
          +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap">'
            +'<span style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px">'+s.name+'</span>'
            +'<span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(255,255,255,.07);color:'+catColor+'">'+catLabel+'</span>'
          +'</div>'
          +(s.location ? '<div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:3px"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:3px"></i>'+s.location+'</div>' : '')
          +(s.slug ? '<a href="/shop/'+s.slug+'" target="_blank" onclick="event.stopPropagation()" class="shop-slug-link"><i class="fas fa-external-link-alt" style="margin-right:3px;opacity:.6"></i>/shop/'+s.slug+'</a>' : '')
        +'</div>'

        // 오른쪽 — 영상수 + 수정/삭제 버튼 + 화살표
        +'<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
          +'<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(167,139,250,.15);color:#a78bfa">'
            +'<i class="fas fa-film" style="margin-right:3px"></i>'+vcount
          +'</span>'
          +'<button class="edit-shop-btn" data-id="'+s.id+'"'
            +' style="padding:5px 10px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.25);border-radius:7px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer" title="업체 수정">'
            +'<i class="fas fa-edit"></i></button>'
          +'<button class="del-shop-btn" data-id="'+s.id+'"'
            +' style="padding:5px 9px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.22);border-radius:7px;color:#f87171;font-size:11px;cursor:pointer" title="업체 삭제">'
            +'<i class="fas fa-trash"></i></button>'
          +'<i class="fas fa-chevron-'+(isOpen?'up':'down')+'" style="font-size:11px;color:rgba(255,255,255,.3);margin-left:2px"></i>'
        +'</div>'
      +'</div>'

      // ── 영상 목록 body (아코디언) ──
      +'<div class="shop-accordion-body" data-shop-id="'+s.id+'" style="padding:0 14px 14px;display:'+(isOpen?'block':'none')+'">'
        + vidRowsHtml
        + addVidBtn
      +'</div>'

    +'</div>';
  }).join('') + '</div>';
}



// ── 영상 목록 렌더 (업체별 그룹) ──
function renderVideos(){
  var el = document.getElementById('videoList');
  if(!el) return; // 영상 목록 카드 제거됨
  if(!videos.length){
    el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">등록된 영상이 없습니다</div>';
    return;
  }
  // 업체별 그룹핑
  var byShop = {};
  videos.forEach(function(v){
    if(!byShop[v.shopId]) byShop[v.shopId] = [];
    byShop[v.shopId].push(v);
  });
  var html = '';
  Object.keys(byShop).forEach(function(sid){
    var shop = shops.find(function(s){return s.id===sid;})||{name:'(삭제된 업체)'};
    html += '<div style="font-size:12px;font-weight:700;color:#FF85B3;padding:8px 0 4px;border-bottom:1px solid rgba(255,77,141,.15);margin-bottom:6px">'+shop.name+'</div>';
    byShop[sid].forEach(function(v){
      html += '<div class="vid-row">'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/48x64/1c1c30/FF4D8D?text=V">'+
        '<div style="flex:1">'+
          '<div style="font-size:13px;font-weight:700;margin-bottom:2px">'+v.title+'</div>'+
          '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+v.views+' 조회 &nbsp; '+v.likes+' 좋아요</div>'+
        '</div>'+
        '<button class="btn-sm btn-red del-video-btn" data-id="'+v.id+'">삭제</button>'+
      '</div>';
    });
    html += '<div style="margin-bottom:12px"></div>';
  });
  el.innerHTML = html;
}

var statusLabels={new:'신규',contacted:'연락중',confirmed:'확정',completed:'완료',cancelled:'취소'};
var statusColors={new:'#60a5fa',contacted:'#fbbf24',confirmed:'#34d399',completed:'#a78bfa',cancelled:'#f87171'};

function renderBookings(){
  var bEl = document.getElementById('bookingTbody');
  if(!bEl) return;
  bEl.innerHTML = bookings.map(function(b){
    var sc = statusColors[b.status]||'#aaa';
    return '<tr>'+
      '<td style="white-space:nowrap;font-size:11px">'+b.createdAt+'</td>'+
      '<td><div style="font-weight:700;font-size:13px">'+b.name+'</div><div style="font-size:11px;color:rgba(255,255,255,.4)">'+b.email+'</div></td>'+
      '<td style="font-size:12px">'+b.shopName+'</td>'+
      '<td style="font-size:12px">'+b.service+'</td>'+
      '<td style="font-size:12px">'+b.people+'</td>'+
      '<td style="font-size:12px;color:#10b981;font-weight:700">'+b.estimatedAmount+'</td>'+
      '<td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(255,255,255,.07);color:'+sc+'">'+statusLabels[b.status]+'</span></td>'+
      '<td>'+
        '<select class="status-select" data-id="'+b.id+'" style="padding:4px 6px;font-size:11px;width:auto;background:#1c1c30;color:#fff;border:1px solid rgba(255,255,255,.15);border-radius:6px">'+
          Object.keys(statusLabels).map(function(k){return '<option value="'+k+'"'+(b.status===k?' selected':'')+'>'+statusLabels[k]+'</option>';}).join('')+
        '</select>'+
        '<br><a href="https://wa.me/'+b.phone.replace(/[^0-9]/g,'')+'" target="_blank" style="display:inline-flex;align-items:center;gap:3px;margin-top:4px;font-size:11px;color:#25D366;text-decoration:none">WA 연락</a>'+
      '</td>'+
    '</tr>';
  }).join('');
}

function renderSeoLinks(){
  var seoEl = document.getElementById('seoLinks');
  if(!seoEl) return;
  seoEl.innerHTML = shops.map(function(s){
    var url = '/shop/'+s.slug;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:8px;margin-bottom:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">'
      +'<div style="min-width:0;flex:1">'
        +'<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:2px">'+s.name+'</div>'
        +'<a href="'+url+'" target="_blank" class="seo-url-link">'
          +'<i class="fas fa-external-link-alt" style="font-size:9px;opacity:.7"></i>'+url
        +'</a>'
      +'</div>'
      +'<a href="'+url+'" target="_blank" class="seo-view-btn">'
        +'<i class="fas fa-eye" style="margin-right:4px"></i>보기'
      +'</a>'
    +'</div>';
  }).join('');
}

window.updateStatus = function updateStatus(id, status){
  fetch('/api/bookings/'+id+'/status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})
    .then(loadAll);
}

// ── 영상 추가 패널 열기/닫기 ──
function openVideoPanel(shopId){
  var shop = shops.find(function(s){ return String(s.id) === String(shopId); });
  currentShopId = shopId;

  // tab-shops 탭이 비활성화 상태면 자동 활성화
  var tabShops = document.getElementById('tab-shops');
  if(tabShops && !tabShops.classList.contains('on')){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    var tabBtn = document.querySelector('.tab[data-tab="shops"]');
    if(tabBtn) tabBtn.classList.add('on');
    tabShops.classList.add('on');
  }

  // 해당 업체 아코디언을 강제로 펼치기
  _shopExpanded[String(shopId)] = true;
  renderShops();

  // 다른 패널 닫기
  document.getElementById('editShopPanel').style.display  = 'none';
  document.getElementById('videoEditPanel').style.display = 'none';

  // 패널에 업체명 세팅 후 표시
  document.getElementById('vd-shop-name').textContent = shop ? shop.name : ('#' + shopId);
  document.getElementById('videoAddPanel').style.display = 'block';

  // 폼 초기화
  ['vd-title','vd-url','vd-thumb','vd-desc','vd-tags'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  var badge = document.getElementById('vd-url-badge');   if(badge)  badge.style.display='none';
  var hint  = document.getElementById('vd-url-hint');    if(hint)   hint.style.display='none';
  var prev  = document.getElementById('vd-url-preview'); if(prev)   prev.style.display='none';

  setTimeout(function(){
    document.getElementById('videoAddPanel').scrollIntoView({behavior:'smooth', block:'start'});
    var titleEl = document.getElementById('vd-title');
    if(titleEl) titleEl.focus();
  }, 80);
}

function closeVideoPanel(){
  document.getElementById('videoAddPanel').style.display = 'none';
  currentShopId = null;
  ['vd-title','vd-url','vd-thumb','vd-desc','vd-tags'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value='';
  });
  var badge = document.getElementById('vd-url-badge');   if(badge)  badge.style.display='none';
  var hint  = document.getElementById('vd-url-hint');    if(hint)   hint.style.display='none';
  var prev  = document.getElementById('vd-url-preview'); if(prev)   prev.style.display='none';
}

document.getElementById('vd-panel-close').addEventListener('click', closeVideoPanel);
document.getElementById('vd-submit-btn').addEventListener('click', function(){ window.addVideo && window.addVideo(); });
document.getElementById('sh-submit-btn').addEventListener('click', function(){ window.addShop && window.addShop(); });
document.getElementById('svc-add-btn').addEventListener('click', addSvcRow);
document.getElementById('vid-add-btn').addEventListener('click', addVidRow);

// ── 영상 수정 패널 ──
var editingVideoId = null;
function openVideoEditPanel(videoId){
  var vid = videos.find(function(v){ return v.id === videoId; });
  if(!vid){ alert('영상 정보를 찾을 수 없습니다.'); return; }
  editingVideoId = videoId;

  document.getElementById('ve-title-label').textContent = vid.title;
  document.getElementById('ve-title').value = vid.title || '';
  document.getElementById('ve-desc').value = vid.description || '';
  document.getElementById('ve-tags').value = (vid.tags||[]).join(', ');

  // 패널 열기 (영상 추가 패널 닫기)
  document.getElementById('videoEditPanel').style.display = 'block';
  document.getElementById('videoAddPanel').style.display = 'none';
  document.getElementById('editShopPanel').style.display = 'none';
  setTimeout(function(){
    document.getElementById('videoEditPanel').scrollIntoView({behavior:'smooth', block:'start'});
    document.getElementById('ve-title').focus();
    document.getElementById('ve-title').select();
  }, 50);
}
function closeVideoEditPanel(){
  document.getElementById('videoEditPanel').style.display = 'none';
  editingVideoId = null;
}
function saveVideoEdit(){
  if(!editingVideoId) return;
  var title = document.getElementById('ve-title').value.trim();
  if(!title){ alert('영상 제목을 입력해주세요!'); return; }
  var desc  = document.getElementById('ve-desc').value.trim();
  var tags  = document.getElementById('ve-tags').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);

  var btn = document.getElementById('ve-submit-btn');
  btn.disabled = true; btn.textContent = '저장 중...';

  // 기존 thumbnail 유지
  var vid = videos.find(function(v){ return v.id === editingVideoId; }) || {};
  var savedShopId = vid.shopId; // 수정 완료 후 아코디언 유지용
  fetch('/api/videos/'+editingVideoId, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ title: title, description: desc, thumbnail: vid.thumbnail||'', tags: tags })
  }).then(function(r){ return r.json(); }).then(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 저장';
    closeVideoEditPanel();
    if(savedShopId) _shopExpanded[String(savedShopId)] = true;
    loadAll();
    alert('✅ 영상 정보가 수정되었습니다!');
  }).catch(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 저장';
    alert('오류가 발생했습니다. 다시 시도해주세요.');
  });
}
document.getElementById('ve-panel-close').addEventListener('click', closeVideoEditPanel);
document.getElementById('ve-panel-cancel').addEventListener('click', closeVideoEditPanel);
document.getElementById('ve-submit-btn').addEventListener('click', saveVideoEdit);

// ── 업체 수정 패널 열기 ──
var editingShopId = null;
function openEditShopPanel(shopId){
  var shop = shops.find(function(s){ return String(s.id) === String(shopId); });
  if(!shop){ alert('업체 정보를 찾을 수 없습니다.'); return; }
  editingShopId = shopId;

  // 탭 활성화
  var tabShops = document.getElementById('tab-shops');
  if(tabShops && !tabShops.classList.contains('on')){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    var tabBtn = document.querySelector('.tab[data-tab="shops"]');
    if(tabBtn) tabBtn.classList.add('on');
    tabShops.classList.add('on');
  }

  // 폼에 기존값 채우기
  document.getElementById('edit-shop-name-label').textContent = shop.name;
  document.getElementById('edit-sh-name').value = shop.name || '';
  document.getElementById('edit-sh-cat').value = shop.category || 'clinic';
  document.getElementById('edit-sh-loc').value = shop.location || '';
  document.getElementById('edit-sh-addr').value = shop.address || '';
  document.getElementById('edit-sh-hours').value = shop.hours || '';
  document.getElementById('edit-sh-gmap-url').value = shop.googleMapUrl || '';
  document.getElementById('edit-sh-gmap-embed').value = shop.googleMapEmbed || '';
  document.getElementById('edit-sh-lat').value = shop.lat || '';
  document.getElementById('edit-sh-lng').value = shop.lng || '';
  // embed 미리보기 갱신
  setTimeout(function(){ updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed'); }, 50);
  document.getElementById('edit-sh-thumb').value = shop.thumbnail || '';
  document.getElementById('edit-sh-commission').value = shop.commission || 15;
  document.getElementById('edit-sh-desc').value = shop.description || '';
  // 리뷰/Places/photos 데이터 hidden 필드 초기화
  var rEl = document.getElementById('edit-sh-reviews');
  if(!rEl){ rEl=document.createElement('input');rEl.type='hidden';rEl.id='edit-sh-reviews';document.body.appendChild(rEl); }
  rEl.value = JSON.stringify(shop.reviews||[]);
  var pidEl = document.getElementById('edit-sh-place-id');
  if(!pidEl){ pidEl=document.createElement('input');pidEl.type='hidden';pidEl.id='edit-sh-place-id';document.body.appendChild(pidEl); }
  pidEl.value = shop.googlePlaceId||'';
  var rcEl = document.getElementById('edit-sh-review-count');
  if(!rcEl){ rcEl=document.createElement('input');rcEl.type='hidden';rcEl.id='edit-sh-review-count';document.body.appendChild(rcEl); }
  rcEl.value = shop.reviewCount||0;
  var ratEl = document.getElementById('edit-sh-rating');
  if(!ratEl){ ratEl=document.createElement('input');ratEl.type='hidden';ratEl.id='edit-sh-rating';document.body.appendChild(ratEl); }
  ratEl.value = shop.rating||5.0;
  var phEl = document.getElementById('edit-sh-photos');
  if(!phEl){ phEl=document.createElement('input');phEl.type='hidden';phEl.id='edit-sh-photos';document.body.appendChild(phEl); }
  phEl.value = JSON.stringify(shop.photos||[]);
  // 사진 미리보기
  var phPrev = document.getElementById('edit-sh-photos-preview');
  if(!phPrev){ phPrev=document.createElement('div');phPrev.id='edit-sh-photos-preview';phPrev.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-top:8px'; document.body.appendChild(phPrev); }
  var existingPhotos = shop.photos||[];
  phPrev.innerHTML = existingPhotos.map(function(url){ return '<img src="'+url+'" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.15)" onerror="this.remove()">'; }).join('');

  // 서비스 목록 채우기
  var svcList = document.getElementById('edit-svc-list');
  svcList.innerHTML = '';
  var prices = shop.servicePrices || [];
  if(prices.length > 0){
    prices.forEach(function(p){
      var rawPrice = p.price ? p.price.replace(/[₩,]/g,'') : '';
      addEditSvcRow(p.name, rawPrice);
    });
  } else {
    addEditSvcRow('','');
  }

  // photos 배열 렌더링
  var photosList = document.getElementById('edit-photos-list');
  photosList.innerHTML = '';
  var existingPhotos = shop.photos || [];
  existingPhotos.forEach(function(url){
    appendEditPhotoCard(url);
  });

  // 썸네일 미리보기 초기화
  var thumbPreview = document.getElementById('edit-thumb-preview');
  var thumbStatus = document.getElementById('edit-thumb-status');
  var thumbPreviewImg = document.getElementById('edit-thumb-preview-img');
  thumbStatus.textContent = '';
  if(shop.thumbnail){
    thumbPreview.style.display = 'block';
    thumbPreviewImg.src = shop.thumbnail;
  } else {
    thumbPreview.style.display = 'none';
  }

  document.getElementById('editShopPanel').style.display = 'block';
  document.getElementById('videoAddPanel').style.display = 'none';
  setTimeout(function(){
    document.getElementById('editShopPanel').scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
}

function closeEditShopPanel(){
  document.getElementById('editShopPanel').style.display = 'none';
  editingShopId = null;
}

/* ── AI 요금표 사진 분석 핸들러 ── */
(function(){
  var btn = document.getElementById('edit-price-img-btn');
  var fileInput = document.getElementById('edit-price-img-file');
  var statusEl = document.getElementById('edit-price-img-status');
  var previewWrap = document.getElementById('edit-price-img-preview');
  var previewImg = document.getElementById('edit-price-img-thumb');

  btn.addEventListener('click', function(){ fileInput.click(); });

  fileInput.addEventListener('change', async function(){
    var file = fileInput.files[0];
    if(!file) return;
    fileInput.value = '';

    // 미리보기
    var reader = new FileReader();
    reader.onload = function(e){ previewImg.src = e.target.result; previewWrap.style.display='block'; };
    reader.readAsDataURL(file);

    // 상태 표시
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>이미지 업로드 중...';
    btn.disabled = true;

    try {
      // 1) Cloudinary에 이미지 업로드
      var signRes = await fetch('/api/upload-sign-image');
      var signData = await signRes.json();
      var fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', signData.apiKey);
      fd.append('timestamp', signData.timestamp);
      fd.append('signature', signData.signature);
      fd.append('folder', signData.folder);
      var upRes = await fetch('https://api.cloudinary.com/v1_1/dc0ouozcd/image/upload', { method:'POST', body:fd });
      var upData = await upRes.json();
      if(!upData.secure_url) throw new Error('업로드 실패: ' + (upData.error?.message||'unknown'));

      statusEl.innerHTML = '<i class="fas fa-brain fa-spin" style="margin-right:6px;color:#a78bfa"></i>AI가 요금표를 분석 중입니다...';

      // 2) AI 분석
      var parseRes = await fetch('/api/parse-price-image', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ imageUrl: upData.secure_url })
      });
      var parseData = await parseRes.json();
      if(parseData.error) throw new Error(parseData.error);

      var items = parseData.items || [];
      if(items.length === 0) throw new Error('가격 항목을 찾지 못했습니다. 다른 사진을 시도해보세요.');

      // 3) 기존 목록 초기화 후 결과 삽입
      document.getElementById('edit-svc-list').innerHTML = '';
      items.forEach(function(item){
        addEditSvcRow(item.name, item.price > 0 ? item.price : '');
      });

      statusEl.innerHTML = '<i class="fas fa-check-circle" style="margin-right:6px;color:#4ade80"></i>'
        + items.length + '개 항목 인식 완료! 아래에서 확인 후 수정하세요.';
      setTimeout(function(){ statusEl.style.display='none'; }, 4000);

    } catch(err) {
      statusEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px;color:#f87171"></i>' + err.message;
    }
    btn.disabled = false;
  });
})();

function addEditSvcRow(name, price){
  var list = document.getElementById('edit-svc-list');
  var row = document.createElement('div');
  row.className = 'edit-svc-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  var nameIn = document.createElement('input');
  nameIn.className = 'edit-svc-name';
  nameIn.placeholder = '서비스명';
  nameIn.value = name || '';
  nameIn.style.flex = '2';
  var priceIn = document.createElement('input');
  priceIn.className = 'edit-svc-price';
  priceIn.type = 'number';
  priceIn.placeholder = '가격 (예: 80000)';
  priceIn.value = price || '';
  priceIn.min = '0';
  priceIn.step = '1000';
  priceIn.style.flex = '1';
  var del = document.createElement('button');
  del.type = 'button';
  del.textContent = '✕';
  del.style.cssText = 'background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:32px;height:32px;cursor:pointer;font-size:14px;flex-shrink:0';
  del.addEventListener('click', function(){ row.remove(); });
  row.appendChild(nameIn); row.appendChild(priceIn); row.appendChild(del);
  list.appendChild(row);
}

function saveEditShop(){
  if(!editingShopId){ return; }
  var name = document.getElementById('edit-sh-name').value.trim();
  if(!name){ alert('업체명을 입력해주세요!'); return; }

  // 서비스 수집
  var svcRows = document.querySelectorAll('#edit-svc-list .edit-svc-row');
  var svcs = [], svcPrices = [], pMin = 0, pMax = 0;
  svcRows.forEach(function(row){
    var n = row.querySelector('.edit-svc-name').value.trim();
    var p = parseInt(row.querySelector('.edit-svc-price').value)||0;
    if(n){
      svcs.push(n);
      svcPrices.push({name:n, price: p ? fmtPrice(p) : ''});
      if(p){ if(!pMin||p<pMin) pMin=p; if(p>pMax) pMax=p; }
    }
  });
  var priceRange = (pMin||pMax) ? (fmtPrice(pMin)+(pMax&&pMax!==pMin?'~'+fmtPrice(pMax):'')) : (document.getElementById('edit-sh-hours').value ? 'Contact us' : '');

  var btn = document.getElementById('edit-sh-submit-btn');
  btn.disabled = true; btn.textContent = '저장 중...';

  var shop = shops.find(function(s){ return String(s.id) === String(editingShopId); }) || {};

  // photos 수집 (수동 업로드 + Places API 자동가져오기 병합)
  var photoCards = document.querySelectorAll('#edit-photos-list .edit-photo-card');
  var photosArr = [];
  photoCards.forEach(function(card){
    var u = card.getAttribute('data-url');
    if(u) photosArr.push(u);
  });
  // Places API로 가져온 photos도 병합 (중복 제거)
  try {
    var placesPhotosEl = document.getElementById('edit-sh-photos');
    var placesPhotos = placesPhotosEl ? JSON.parse(placesPhotosEl.value||'[]') : [];
    placesPhotos.forEach(function(u){ if(u && photosArr.indexOf(u)===-1) photosArr.push(u); });
  } catch(e2){};

  fetch('/api/shops/'+editingShopId, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      name: name,
      slug: shop.slug || '',
      category: document.getElementById('edit-sh-cat').value,
      location: document.getElementById('edit-sh-loc').value || 'Seoul',
      address: document.getElementById('edit-sh-addr').value || '',
      hours: document.getElementById('edit-sh-hours').value || '',
      googleMapUrl: document.getElementById('edit-sh-gmap-url').value || '',
      googleMapEmbed: document.getElementById('edit-sh-gmap-embed').value || '',
      lat: document.getElementById('edit-sh-lat').value || '',
      lng: document.getElementById('edit-sh-lng').value || '',
      thumbnail: document.getElementById('edit-sh-thumb').value || '',
      commission: parseInt(document.getElementById('edit-sh-commission').value)||15,
      description: document.getElementById('edit-sh-desc').value || '',
      services: svcs,
      servicePrices: svcPrices,
      priceRange: svcs.length > 0 ? priceRange : (shop.priceRange||''),
      rating: (function(){ var el=document.getElementById('edit-sh-rating'); return el?parseFloat(el.value)||shop.rating||5.0:shop.rating||5.0;})(),
      reviewCount: (function(){ var el=document.getElementById('edit-sh-review-count'); return el?parseInt(el.value)||shop.reviewCount||0:shop.reviewCount||0;})(),
      reviews: (function(){ try{ var el=document.getElementById('edit-sh-reviews'); return el?JSON.parse(el.value||'[]'):shop.reviews||[];} catch(e){return shop.reviews||[];}}()),
      googlePlaceId: (function(){ var el=document.getElementById('edit-sh-place-id'); return el&&el.value?el.value:shop.googlePlaceId||'';})(),
      active: true,
      photos: photosArr
    })
  }).then(function(r){ return r.json(); }).then(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 수정 저장';
    closeEditShopPanel();
    loadAll();
    alert('✅ 업체 정보가 수정되었습니다!');
  }).catch(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 수정 저장';
    alert('오류가 발생했습니다. 다시 시도해주세요.');
  });
}

document.getElementById('edit-panel-close').addEventListener('click', closeEditShopPanel);
document.getElementById('edit-panel-cancel').addEventListener('click', closeEditShopPanel);
document.getElementById('edit-sh-submit-btn').addEventListener('click', saveEditShop);
document.getElementById('edit-svc-add-btn').addEventListener('click', function(){ addEditSvcRow('',''); });

// ── 사진 카드 추가 헬퍼 ──
function appendEditPhotoCard(url){
  var list = document.getElementById('edit-photos-list');
  var card = document.createElement('div');
  card.className = 'edit-photo-card';
  card.setAttribute('data-url', url);
  card.style.cssText = 'position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.12);flex-shrink:0';
  var img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.innerHTML = '&times;';
  delBtn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.85);border:none;color:#fff;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0';
  delBtn.addEventListener('click', function(){ card.remove(); });
  card.appendChild(img);
  card.appendChild(delBtn);
  list.appendChild(card);
}

// ── Cloudinary 이미지 업로드 공통 함수 ──
function uploadImageToCloudinary(file, onProgress, onSuccess, onError){
  onProgress('서명 발급 중...');
  fetch('/api/upload-sign-image')
    .then(function(r){ return r.json(); })
    .then(function(sign){
      if(sign.error) throw new Error(sign.error);
      var mb = (file.size/1024/1024).toFixed(1);
      onProgress('업로드 중... (' + mb + 'MB)');
      var fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      fd.append('folder', sign.folder);
      return fetch('https://api.cloudinary.com/v1_1/' + sign.cloudName + '/image/upload', {
        method:'POST', body:fd
      }).then(function(r){ return r.json(); });
    })
    .then(function(data){
      if(data.secure_url){ onSuccess(data.secure_url); }
      else {
        var msg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
        onError(msg);
      }
    })
    .catch(function(err){ onError(err.message || '네트워크 오류'); });
}

// ── 썸네일 업로드 핸들러 ──
document.getElementById('edit-thumb-upload-btn').addEventListener('click', function(){
  document.getElementById('edit-thumb-file').click();
});
document.getElementById('edit-thumb-file').addEventListener('change', function(){
  var file = this.files && this.files[0];
  if(!file) return;
  var statusEl = document.getElementById('edit-thumb-status');
  var previewWrap = document.getElementById('edit-thumb-preview');
  var previewImg = document.getElementById('edit-thumb-preview-img');
  var btn = document.getElementById('edit-thumb-upload-btn');
  statusEl.style.color = '#fbbf24';
  btn.disabled = true;
  uploadImageToCloudinary(
    file,
    function(msg){ statusEl.style.color='#fbbf24'; statusEl.textContent=msg; },
    function(url){
      document.getElementById('edit-sh-thumb').value = url;
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '✅ 업로드 완료!';
      previewImg.src = url;
      previewWrap.style.display = 'block';
      btn.disabled = false;
    },
    function(errMsg){
      statusEl.style.color = '#f87171';
      statusEl.textContent = '❌ ' + errMsg;
      btn.disabled = false;
    }
  );
  this.value = ''; // 파일 인풋 초기화 (같은 파일 재선택 가능)
});

// ── 추가 사진 업로드 핸들러 ──
document.getElementById('edit-photo-add-btn').addEventListener('click', function(){
  document.getElementById('edit-photo-file').click();
});
document.getElementById('edit-photo-file').addEventListener('change', function(){
  var file = this.files && this.files[0];
  if(!file) return;
  var btn = document.getElementById('edit-photo-add-btn');
  var origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '업로드 중...';
  uploadImageToCloudinary(
    file,
    function(){},
    function(url){
      appendEditPhotoCard(url);
      btn.disabled = false;
      btn.textContent = origText;
    },
    function(errMsg){
      alert('사진 업로드 실패: ' + errMsg);
      btn.disabled = false;
      btn.textContent = origText;
    }
  );
  this.value = ''; // 파일 인풋 초기화
});

// 구글맵 자동입력 버튼 + 붙여넣기 이벤트
document.getElementById('sh-gmap-btn').addEventListener('click', function(){
  parseGmapUrl(document.getElementById('sh-gmap-raw').value);
});
document.getElementById('sh-gmap-raw').addEventListener('paste', function(e){
  // paste 이벤트는 value 반영 전에 발생 → setTimeout으로 약간 딜레이
  setTimeout(function(){
    var val = document.getElementById('sh-gmap-raw').value.trim();
    if(val) parseGmapUrl(val);
  }, 100);
});
document.getElementById('sh-gmap-raw').addEventListener('keydown', function(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    parseGmapUrl(document.getElementById('sh-gmap-raw').value);
  }
});

// 서비스 행 삭제 이벤트
document.getElementById('svc-list').addEventListener('click', function(e){
  var btn = e.target.closest('.svc-del');
  if(btn) btn.closest('.svc-row').remove();
});
// 영상 행 삭제 이벤트
document.getElementById('vid-list').addEventListener('click', function(e){
  var btn = e.target.closest('.vid-del');
  if(btn) btn.closest('.vid-row').remove();
});

// 초기 서비스 1행 추가
addSvcRow();

// ── 서비스 행 추가 ──
function addSvcRow(name, price){
  var list = document.getElementById('svc-list');
  var row = document.createElement('div');
  row.className = 'svc-row';
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';

  var nameIn = document.createElement('input');
  nameIn.className = 'svc-name';
  nameIn.placeholder = '서비스명 (예: 딥클렌징 페이셜)';
  nameIn.value = name || '';
  nameIn.style.flex = '2';

  var priceIn = document.createElement('input');
  priceIn.className = 'svc-price';
  priceIn.type = 'number';
  priceIn.placeholder = '가격 (예: 80000)';
  priceIn.value = price || '';
  priceIn.min = '0';
  priceIn.step = '1000';
  priceIn.style.flex = '1';

  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'svc-del';
  del.textContent = '✕';
  del.style.cssText = 'background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:32px;height:32px;cursor:pointer;font-size:14px;flex-shrink:0';

  row.appendChild(nameIn);
  row.appendChild(priceIn);
  row.appendChild(del);
  list.appendChild(row);
}

// ── 영상 행 추가 ──
function addVidRow(){
  var list = document.getElementById('vid-list');
  var row = document.createElement('div');
  row.className = 'vid-row-form';
  row.style.cssText = 'background:rgba(255,77,141,.04);border:1px solid rgba(255,77,141,.15);border-radius:12px;padding:12px;margin-bottom:10px';

  // 숨겨진 URL 저장용 input (addShop에서 수집)
  var urlIn = document.createElement('input');
  urlIn.className = 'vid-form-url';
  urlIn.type = 'hidden';

  // 영상 제목 입력 (파일 선택 시 기본값, 수정 가능)
  var titleIn = document.createElement('input');
  titleIn.className = 'vid-form-title';
  titleIn.type = 'text';
  titleIn.placeholder = 'Video title (e.g. Gangnam Facial Treatment)';
  titleIn.style.cssText = 'width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:8px 12px;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;';

  // 숨겨진 desc
  var descIn = document.createElement('input');
  descIn.className = 'vid-form-desc';
  descIn.type = 'hidden';
  descIn.value = '';

  // 업로드 영역
  var uploadWrap = document.createElement('div');
  uploadWrap.style.cssText = 'display:flex;align-items:center;gap:10px';

  var fileIn = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'video/mp4,video/quicktime,video/x-m4v';
  fileIn.style.cssText = 'display:none';

  var uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.style.cssText = 'padding:8px 18px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap';
  uploadBtn.textContent = '영상 파일 선택';

  var uploadStatus = document.createElement('span');
  uploadStatus.style.cssText = 'font-size:12px;color:rgba(255,255,255,.4)';
  uploadStatus.textContent = '파일을 선택해주세요';

  var delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'vid-del';
  delBtn.textContent = '✕';
  delBtn.style.cssText = 'margin-left:auto;background:rgba(239,68,68,.15);border:none;border-radius:8px;color:#f87171;width:30px;height:30px;cursor:pointer;font-size:13px;flex-shrink:0';

  uploadBtn.addEventListener('click', function(){ fileIn.click(); });

  fileIn.addEventListener('change', function(){
    var file = fileIn.files && fileIn.files[0];
    if(!file) return;
    if(!titleIn.value) titleIn.value = file.name.split('.').slice(0,-1).join('.').replace(/[-_]/g,' ') || file.name;
    uploadStatus.style.color = '#fbbf24';
    uploadStatus.textContent = '서명 발급 중...';
    uploadBtn.disabled = true;
    uploadBtn.textContent = '업로드 중...';
    // 1) 서버에서 서명 받기
    fetch('/api/upload-sign')
      .then(function(r){ return r.json(); })
      .then(function(sign){
        if(sign.error){ throw new Error(sign.error); }
        // 2) Cloudinary에 직접 업로드 (Vercel 크기제한 우회)
        var mb = (file.size/1024/1024).toFixed(1);
        uploadStatus.textContent = '업로드 중... (' + mb + 'MB)';
        var fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', sign.apiKey);
        fd.append('timestamp', sign.timestamp);
        fd.append('signature', sign.signature);
        fd.append('folder', sign.folder);
        return fetch('https://api.cloudinary.com/v1_1/' + sign.cloudName + '/video/upload', {
          method: 'POST', body: fd
        }).then(function(r){ return r.json(); });
      })
      .then(function(data){
        if(data.secure_url){
          urlIn.value = data.secure_url;
          uploadStatus.style.color = '#4ade80';
          uploadStatus.textContent = '✅ 업로드 완료!';
          uploadBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
          uploadBtn.textContent = '완료 ✓';
        } else {
          var errMsg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
          uploadStatus.style.color = '#f87171';
          uploadStatus.textContent = '❌ ' + errMsg;
          uploadBtn.disabled = false;
          uploadBtn.textContent = '영상 파일 선택';
        }
      })
      .catch(function(err){
        uploadStatus.style.color = '#f87171';
        uploadStatus.textContent = '❌ ' + (err.message || '네트워크 오류');
        uploadBtn.disabled = false;
        uploadBtn.textContent = '영상 파일 선택';
      });
  });

  uploadWrap.appendChild(fileIn);
  uploadWrap.appendChild(uploadBtn);
  uploadWrap.appendChild(uploadStatus);
  uploadWrap.appendChild(delBtn);

  row.appendChild(urlIn);
  row.appendChild(descIn);
  row.appendChild(titleIn);
  row.appendChild(uploadWrap);
  list.appendChild(row);
}

// 영상 행 URL 처리 (구글드라이브 자동변환)
function handleVidRowUrl(input, badge){
  var raw = input.value;
  if(!raw){ badge.style.display='none'; return; }
  if(raw.indexOf('drive.google.com') !== -1){
    var converted = convertGDriveUrl(raw);
    if(converted){
      input.value = converted;
      badge.style.display='inline-block';
      badge.style.background='linear-gradient(135deg,#4285F4,#34A853)';
      badge.style.color='#fff';
      badge.textContent='G Drive';
    }
    return;
  }
  if(raw.indexOf('r2.dev') !== -1){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#F6821F,#FAAD3D)';
    badge.style.color='#fff';
    badge.textContent='R2';
    return;
  }
  badge.style.display='none';
}

// ── 지역 키워드 → 지역명 변환 ──
function detectArea(text){
  var areaMap = [
    ['압구정','Apgujeong, Seoul'],['청담','Cheongdam, Seoul'],
    ['가로수길','Sinsa, Seoul'],['신사','Sinsa, Seoul'],
    ['역삼','Gangnam, Seoul'],['선릉','Gangnam, Seoul'],['삼성동','Gangnam, Seoul'],
    ['강남','Gangnam, Seoul'],['서초','Seocho, Seoul'],
    ['홍대','Hongdae, Seoul'],['합정','Hapjeong, Seoul'],['상수','Hapjeong, Seoul'],
    ['신촌','Sinchon, Seoul'],['마포','Mapo, Seoul'],
    ['이태원','Itaewon, Seoul'],['한남','Itaewon, Seoul'],['용산','Yongsan, Seoul'],
    ['명동','Myeongdong, Seoul'],['충무로','Myeongdong, Seoul'],['중구','Myeongdong, Seoul'],
    ['종로','Jongno, Seoul'],['인사동','Jongno, Seoul'],['북촌','Jongno, Seoul'],
    ['동대문','Dongdaemun, Seoul'],['신설','Dongdaemun, Seoul'],
    ['성수','Seongsu, Seoul'],['성동','Seongsu, Seoul'],['뚝섬','Seongsu, Seoul'],
    ['건대','Konkuk, Seoul'],['광진','Konkuk, Seoul'],
    ['잠실','Jamsil, Seoul'],['송파','Songpa, Seoul'],['강동','Songpa, Seoul'],
    ['노원','Nowon, Seoul'],['도봉','Nowon, Seoul'],
    ['신림','Sinlim, Seoul'],['관악','Sinlim, Seoul'],
    ['여의도','Yeouido, Seoul'],['영등포','Yeouido, Seoul'],
    ['강서','Gangseo, Seoul'],['목동','Gangseo, Seoul'],
    ['은평','Eunpyeong, Seoul'],['연신내','Eunpyeong, Seoul'],
    ['부산','Busan'],['해운대','Busan'],['서면','Busan'],
    ['제주','Jeju'],['인천','Incheon'],['대구','Daegu'],
    ['대전','Daejeon'],['광주','Gwangju'],['수원','Suwon']
  ];
  var t = text.toLowerCase();
  for(var i=0;i<areaMap.length;i++){
    if(t.indexOf(areaMap[i][0])!==-1) return areaMap[i][1];
  }
  return '';
}

// ── 업체명 추출 (place URL의 첫 토큰) ──
function extractPlaceName(placeText){
  // "강남 글로우 스킨클리닉 서울특별시 강남구..." → 첫 의미 단위 추출
  var parts = placeText.split(' ');
  // 앞에서 최대 4단어, 주소성 단어 나오면 중단
  var stopWords = ['서울','경기','부산','인천','대구','광주','대전','울산','세종','특별시','광역시','도','시','구','동','로','길','번길','번지'];
  var name = [];
  for(var i=0;i<parts.length&&i<5;i++){
    var w = parts[i];
    var isStop = false;
    for(var j=0;j<stopWords.length;j++){
      if(w.indexOf(stopWords[j])!==-1){ isStop=true; break; }
    }
    if(isStop) break;
    name.push(w);
  }
  return name.join(' ');
}

// embed iframe preview helper
function updateGmapEmbedPreview(previewId, inputId) {
  var input = document.getElementById(inputId);
  var preview = document.getElementById(previewId);
  if(!input || !preview) return;
  var val = input.value.trim();
  // src="..." 형태로 붙여넣으면 src 값만 추출
  var srcMatch = val.match(/src=["']([^"']+)["']/);
  if(srcMatch) { val = srcMatch[1]; input.value = val; }
  if(val.indexOf('google.com/maps/embed') !== -1) {
    var frameId = previewId.replace('preview','frame').replace('gmap-preview','gmap-frame');
    var frame = document.getElementById(frameId) || preview.querySelector('iframe');
    if(frame) frame.src = val;
    preview.style.display = 'block';
  } else if(!val) {
    preview.style.display = 'none';
  }
}

// ── 구글맵 URL 파싱 → 자동입력 ──
/* ── 구글맵 링크 → resolve-gmap → 폼 자동입력 ── */
function applyPlacesDataToForm(prefix, d) {
  /* resolve-gmap / places-fetch 응답을 폼 prefix의 모든 필드에 채워 넣는 공통 함수 */
  if(d.name)    { var ne=document.getElementById(prefix+'-name');    if(ne && !ne.value.trim()) ne.value=d.name; }
  if(d.address) { var ae=document.getElementById(prefix+'-addr');    if(ae) ae.value=d.address; }
  if(d.location){ var le=document.getElementById(prefix+'-loc');     if(le && !le.value.trim()) le.value=d.location; }
  if(d.lat)     { var late=document.getElementById(prefix+'-lat');   if(late) late.value=d.lat; }
  if(d.lng)     { var lnge=document.getElementById(prefix+'-lng');   if(lnge) lnge.value=d.lng; }

  if(d.weekdayDescriptions && d.weekdayDescriptions.length>0){
    var he=document.getElementById(prefix+'-hours'); if(he) he.value=d.weekdayDescriptions.join(' | ');
  } else if(d.hours){
    var he2=document.getElementById(prefix+'-hours'); if(he2) he2.value=d.hours;
  }

  /* 업체 소개 (editorialSummary) — 비어있을 때만 채움 */
  if(d.description){
    var de=document.getElementById(prefix+'-desc');
    if(de && !de.value.trim()) de.value=d.description;
  }

  /* 카테고리 자동선택 (suggestedCategory) */
  if(d.suggestedCategory){
    var ce=document.getElementById(prefix+'-cat');
    if(ce) ce.value=d.suggestedCategory;
  }

  if(d.rating){ var re=document.getElementById(prefix+'-rating'); if(re) re.value=d.rating; }
  if(d.reviewCount){ var rce=document.getElementById(prefix+'-review-count'); if(rce) rce.value=d.reviewCount; }
  if(d.reviews && d.reviews.length>0){ var rve=document.getElementById(prefix+'-reviews'); if(rve) rve.value=JSON.stringify(d.reviews); }
  if(d.placeId){ var pie=document.getElementById(prefix+'-place-id'); if(pie) pie.value=d.placeId; }
  if(d.photos && d.photos.length>0){
    var th=document.getElementById(prefix+'-thumb'); if(th && !th.value) th.value=d.photos[0];
    var ph=document.getElementById(prefix+'-photos'); if(ph) ph.value=JSON.stringify(d.photos);
    /* 사진 미리보기 */
    var prevId=prefix==='sh'?'sh-photos-preview':'edit-sh-photos-preview';
    var prevEl=document.getElementById(prevId);
    if(prevEl){
      prevEl.innerHTML=d.photos.map(function(u){ return '<img src="'+u+'" style="width:64px;height:64px;object-fit:cover;border-radius:7px;border:1px solid rgba(255,255,255,.12)" onerror="this.remove()">'; }).join('');
      prevEl.style.display='flex'; prevEl.style.flexWrap='wrap'; prevEl.style.gap='4px'; prevEl.style.marginTop='8px';
    }
  }
}

var _CAT_LABEL = {skincare:'스킨케어',makeup:'메이크업',hair:'헤어',headspa:'헤드스파',nail:'네일',clinic:'클리닉',spa:'스파·마사지'};

function buildPlacesResultCard(d, extra) {
  /* 가져온 정보를 한눈에 볼 수 있는 상세 카드 HTML 반환 */
  var html = '<div style="background:rgba(66,133,244,.07);border:1px solid rgba(66,133,244,.3);border-radius:12px;padding:12px 14px;margin-top:8px;font-size:12px">';
  html += '<div style="font-weight:800;color:#60a5fa;margin-bottom:8px;font-size:12px"><i class="fab fa-google"></i> 구글 정보 가져오기 완료!</div>';

  /* 업체명 + 카테고리 자동감지 배지 */
  var nameRow = '';
  if(d.name) nameRow += '<b style="color:#fff;font-size:13px">'+d.name+'</b>';
  if(d.suggestedCategory){
    nameRow += ' <span style="background:rgba(232,65,122,.18);border:1px solid rgba(232,65,122,.4);border-radius:20px;padding:1px 8px;font-size:10px;color:#f9a8d4;margin-left:4px">자동감지: '+(_CAT_LABEL[d.suggestedCategory]||d.suggestedCategory)+'</span>';
  }
  if(nameRow) html += '<div style="margin-bottom:6px">'+nameRow+'</div>';

  /* 평점 + 리뷰수 */
  if(d.rating){
    var stars=''; for(var i=0;i<5;i++) stars+=(i<Math.round(d.rating)?'★':'☆');
    html += '<div style="margin-bottom:5px"><span style="color:#fbbf24;font-size:13px">'+stars+'</span> <b style="color:#fbbf24">'+d.rating+'</b> <span style="color:rgba(255,255,255,.4)">('+((d.reviewCount||0).toLocaleString())+'개 리뷰)</span></div>';
  }

  /* 주소 */
  if(d.address) html += '<div style="margin-bottom:4px;line-height:1.5"><i class="fas fa-map-marker-alt" style="color:#f87171;margin-right:4px"></i><span style="color:rgba(255,255,255,.75)">'+d.address+'</span></div>';

  /* 지역 */
  if(d.location) html += '<div style="margin-bottom:5px"><i class="fas fa-location-dot" style="color:#a78bfa;margin-right:4px"></i><span style="color:#c4b5fd">'+d.location+'</span></div>';

  /* 업체 소개 */
  if(d.description){
    html += '<div style="margin-bottom:6px;background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px">';
    html += '<div style="color:rgba(255,255,255,.4);margin-bottom:3px;font-size:10px"><i class="fas fa-info-circle" style="margin-right:3px"></i>업체 소개 (자동입력됨)</div>';
    html += '<div style="color:rgba(255,255,255,.7);font-size:11px;line-height:1.6">'+d.description+'</div>';
    html += '</div>';
  }

  /* 영업시간 */
  if(d.weekdayDescriptions && d.weekdayDescriptions.length>0){
    html += '<div style="margin-bottom:6px"><div style="color:rgba(255,255,255,.4);margin-bottom:3px"><i class="fas fa-clock" style="margin-right:4px"></i>영업시간</div>';
    html += '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:6px 8px;font-size:11px;color:rgba(255,255,255,.65);line-height:1.7">';
    d.weekdayDescriptions.forEach(function(h){ html += h + '<br>'; });
    html += '</div></div>';
  }

  /* 사진 */
  if(d.photos && d.photos.length>0){
    html += '<div style="margin-bottom:6px"><div style="color:rgba(255,255,255,.4);margin-bottom:4px"><i class="fas fa-images" style="margin-right:4px"></i>사진 '+d.photos.length+'장</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    d.photos.slice(0,8).forEach(function(u){ html += '<img src="'+u+'" style="width:58px;height:58px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,.1)" onerror="this.remove()">'; });
    html += '</div></div>';
  }

  /* 리뷰 미리보기 */
  if(d.reviews && d.reviews.length>0){
    html += '<div style="margin-bottom:4px"><div style="color:rgba(255,255,255,.4);margin-bottom:4px"><i class="fas fa-comment" style="margin-right:4px"></i>리뷰 미리보기</div>';
    d.reviews.slice(0,2).forEach(function(rv){
      var strs=''; for(var i=0;i<(rv.rating||5);i++) strs+='★';
      html += '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:7px 9px;margin-bottom:4px;font-size:11px">';
      html += '<div style="color:#fbbf24;font-size:10px;margin-bottom:2px">'+strs+' <span style="color:rgba(255,255,255,.4)">'+rv.author+'</span></div>';
      html += '<div style="color:rgba(255,255,255,.7);line-height:1.5">'+rv.text.slice(0,120)+(rv.text.length>120?'…':'')+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if(extra) html += extra;
  html += '</div>';
  return html;
}

function parseGmapUrl(raw){
  var status = document.getElementById('sh-gmap-status');
  var url = raw.trim();
  if(!url){ status.textContent=''; return; }

  document.getElementById('sh-gmap-raw').setAttribute('data-gmap-url', url);

  /* 구글맵 URL → 서버 경유: resolve-gmap이 Places API까지 조회해서 전체정보 반환 */
  if(url.indexOf('google.com/maps')!==-1 || url.indexOf('goo.gl')!==-1 || url.indexOf('maps.app')!==-1){
    status.style.color='#fbbf24';
    status.innerHTML='<i class="fas fa-spinner fa-spin"></i> 구글에서 업체 정보 가져오는 중...';
    fetch('/api/resolve-gmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.error){ status.style.color='#f87171'; status.textContent='❌ '+d.error; return; }
        /* 공통 헬퍼로 sh- 폼 전체 입력 */
        applyPlacesDataToForm('sh', d);
        if(d._fromPlaces){
          status.innerHTML = buildPlacesResultCard(d, '<div style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.3)">링크 자동가져오기 완료</div>');
        } else if(d.address||d.name){
          status.style.color='#4ade80';
          status.textContent='✅ 자동입력 완료! 내용을 확인해주세요.';
        } else {
          status.style.color='#fbbf24';
          status.textContent='⚠ 일부 정보를 가져오지 못했어요. 직접 입력해주세요.';
        }
      })
      .catch(function(e){
        status.style.color='#f87171';
        status.textContent='❌ 분석 실패: '+e.message;
      });
    return;
  }

  status.style.color='rgba(255,255,255,.4)';
  status.textContent='구글맵 링크를 붙여넣어 주세요.';
}

// ── 업체 등록 ──
window.addShop = function addShop(){
  var name = document.getElementById('sh-name').value.trim();
  if(!name){ alert('업체명을 입력해주세요!'); return; }

  // 서비스 행 수집
  var svcRows = document.querySelectorAll('#svc-list .svc-row');
  var svcs = [], svcPrices = [], pMin = 0, pMax = 0;
  svcRows.forEach(function(row){
    var n = row.querySelector('.svc-name').value.trim();
    var p = parseInt(row.querySelector('.svc-price').value)||0;
    if(n){
      svcs.push(n);
      svcPrices.push({name:n, price: p ? fmtPrice(p) : ''});
      if(p){ if(!pMin||p<pMin) pMin=p; if(p>pMax) pMax=p; }
    }
  });
  var priceRange = (pMin||pMax) ? (fmtPrice(pMin)+(pMax&&pMax!==pMin?'~'+fmtPrice(pMax):'')) : 'Contact us';

  // slug 생성 (한글 업체명도 안전하게)
  var slugBase = '';
  for(var ci=0;ci<name.length;ci++){ var ch=name[ci].toLowerCase(); slugBase += (ch>='a'&&ch<='z')||(ch>='0'&&ch<='9') ? ch : '-'; }
  while(slugBase.indexOf('--')!==-1) slugBase=slugBase.split('--').join('-');
  slugBase = slugBase.split('').filter(function(c){return c!=='-';}).length === 0 ? '' : slugBase;
  if(slugBase && slugBase[0]==='-') slugBase=slugBase.slice(1);
  if(slugBase && slugBase[slugBase.length-1]==='-') slugBase=slugBase.slice(0,-1);
  var slug = (slugBase||'shop') + '-' + Date.now().toString().slice(-6);

  var rawInput = document.getElementById('sh-gmap-raw');
  var gmapUrl = rawInput.getAttribute('data-gmap-url') || rawInput.value || '';

  // 영상 행 수집
  var vidRows = document.querySelectorAll('#vid-list .vid-row-form');
  var pendingVids = [];
  vidRows.forEach(function(row){
    var t = row.querySelector('.vid-form-title').value.trim();
    var u = row.querySelector('.vid-form-url').value.trim();
    var d = row.querySelector('.vid-form-desc').value.trim();
    if(t && u) pendingVids.push({title:t, videoUrl:u, description:d});
  });

  var btn = document.getElementById('sh-submit-btn');
  btn.disabled = true;
  btn.textContent = '등록 중...';

  fetch('/api/shops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:name, slug:slug,
    category:document.getElementById('sh-cat').value,
    location:document.getElementById('sh-loc').value||'Seoul',
    priceRange:priceRange,
    hours:document.getElementById('sh-hours').value||'',
    commission:15,
    address:document.getElementById('sh-addr').value||'',
    googleMapUrl:gmapUrl,
    googleMapEmbed:document.getElementById('sh-gmap-embed').value||'',
    lat:document.getElementById('sh-lat').value||'',
    lng:document.getElementById('sh-lng').value||'',
    thumbnail:'',
    services:svcs,
    servicePrices:svcPrices,
    description:document.getElementById('sh-desc').value||'',
    reviews:(function(){ try{ var el=document.getElementById('sh-reviews'); return el?JSON.parse(el.value||'[]'):[];} catch(e){return[];}}()),
    googlePlaceId:(function(){ var el=document.getElementById('sh-place-id'); return el?el.value:'';})(),
    rating:(function(){ var el=document.getElementById('sh-rating'); return el?parseFloat(el.value)||5.0:5.0;})(),
    reviewCount:(function(){ var el=document.getElementById('sh-review-count'); return el?parseInt(el.value)||0:0;})(),
    photos:(function(){ try{ var el=document.getElementById('sh-photos'); return el?JSON.parse(el.value||'[]'):[];} catch(e){return[];}}())
  })}).then(function(r){return r.json();}).then(function(res){
    var newShopId = res.id || null;
    // 폼 초기화
    var gepEl = document.getElementById('sh-gmap-embed'); if(gepEl){ gepEl.value=''; }
    var gepPrev = document.getElementById('sh-gmap-embed-preview'); if(gepPrev) gepPrev.style.display='none';
    ['sh-name','sh-loc','sh-addr','sh-desc','sh-gmap-raw'].forEach(function(id){
      var el = document.getElementById(id);
      if(el){ el.value=''; el.removeAttribute('data-gmap-url'); }
    });
    document.getElementById('sh-gmap-status').textContent='';
    document.getElementById('svc-list').innerHTML='';
    document.getElementById('vid-list').innerHTML='';
    addSvcRow();
    btn.disabled = false;
    btn.textContent = '업체 등록 완료';
    // 영상 순차 등록
    if(newShopId && pendingVids.length > 0){
      var chain = Promise.resolve();
      pendingVids.forEach(function(v){
        chain = chain.then(function(){
          return fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            shopId:newShopId,
            title:v.title,
            videoUrl:v.videoUrl,
            description:v.description,
            thumbnail:'',
            tags:[],
            views:0, likes:0
          })});
        });
      });
      chain.then(loadAll);
    } else {
      loadAll();
    }
  }).catch(function(){
    btn.disabled = false;
    btn.textContent = '업체 등록 완료';
    alert('등록 중 오류가 발생했습니다.');
  });
}

// ── 영상 description AI 일괄 생성 ──
window.bulkGenVideoDesc = function bulkGenVideoDesc(force){
  var btn = document.getElementById(force ? 'bulk-desc-force-btn' : 'bulk-desc-btn');
  var status = document.getElementById('bulk-desc-status');
  if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (force ? '전체 재생성 중...' : '생성 중...'); }
  status.style.display = 'block';
  status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI가 description을 작성 중입니다. 잠시만 기다려주세요...';

  fetch('/api/videos/gen-description-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force: !!force })
  }).then(function(r){ return r.json(); }).then(function(res){
    if(btn){ btn.disabled = false; btn.innerHTML = force ? '<i class="fas fa-sync"></i> 전체 재생성' : '<i class="fas fa-magic"></i> 빈 description 일괄 생성'; }
    if(res.ok){
      if(res.updated === 0){
        status.innerHTML = '✅ 모든 영상에 이미 description이 있습니다!';
      } else {
        status.innerHTML = '✅ ' + res.updated + '개 영상 description 생성 완료!' + (res.failed ? ' (' + res.failed + '개 실패)' : '');
        loadAll();
      }
    } else {
      status.innerHTML = '❌ 오류: ' + (res.error || '알 수 없는 오류');
    }
  }).catch(function(){
    if(btn){ btn.disabled = false; btn.innerHTML = force ? '<i class="fas fa-sync"></i> 전체 재생성' : '<i class="fas fa-magic"></i> 빈 description 일괄 생성'; }
    status.innerHTML = '❌ 네트워크 오류가 발생했습니다.';
  });
};

// ── 영상 편집 패널에서 개별 AI description 생성 ──
window.genVideoDescSingle = function genVideoDescSingle(){
  if(!editingVideoId){ alert('수정할 영상을 먼저 선택해주세요!'); return; }
  var btn = document.getElementById('ve-ai-desc-btn');
  var statusEl = document.getElementById('ve-ai-status');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI가 description을 작성 중...';

  fetch('/api/videos/' + editingVideoId + '/gen-description', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(res){
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> AI 자동생성';
      if(res.ok && res.description){
        document.getElementById('ve-desc').value = res.description;
        statusEl.innerHTML = '✅ 생성 완료! 내용을 확인 후 저장하세요.';
        statusEl.style.color = '#4ade80';
      } else {
        statusEl.innerHTML = '❌ 생성 실패. 직접 입력해주세요.';
        statusEl.style.color = '#f87171';
      }
    }).catch(function(){
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> AI 자동생성';
      statusEl.innerHTML = '❌ 네트워크 오류.';
      statusEl.style.color = '#f87171';
    });
};

window.delShop = function delShop(id){
  if(!confirm('업체를 삭제하면 연결된 영상도 모두 사라집니다. 계속하시겠습니까?'))return;
  fetch('/api/shops/'+id,{method:'DELETE'}).then(loadAll);
}

// ── 구글 드라이브 URL 변환 ──
function convertGDriveUrl(url){
  var marker1 = 'drive.google.com/file/d/';
  var idx1 = url.indexOf(marker1);
  if(idx1 !== -1){
    var rest1 = url.slice(idx1 + marker1.length);
    var id1 = rest1.split('/')[0].split('?')[0];
    if(id1) return 'https://drive.google.com/uc?export=download&id=' + id1;
  }
  var marker2 = 'drive.google.com/open?id=';
  var idx2 = url.indexOf(marker2);
  if(idx2 !== -1){
    var id2 = url.slice(idx2 + marker2.length).split('&')[0];
    if(id2) return 'https://drive.google.com/uc?export=download&id=' + id2;
  }
  if(url.indexOf('drive.google.com/uc') !== -1) return url;
  return null;
}

function detectUrlType(url){
  if(!url) return null;
  if(url.indexOf('drive.google.com') !== -1) return 'gdrive';
  if(url.indexOf('r2.dev') !== -1 || url.indexOf('r2.cloudflarestorage') !== -1) return 'r2';
  var lower = url.toLowerCase().split('?')[0];
  if(lower.slice(-4)==='.mp4'||lower.slice(-5)==='.webm'||lower.slice(-4)==='.mov'||lower.slice(-4)==='.avi') return 'direct';
  if(url.indexOf('https://')===0 || url.indexOf('http://')===0) return 'url';
  return null;
}

function handleVideoUrlInput(raw){
  var badge = document.getElementById('vd-url-badge');
  var hint  = document.getElementById('vd-url-hint');
  var preview = document.getElementById('vd-url-preview');
  var input = document.getElementById('vd-url');
  if(!raw){ badge.style.display='none'; hint.style.display='none'; preview.style.display='none'; return; }
  var type = detectUrlType(raw);
  if(type === 'gdrive'){
    var converted = convertGDriveUrl(raw);
    if(converted){
      input.value = converted;
      badge.style.display='inline-block';
      badge.style.background='linear-gradient(135deg,#4285F4,#34A853)';
      badge.style.color='#fff';
      badge.textContent='구글 드라이브';
      hint.style.display='block';
      hint.textContent='✅ 구글 드라이브 링크 자동 변환 완료!';
      showVideoPreview(converted, preview);
      return;
    }
  }
  if(type === 'r2'){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#F6821F,#FAAD3D)';
    badge.style.color='#fff';
    badge.textContent='Cloudflare R2';
    hint.style.display='none';
    showVideoPreview(raw, preview);
    return;
  }
  if(type === 'direct'){
    badge.style.display='inline-block';
    badge.style.background='linear-gradient(135deg,#9B59B6,#8E44AD)';
    badge.style.color='#fff';
    badge.textContent='MP4 링크';
    hint.style.display='none';
    showVideoPreview(raw, preview);
    return;
  }
  badge.style.display='none';
  hint.style.display='none';
  preview.style.display='none';
}

function showVideoPreview(url, container){
  container.style.display='block';
  var wrap = document.createElement('div');
  var label = document.createElement('div');
  label.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);margin-bottom:4px';
  label.textContent = '▶ 미리보기';
  var vid = document.createElement('video');
  vid.src = url;
  vid.controls = true;
  vid.style.cssText = 'width:100%;max-height:160px;border-radius:10px;background:#000;display:block';
  vid.onerror = function(){
    var errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;font-size:12px;color:#f87171';
    errDiv.textContent = '⚠ 영상을 불러올 수 없습니다. URL을 확인해주세요.';
    while(container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(label.cloneNode(true));
    container.appendChild(errDiv);
  };
  wrap.appendChild(label);
  wrap.appendChild(vid);
  while(container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(wrap);
}

// ── 영상 등록 ──
window.addVideo = function addVideo(){
  if(!currentShopId){ alert('업체를 먼저 선택해주세요!'); return; }
  var title = document.getElementById('vd-title').value.trim();
  var url   = document.getElementById('vd-url').value.trim();
  if(!title){ alert('영상 제목을 입력해주세요!'); return; }
  if(!url){   alert('영상 URL을 입력해주세요!'); return; }
  var shop = shops.find(function(s){return s.id===currentShopId;})||{};
  var tags = document.getElementById('vd-tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean);
  var savedShopId = currentShopId; // 저장 후에도 유지
  var btn = document.getElementById('vd-submit-btn');
  if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> 등록 중...'; }
  fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    shopId:currentShopId,
    title:title, videoUrl:url,
    thumbnail:document.getElementById('vd-thumb').value || shop.thumbnail || '',
    description:document.getElementById('vd-desc').value||'',
    tags:tags
  })}).then(function(){
    closeVideoPanel();
    _shopExpanded[String(savedShopId)] = true; // 등록 후 해당 업체 아코디언 열어두기
    loadAll();
  }).finally(function(){
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="fas fa-plus-circle"></i> 영상 등록'; }
  });
}

window.delVideo = function delVideo(id){
  if(!confirm('이 영상을 삭제하시겠습니까?'))return;
  // 삭제 후에도 해당 업체 아코디언 열린 상태 유지
  var vid = videos.find(function(v){ return v.id===id; });
  if(vid) _shopExpanded[String(vid.shopId)] = true;
  fetch('/api/videos/'+id,{method:'DELETE'}).then(loadAll);
}

window.saveSettings = function saveSettings(){
  alert('저장되었습니다!');
}

/* ── Google Places 자동가져오기 (통합) ── */
window.fetchPlacesInfo = async function fetchPlacesInfo(prefix) {
  var nameEl   = document.getElementById(prefix + '-name');
  var locEl    = document.getElementById(prefix + '-loc');
  var statusEl = document.getElementById(prefix + '-places-status');
  var btnEl    = document.getElementById(prefix + '-places-btn');

  var shopName = nameEl ? nameEl.value.trim() : '';
  var location = locEl  ? locEl.value.trim()  : '';

  /* placeId가 이미 있으면 ID로 직접 조회 (더 정확) */
  var pidEl = document.getElementById(prefix + '-place-id');
  var existingPid = pidEl ? pidEl.value.trim() : '';

  if (!shopName && !existingPid) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">⚠️ 업체명을 먼저 입력하세요</span>';
    return;
  }

  if(statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#60a5fa"></i> <span style="color:#93c5fd"> 구글 Places에서 전체 정보 가져오는 중...</span>';
  if(btnEl) { btnEl.disabled = true; btnEl.style.opacity = '.6'; }

  try {
    var body;
    if(existingPid) {
      body = JSON.stringify({ placeId: existingPid });
    } else {
      var query = shopName + (location ? ' ' + location : '') + ' Seoul Korea';
      body = JSON.stringify({ query: query });
    }

    var res = await fetch('/api/places-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });
    var d = await res.json();

    if (d.error) {
      if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ ' + (d.error === 'No place found' ? '구글에서 업체를 찾을 수 없습니다. 업체명을 영문으로 바꿔 다시 시도해보세요.' : d.error) + '</span>';
      return;
    }

    /* 공통 헬퍼로 모든 필드 자동입력 */
    applyPlacesDataToForm(prefix, d);

    /* 상세 결과 카드 렌더 */
    if(statusEl) statusEl.innerHTML = buildPlacesResultCard(d, '');

  } catch(e) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ 오류: ' + e.message + '</span>';
  } finally {
    if(btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
  }
}

/* ── AI SEO 자동생성 ── */
window.genAiSeo = async function genAiSeo(prefix) {
  var nameEl   = document.getElementById(prefix + '-name');
  var locEl    = document.getElementById(prefix + '-loc');
  var catEl    = document.getElementById(prefix + '-cat');
  var descEl   = document.getElementById(prefix + '-desc');
  var statusEl = document.getElementById(prefix + '-ai-status');
  var btnEl    = document.getElementById(prefix + '-ai-btn');

  var name     = nameEl ? nameEl.value.trim() : '';
  var location = locEl  ? locEl.value.trim()  : '';
  var category = catEl  ? catEl.value         : '';

  if (!name) {
    if (statusEl) statusEl.textContent = '⚠️ 업체명을 먼저 입력하세요';
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...'; }
  if (statusEl) statusEl.textContent = 'AI is generating SEO description...';

  // 서비스 목록 수집
  var services = [];
  var svcInputs = document.querySelectorAll('[id^="' + (prefix==='sh'?'sh':'edit-sh') + '"] .svc-name-input, .svc-name-input');
  svcInputs.forEach(function(el){ if(el.value) services.push(el.value); });

  // 가격대, 영업시간 수집
  var priceRange = (document.getElementById(prefix + '-price') || {}).value || '';
  var hours      = (document.getElementById(prefix + '-hours') || {}).value || '';

  var catKeywords = {
    skincare:'Korean skincare, facial treatment, glass skin, K-beauty skincare, skin clinic Seoul',
    makeup:'Korean makeup artist, K-beauty makeup Seoul, Korean beauty look, makeup studio Seoul',
    hair:'Korean hair salon, K-pop hairstyle Seoul, hair coloring Seoul, balayage Korean salon',
    headspa:'head spa Seoul, Korean scalp treatment, scalp care Seoul, relaxing head massage Korea',
    nail:'Korean nail art Seoul, nail salon Seoul, K-pop nail design, gel nails Korea',
    clinic:'Korean dermatology Seoul, skin clinic Korea, laser treatment Seoul, aesthetic clinic Korea',
    spa:'Korean spa Seoul, body treatment Korea, Korean massage Seoul, relaxation spa Korea'
  };
  var keywords = catKeywords[category] || 'Korean beauty Seoul, K-beauty';
  var area = (location || 'Seoul').split(',')[0].trim();

  var NL = String.fromCharCode(10);
  var prompt = "You are an SEO expert for a Korean beauty booking platform for foreign tourists." + NL + NL
    + "Generate SEO content for this shop:" + NL
    + "- Name: " + name + NL
    + "- Area: " + area + ", Seoul" + NL
    + "- Category: " + category + NL
    + "- Services: " + (services.join(", ") || "beauty services") + NL
    + "- Keywords to include naturally: " + keywords + ", " + area + " " + category + " Seoul, best " + category + " " + area + NL + NL
    + "Rules:" + NL
    + "1. metaDescription: 140-155 chars, natural English, include shop name + area + category, end with Book via WhatsApp" + NL
    + "2. description: 2 sentences, 180-240 chars, SEO-friendly, English-friendly tone" + NL
    + "3. keywords: exactly 6 strings foreigners search on Google" + NL
    + "4. titleSuffix: short phrase like Gangnam Head Spa Seoul" + NL
    + "5. No quotes inside text, no markdown" + NL + NL
    + 'Return ONLY valid JSON: {"metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6"],"titleSuffix":"..."}';

  try {
    var aiRes = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _GSK_TOKEN },
      body: JSON.stringify({ model: 'claude-haiku-4-5', messages: [{ role: 'user', content: prompt }], max_tokens: 1200 })
    });
    if (!aiRes.ok) {
      var errBody = ''; try { errBody = await aiRes.text(); } catch(ex){}
      throw new Error('API 오류 (' + aiRes.status + ')' + (errBody ? ': ' + errBody.slice(0,120) : ''));
    }
    var aiData = await aiRes.json();
    if (aiData.error) throw new Error(aiData.error.message || JSON.stringify(aiData.error));
    var text = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || '';
    if (!text) throw new Error('AI 응답이 비어있습니다. 토큰을 확인해주세요.');

    /* JSON 추출 (마크다운 코드블록 포함 대응) */
    /* backtick이 template literal로 해석되지 않도록 RegExp 생성자 사용 */
    var reFenceStart = new RegExp('^' + String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96) + 'json[\\s]*');
    var reFenceEnd   = new RegExp(String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96) + '[\\s]*$');
    var cleaned = text.trim().replace(reFenceStart,'').replace(reFenceEnd,'');
    var jsonStart = cleaned.indexOf('{');
    if (jsonStart > 0) cleaned = cleaned.slice(jsonStart);
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 파싱 실패 — AI 응답: ' + text.slice(0,100));
    var data = JSON.parse(match[0]);

    if (descEl && data.description) {
      descEl.value = data.description;
      descEl.style.borderColor = 'rgba(124,58,237,.6)';
    }
    if (statusEl) {
      var kw = (data.keywords || []).slice(0,4).join(', ');
      var area2 = (location||'Seoul').split(',')[0].trim();
      statusEl.innerHTML = '<div style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);border-radius:9px;padding:8px 10px;margin-top:4px">'
        + '<div style="color:#a78bfa;font-weight:800;margin-bottom:4px"><i class="fas fa-magic"></i> SEO 생성 완료!</div>'
        + (data.titleSuffix ? '<div style="font-size:11px;color:rgba(255,255,255,.55);margin-bottom:3px">타이틀: <b style="color:rgba(255,255,255,.8)">'+data.titleSuffix+'</b></div>' : '')
        + '<div style="font-size:10px;color:rgba(255,255,255,.4);margin-bottom:3px">키워드: '+kw+'</div>'
        + '<div style="font-size:10px;color:rgba(74,222,128,.7);border-top:1px solid rgba(255,255,255,.08);padding-top:5px;margin-top:3px"><i class="fas fa-image" style="margin-right:3px"></i>이미지 alt 태그 자동 적용: <b style="color:rgba(74,222,128,.9)">'+name+' '+category+' Seoul — interior/treatment room/...</b></div>'
        + '</div>';
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ 실패: ' + e.message + '</span>';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fas fa-magic"></i> AI SEO 자동생성'; }
  }
}

loadAll();

/* ── 등록 폼 slug 미리보기 ── */
function updateSlugPreview() {
  var name = (document.getElementById('sh-name')||{}).value || '';
  var loc  = (document.getElementById('sh-loc')||{}).value  || '';
  // 클라이언트 slug 미리계산 (서버와 동일 로직)
  var base = '';
  for (var i=0; i<name.length; i++) {
    var ch = name[i].toLowerCase();
    base += (ch>='a'&&ch<='z')||(ch>='0'&&ch<='9') ? ch : '-';
  }
  base = base.replace(/-+/g,'-').replace(/^-|-$/g,'') || 'shop';
  var areaRaw = loc.split(',')[0].trim();
  var area = '';
  for (var j=0; j<areaRaw.length; j++) {
    var ac = areaRaw[j].toLowerCase();
    area += (ac>='a'&&ac<='z') ? ac : '-';
  }
  area = area.replace(/-+/g,'-').replace(/^-|-$/g,'');
  var slug = area ? base+'-'+area : base;

  var wrap = document.getElementById('sh-slug-preview');
  var val  = document.getElementById('sh-slug-preview-val');
  if (!name) { if(wrap) wrap.style.display='none'; return; }
  if (wrap) wrap.style.display='block';
  if (val)  val.textContent = '/shop/' + slug;
}

/* ── 전체 Slug 정리 ── */
window.fixAllSlugs = async function fixAllSlugs() {
  var btn = document.getElementById('fix-slugs-btn');
  var statusEl = document.getElementById('regen-status');
  var resultsEl = document.getElementById('regen-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Slug 정리 중...'; }
  if (statusEl) statusEl.textContent = '⏳ 업체명+지역명 기반으로 Slug 재생성 중...';
  if (resultsEl) resultsEl.innerHTML = '';
  try {
    var res = await fetch('/api/admin/fix-slugs', { method: 'POST', headers: { 'Authorization': 'Bearer ' + _GSK_TOKEN } });
    var data = await res.json();
    if (statusEl) statusEl.innerHTML = '<span style="color:#fbbf24">✅ 완료! ' + data.updated + '개 Slug 업데이트</span>';
    if (resultsEl && data.results) {
      resultsEl.innerHTML = data.results.map(function(r) {
        return '<div style="font-size:11px;padding:3px 0;color:#fbbf24">'
          + '🔗 <b>' + r.name + '</b><br>'
          + '&nbsp;&nbsp;이전: <span style="color:#6b7280">' + r.old + '</span><br>'
          + '&nbsp;&nbsp;변경: <span style="color:#10b981">' + r.new + '</span>'
          + '</div>';
      }).join('<div style="border-top:1px solid rgba(255,255,255,.05);margin:4px 0"></div>');
    }
    if (data.updated > 0) loadShops();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">❌ 오류: ' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> 전체 Slug 정리 (업체명-지역명)'; }
  }
}

/* ── 일괄 SEO 재생성 ── */
window.regenSeoAll = async function regenSeoAll(force) {
  var btn = document.getElementById(force ? 'regen-force-btn' : 'regen-btn');
  var statusEl = document.getElementById('regen-status');
  var resultsEl = document.getElementById('regen-results');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 처리 중...'; }
  if (statusEl) statusEl.textContent = force ? '⏳ 전체 업체 SEO 재생성 중...' : '⏳ SEO 미생성 업체 처리 중...';
  if (resultsEl) resultsEl.innerHTML = '';
  try {
    var url = '/api/admin/regenerate-seo-all' + (force ? '?force=true' : '');
    var res = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + _GSK_TOKEN } });
    var data = await res.json();
    if (statusEl) statusEl.innerHTML = '<span style="color:#10b981">✅ 완료! 총 ' + data.total + '개 업체 처리</span>';
    if (resultsEl && data.results) {
      resultsEl.innerHTML = data.results.map(function(r) {
        var color = r.status === 'updated' ? '#10b981' : r.status.startsWith('error') ? '#ef4444' : '#6b7280';
        return '<div style="font-size:11px;padding:3px 0;color:' + color + '">'
          + (r.status === 'updated' ? '✅' : r.status.startsWith('error') ? '❌' : '⏭️')
          + ' ' + r.name + ' — ' + r.status + '</div>';
      }).join('');
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#ef4444">❌ 오류: ' + e.message + '</span>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = force ? '<i class="fas fa-sync"></i> 전체 업체 SEO 강제 재생성' : '<i class="fas fa-magic"></i> SEO 미생성 업체 일괄 생성'; }
  }
}

}); // DOMContentLoaded
</script>
</body>
</html>`
