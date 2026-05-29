import { Hono } from 'hono'
import { neon } from '@neondatabase/serverless'

type Env = { GENSPARK_TOKEN: string; GSK_TOKEN: string }

const GOOGLE_PLACES_KEY = 'AIzaSyCcM03wGoZrSkmCMOS-Vib-JR1oKNPsSkY'

const DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
const getDb = () => neon(DB_URL)

const app = new Hono<{ Bindings: Env }>()



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
    thumbnail: r.thumbnail || '', photos: r.photos || [],
    commission: r.commission || 15,
    active: r.active !== false, createdAt: r.created_at || '',
    reviews: (() => { if(!r.reviews) return []; if(Array.isArray(r.reviews)) return r.reviews; try { return JSON.parse(r.reviews) } catch { return [] } })(),
    googlePlaceId: r.google_place_id || '',
    metaDescription: r.meta_description || '',
    seoKeywords: r.seo_keywords || '',
    menuItems: (() => { if(!r.menu_items) return []; if(Array.isArray(r.menu_items)) return r.menu_items; try { return JSON.parse(r.menu_items) } catch { return [] } })()
  }
}
function rowToVideo(r: any): Video {
  return {
    id: String(r.id), shopId: String(r.shop_id), title: r.title || '',
    description: r.description || '', videoUrl: r.video_url || '',
    thumbnail: r.thumbnail || '', tags: r.tags || [],
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
async function initDb() {
  const sql = getDb()
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
async function ensureDb() {
  if (_dbInited) return
  _dbInited = true
  await initDb()
}

// ── favicon.ico 404 방지 ──
app.get('/favicon.ico', (c) => c.body(null, 204))

// ── API ──
app.get('/api/videos', async (c) => {
  await ensureDb()
  const sql = getDb()
  const cat = c.req.query('category')
  const rows = cat && cat !== 'all'
    ? await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.category=${cat} ORDER BY RANDOM()`
    : await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY RANDOM()`
  const result = rows.map((r: any) => ({
    ...rowToVideo(r),
    shop: { id: r.shop_id, name: r.shop_name, category: r.shop_cat, location: r.shop_location, thumbnail: r.shop_thumb }
  }))
  return c.json({ videos: result })
})

app.get('/api/shops', async (c) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM shops ORDER BY created_at DESC`
  return c.json({ shops: rows.map(rowToShop) })
})
app.get('/api/shops/:id', async (c) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM shops WHERE id=${c.req.param('id')}`
  if (!rows.length) return c.json({ error: 'Not found' }, 404)
  const vidRows = await sql`SELECT * FROM videos WHERE shop_id=${c.req.param('id')} ORDER BY created_at DESC`
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

    // ── /place/ 파싱 ──
    const placeIdx = resolved.indexOf('/place/')
    if (placeIdx !== -1) {
      // 업체명 추출
      const afterPlace = resolved.slice(placeIdx + 7)
      const rawName = afterPlace.split('/')[0].split('?')[0].split('@')[0]
      let shopName = ''
      try { shopName = decodeURIComponent(rawName.split('+').join(' ')).trim() } catch { shopName = rawName.trim() }

      // 좌표 추출 시도
      const coords = extractCoords(resolved)
      if (coords) {
        const geo = await reverseGeocode(coords.lat, coords.lon)
        if (geo) {
          return c.json({ name: shopName, address: geo.address, location: geo.location, lat: coords.lat, lng: coords.lon })
        }
      }

      // 좌표 없음 → 업체명만 반환 (주소는 비워둠)
      return c.json({ name: shopName, address: '', location: findArea(shopName), lat: '', lng: '' })
    }

    // ── ?q= 파싱 ──
    const qMatch = resolved.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      let qVal = ''
      try { qVal = decodeURIComponent(qMatch[1].split('+').join(' ')) } catch { qVal = qMatch[1] }
      // 좌표값이면 역지오코딩
      const coordsFromQ = extractCoords(resolved)
      if (coordsFromQ) {
        const geo = await reverseGeocode(coordsFromQ.lat, coordsFromQ.lon)
        if (geo) return c.json({ name: '', address: geo.address, location: geo.location, lat: coordsFromQ.lat, lng: coordsFromQ.lon })
      }
      return c.json({ name: '', address: qVal, location: findArea(qVal), lat: '', lng: '' })
    }

    // ── 좌표만 있는 경우 ──
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

// ── AI SEO 자동생성 헬퍼 (등록/수정 시 공통 사용) ──
async function autoGenSeo(body: any, apiKey: string): Promise<{description:string, metaDescription:string, keywords:string[], titleSuffix:string} | null> {
  if (!apiKey || !body.name) return null
  try {
    const catKeywords: Record<string,string> = {
      skincare: 'Korean skincare Seoul, facial treatment Seoul, glass skin Seoul, K-beauty facial, skin clinic Seoul foreigners',
      makeup:   'Korean makeup Seoul, K-beauty makeup artist, Korean beauty look, makeup studio Seoul foreigners',
      hair:     'Korean hair salon Seoul, K-pop hairstyle Seoul, hair coloring Seoul foreigners, balayage Seoul',
      headspa:  'head spa Seoul, Korean head spa foreigners, scalp treatment Seoul, Korean scalp massage',
      nail:     'Korean nail art Seoul, nail salon Seoul foreigners, K-pop nail design, gel nails Seoul English',
      clinic:   'Korean dermatology Seoul, skin clinic Seoul foreigners, laser treatment Seoul, aesthetic clinic Korea',
      spa:      'Korean spa Seoul, body treatment Seoul foreigners, Korean massage Seoul, relaxation spa Seoul English',
    }
    const area = (body.location || 'Seoul').split(',')[0].trim()
    const catKeyword = catKeywords[body.category] || 'Korean beauty Seoul, K-beauty'
    const serviceList = Array.isArray(body.services) ? body.services.join(', ') : (body.services || 'beauty services')
    const brandVariants = `${body.name} Seoul, ${body.name} ${body.category}, ${body.name} booking, ${body.name} review, ${body.name} foreigner, ${body.name} English, ${body.name} price`
    const ratingInfo = body.rating ? `- Google Rating: ${body.rating}/5 (${body.reviewCount||0} reviews)` : ''

    const prompt = `You are an SEO expert for a Korean beauty booking platform targeting foreign tourists in Seoul.

The shop "${body.name}" is a real ${body.category} salon in ${area}, Seoul.
Create SEO content capturing BOTH brand searches (people who know "${body.name}") AND generic searches (foreigners looking for ${body.category} in Seoul).

Shop details:
- Name: ${body.name}
- Area: ${area}, Seoul
- Category: ${body.category}
- Services: ${serviceList}
- Price Range: ${body.priceRange || 'contact for pricing'}
${ratingInfo}
- Brand variants: ${brandVariants}
- Category keywords: ${catKeyword}

Rules:
1. titleSuffix: max 40 chars, format "${body.name} | ${area} ${body.category} Seoul"
2. metaDescription: 140-155 chars, start with "${body.name}", include area + category + English-friendly + Book via WhatsApp
3. description: 2-3 sentences (180-240 chars), mention shop name, area, what makes it special for foreigners
4. keywords: exactly 8 strings — 4 brand keywords (${body.name} Seoul, ${body.name} booking, ${body.name} review, ${body.name} foreigners) + 4 generic (best ${body.category} ${area} Seoul, ${body.category} Seoul English, ${body.category} Seoul foreigners, Korean ${body.category} Seoul)
5. No quotes or markdown inside values

Return ONLY valid JSON:
{"titleSuffix":"...","metaDescription":"...","description":"...","keywords":["k1","k2","k3","k4","k5","k6","k7","k8"]}`

    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-5-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1000 })
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const text = data.choices?.[0]?.message?.content || ''
    const cleaned = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return null
    return JSON.parse(m[0])
  } catch { return null }
}

app.post('/api/shops', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  const newId = 's' + Date.now()
  const today = new Date().toISOString().split('T')[0]

  // description 없으면 AI SEO 자동 생성
  let description = body.description || ''
  let metaDescription = body.metaDescription || ''
  let seoKeywords = body.seoKeywords || ''
  if (!description) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || ''
    const seo = await autoGenSeo(body, apiKey)
    if (seo) {
      description = seo.description || ''
      metaDescription = seo.metaDescription || ''
      seoKeywords = Array.isArray(seo.keywords) ? seo.keywords.join(', ') : ''
    }
  }

  await sql`INSERT INTO shops (id,name,slug,category,location,address,google_map_url,google_map_embed,lat,lng,price_range,hours,services,service_prices,description,meta_description,seo_keywords,rating,review_count,thumbnail,photos,commission,active,created_at) VALUES (
    ${newId},${body.name||''},${body.slug||''},${body.category||''},${body.location||''},${body.address||''},
    ${body.googleMapUrl||''},${body.googleMapEmbed||''},${body.lat||''},${body.lng||''},
    ${body.priceRange||''},${body.hours||''},
    ${JSON.stringify(body.services||[])},${JSON.stringify(body.servicePrices||[])},
    ${description},${metaDescription},${seoKeywords},
    ${body.rating||5.0},${body.reviewCount||0},${body.thumbnail||''},
    ${JSON.stringify(body.photos||[])},${body.commission||15},true,${today}
  ) ON CONFLICT DO NOTHING`
  return c.json({ ok: true, id: newId, seoGenerated: !body.description })
})

app.put('/api/shops/:id', async (c) => {
  const sql = getDb()
  const body = await c.req.json()

  // description이 변경됐거나 없으면 AI SEO 재생성
  let description = body.description || ''
  let metaDescription = body.metaDescription || ''
  let seoKeywords = body.seoKeywords || ''
  if (!description || body.regenerateSeo) {
    const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || ''
    const seo = await autoGenSeo(body, apiKey)
    if (seo) {
      description = description || seo.description || ''
      metaDescription = metaDescription || seo.metaDescription || ''
      seoKeywords = seoKeywords || (Array.isArray(seo.keywords) ? seo.keywords.join(', ') : '')
    }
  }

  await sql`UPDATE shops SET
    name=${body.name||''},
    slug=${body.slug||''},
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
    rating=${body.rating||5.0},
    review_count=${body.reviewCount||0},
    thumbnail=${body.thumbnail||''},
    photos=${JSON.stringify(body.photos||[])},
    commission=${body.commission||15},
    active=${body.active!==false},
    reviews=${JSON.stringify(body.reviews||[])},
    google_place_id=${body.googlePlaceId||''},
    menu_items=${JSON.stringify(body.menuItems||[])}
    WHERE id=${c.req.param('id')}`
  return c.json({ ok: true, seoGenerated: !body.description || !!body.regenerateSeo })
})
app.delete('/api/shops/:id', async (c) => {
  const sql = getDb()
  await sql`DELETE FROM shops WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.post('/api/videos', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  const newId = 'v' + Date.now()
  const today = new Date().toISOString().split('T')[0]
  await sql`INSERT INTO videos (id,shop_id,title,description,video_url,thumbnail,tags,views,likes,created_at) VALUES (
    ${newId},${body.shopId||''},${body.title||''},${body.description||''},${body.videoUrl||''},
    ${body.thumbnail||''},${JSON.stringify(body.tags||[])},0,0,${today}
  )`
  return c.json({ ok: true, id: newId })
})
app.delete('/api/videos/:id', async (c) => {
  const sql = getDb()
  await sql`DELETE FROM videos WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})
app.put('/api/videos/:id', async (c) => {
  const sql = getDb()
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
  const sql = getDb()
  await sql`UPDATE videos SET views=views+1 WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.get('/api/bookings', async (c) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM bookings ORDER BY created_at DESC`
  return c.json({ bookings: rows.map(rowToBooking) })
})
app.post('/api/bookings', async (c) => {
  const sql = getDb()
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
  const sql = getDb()
  const { status } = await c.req.json()
  await sql`UPDATE bookings SET status=${status} WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
})

app.get('/api/stats', async (c) => {
  const sql = getDb()
  const [vStats] = await sql`SELECT COALESCE(SUM(views),0) as total_views, COUNT(*) as total FROM videos`
  const [bStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='new') as new_cnt, COUNT(*) FILTER (WHERE status='confirmed') as confirmed_cnt, COUNT(*) FILTER (WHERE status='contacted') as contacted_cnt FROM bookings`
  const [sStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE active=true) as active_cnt FROM shops`
  const topRows = await sql`SELECT v.*, s.name as shop_name FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY v.views DESC LIMIT 5`
  // 카테고리별 업체 수
  const catRows = await sql`SELECT category, COUNT(*) as cnt FROM shops WHERE active=true GROUP BY category ORDER BY cnt DESC`
  // 업체별 총 조회수 TOP5
  const shopViewRows = await sql`SELECT s.name, s.category, COALESCE(SUM(v.views),0) as total_views FROM shops s LEFT JOIN videos v ON v.shop_id=s.id GROUP BY s.id, s.name, s.category ORDER BY total_views DESC LIMIT 5`
  // 최근 7일 예약 (날짜별)
  const recentBookings = await sql`SELECT DATE(created_at) as day, COUNT(*) as cnt FROM bookings WHERE created_at >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`
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

    const OPENAI_KEY = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || ''
    if (!OPENAI_KEY) return c.json({ error: 'API key not configured' }, 500)
    const res = await fetch('https://www.genspark.ai/api/llm_proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5',
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

// ── Google Places API 자동가져오기 ──
app.post('/api/places-fetch', async (c) => {
  try {
    const { query } = await c.req.json() as { query: string }
    if (!query) return c.json({ error: 'query required' }, 400)

    // 1. Text Search — languageCode:'en' 으로 영문 정보 직접 취득
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.addressComponents,places.regularOpeningHours,places.rating,places.userRatingCount,places.reviews,places.priceLevel,places.photos,places.websiteUri,places.internationalPhoneNumber'
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en' })
    })
    if (!searchRes.ok) {
      const err = await searchRes.text()
      return c.json({ error: 'Places API error', detail: err }, 500)
    }
    const searchData: any = await searchRes.json()
    const place = searchData.places?.[0]
    if (!place) return c.json({ error: 'No place found' }, 404)

    // 2. 영문 주소 정제
    // formattedAddress가 영문이면 그대로, 한국어가 섞이면 addressComponents로 재조합
    const rawAddr: string = place.formattedAddress || ''
    const hasKorean = /[\uAC00-\uD7A3]/.test(rawAddr)
    let engAddress = rawAddr

    if (hasKorean) {
      // addressComponents에서 영문(long_name) 으로 재조합
      const comps: any[] = place.addressComponents || []
      // 필요한 타입만 추려서 영문으로 조합: subpremise > premise > sublocality_level_1 > locality > administrative_area_level_1
      const pick = (types: string[]) => {
        const c = comps.find((x: any) => types.some((t: string) => x.types?.includes(t)))
        return c?.languageCode === 'ko' ? (c?.longText || '') : (c?.longText || '')
      }
      const parts = [
        pick(['subpremise']),
        pick(['premise', 'point_of_interest', 'establishment']),
        pick(['sublocality_level_4', 'sublocality_level_3', 'sublocality_level_2', 'sublocality_level_1']),
        pick(['locality', 'administrative_area_level_2']),
        pick(['administrative_area_level_1']),
        'South Korea'
      ].filter(Boolean)
      engAddress = parts.length > 1 ? parts.join(', ') : rawAddr
      // 여전히 한국어 포함이면 place.shortFormattedAddress 시도
      if (/[\uAC00-\uD7A3]/.test(engAddress)) {
        engAddress = place.shortFormattedAddress || rawAddr
      }
    }

    // 3. 지역명 추출 (location 필드용: "Gangnam, Seoul" 형태)
    const comps: any[] = place.addressComponents || []
    const locality = comps.find((x: any) => x.types?.includes('sublocality_level_1') || x.types?.includes('locality'))
    const area = locality?.longText || ''
    const location = area ? `${area}, Seoul` : 'Seoul'

    // 4. 업체 영문명
    const engName: string = place.displayName?.text || ''

    // 5. 전화번호, 웹사이트
    const phone: string = place.internationalPhoneNumber || ''
    const website: string = place.websiteUri || ''

    // 6. 영업시간 (요일별 배열 — 영문)
    const weekdays: string[] = place.regularOpeningHours?.weekdayDescriptions || []
    const hoursStr = weekdays.join(' | ')

    // 7. 리뷰: 영어 우선, 부족하면 전체에서 보충 (최대 5개)
    const rawReviews: any[] = place.reviews || []
    const enReviews = rawReviews.filter((r: any) => r.text?.languageCode === 'en' && (r.text?.text?.length || 0) > 20)
    const otherReviews = rawReviews.filter((r: any) => r.text?.languageCode !== 'en' && (r.text?.text?.length || 0) > 20)
    const reviews = [...enReviews, ...otherReviews].slice(0, 5).map((r: any) => ({
      author: r.authorAttribution?.displayName || 'Guest',
      rating: r.rating || 5,
      text: r.text?.text || '',
      time: r.relativePublishTimeDescription || ''
    }))

    // 8. 사진 URL (최대 6장) — 상대경로 프록시
    const rawPhotos: any[] = place.photos || []
    const photos = rawPhotos.slice(0, 6).map((p: any) => {
      const name = encodeURIComponent(p.name || '')
      return `/api/photo?name=${name}`
    })

    return c.json({
      placeId:             place.id || '',
      name:                engName,
      address:             engAddress,
      location:            location,
      phone:               phone,
      website:             website,
      hours:               hoursStr,
      weekdayDescriptions: weekdays,
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
        'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
        'X-Goog-FieldMask': 'photos'
      }
    })
    if (!res.ok) return c.json({ error: 'Places API error' }, 500)
    const data: any = await res.json()
    const rawPhotos: any[] = data.photos || []
    const photos = rawPhotos.slice(0, 6).map((p: any) => {
      const name = encodeURIComponent(p.name || '')
      return `/api/photo?name=${name}`
    })
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
  const apiUrl = `https://places.googleapis.com/v1/${cleanName}/media?key=${GOOGLE_PLACES_KEY}&maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true`
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
// ── 일괄 SEO 재생성 API ──
// POST /api/admin/regenerate-seo-all
// → 모든 활성 업체 순회, description/metaDescription/seoKeywords 없는 것 자동 생성
// ══════════════════════════════════════════
app.post('/api/admin/regenerate-seo-all', async (c) => {
  const sql = getDb()
  const apiKey = c.env?.GSK_TOKEN || c.env?.GENSPARK_TOKEN || ''
  if (!apiKey) return c.json({ error: 'API key not configured' }, 500)

  // 쿼리파라미터: force=true 이면 이미 있는 것도 재생성
  const force = c.req.query('force') === 'true'

  let rows: any[] = []
  try {
    rows = force
      ? await sql`SELECT * FROM shops WHERE active=true ORDER BY created_at ASC`
      : await sql`SELECT * FROM shops WHERE active=true AND (description IS NULL OR description='' OR meta_description IS NULL OR meta_description='') ORDER BY created_at ASC`
  } catch(e: any) {
    return c.json({ error: e.message }, 500)
  }

  const results: {id:string, name:string, status:string}[] = []

  for (const row of rows) {
    const shop = rowToShop(row)
    try {
      const seo = await autoGenSeo({
        name: shop.name,
        category: shop.category,
        location: shop.location,
        services: shop.services,
        priceRange: shop.priceRange,
        rating: shop.rating,
        reviewCount: shop.reviewCount
      }, apiKey)
      if (!seo) { results.push({ id: shop.id, name: shop.name, status: 'skipped (api fail)' }); continue }

      await sql`UPDATE shops SET
        description   = ${seo.description   || shop.description},
        meta_description = ${seo.metaDescription || ''},
        seo_keywords  = ${Array.isArray(seo.keywords) ? seo.keywords.join(', ') : ''}
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

// ── SEO 업체 상세 페이지 ──
app.get('/shop/:slug', async (c) => {
  const sql = getDb()
  const shopRows = await sql`SELECT * FROM shops WHERE slug=${c.req.param('slug')}`
  if (!shopRows.length) return c.notFound()
  const shop = rowToShop(shopRows[0])
  const vidRows = await sql`SELECT * FROM videos WHERE shop_id=${shop.id} ORDER BY views DESC`
  const shopVideos = vidRows.map(rowToVideo)
  const shopArea = shop.location ? ` (${shop.location.split(',')[0].trim()})` : ''
  const waMsg = encodeURIComponent(`[ Booking Request ]\nShop: ${shop.name}${shopArea}\n\nDate: \nTime: \nService: \nName: \nPeople: `)
  const waUrl = `https://wa.me/${PLATFORM.whatsapp}?text=${waMsg}`
  const base = 'https://seoulbeautytrip.com'
  const canonicalUrl = `${base}/shop/${shop.slug}`
  const catEmoji: Record<string,string> = {skincare:'🌿',makeup:'💋',hair:'💇',headspa:'🧖',nail:'💅',clinic:'🏥'}
  const catIcon = catEmoji[shop.category] || '✨'
  return c.html(`<!DOCTYPE html>
<html lang="en" itemscope itemtype="https://schema.org/LocalBusiness">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${shop.name} | ${shop.location.split(',')[0].trim()} ${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)} Seoul | Seoul Beauty Trip</title>
<meta name="description" content="${(shop.metaDescription || shop.description || `${shop.name} is a top-rated ${shop.category} salon in ${shop.location.split(',')[0].trim()}, Seoul. English-friendly service. Book via WhatsApp.`).slice(0,155)}">
<meta name="keywords" content="${shop.seoKeywords || [shop.name, shop.name+' Seoul', shop.name+' '+shop.category, shop.name+' booking', shop.name+' review', shop.name+' foreigner', 'best '+shop.category+' '+shop.location.split(',')[0].trim()+' Seoul', shop.category+' Seoul foreigners', 'English speaking '+shop.category+' Seoul', 'Korean '+shop.category+' Seoul', ...shop.services.slice(0,3)].join(', ')}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">
<!-- Open Graph -->
<meta property="og:type" content="business.business">
<meta property="og:title" content="${shop.name} | Seoul Beauty Trip">
<meta property="og:description" content="${shop.description.slice(0,155)}">
<meta property="og:image" content="${shop.thumbnail}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${shop.name} | Seoul Beauty Trip">
<meta name="twitter:description" content="${shop.description.slice(0,155)}">
<meta name="twitter:image" content="${shop.thumbnail}">
<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":["LocalBusiness","BeautySalon"],
      "@id":"${canonicalUrl}",
      "name":"${shop.name}",
      "description":"${(shop.description||'').replace(/"/g,"'")}",
      "image":["${shop.thumbnail}"${shop.photos&&shop.photos.length?','+shop.photos.map((p:string)=>'"'+p+'"').join(','):''}],
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
      "keywords":"${shop.name}, ${shop.name} Seoul, ${shop.name} ${shop.category}, ${shop.name} booking, ${shop.name} review, ${shop.name} foreigners, best ${shop.category} ${shop.location.split(',')[0].trim()} Seoul, ${shop.category} Seoul English, ${shop.category} Seoul foreigners"
    },
    {
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"Seoul Beauty Trip","item":"${base}/"},
        {"@type":"ListItem","position":2,"name":"${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)}","item":"${base}/?cat=${shop.category}"},
        {"@type":"ListItem","position":3,"name":"${shop.name}","item":"${canonicalUrl}"}
      ]
    },
    {
      "@type":"FAQPage",
      "mainEntity":[
        {
          "@type":"Question",
          "name":"Does ${shop.name} have English-speaking staff?",
          "acceptedAnswer":{"@type":"Answer","text":"Yes, ${shop.name} in ${shop.location.split(',')[0].trim()}, Seoul is foreigner-friendly and supports English communication for bookings and consultations."}
        },
        {
          "@type":"Question",
          "name":"How do I book at ${shop.name}?",
          "acceptedAnswer":{"@type":"Answer","text":"You can book ${shop.name} easily via WhatsApp through Seoul Beauty Trip. We handle all communication in English for you."}
        },
        {
          "@type":"Question",
          "name":"What services does ${shop.name} offer?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.name} offers ${shop.services.slice(0,5).join(', ')}${shop.services.length>5?' and more':''} in ${shop.location.split(',')[0].trim()}, Seoul."}
        },
        {
          "@type":"Question",
          "name":"What are ${shop.name}'s opening hours?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.hours ? shop.hours.replace(/"/g,"'").split('|')[0].trim() : 'Please contact us for current opening hours.'}"}
        },
        {
          "@type":"Question",
          "name":"How much does ${shop.name} cost?",
          "acceptedAnswer":{"@type":"Answer","text":"${shop.priceRange ? 'Prices at '+shop.name+' start from '+shop.priceRange+'. Contact us via WhatsApp for exact pricing.' : 'Contact '+shop.name+' via WhatsApp through Seoul Beauty Trip for current pricing information.'}"}
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
      "name":"${shop.name} | ${shop.location.split(',')[0].trim()} ${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)} Seoul",
      "description":"${(shop.description||'').replace(/"/g,"'").slice(0,155)}",
      "inLanguage":"en",
      "isPartOf":{"@id":"${base}/#website"},
      "primaryImageOfPage":{"@type":"ImageObject","url":"${shop.thumbnail}"}
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
.sp-nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(8,8,14,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.sp-nav-logo{font-family:var(--ff-serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,#fff,var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.sp-nav-back{display:flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid var(--border);border-radius:20px;color:rgba(255,255,255,.6);font-size:12px;font-weight:600;text-decoration:none;transition:all .2s;background:rgba(255,255,255,.04)}
.sp-nav-back:hover{color:#fff;border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.07)}
/* HERO */
.sp-hero{position:relative;height:320px;overflow:hidden}
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
.sp-gallery{display:flex;gap:8px;overflow-x:auto;padding:16px 20px;scrollbar-width:none;background:var(--bg)}
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
/* CARDS */
.sp-card{background:var(--cd);border:1px solid var(--border);border-radius:18px;padding:20px;margin-bottom:14px}
.sp-card-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.sp-info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:rgba(255,255,255,.75);line-height:1.5}
.sp-info-row i{color:var(--pk2);width:16px;flex-shrink:0;margin-top:2px}
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
.sp-vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sp-vid-card{border-radius:14px;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16;background:#000}
.sp-vid-card img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.sp-vid-card:hover img{transform:scale(1.04)}
.sp-vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.85) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:12px 10px}
.sp-vid-card-title{font-size:11px;font-weight:700;line-height:1.3;color:#fff}
.sp-vid-views{font-size:10px;color:rgba(255,255,255,.55);margin-top:3px}
.sp-play-ic{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(232,65,122,.8);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
/* FLOAT BTN */
.sp-float{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100;white-space:nowrap}
.sp-float a{display:flex;align-items:center;gap:9px;padding:15px 36px;background:linear-gradient(135deg,#25D366,#0EA855);border-radius:30px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 28px rgba(37,211,102,.45)}
</style>
</head>
<body>
<nav class="sp-nav" itemscope itemtype="https://schema.org/SiteNavigationElement">
  <a href="/" class="sp-nav-logo" itemprop="url"><span itemprop="name">Seoul Beauty Trip</span></a>
  <a href="/" class="sp-nav-back"><i class="fas fa-arrow-left"></i> Back</a>
</nav>

<div class="sp-hero">
  <img class="sp-hero-img" src="${shop.thumbnail}" alt="${shop.name} — ${shop.location} ${shop.category}" itemprop="image">
  <div class="sp-hero-ov"></div>
  <div class="sp-hero-info">
    <div class="sp-cat-badge">${catIcon} ${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)} · ${shop.location.split(',')[0].trim()} Seoul</div>
    <h1 class="sp-title" itemprop="name">${shop.name}</h1>
    <div class="sp-loc"><i class="fas fa-map-marker-alt" style="color:var(--pk)"></i><span itemprop="addressLocality">${shop.location}, Seoul</span></div>
    <div class="sp-rating">
      <span class="sp-stars">★★★★★</span>
      <span class="sp-rating-num" itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
        <span itemprop="ratingValue">${shop.rating}</span> (<span itemprop="reviewCount">${shop.reviewCount}</span> reviews)
      </span>
    </div>
  </div>
</div>

${(()=>{const allP=[shop.thumbnail,...(shop.photos||[]).filter((p:string)=>p&&p!==shop.thumbnail)];if(allP.length<2)return '';const thumbs=allP.map((url:string,i:number)=>`<div class="sp-gthumb${i===0?' active':''}" onclick="setHero('${url}',this)"><img src="${url}" alt="${shop.name} photo ${i+1}" loading="lazy"></div>`).join('');return `<div class="sp-gallery">${thumbs}</div>`;})()}

<div class="sp-wrap">
  <div class="sp-actions">
    <a href="${waUrl}" target="_blank" rel="noopener" class="sp-wa">
      <i class="fab fa-whatsapp" style="font-size:19px"></i> WhatsApp Book
    </a>
  </div>

  <div class="sp-card">
    <div class="sp-card-title"><i class="fas fa-info-circle"></i> Shop Info</div>
    ${shop.hours?`<div class="sp-info-row"><i class="fas fa-clock"></i><span itemprop="openingHours">${shop.hours}</span></div>`:''}
    ${shop.priceRange?`<div class="sp-info-row"><i class="fas fa-tag"></i><span itemprop="priceRange">${shop.priceRange}</span></div>`:''}
    ${shop.address?`<div class="sp-info-row"><i class="fas fa-map-marker-alt"></i><span itemprop="address">${shop.address}</span></div>`:''}
    ${shop.description?`<div class="sp-info-row"><i class="fas fa-quote-left"></i><span itemprop="description">${shop.description}</span></div>`:''}
  </div>

  ${shop.servicePrices&&shop.servicePrices.length>0?`<div class="sp-card"><div class="sp-card-title"><i class="fas fa-list-ul"></i> Price List</div><div class="sp-price-list">${shop.servicePrices.map((p:any)=>`<div class="sp-price-item"><span class="sp-price-name">${p.name}</span><span class="sp-price-val">${p.price}</span></div>`).join('')}</div></div>`:''}

  ${shop.services&&shop.services.length>0?`<div class="sp-card"><div class="sp-card-title"><i class="fas fa-spa"></i> Services</div><div class="sp-svc-tags">${shop.services.map((s:string)=>`<span class="sp-svc-tag">${s}</span>`).join('')}</div></div>`:''}

  ${(()=>{
    const embedUrl = shop.googleMapEmbed
      || (shop.lat && shop.lng
        ? `https://maps.google.com/maps?q=${shop.lat},${shop.lng}&z=17&output=embed&hl=en`
        : '');
    return embedUrl
      ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-map"></i> Location</div><div class="sp-map"><iframe src="${embedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>`
      : shop.address ? `<div class="sp-card"><div class="sp-card-title"><i class="fas fa-map"></i> Location</div><div style="padding:12px;font-size:13px;color:rgba(0,0,0,.7)"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:6px"></i>${shop.address}</div></div>` : '';
  })()}

  ${shopVideos.length>0?`<div class="sp-card"><div class="sp-card-title"><i class="fas fa-play-circle"></i> Videos</div><div class="sp-vid-grid">${shopVideos.map((v:any)=>`<div class="sp-vid-card" onclick="window.location='/'"><img src="${v.thumbnail}" alt="${v.title}" loading="lazy"><div class="sp-play-ic"><i class="fas fa-play" style="font-size:14px;color:#fff;margin-left:2px"></i></div><div class="sp-vid-card-ov"><div class="sp-vid-card-title">${v.title}</div><div class="sp-vid-views"><i class="fas fa-eye"></i> ${v.views>=1000?(v.views/1000).toFixed(1)+'K':v.views}</div></div></div>`).join('')}</div></div>`:''}

  <div style="height:60px"></div>
</div>

<div class="sp-float">
  <a href="${waUrl}" target="_blank" rel="noopener">
    <i class="fab fa-whatsapp" style="font-size:20px"></i> Book via WhatsApp
  </a>
</div>

<script>
function setHero(url, el) {
  document.querySelector('.sp-hero-img').src = url;
  document.querySelectorAll('.sp-gthumb').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
}
</script>
</body>
</html>`)
})

// ══════════════════════════════════════════════════════
// ── /best/:category/:area  카테고리×지역 랜딩 페이지 ──
// ══════════════════════════════════════════════════════
const CATEGORY_LABELS: Record<string,string> = {
  skincare:'Skincare', makeup:'Makeup', hair:'Hair Salon',
  headspa:'Head Spa', nail:'Nail Salon', clinic:'Skin Clinic', spa:'Spa & Massage'
}
const AREA_LABELS: Record<string,string> = {
  gangnam:'Gangnam', hongdae:'Hongdae', itaewon:'Itaewon',
  myeongdong:'Myeongdong', sinchon:'Sinchon', mapo:'Mapo',
  jongno:'Jongno', dongdaemun:'Dongdaemun', insadong:'Insadong',
  apgujeong:'Apgujeong', yeouido:'Yeouido', seoul:'Seoul'
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
    {q:'Are Korean skin clinics good for foreigners?',a:'Yes, Seoul has world-class dermatology clinics with cutting-edge laser, RF, and injection treatments. Many clinics near Gangnam cater specifically to medical tourists.'},
    {q:'Do I need a prescription for skin treatments in Seoul?',a:'Most aesthetic treatments like laser, peels, and facials do not require prescriptions. Injectable treatments like Botox require a consultation with a licensed doctor.'},
    {q:'How much does a laser treatment cost in Seoul?',a:'Laser treatments in Seoul range from ₩100,000 to ₩500,000+ depending on the type and area treated. Korean clinics are often 30–50% cheaper than Western countries.'},
    {q:'Is it safe to get skin treatments in Seoul as a tourist?',a:'Yes, Seoul clinics follow strict safety standards. Consult with the clinic about your skin type, medications, and any conditions before treatment.'},
    {q:'What are popular clinic treatments among foreign tourists in Seoul?',a:'Laser toning, skin booster injections, chemical peels, RF lifting, and acne scar treatment are most popular among medical tourists visiting Seoul.'}
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
  ]
}
const DEFAULT_FAQ = [
  {q:'How do I book a beauty salon in Seoul as a foreigner?',a:'Seoul Beauty Trip makes it easy — browse shops, choose your service, and book via WhatsApp in English. No Korean language skills needed.'},
  {q:'Are these salons English-friendly?',a:'Yes, all salons listed on Seoul Beauty Trip are verified to support foreign visitors with English communication for bookings.'},
  {q:'How far in advance should I book?',a:'1–3 days in advance is recommended. Same-day bookings are sometimes available on weekdays.'},
  {q:'What payment methods are accepted?',a:'Most salons accept credit cards and cash (Korean Won). Some also accept international cards like Visa and Mastercard.'},
  {q:'Can I cancel or reschedule my booking?',a:'Yes. Contact us via WhatsApp and we will help reschedule or cancel depending on the salon\'s policy.'}
]

app.get('/best/:category/:area', async (c) => {
  const catSlug  = c.req.param('category').toLowerCase()
  const areaSlug = c.req.param('area').toLowerCase()
  const catLabel  = CATEGORY_LABELS[catSlug]
  const areaLabel = AREA_LABELS[areaSlug]
  // 유효하지 않은 카테고리/지역이면 404
  if (!catLabel || !areaLabel) return c.notFound()

  const sql = getDb()
  const base = 'https://seoulbeautytrip.com'
  const pageUrl = `${base}/best/${catSlug}/${areaSlug}`
  const areaForQuery = areaLabel  // DB location 컬럼 매칭용

  // 해당 카테고리+지역 업체 조회
  let shops: Shop[] = []
  try {
    const rows = areaSlug === 'seoul'
      ? await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} ORDER BY rating DESC, review_count DESC LIMIT 10`
      : await sql`SELECT * FROM shops WHERE active=true AND category=${catSlug} AND LOWER(location) LIKE ${('%'+areaLabel+'%').toLowerCase()} ORDER BY rating DESC, review_count DESC LIMIT 10`
    shops = rows.map(rowToShop)
  } catch(e) {}

  const faqList = CAT_FAQ[catSlug] || DEFAULT_FAQ
  const titleMain   = `Best ${catLabel} in ${areaLabel} Seoul for Foreigners`
  const metaDesc    = `Top-rated ${catLabel.toLowerCase()} salons in ${areaLabel}, Seoul. English-friendly, foreigner-approved. Book via WhatsApp — no Korean needed. Updated ${new Date().getFullYear()}.`
  const h1Text      = `Best ${catLabel} in ${areaLabel}, Seoul`
  const subText     = `Foreigner-Friendly | English Booking | Verified Reviews`
  const catEmoji: Record<string,string> = {skincare:'🌿',makeup:'💋',hair:'💇',headspa:'🧖',nail:'💅',clinic:'🏥',spa:'🛁'}
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
          'image':s.thumbnail,
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
        const desc = (s.metaDescription || s.description || '').slice(0,120)
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
      <div class="card-services">${s.services.slice(0,3).map(sv=>`<span class="svc-tag">${sv}</span>`).join('')}</div>
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
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titleMain} ${new Date().getFullYear()} | Seoul Beauty Trip</title>
<meta name="description" content="${metaDesc}">
<meta name="keywords" content="best ${catLabel.toLowerCase()} ${areaLabel} Seoul, ${catLabel.toLowerCase()} Seoul foreigners, ${catLabel.toLowerCase()} Seoul English, ${catLabel.toLowerCase()} ${areaLabel} tourists, foreigner friendly ${catLabel.toLowerCase()} Seoul, ${catLabel.toLowerCase()} Seoul booking, Korean ${catLabel.toLowerCase()} ${areaLabel}, ${catLabel.toLowerCase()} Seoul recommendation">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="${titleMain} | Seoul Beauty Trip">
<meta property="og:description" content="${metaDesc}">
<meta property="og:image" content="${shops[0]?.thumbnail || base+'/og-cover.jpg'}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="Seoul Beauty Trip">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleMain} | Seoul Beauty Trip">
<meta name="twitter:description" content="${metaDesc}">
<meta name="twitter:image" content="${shops[0]?.thumbnail || base+'/og-cover.jpg'}">
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
.intro-box{background:#fff;border-radius:16px;padding:24px;margin-bottom:8px;box-shadow:0 1px 8px rgba(0,0,0,.06);font-size:.9rem;line-height:1.8;color:#374151}
.intro-box strong{color:#e91e8c}
/* FOOTER */
.lp-footer{text-align:center;padding:32px 16px;font-size:.82rem;color:#999;border-top:1px solid #eee;margin-top:40px}
.lp-footer a{color:#e91e8c}
@media(max-width:520px){
  .card-link{flex-direction:column}
  .card-img-wrap{width:100%;min-width:unset;height:180px}
  .card-img-wrap img{min-height:180px}
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
    Looking for the <strong>best ${catLabel.toLowerCase()} in ${areaLabel}, Seoul</strong>? 
    Seoul Beauty Trip has curated the top foreigner-friendly ${catLabel.toLowerCase()} salons in ${areaLabel} — all verified, English-booking supported, and loved by international tourists. 
    Whether you're visiting Seoul for K-beauty experiences or living here, book your ${catLabel.toLowerCase()} appointment via WhatsApp in English with zero hassle.
  </div>
  <div class="section-title">${emoji} Top ${catLabel} Salons in ${areaLabel} <span style="font-size:.85rem;font-weight:400;color:#888">(${shops.length} listed)</span></div>
  ${shopCards}
  <div class="section-title">❓ FAQ — ${catLabel} in ${areaLabel} Seoul</div>
  <div>${faqHtml}</div>
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
  const sql = getDb()
  const rows = await sql`SELECT * FROM shops WHERE active=true ORDER BY rating DESC, created_at DESC`
  const shops = rows.map(rowToShop)
  const catColors: Record<string,string> = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa'}
  const catEmoji: Record<string,string> = {skincare:'🌿',makeup:'💋',hair:'💇',headspa:'🧖',nail:'💅',clinic:'🏥',spa:'🛁'}
  const cats = ['all','skincare','makeup','hair','headspa','nail','clinic','spa']
  const catLabels: Record<string,string> = {all:'All',skincare:'Skincare',makeup:'Makeup',hair:'Hair',headspa:'Head Spa',nail:'Nail',clinic:'Clinic',spa:'Spa'}

  const cardsHtml = shops.map(shop => {
    const col = catColors[shop.category] || '#aaa'
    const href = shop.slug ? `/shop/${shop.slug}` : '#'
    const emoji = catEmoji[shop.category] || '✨'
    return `<a class="sc-card" href="${href}" data-cat="${shop.category}">
      <div class="sc-card-img-wrap">
        <img class="sc-card-img" src="${shop.thumbnail||''}" alt="${shop.name}" loading="lazy" onerror="this.style.background='#1a1a2e'">
        <div class="sc-card-rating"><i class="fas fa-star" style="font-size:9px"></i> ${shop.rating}</div>
        <div class="sc-card-cat-badge" style="background:${col}22;color:${col};border-color:${col}44">${emoji} ${shop.category}</div>
      </div>
      <div class="sc-card-body">
        <div class="sc-card-name">${shop.name}</div>
        <div class="sc-card-loc"><i class="fas fa-map-marker-alt"></i>${(shop.location||'').split(',')[0]}</div>
        ${shop.priceRange ? `<div class="sc-card-price"><i class="fas fa-tag"></i>${shop.priceRange}</div>` : ''}
        ${shop.hours ? `<div class="sc-card-hours"><i class="far fa-clock"></i>${shop.hours.split('|')[0].trim()}</div>` : ''}
      </div>
    </a>`
  }).join('')

  const filterBtns = cats.map(cat =>
    `<button class="sc-flt${cat==='all'?' on':''}" data-cat="${cat}">${catLabels[cat]}</button>`
  ).join('')

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Catalog — All K-Beauty Shops | Seoul Beauty Trip</title>
<meta name="description" content="Browse all Korean beauty salons in Seoul. Skincare, hair, nail, makeup, head spa and clinic — all foreigner-friendly with English support.">
<link rel="canonical" href="https://seoulbeautytrip.com/shops">
<meta property="og:title" content="Seoul Beauty Catalog | Seoul Beauty Trip">
<meta property="og:description" content="Browse all Korean beauty salons in Seoul — foreigner-friendly with WhatsApp booking.">
<meta property="og:image" content="${shops[0]?.thumbnail||''}">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#E8417A;--pk2:#FF6B9D;--pk3:#FFB3CC;--gold:#C9A84C;--bg:#08080E;--bg2:#0F0F1A;--border:rgba(255,255,255,.07);--ff-serif:'Playfair Display',serif;--ff-sans:'Inter',sans-serif}
body{background:var(--bg);color:#fff;font-family:var(--ff-sans);min-height:100vh}
a{text-decoration:none;color:inherit}
/* 헤더 */
.sc-nav{position:sticky;top:0;z-index:100;background:rgba(8,8,14,.95);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);padding:12px 16px}
.sc-nav-row{display:flex;align-items:center;gap:12px;max-width:900px;margin:0 auto}
.sc-back{display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer;transition:color .18s;flex-shrink:0}
.sc-back:hover{color:#fff}
.sc-nav-title{font-family:var(--ff-serif);font-size:18px;font-weight:900;background:linear-gradient(100deg,#fff 30%,var(--pk3) 80%,var(--gold) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sc-nav-count{font-size:11px;color:rgba(255,255,255,.28);font-weight:600;margin-left:auto}
/* 검색 + 필터 */
.sc-controls{max-width:900px;margin:16px auto;padding:0 16px;display:flex;flex-direction:column;gap:10px}
.sc-search-wrap{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:10px 14px}
.sc-search-wrap:focus-within{border-color:rgba(232,65,122,.4);background:rgba(232,65,122,.04)}
.sc-search-wrap i{color:rgba(255,255,255,.28);font-size:13px;flex-shrink:0}
#scSearch{flex:1;background:none;border:none;outline:none;color:#fff;font-size:14px;font-family:var(--ff-sans)}
#scSearch::placeholder{color:rgba(255,255,255,.25)}
.sc-filters{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.sc-filters::-webkit-scrollbar{display:none}
.sc-flt{flex-shrink:0;padding:7px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:rgba(255,255,255,.45);font-size:11px;font-weight:700;cursor:pointer;transition:all .18s;white-space:nowrap;font-family:var(--ff-sans)}
.sc-flt.on{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff;box-shadow:0 2px 12px rgba(232,65,122,.35)}
/* 그리드 */
.sc-grid{max-width:900px;margin:0 auto;padding:4px 16px 60px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
@media(min-width:540px){.sc-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:768px){.sc-grid{grid-template-columns:repeat(4,1fr)}}
/* 카드 */
.sc-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;transition:all .22s;display:block}
.sc-card:hover{border-color:rgba(232,65,122,.4);transform:translateY(-3px);box-shadow:0 10px 28px rgba(232,65,122,.15)}
.sc-card-img-wrap{position:relative;overflow:hidden}
.sc-card-img{width:100%;height:130px;object-fit:cover;display:block;background:#1a1a2e;transition:transform .4s}
.sc-card:hover .sc-card-img{transform:scale(1.04)}
.sc-card-rating{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);border-radius:20px;padding:3px 8px;font-size:10px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:3px}
.sc-card-cat-badge{position:absolute;bottom:8px;left:8px;padding:3px 9px;border-radius:10px;border:1px solid;font-size:9px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;backdrop-filter:blur(8px)}
.sc-card-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:5px}
.sc-card-name{font-size:13px;font-weight:800;color:#fff;line-height:1.3}
.sc-card-loc,.sc-card-price,.sc-card-hours{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,.38)}
.sc-card-loc i{color:var(--pk);font-size:9px}
.sc-card-price i{color:var(--gold);font-size:9px}
.sc-card-price{color:rgba(201,168,76,.85)}
.sc-card-hours i{color:rgba(255,255,255,.3);font-size:9px}
/* 빈 상태 */
.sc-empty{grid-column:1/-1;text-align:center;padding:80px 20px;color:rgba(255,255,255,.2);font-size:14px}
.sc-empty i{font-size:40px;display:block;margin-bottom:12px;opacity:.3}
</style>
</head>
<body>
<nav class="sc-nav">
  <div class="sc-nav-row">
    <a href="/" class="sc-back"><i class="fas fa-arrow-left"></i> Back</a>
    <span class="sc-nav-title">Seoul Beauty</span>
    <span class="sc-nav-count" id="scCount">${shops.length} shops</span>
  </div>
</nav>

<div class="sc-controls">
  <div class="sc-search-wrap">
    <i class="fas fa-search"></i>
    <input id="scSearch" type="search" placeholder="Search shops, area or treatment..." autocomplete="off" oninput="filterShops()">
  </div>
  <div class="sc-filters" id="scFilters">
    ${filterBtns}
  </div>
</div>

<div class="sc-grid" id="scGrid">
  ${cardsHtml}
</div>

<script>
var _activeCat = 'all';
var _kw = '';
document.querySelectorAll('.sc-flt').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('.sc-flt').forEach(function(b){ b.classList.remove('on'); });
    btn.classList.add('on');
    _activeCat = btn.getAttribute('data-cat');
    filterShops();
  });
});
function filterShops(){
  _kw = (document.getElementById('scSearch').value||'').toLowerCase().trim();
  var cards = document.querySelectorAll('.sc-card');
  var visible = 0;
  cards.forEach(function(card){
    var cat = card.getAttribute('data-cat');
    var text = card.textContent.toLowerCase();
    var catOk = _activeCat === 'all' || cat === _activeCat;
    var kwOk = !_kw || text.indexOf(_kw) !== -1;
    var show = catOk && kwOk;
    card.style.display = show ? '' : 'none';
    if(show) visible++;
  });
  var empty = document.getElementById('sc-empty');
  if(!empty){
    empty = document.createElement('div');
    empty.id = 'sc-empty';
    empty.className = 'sc-empty';
    empty.innerHTML = '<i class="fas fa-search"></i>No shops found';
    document.getElementById('scGrid').appendChild(empty);
  }
  empty.style.display = visible === 0 ? '' : 'none';
  document.getElementById('scCount').textContent = visible + ' shop' + (visible!==1?'s':'');
}
</script>
</body>
</html>`)
})

// ── sitemap.xml ──
app.get('/sitemap.xml', async (c) => {
  const sql = getDb()
  let shopSlugs: string[] = []
  try {
    const rows = await sql`SELECT slug FROM shops WHERE active=true AND slug IS NOT NULL AND slug!=''`
    shopSlugs = rows.map((r: any) => r.slug).filter(Boolean)
  } catch(e) {}
  const base = 'https://seoulbeautytrip.com'
  const today = new Date().toISOString().split('T')[0]

  // 카테고리×지역 조합 — 모든 Best 랜딩 페이지
  const bestPages: string[] = []
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    for (const area of Object.keys(AREA_LABELS)) {
      bestPages.push(`<url><loc>${base}/best/${cat}/${area}</loc><changefreq>weekly</changefreq><priority>0.9</priority><lastmod>${today}</lastmod></url>`)
    }
  }

  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    ...bestPages,
    ...shopSlugs.map(slug =>
      `<url><loc>${base}/shop/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`
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
app.get('/', async (c) => {
  const sql = getDb()
  try {
    const vidRows = await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.active=true ORDER BY RANDOM()`
    const initVideos = vidRows.map((r: any) => ({
      id: r.id, shopId: r.shop_id, title: r.title, description: r.description,
      videoUrl: r.video_url, thumbnail: r.thumbnail, tags: r.tags || [],
      views: r.views, likes: r.likes, createdAt: r.created_at,
      shop: { id: r.shop_id, name: r.shop_name, category: r.shop_cat, location: r.shop_location, thumbnail: r.shop_thumb }
    }))
    // platform 테이블 대신 PLATFORM 상수 사용
    const initPlatform = { whatsapp: PLATFORM.whatsapp, name: PLATFORM.name, instagram: PLATFORM.instagram }
    // </script> 문자열이 JSON 안에 있으면 HTML 파서가 스크립트를 조기 종료 → 이스케이프 처리
    const safeJson = (obj: any) => JSON.stringify(obj).replace(/<\/script>/gi, '<\\/script>').replace(/<!--/g, '<\\!--')
    const inlineScript = `<script>window.__INIT_VIDEOS__=${safeJson(initVideos)};window.__INIT_PLATFORM__=${safeJson(initPlatform)};<\/script>`
    return c.html(MAIN_HTML.replace('__INLINE_DATA_PLACEHOLDER__', inlineScript))
  } catch(e: any) {
    console.error('[/ route error]', e?.message || e)
    return c.html(MAIN_HTML.replace('__INLINE_DATA_PLACEHOLDER__', ''))
  }
})
app.get('/admin', (c) => {
  const token = c.env?.GSK_TOKEN || ''
  const html = ADMIN_HTML.replace('__GSK_TOKEN__', token)
  return c.html(html)
})
export default app

// ════════════════════════════════════════════
const MAIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
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
<meta property="og:image" content="https://seoulbeautytrip.com/og-cover.jpg">
<meta property="og:url" content="https://seoulbeautytrip.com/">
<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@seoulbeautytrip">
<meta name="twitter:title" content="Seoul Beauty Trip — Book Korean Beauty in Seoul">
<meta name="twitter:description" content="Discover and book the best Korean beauty salons in Seoul. WhatsApp booking, foreign-friendly.">
<meta name="twitter:image" content="https://seoulbeautytrip.com/og-cover.jpg">
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
      "logo":"https://seoulbeautytrip.com/og-cover.jpg",
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
.bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
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
#muteBtn{position:fixed;top:16px;right:12px;transform:none;z-index:200;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);transition:all .2s}
#muteBtn:hover{background:rgba(232,65,122,.3);border-color:rgba(232,65,122,.5)}
/* ── PC 반응형 (768px~1199px) ── */
@media(min-width:768px) and (max-width:1199px){
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  #muteBtn{right:calc(50% - 210px - 56px)}
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
  #muteBtn{right:calc(50% - 210px - 56px)}
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
@keyframes msu{from{transform:translateY(100%);opacity:.6}to{transform:translateY(0);opacity:1}}
/* 핸들 */
.modal-handle-area{flex-shrink:0;padding:10px 20px 0;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:10px}
.mhdl{width:32px;height:3px;background:rgba(255,255,255,.12);border-radius:2px}
.modal-top-row{display:flex;align-items:center;justify-content:space-between;width:100%}
.modal-top-title{font-size:9px;color:rgba(255,255,255,.22);font-weight:700;letter-spacing:2.5px;text-transform:uppercase}
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
/* 사진 그리드 */
.m-photos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;border-radius:12px;overflow:hidden}
.m-photos-grid img{width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;transition:opacity .2s}
.m-photos-grid img:hover{opacity:.85}
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
.m-btns-row2{display:flex;gap:8px}
.m-btn-share{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:rgba(255,255,255,.7);font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;text-decoration:none}
.m-btn-share:hover{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2)}
.m-btn-page{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:12px;background:rgba(232,65,122,.08);border:1px solid rgba(232,65,122,.2);border-radius:14px;color:var(--pk2);font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;text-decoration:none}
.m-btn-page:hover{background:rgba(232,65,122,.15);border-color:rgba(232,65,122,.4);color:#fff}
/* \uac80\uc0c9 */
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
#search-overlay{display:none;position:fixed;inset:0;z-index:800;background:rgba(8,8,14,.96);backdrop-filter:blur(16px);flex-direction:column;padding-top:130px;overflow-y:auto}
#search-overlay.open{display:flex}
.so-header{padding:0 20px 16px;font-size:11px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:1.5px;text-transform:uppercase}
.so-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 16px 40px}
@media(min-width:480px){.so-grid{grid-template-columns:repeat(3,1fr)}}
.so-card{background:#13132a;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;cursor:pointer;transition:all .2s;text-decoration:none;display:block}
.so-card:hover{border-color:rgba(232,65,122,.4);transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,65,122,.12)}
.so-card-img{width:100%;height:90px;object-fit:cover;display:block;background:#1a1a2e}
.so-card-body{padding:9px 10px 11px}
.so-card-cat{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--pk);margin-bottom:3px}
.so-card-name{font-size:12px;font-weight:800;color:#fff;line-height:1.3;margin-bottom:3px}
.so-card-loc{font-size:10px;color:rgba(255,255,255,.38);display:flex;align-items:center;gap:3px}
.so-empty{padding:60px 20px;text-align:center;color:rgba(255,255,255,.25);font-size:14px}
/* \ud5e4\ub354\uc5d0 Catalog \ubc84\ud2bc */
.catalog-btn{display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.5);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;text-decoration:none;white-space:nowrap}
.catalog-btn:hover{background:rgba(232,65,122,.12);border-color:rgba(232,65,122,.3);color:rgba(255,255,255,.9)}
.catalog-btn i{font-size:10px}
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
      <a href="/shops" class="catalog-btn"><i class="fas fa-th-large"></i> Catalog</a>
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
    <button class="cat" data-cat="skincare"><i class="fas fa-leaf"></i> Skincare</button>
    <button class="cat" data-cat="makeup"><i class="fas fa-magic"></i> Makeup</button>
    <button class="cat" data-cat="hair"><i class="fas fa-cut"></i> Hair</button>
    <button class="cat" data-cat="headspa"><i class="fas fa-spa"></i> Head Spa</button>
    <button class="cat" data-cat="nail"><i class="fas fa-hand-sparkles"></i> Nail</button>
    <button class="cat" data-cat="clinic"><i class="fas fa-briefcase-medical"></i> Clinic</button>
    <button class="cat" data-cat="spa"><i class="fas fa-hot-tub"></i> Spa</button>
  </nav>
</header>

<!-- 검색 결과 오버레이 -->
<div id="search-overlay" role="dialog" aria-label="Search results">
  <div class="so-header" id="so-header">Results</div>
  <div class="so-grid" id="so-grid"></div>
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
      <div class="sp-subtitle" id="sp-count">Loading...</div>
    </div>
    <div class="sp-filter" id="sp-filter">
      <button class="sp-flt on" data-cat="all">All</button>
      <button class="sp-flt" data-cat="skincare">Skincare</button>
      <button class="sp-flt" data-cat="headspa">Head Spa</button>
      <button class="sp-flt" data-cat="hair">Hair</button>
      <button class="sp-flt" data-cat="nail">Nail</button>
      <button class="sp-flt" data-cat="clinic">Clinic</button>
      <button class="sp-flt" data-cat="makeup">Makeup</button>
      <button class="sp-flt" data-cat="spa">Spa</button>
    </div>
    <div class="sp-grid" id="sp-grid"></div>
  </aside>
</div>
<div id="toast" role="status" aria-live="polite"></div>

<!-- 관리자 비밀번호 모달 -->
<div id="adminModal" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);align-items:center;justify-content:center">
  <div style="background:var(--cd);border:1px solid rgba(232,65,122,.2);border-radius:20px;padding:28px 24px;width:280px;max-width:90vw;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">&#128274;</div>
    <div style="font-family:var(--ff-serif);font-size:15px;font-weight:700;margin-bottom:4px;background:linear-gradient(135deg,var(--pk),var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent">Admin Login</div>
    <div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:18px">Enter password to continue</div>
    <form onsubmit="checkAdminPw();return false;" autocomplete="off">
      <input type="text" name="username" style="display:none" autocomplete="username">
      <input id="adminPwInput" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.05);border:1.5px solid rgba(232,65,122,.2);border-radius:11px;color:#fff;font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:12px;font-family:var(--ff-sans)">
      <div style="display:flex;gap:8px">
        <button type="submit" style="flex:1;padding:11px;background:linear-gradient(135deg,var(--pk),#7C3AED);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Confirm</button>
        <button type="button" onclick="closeAdminModal()" style="flex:1;padding:11px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:11px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer">Cancel</button>
      </div>
    </form>
    <div id="adminPwErr" style="font-size:11px;color:#ef4444;margin-top:10px;display:none">&#10060; Incorrect password</div>
  </div>
</div>

<!-- 업체 정보 모달 -->
<div class="modal-bg" id="shopModal" role="dialog" aria-modal="true" aria-label="Shop information">
  <div class="modal" id="modalPanel">
    <div class="modal-handle-area" id="modalHandle">
      <div class="mhdl"></div>
      <div class="modal-top-row">
        <span class="modal-top-title">Shop Info</span>
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
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',headspa:'&#129496;',nail:'&#128133;',clinic:'&#127973;',spa:'&#129510;'};
var catFaIcons = {skincare:'fa-leaf',makeup:'fa-magic',hair:'fa-cut',headspa:'fa-spa',nail:'fa-hand-sparkles',clinic:'fa-briefcase-medical',spa:'fa-hot-tub'};

if(window.__INIT_PLATFORM__) { platform = window.__INIT_PLATFORM__; }
else { fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; }); }

/* ── 로딩 팁 ── */
var _ldTips = [
  '✨ Swipe up to explore more looks',
  '💄 Tap the shop name to book',
  '📍 Real shops in Seoul, Korea',
  '🌸 Curated K-beauty experiences',
  '💬 Contact via WhatsApp to reserve'
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

/* loading hide */
var _ldHidden = false;
function hideLd(){
  if(_ldHidden) return;
  _ldHidden = true;
  var ld = document.getElementById('ld');
  if(!ld) return;
  ld.style.opacity = '0';
  setTimeout(function(){ ld.style.display = 'none'; }, 600);
}

/* 카테고리 전환 스피너 */
function showCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.add('on'); }
function hideCatLoading(){ var el=document.getElementById('cat-loading'); if(el) el.classList.remove('on'); }

function loadVideos(cat) {
  // 첫 로드이고 cat='all'이면 SSR 인라인 데이터 즉시 사용 (fetch 생략)
  if((cat === 'all' || !cat) && window.__INIT_VIDEOS__ && window.__INIT_VIDEOS__.length) {
    vids = window.__INIT_VIDEOS__;
    window.__INIT_VIDEOS__ = null; // 한 번만 사용
    // Fisher-Yates shuffle
    for(var i=vids.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
    }
    renderFeed();
    hideLd();
    return;
  }
  // 카테고리 전환: 스켈레톤 + 스피너 표시
  var isCatSwitch = _ldHidden; // 스플래시 이미 숨겼으면 카테고리 전환
  if(isCatSwitch) {
    showSkeletonFeed();
    showCatLoading();
  }
  fetch('/api/videos?category='+(cat||'all'))
    .then(function(r){ return r.json(); })
    .then(function(d){
      vids = d.videos || [];
      // Fisher-Yates shuffle
      for(var i=vids.length-1;i>0;i--){
        var j=Math.floor(Math.random()*(i+1));
        var tmp=vids[i]; vids[i]=vids[j]; vids[j]=tmp;
      }
      hideCatLoading();
      renderFeed();
      hideLd();
    })
    .catch(function(){
      vids = [];
      hideCatLoading();
      renderFeed();
      hideLd();
    });
  setTimeout(function(){ hideLd(); hideCatLoading(); }, 5000);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
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
    return;
  }
  for(var i=0;i<vids.length;i++){
    var dot=document.createElement('div');
    dot.className='dot'+(i===0?' on':''); dot.id='dot'+i;
    dots.appendChild(dot);
  }
  for(var i=0;i<vids.length;i++){ buildSlide(vids[i],i); }
  setupObs();
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
  s.setAttribute('itemscope','');
  s.setAttribute('itemtype','https://schema.org/VideoObject');
  var tags = (v.tags||[]).map(function(t){return '<span class="vtag">'+esc(t)+'</span>';}).join('');
  var uploadDate = v.createdAt || new Date().toISOString().split('T')[0];
  // 썸네일: Cloudinary 저화질 WebP 자동 생성 (poster 빠른 표시용)
  var thumb = v.thumbnail || getAutoThumb(v.videoUrl) || '';
  // 첫번째 슬라이드는 eager load, 나머지는 lazy
  var imgLoading = idx === 0 ? 'eager' : 'lazy';
  var imgPriority = idx === 0 ? ' fetchpriority="high"' : '';

  s.innerHTML =
    '<meta itemprop="name" content="'+esc(v.title)+'">' +
    '<meta itemprop="description" content="'+esc(v.description)+'">' +
    '<meta itemprop="thumbnailUrl" content="'+esc(thumb)+'">' +
    '<meta itemprop="uploadDate" content="'+esc(uploadDate)+'">' +
    (thumb ? '<img class="bg-img" src="'+esc(thumb)+'" alt="'+esc(v.title)+'" loading="'+imgLoading+'" decoding="async"'+imgPriority+'>' : '<div class="bg-img" style="background:linear-gradient(135deg,#1a0a14 0%,#1c0e22 40%,#0f0816 100%)"></div>') +
    '<video id="vid'+idx+'" loop muted playsinline preload="none" poster="'+esc(thumb)+'" itemprop="contentUrl"></video>' +
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

      // ── 에러/멈춤 시 자동 재시도 ──
      ve.addEventListener('error', function(){
        hideBuf();
        // 1초 후 src 재세팅으로 재시도
        setTimeout(function(){
          if(ve.dataset.src && !ve.dataset.retried){
            ve.dataset.retried = '1';
            ve.src = ve.dataset.src;
            ve.load();
            ve.play().catch(function(){});
          }
        }, 1000);
      });

      // ── stalled 3초 지속 시 강제 load() ──
      var _stallTimer = null;
      ve.addEventListener('stalled', function(){
        clearTimeout(_stallTimer);
        _stallTimer = setTimeout(function(){
          if(ve.dataset.src && ve.networkState === 2 /* NETWORK_LOADING */){
            var t = ve.currentTime;
            ve.load();
            ve.currentTime = t;
            ve.play().catch(function(){});
          }
        }, 3000);
      });
      ve.addEventListener('playing', function(){ clearTimeout(_stallTimer); });
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
      openShopModal(vid.shopId||shopData.id);
    };

    var infoEl = s.querySelector('.info');
    if(infoEl) infoEl.addEventListener('click', function(e){ e.stopPropagation(); });

    fetch('/api/videos/'+vid.id+'/view', {method:'POST'}).catch(function(){});
  })(v, idx, shop);
}

function loadVidSrc(vid){
  if(vid && !vid.src && vid.dataset.src){
    vid.src = vid.dataset.src;
  }
}
function preloadNext(idx){
  // 다음 1개 슬라이드 src 미리 세팅 (preload="none"이라 네트워크 요청은 최소)
  var next = document.getElementById('vid'+(idx+1));
  if(next && !next.src && next.dataset.src){ next.src = next.dataset.src; }
}

function setupObs(){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var idx = parseInt(e.target.id.replace('sl',''));
      var vid = document.getElementById('vid'+idx);
      var bufIc = document.getElementById('bufic'+idx);
      document.querySelectorAll('.dot').forEach(function(d,i){ d.classList.toggle('on',i===idx); });

      if(e.isIntersecting){
        if(vid){
          // src 없으면 세팅 + 스피너 즉시 표시
          if(!vid.src && vid.dataset.src){
            if(bufIc) bufIc.style.display = 'flex';
            vid.src = vid.dataset.src;
          }
          vid.muted = isMuted;
          // canplay 후 재생 시도 (이미 준비됐으면 즉시)
          if(vid.readyState >= 3){
            vid.play().catch(function(){});
          } else {
            if(bufIc) bufIc.style.display = 'flex';
            vid.addEventListener('canplay', function onCp(){
              vid.removeEventListener('canplay', onCp);
              vid.play().catch(function(){});
            });
            vid.play().catch(function(){});
          }
          preloadNext(idx); // 다음 슬라이드 미리 로드
        }
      } else {
        if(vid){ vid.pause(); vid.currentTime = 0; }
        if(bufIc) bufIc.style.display = 'none';
      }
    });
  },{threshold: 0.6});

  document.querySelectorAll('.slide').forEach(function(s){ obs.observe(s); });

  // 첫 슬라이드 즉시 로드 + 재생
  var v0 = document.getElementById('vid0');
  if(v0){
    var buf0 = document.getElementById('bufic0');
    if(!v0.src && v0.dataset.src){
      if(buf0) buf0.style.display = 'flex';
      v0.src = v0.dataset.src;
    }
    v0.muted = true;
    v0.play().catch(function(){});
    preloadNext(0);
  }
  var dot0 = document.getElementById('dot0');
  if(dot0) dot0.classList.add('on');
}

function openShopModal(shopId) {
  if(!shopId) return;
  document.getElementById('modalHero').innerHTML = '';
  document.getElementById('modalBtns').innerHTML = '';
  document.getElementById('shopModal').classList.add('open');
  document.getElementById('modalScroll').scrollTop = 0;

  // 1) 캐시에 있으면 즉시 렌더 (스피너 없음)
  if(shopCache[shopId]) {
    renderShopModal(shopCache[shopId]);
    return;
  }

  // 2) vids 배열에서 shop 기본정보 찾아 스켈레톤 즉시 표시
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

  // 3) 상세 API fetch → 캐시 저장 후 렌더
  fetch('/api/shops/'+shopId).then(function(r){ return r.json(); }).then(function(d){
    var shop = d.shop;
    if(!shop){ document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">Shop information unavailable.</div>'; return; }
    shopCache[shopId] = shop;
    renderShopModal(shop);
  }).catch(function(){
    document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">An error occurred.</div>';
  });
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
      '<div class="m-hero">'
        +'<img class="m-hero-img" id="mHeroImg" src="'+esc(cdnImg(allPhotos[0],800,600))+'" alt="'+esc(shop.name)+'" loading="eager" fetchpriority="high" decoding="async">'
        +'<div class="m-hero-ov"></div>'
        +'<div class="m-hero-badge">'+(catIcons[shop.category]||'')+'&nbsp;'+esc((shop.category||'').toUpperCase())+'</div>'
      +'</div>';

    /* 히어로 바로 아래 전체 썸네일 스트립 (최대 6장) */
    if(allPhotos.length > 1) {
      var stripPhotos = allPhotos.slice(0, 6);
      var strips = stripPhotos.map(function(url, i){
        return '<div class="m-ts-thumb'+(i===0?' on':'')+'" data-photo-url="'+esc(cdnImg(url,800,600))+'" onclick="setMHero(this.dataset.photoUrl,this)">'
          +'<img src="'+esc(cdnImg(url,120,120))+'" alt="" loading="lazy" decoding="async" onerror="this.parentElement.remove()">'
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
      var rows = days.map(function(line) {
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
        +'<table class="m-hours-table">'+rows+'</table></div></div>';
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

  /* ── 가격 섹션 — 가격 있으면 테이블, 없으면 상담 안내 ── */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    // 가격 공개 업체 → Price List 테이블
    var rows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+esc(p.name||'')+'</span><span class="m-price-val">'+esc(p.price||'')+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-sec"><div class="m-sec-title"><i class="fas fa-won-sign" style="color:var(--gold);margin-right:4px"></i>Price List</div><div class="m-price-list">'+rows+'</div></div>';
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

  /* ── 구글맵 embed: lat/lng+place_id > embed > address 순으로 시도 ── */
  var embedSrc = shop.googleMapEmbed || '';
  // 1순위: lat/lng 좌표로 핀 표시 (z=17 근접 줌, API키 불필요)
  if(!embedSrc && shop.lat && shop.lng) {
    var mlat = parseFloat(shop.lat), mlng = parseFloat(shop.lng);
    embedSrc = 'https://maps.google.com/maps?q='+mlat+','+mlng+'&z=17&output=embed&hl=en';
  }
  // 2순위: URL에서 파싱
  if(!embedSrc && shop.googleMapUrl) {
    var q = '';
    var qm = shop.googleMapUrl.match(/[?&]q=([^&]+)/);
    if(qm) { try { q = decodeURIComponent(qm[1]); } catch(e3){ q = qm[1]; } }
    else {
      var latm = shop.googleMapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if(latm) q = latm[1]+','+latm[2];
    }
    if(!q && shop.address) q = shop.address;
    if(!q && shop.name)    q = shop.name + ' Seoul';
    if(q) embedSrc = 'https://www.google.com/maps?q='+encodeURIComponent(q)+'&output=embed&hl=en';
  }
  /* Location: embed URL 직접 표시 또는 주소 텍스트 */
  var mapHtml = '';
  if(embedSrc) {
    mapHtml = '<div class="m-sec"><div class="m-sec-title">Location</div>'
      +'<div class="m-map">'
        +'<iframe src="'+embedSrc+'" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0"></iframe>'
        +'<div class="m-map-cover"><i class="fas fa-map-marker-alt m-map-cover-icon"></i><span class="m-map-cover-txt">SeoulBeautyTrip</span></div>'
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

  /* ── 사진 그리드 제거 (상단 히어로+썸네일로 충분) ── */
  var photosGridHtml = '';

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
    + priceHtml
    + svcHtml
    + reviewsHtml
    + hoursHtml
    + mapHtml;

  /* ── 버튼 영역 ── */
  var shopSlug = shop.slug || '';
  var pageUrl = shopSlug ? '/shop/'+shopSlug : '';
  var shareSupported = !!navigator.share;

  var btn2Row = '<div class="m-btns-row2">';
  // Share 버튼 — data-* 속성으로 값 전달 (따옴표 충돌 방지)
  btn2Row += '<button class="m-btn-share" id="shareBtn" data-name="'+esc(shop.name||'')+'" data-url="'+esc(pageUrl)+'" onclick="shareShopBtn(this)">'
    +'<i class="fas fa-share-alt"></i> Share'
  +'</button>';
  // View Page 버튼 (slug 있을 때만)
  if(pageUrl) {
    btn2Row += '<a href="'+pageUrl+'" class="m-btn-page">'
      +'<i class="fas fa-external-link-alt"></i> View Page'
    +'</a>';
  }
  btn2Row += '</div>';

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
  var img = document.getElementById('mHeroImg');
  if(img) img.src = url;
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
  var bg = document.getElementById('shopModal');
  var panel = document.getElementById('modalPanel');
  panel.style.transition='transform .28s cubic-bezier(.32,1,.32,1)';
  panel.style.transform='translateY(100%)';
  setTimeout(function(){
    bg.classList.remove('open');
    panel.style.transition='';
    panel.style.transform='';
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

window.toggleMute=function(){
  isMuted=!isMuted;
  document.getElementById('muteBtn').innerHTML=isMuted?'<i class="fas fa-volume-mute"></i>':'<i class="fas fa-volume-up"></i>';
  document.querySelectorAll('video').forEach(function(v){v.muted=isMuted;});
};
function showToast(msg){
  var t=document.getElementById('toast');
  t.innerHTML=msg; t.classList.add('on');
  setTimeout(function(){t.classList.remove('on');},3000);
}

/* ── 검색 기능 ── */
var _searchOpen = false;
function toggleSearch(){
  _searchOpen = !_searchOpen;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  var overlay = document.getElementById('search-overlay');
  bar.classList.toggle('open', _searchOpen);
  btn.classList.toggle('on', _searchOpen);
  if(_searchOpen){
    setTimeout(function(){ var inp = document.getElementById('srchInput'); if(inp) inp.focus(); }, 340);
  } else {
    clearSearch();
    overlay.classList.remove('open');
  }
}
function onSearch(q){
  var clear = document.getElementById('srchClear');
  var overlay = document.getElementById('search-overlay');
  var grid = document.getElementById('so-grid');
  var header = document.getElementById('so-header');
  if(clear) clear.classList.toggle('on', q.length > 0);
  if(!q.trim()){
    overlay.classList.remove('open');
    return;
  }
  var kw = q.toLowerCase().trim();
  var results = allShopsData.filter(function(s){
    return (s.name||'').toLowerCase().indexOf(kw) !== -1
      || (s.category||'').toLowerCase().indexOf(kw) !== -1
      || (s.location||'').toLowerCase().indexOf(kw) !== -1
      || (s.description||'').toLowerCase().indexOf(kw) !== -1
      || (s.services||[]).some(function(sv){ return sv.toLowerCase().indexOf(kw) !== -1; });
  });
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa'};
  if(header) header.textContent = results.length + ' result' + (results.length!==1?'s':'') + ' for "' + q + '"';
  if(!results.length){
    grid.innerHTML = '<div class="so-empty" style="grid-column:1/-1"><i class="fas fa-search" style="font-size:32px;margin-bottom:12px;display:block;opacity:.3"></i>No shops found</div>';
  } else {
    grid.innerHTML = results.map(function(s){
      var col = catColors[s.category] || 'var(--pk)';
      var href = s.slug ? '/shop/'+s.slug : '#';
      var clickAttr = s.slug ? '' : ' onclick="event.preventDefault();closeSearch();openShopModal(\''+s.id+'\')"';
      return '<a class="so-card" href="'+href+'"'+clickAttr+'>'
        +'<img class="so-card-img" src="'+(s.thumbnail||'')+'" alt="'+esc(s.name)+'" loading="lazy" onerror="this.style.background=&quot;#1a1a2e&quot;">'
        +'<div class="so-card-body">'
          +'<div class="so-card-cat" style="color:'+col+'">'+esc(s.category)+'</div>'
          +'<div class="so-card-name">'+esc(s.name)+'</div>'
          +'<div class="so-card-loc"><i class="fas fa-map-marker-alt" style="font-size:8px;color:var(--pk)"></i>'+esc((s.location||'').split(',')[0])+'</div>'
        +'</div>'
      +'</a>';
    }).join('');
  }
  overlay.classList.add('open');
}
function clearSearch(){
  var inp = document.getElementById('srchInput');
  var clear = document.getElementById('srchClear');
  var overlay = document.getElementById('search-overlay');
  if(inp) inp.value = '';
  if(clear) clear.classList.remove('on');
  if(overlay) overlay.classList.remove('open');
}
function closeSearch(){
  _searchOpen = false;
  var bar = document.getElementById('search-bar');
  var btn = document.getElementById('srchToggle');
  bar.classList.remove('open');
  btn.classList.remove('on');
  clearSearch();
}
// ESC 키로 검색 닫기
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeSearch();
});
window.addEventListener('load', function(){
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

  window.showAdminModal = function(){
    var m = document.getElementById('adminModal');
    m.style.display = 'flex';
    var inp = document.getElementById('adminPwInput');
    inp.value = '';
    document.getElementById('adminPwErr').style.display = 'none';
    setTimeout(function(){ inp.focus(); }, 150);
  };
  window.closeAdminModal = function(){
    document.getElementById('adminModal').style.display = 'none';
  };
  window.checkAdminPw = function(){
    var pw = document.getElementById('adminPwInput').value;
    if(pw === ADMIN_PW){
      window.location.href = '/admin';
    } else {
      document.getElementById('adminPwErr').style.display = 'block';
      var inp = document.getElementById('adminPwInput');
      inp.value = '';
      inp.style.borderColor = '#ef4444';
      setTimeout(function(){ inp.style.borderColor = 'rgba(232,65,122,.2)'; }, 1200);
    }
  };
  document.getElementById('adminModal').addEventListener('click', function(e){
    if(e.target === this) window.closeAdminModal();
  });

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
  var catColors = {skincare:'#f472b6',headspa:'#67e8f9',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',makeup:'#c084fc',spa:'#a78bfa'};
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
      ? 'onclick="location.href=\'/shop/'+s.slug+'\'"'
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

</body>
</html>`

// ════════════════════════════════════════════
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Trip - Admin</title>
<script>var _GSK_TOKEN = '__GSK_TOKEN__';</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30;--green:#10b981;--yellow:#f59e0b;--red:#ef4444;--blue:#3b82f6}
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
</style>
</head>
<body>
<nav class="nav">
  <div class="nav-logo">&#10024; Seoul Beauty Trip — 관리자</div>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> 사이트로</a>
</nav>

<div class="tabs">
  <div class="tab on" data-tab="dashboard"><i class="fas fa-chart-bar"></i> 대시보드</div>
  <div class="tab" data-tab="bookings"><i class="fas fa-calendar-check"></i> 예약관리</div>
  <div class="tab" data-tab="shops"><i class="fas fa-store"></i> 업체 · 영상</div>
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

<!-- 예약관리 -->
<div class="tab-content" id="tab-bookings">
  <div class="card">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-calendar-check" style="color:#FF4D8D"></i> 예약 요청 목록</div>
    </div>
    <div id="bookingList" style="overflow-x:auto">
      <table class="tbl">
        <thead><tr>
          <th>날짜</th><th>고객명</th><th>업체</th><th>서비스</th><th>인원</th><th>수수료</th><th>상태</th><th>처리</th>
        </tr></thead>
        <tbody id="bookingTbody"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- 업체·영상 통합관리 -->
<div class="tab-content" id="tab-shops">

  <!-- ① 업체 등록 폼 -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div class="card-title"><i class="fas fa-store" style="color:#FF4D8D"></i> 업체 등록</div>
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
        <input id="sh-name" placeholder="예: 압구정 헤어팩토리">
      </div>
      <div>
        <label>카테고리 *</label>
        <select id="sh-cat">
          <option value="skincare">스킨케어</option>
          <option value="makeup">메이크업</option>
          <option value="hair">헤어</option>
          <option value="headspa">헤드스파</option>
          <option value="nail">네일</option>
          <option value="clinic">클리닉</option>
          <option value="spa">스파·마사지</option>
        </select>
      </div>
      <div>
        <label>지역 <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35)">(자동입력)</span></label>
        <input id="sh-loc" placeholder="예: Gangnam, Seoul">
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

  <!-- ② 등록된 업체 목록 (클릭하면 영상 추가) -->
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
          <option value="skincare">스킨케어</option>
          <option value="makeup">메이크업</option>
          <option value="hair">헤어</option>
          <option value="headspa">헤드스파</option>
          <option value="nail">네일</option>
          <option value="clinic">클리닉</option>
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
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:8px">서비스 목록 (이름 + 가격)</div>
      <div id="edit-svc-list"></div>
      <button type="button" id="edit-svc-add-btn" style="margin-top:6px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.2);border-radius:10px;color:rgba(255,255,255,.5);padding:7px 14px;font-size:12px;cursor:pointer;width:100%">+ 서비스 추가</button>
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
      <div class="full"><label>영상 설명 <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택)</span></label><input id="ve-desc" placeholder="짧은 설명..."></div>
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
<div class="tab-content" id="tab-settings">
  <div class="card">
    <div class="card-title" style="margin-bottom:16px"><i class="fas fa-cog" style="color:#FF4D8D"></i> 플랫폼 설정</div>
    <div style="margin-bottom:12px">
      <label>왓츠앱 번호 (국가코드 포함, + 없이)</label>
      <input id="cfg-wa" placeholder="821012345678" value="821012345678">
    </div>
    <div style="margin-bottom:12px">
      <label>수수료 범위</label>
      <input id="cfg-comm" placeholder="10~20%" value="10~20%">
    </div>
    <button class="btn-pk" onclick="saveSettings()"><i class="fas fa-save"></i> 설정 저장</button>
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)">
      <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:8px">SEO 페이지 — 업체별 구글 검색 노출 URL</div>
      <div id="seoLinks"></div>
    </div>
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

// ── 탭 전환 ──
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
    document.querySelectorAll('.tab-content').forEach(function(x){ x.classList.remove('on'); });
    t.classList.add('on');
    document.getElementById('tab-' + t.getAttribute('data-tab')).classList.add('on');
  });
});

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
});
document.addEventListener('change', function(e){
  var sel = e.target.closest('.status-select');
  if(sel){ updateStatus(sel.getAttribute('data-id'), sel.value); }
});

// ── 현재 영상 추가 중인 업체 ID ──
var currentShopId = null;

// ── 데이터 로드 ──
function loadAll(){
  fetch('/api/stats').then(function(r){return r.json();}).then(function(d){
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
  fetch('/api/shops').then(function(r){return r.json();}).then(function(d){
    shops = d.shops||[];
    renderShops();
    renderSeoLinks();
  });
  fetch('/api/videos').then(function(r){return r.json();}).then(function(d){
    videos = d.videos||[];
    renderVideos();
  });
  fetch('/api/bookings').then(function(r){return r.json();}).then(function(d){
    bookings = d.bookings||[];
    renderBookings();
  });
}

// ── 가격 포맷 (숫자 → ₩xx,xxx) ──
function fmtPrice(n){
  if(!n || isNaN(n)) return '';
  return '\u20a9'+Number(n).toLocaleString();
}

// ── 업체 목록 렌더 ──
function renderShops(){
  var el = document.getElementById('shopList');
  if(!shops.length){
    el.innerHTML = '<div style="text-align:center;padding:40px 24px;color:rgba(255,255,255,.25);font-size:13px"><div style="font-size:32px;margin-bottom:8px">&#127978;</div>No shops registered<br><span style="font-size:11px">Add a shop using the form above</span></div>';
    return;
  }
  var catColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',headspa:'#67e8f9',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
  var catLabels = {skincare:'스킨케어',makeup:'메이크업',hair:'헤어',headspa:'헤드스파',nail:'네일',clinic:'클리닉',spa:'스파'};
  el.innerHTML = '<div style="display:grid;gap:12px">' + shops.map(function(s){
    var vcount = videos.filter(function(v){return v.shopId===s.id;}).length;
    var catColor = catColors[s.category] || '#aaa';
    var catLabel = catLabels[s.category] || s.category;
    var initial = (s.name||'S')[0].toUpperCase();
    // 이 업체 소속 영상 목록
    var shopVids = videos.filter(function(v){ return v.shopId === s.id; });
    var vidsHtml = shopVids.length
      ? shopVids.map(function(v){
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid rgba(255,255,255,.05)">'
            +'<img src="'+(v.thumbnail||'')+'" class="safe-img" data-fallback="https://placehold.co/36x48/1c1c30/FF4D8D?text=V" style="width:36px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0">'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">'+v.title+'</div>'
              +'<div style="font-size:10px;color:rgba(255,255,255,.3)">'+v.views+' 조회</div>'
            +'</div>'
            +'<div style="display:flex;gap:4px;flex-shrink:0">'
              +'<button class="vid-edit-btn" data-id="'+v.id+'" style="padding:4px 10px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:6px;color:#a5b4fc;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-pen"></i> 수정</button>'
              +'<button class="del-video-btn" data-id="'+v.id+'" style="padding:4px 8px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:6px;color:#f87171;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-trash"></i></button>'
            +'</div>'
          +'</div>';
        }).join('')
      : '<div style="font-size:11px;color:rgba(255,255,255,.2);padding:8px 0;border-top:1px solid rgba(255,255,255,.05)">등록된 영상 없음</div>';

    return '<div class="shop-card" style="flex-direction:column;gap:0">'
      // 업체 헤더행
      +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">'
        // 썸네일 or 이니셜
        +'<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(255,77,141,.2),rgba(155,89,182,.2));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#FF4D8D">'
          +(s.thumbnail ? '<img src="'+s.thumbnail+'" class="safe-img" style="width:100%;height:100%;object-fit:cover" data-fallback-text="'+initial+'">' : initial)
        +'</div>'
        // 메타정보
        +'<div style="flex:1;min-width:0">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
            +'<span style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.name+'</span>'
            +'<span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(255,255,255,.07);color:'+catColor+'">'+catLabel+'</span>'
          +'</div>'
          +(s.location ? '<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:4px"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:4px"></i>'+s.location+'</div>' : '')
          +'<div style="display:flex;align-items:center;gap:10px">'
            +'<span style="font-size:11px;color:#a78bfa"><i class="fas fa-film" style="margin-right:3px"></i>'+vcount+'개 영상</span>'
            +(s.priceRange ? '<span style="font-size:11px;color:#34d399">'+s.priceRange+'</span>' : '')
          +'</div>'
        +'</div>'
        // 업체 액션 버튼
        +'<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
          +'<button data-add-video="'+s.id+'" style="padding:6px 12px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:8px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-plus"></i> 영상</button>'
          +'<button class="edit-shop-btn" data-id="'+s.id+'" style="padding:6px 12px;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.25);border-radius:8px;color:#60a5fa;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-edit"></i> 수정</button>'
          +'<button class="del-shop-btn" data-id="'+s.id+'" style="padding:6px 12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:8px;color:#f87171;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-trash"></i> 삭제</button>'
        +'</div>'
      +'</div>'
      // 영상 목록
      + vidsHtml
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
  document.getElementById('bookingTbody').innerHTML = bookings.map(function(b){
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
  document.getElementById('seoLinks').innerHTML = shops.map(function(s){
    var url = '/shop/'+s.slug;
    return '<div style="font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'+
      '<a href="'+url+'" target="_blank" style="color:#60a5fa;text-decoration:none">'+url+'</a>'+
      ' <span style="color:rgba(255,255,255,.3);font-size:11px">— '+s.name+'</span>'+
    '</div>';
  }).join('');
}

function updateStatus(id, status){
  fetch('/api/bookings/'+id+'/status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})
    .then(loadAll);
}

// ── 영상 추가 패널 열기/닫기 ──
function openVideoPanel(shopId){
  // id 타입 불일치 방지: 문자열로 통일해서 비교
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

  // shop을 찾지 못해도 패널은 열어줌 (이름은 shopId로 표시)
  document.getElementById('vd-shop-name').textContent = shop ? shop.name : ('#' + shopId);
  document.getElementById('videoAddPanel').style.display = 'block';
  setTimeout(function(){
    document.getElementById('videoAddPanel').scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
}

function closeVideoPanel(){
  document.getElementById('videoAddPanel').style.display = 'none';
  currentShopId = null;
  ['vd-title','vd-url','vd-thumb','vd-desc','vd-tags'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('vd-url-badge').style.display='none';
  document.getElementById('vd-url-hint').style.display='none';
  document.getElementById('vd-url-preview').style.display='none';
}

document.getElementById('vd-panel-close').addEventListener('click', closeVideoPanel);
document.getElementById('vd-submit-btn').addEventListener('click', addVideo);
document.getElementById('sh-submit-btn').addEventListener('click', addShop);
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
  fetch('/api/videos/'+editingVideoId, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ title: title, description: desc, thumbnail: vid.thumbnail||'', tags: tags })
  }).then(function(r){ return r.json(); }).then(function(){
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 저장';
    closeVideoEditPanel();
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
  document.getElementById('edit-sh-cat').value = shop.category || 'skincare';
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
function parseGmapUrl(raw){
  var status = document.getElementById('sh-gmap-status');
  var url = raw.trim();
  if(!url){ status.textContent=''; return; }

  document.getElementById('sh-gmap-raw').setAttribute('data-gmap-url', url);

  // 구글맵 URL → 서버 경유 처리 (단축URL + /place/ 형태 모두)
  if(url.indexOf('google.com/maps')!==-1 || url.indexOf('goo.gl')!==-1 || url.indexOf('maps.app')!==-1){
    status.style.color='#fbbf24';
    status.textContent='Analyzing link...';
    fetch('/api/resolve-gmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.name) document.getElementById('sh-name').value = d.name;
        if(d.address) document.getElementById('sh-addr').value = d.address;
        if(d.location) document.getElementById('sh-loc').value = d.location;
        if(d.lat) document.getElementById('sh-lat').value = d.lat;
        if(d.lng) document.getElementById('sh-lng').value = d.lng;
        if(d.address||d.name){
          status.style.color='#4ade80';
          status.textContent='✅ 자동입력 완료! 내용을 확인해주세요.';
        } else {
          status.style.color='#fbbf24';
          status.textContent='⚠ 일부 정보를 가져오지 못했어요. 직접 입력해주세요.';
        }
      })
      .catch(function(){
        status.style.color='#f87171';
        status.textContent='❌ 분석 실패. 아래 정보를 직접 입력해주세요.';
      });
    return;
  }

  // /place/ 형식: maps.google.com/maps/place/업체명+주소/
  var placeIdx = url.indexOf('/place/');
  if(placeIdx!==-1){
    var placePart = url.slice(placeIdx+7).split('/')[0];
    var decoded='';
    try{ decoded=decodeURIComponent(placePart.split('+').join(' ')); }catch(e){ decoded=placePart; }
    if(decoded){
      var pname = extractPlaceName(decoded);
      var area = detectArea(decoded);
      if(pname && !document.getElementById('sh-name').value) document.getElementById('sh-name').value = pname;
      document.getElementById('sh-addr').value = decoded;
      if(area) document.getElementById('sh-loc').value = area;
      status.style.color='#4ade80';
      status.textContent='✅ 자동입력 완료! 내용을 확인해주세요.';
      return;
    }
  }

  // ?q= 형식
  var qIdx = url.indexOf('?q=');
  if(qIdx===-1) qIdx=url.indexOf('&q=');
  if(qIdx!==-1){
    var qVal=url.slice(qIdx+3).split('&')[0];
    var dec2='';
    try{ dec2=decodeURIComponent(qVal.split('+').join(' ')); }catch(e){ dec2=qVal; }
    if(dec2){
      var area2=detectArea(dec2);
      document.getElementById('sh-addr').value=dec2;
      if(area2) document.getElementById('sh-loc').value=area2;
      status.style.color='#4ade80';
      status.textContent='✅ 주소 자동입력 완료!';
      return;
    }
  }

  status.style.color='rgba(255,255,255,.4)';
  status.textContent='링크에서 정보를 찾지 못했어요. 아래에 직접 입력해주세요.';
}

// ── 업체 등록 ──
function addShop(){
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

function delShop(id){
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
function addVideo(){
  if(!currentShopId){ alert('업체를 먼저 선택해주세요!'); return; }
  var title = document.getElementById('vd-title').value.trim();
  var url   = document.getElementById('vd-url').value.trim();
  if(!title){ alert('영상 제목을 입력해주세요!'); return; }
  if(!url){   alert('영상 URL을 입력해주세요!'); return; }
  var shop = shops.find(function(s){return s.id===currentShopId;})||{};
  var tags = document.getElementById('vd-tags').value.split(',').map(function(t){return t.trim();}).filter(Boolean);
  fetch('/api/videos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    shopId:currentShopId,
    title:title, videoUrl:url,
    thumbnail:document.getElementById('vd-thumb').value || shop.thumbnail || '',
    description:document.getElementById('vd-desc').value||'',
    tags:tags
  })}).then(function(){
    closeVideoPanel();
    loadAll();
  });
}

function delVideo(id){
  if(!confirm('이 영상을 삭제하시겠습니까?'))return;
  fetch('/api/videos/'+id,{method:'DELETE'}).then(loadAll);
}

function saveSettings(){
  alert('저장되었습니다!');
}

/* ── Google Places 자동가져오기 (통합) ── */
async function fetchPlacesInfo(prefix) {
  var nameEl   = document.getElementById(prefix + '-name');
  var locEl    = document.getElementById(prefix + '-loc');
  var addrEl   = document.getElementById(prefix + '-addr');
  var hoursEl  = document.getElementById(prefix + '-hours');
  var statusEl = document.getElementById(prefix + '-places-status');
  var btnEl    = document.getElementById(prefix + '-places-btn');

  var shopName = nameEl ? nameEl.value.trim() : '';
  var location = locEl  ? locEl.value.trim()  : '';
  if (!shopName) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">⚠️ 업체명을 먼저 입력하세요</span>';
    return;
  }

  var query = shopName + (location ? ' ' + location : '') + ' Seoul Korea';
  if(statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 구글에서 정보 가져오는 중...';
  if(btnEl) { btnEl.disabled = true; btnEl.style.opacity = '.6'; }

  try {
    var res = await fetch('/api/places-fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    var d = await res.json();
    if (d.error) {
      if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ ' + (d.error === 'No place found' ? '구글에서 업체를 찾을 수 없습니다.' : d.error) + '</span>';
      return;
    }

    var updated = [];

    // 1. 업체 영문명 (비어있을 때만 덮어씀)
    if (d.name && nameEl && !nameEl.value.trim()) {
      nameEl.value = d.name;
      updated.push('업체명');
    }

    // 2. 영문 주소
    if (d.address && addrEl) {
      addrEl.value = d.address;
      updated.push('주소 ✅');
    }

    // 3. 지역 (location)
    if (d.location && locEl && !locEl.value.trim()) {
      locEl.value = d.location;
      updated.push('지역');
    }

    // 4. 영업시간 (요일별)
    if (d.weekdayDescriptions && d.weekdayDescriptions.length > 0 && hoursEl) {
      hoursEl.value = d.weekdayDescriptions.join(' | ');
      updated.push('영업시간 ✅');
    } else if (d.hours && hoursEl) {
      hoursEl.value = d.hours;
      updated.push('영업시간 ✅');
    }

    // 5. 평점/리뷰수 hidden 저장
    var ratingEl = document.getElementById(prefix + '-rating');
    if (d.rating && ratingEl) { ratingEl.value = d.rating; updated.push('평점 ' + d.rating + '★'); }
    var rcEl = document.getElementById(prefix + '-review-count');
    if (d.reviewCount && rcEl) { rcEl.value = d.reviewCount; }

    // 6. 리뷰 JSON hidden 저장
    var rvEl = document.getElementById(prefix + '-reviews');
    if (d.reviews && d.reviews.length > 0 && rvEl) {
      rvEl.value = JSON.stringify(d.reviews);
      updated.push('리뷰 ' + d.reviews.length + '개 ✅');
    }

    // 7. placeId hidden 저장
    var pidEl = document.getElementById(prefix + '-place-id');
    if (d.placeId && pidEl) { pidEl.value = d.placeId; }

    // 8. 사진 (최대 6장) — 썸네일 + photos hidden + 미리보기
    if (d.photos && d.photos.length > 0) {
      var thumbEl = document.getElementById(prefix + '-thumb');
      if (thumbEl && !thumbEl.value) { thumbEl.value = d.photos[0]; }
      var photosHiddenEl = document.getElementById(prefix + '-photos');
      if (photosHiddenEl) { photosHiddenEl.value = JSON.stringify(d.photos); }
      updated.push('사진 ' + d.photos.length + '장 ✅');
      var previewId = prefix === 'sh' ? 'sh-photos-preview' : 'edit-sh-photos-preview';
      var previewEl = document.getElementById(previewId);
      if (previewEl) {
        previewEl.innerHTML = d.photos.map(function(url) {
          return '<div style="position:relative;display:inline-block;margin:3px">'
            + '<img src="' + url + '" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.15)" onerror="this.remove()">'
            + '</div>';
        }).join('');
        previewEl.style.display = 'flex';
        previewEl.style.flexWrap = 'wrap';
        previewEl.style.gap = '4px';
        previewEl.style.marginTop = '8px';
      }
    }

    // 9. 결과 요약 카드 렌더링
    var resultCard = '<div style="background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.2);border-radius:10px;padding:10px 12px;margin-top:6px">'
      + '<div style="font-size:11px;font-weight:800;color:#4ade80;margin-bottom:6px"><i class="fab fa-google"></i> 구글 정보 가져오기 완료!</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px">';
    updated.forEach(function(item) {
      resultCard += '<span style="background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:20px;padding:2px 9px;font-size:10px;color:#86efac">' + item + '</span>';
    });
    resultCard += '</div>';
    if (d.name) resultCard += '<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,.5)">영문명: <b style="color:rgba(255,255,255,.8)">' + d.name + '</b></div>';
    resultCard += '</div>';
    if(statusEl) statusEl.innerHTML = resultCard;

  } catch(e) {
    if(statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ 오류: ' + e.message + '</span>';
  } finally {
    if(btnEl) { btnEl.disabled = false; btnEl.style.opacity = '1'; }
  }
}

/* ── AI SEO 자동생성 ── */
async function genAiSeo(prefix) {
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
      body: JSON.stringify({ model: 'gpt-5', messages: [{ role: 'user', content: prompt }], max_tokens: 3000 })
    });
    var aiData = await aiRes.json();
    var text = (aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content) || '';
    if (!text) throw new Error('AI 응답이 비어있습니다');

    var cleaned = text.trim();
    if (cleaned.indexOf('{') > 0) cleaned = cleaned.slice(cleaned.indexOf('{'));
    var match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 파싱 실패');
    var data = JSON.parse(match[0]);

    if (descEl && data.description) {
      descEl.value = data.description;
      descEl.style.borderColor = 'rgba(124,58,237,.6)';
    }
    if (statusEl) {
      var kw = (data.keywords || []).slice(0,4).join(', ');
      statusEl.innerHTML = '<span style="color:#a78bfa">✅ SEO 설명 생성 완료!</span> <span style="color:rgba(255,255,255,.35);font-size:10px"> 키워드: ' + kw + '</span>';
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#f87171">❌ 실패: ' + e.message + '</span>';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="fas fa-magic"></i> AI SEO 자동생성'; }
  }
}

loadAll();

/* ── 일괄 SEO 재생성 ── */
async function regenSeoAll(force) {
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
