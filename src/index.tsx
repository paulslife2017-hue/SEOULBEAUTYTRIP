import { Hono } from 'hono'
import { neon } from '@neondatabase/serverless'

const DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
const getDb = () => neon(DB_URL)

const app = new Hono()

// ── 플랫폼 설정 ──
const PLATFORM = {
  whatsapp: '821012345678',   // 운영자 왓츠앱 번호 (국가코드 포함, +없이)
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
    googleMapEmbed: r.google_map_embed || '', priceRange: r.price_range || '',
    hours: r.hours || '', services: r.services || [],
    servicePrices: r.service_prices || [], description: r.description || '',
    rating: r.rating || 5.0, reviewCount: r.review_count || 0,
    thumbnail: r.thumbnail || '', photos: r.photos || [],
    commission: r.commission || 15,
    active: r.active !== false, createdAt: r.created_at || ''
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
    ? await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id WHERE s.category=${cat} ORDER BY v.views DESC`
    : await sql`SELECT v.*, s.category as shop_cat, s.name as shop_name, s.location as shop_location, s.thumbnail as shop_thumb FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY v.views DESC`
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
          return c.json({ name: shopName, address: geo.address, location: geo.location })
        }
      }

      // 좌표 없음 → 업체명만 반환 (주소는 비워둠)
      return c.json({ name: shopName, address: '', location: findArea(shopName) })
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
        if (geo) return c.json({ name: '', address: geo.address, location: geo.location })
      }
      return c.json({ name: '', address: qVal, location: findArea(qVal) })
    }

    // ── 좌표만 있는 경우 ──
    const coordsOnly = extractCoords(resolved)
    if (coordsOnly) {
      const geo = await reverseGeocode(coordsOnly.lat, coordsOnly.lon)
      if (geo) return c.json({ name: '', address: geo.address, location: geo.location })
    }

    return c.json({ address: '', location: '', name: '' })
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

app.post('/api/shops', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  const newId = 's' + Date.now()
  const today = new Date().toISOString().split('T')[0]
  await sql`INSERT INTO shops (id,name,slug,category,location,address,google_map_url,google_map_embed,price_range,hours,services,service_prices,description,rating,review_count,thumbnail,photos,commission,active,created_at) VALUES (
    ${newId},${body.name||''},${body.slug||''},${body.category||''},${body.location||''},${body.address||''},
    ${body.googleMapUrl||''},${body.googleMapEmbed||''},${body.priceRange||''},${body.hours||''},
    ${JSON.stringify(body.services||[])},${JSON.stringify(body.servicePrices||[])},
    ${body.description||''},${body.rating||5.0},${body.reviewCount||0},${body.thumbnail||''},
    ${JSON.stringify(body.photos||[])},${body.commission||15},true,${today}
  )`
  return c.json({ ok: true, id: newId })
})
app.put('/api/shops/:id', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  await sql`UPDATE shops SET
    name=${body.name||''},
    slug=${body.slug||''},
    category=${body.category||''},
    location=${body.location||''},
    address=${body.address||''},
    google_map_url=${body.googleMapUrl||''},
    google_map_embed=${body.googleMapEmbed||''},
    price_range=${body.priceRange||''},
    hours=${body.hours||''},
    services=${JSON.stringify(body.services||[])},
    service_prices=${JSON.stringify(body.servicePrices||[])},
    description=${body.description||''},
    thumbnail=${body.thumbnail||''},
    photos=${JSON.stringify(body.photos||[])},
    commission=${body.commission||15},
    active=${body.active!==false}
    WHERE id=${c.req.param('id')}`
  return c.json({ ok: true })
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
  const [bStats] = await sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='new') as new_cnt FROM bookings`
  const [sStats] = await sql`SELECT COUNT(*) as total FROM shops`
  const topRows = await sql`SELECT v.*, s.name as shop_name FROM videos v LEFT JOIN shops s ON v.shop_id=s.id ORDER BY v.views DESC LIMIT 3`
  return c.json({
    totalViews: Number(vStats.total_views), totalBookings: Number(bStats.total),
    newBookings: Number(bStats.new_cnt), totalShops: Number(sStats.total),
    topVideos: topRows.map((r: any) => ({ ...rowToVideo(r), shop: { name: r.shop_name } }))
  })
})

app.get('/api/platform', (c) => c.json(PLATFORM))

// ── SEO 업체 상세 페이지 ──
app.get('/shop/:slug', async (c) => {
  const sql = getDb()
  const shopRows = await sql`SELECT * FROM shops WHERE slug=${c.req.param('slug')}`
  if (!shopRows.length) return c.notFound()
  const shop = rowToShop(shopRows[0])
  const vidRows = await sql`SELECT * FROM videos WHERE shop_id=${shop.id} ORDER BY views DESC`
  const shopVideos = vidRows.map(rowToVideo)
  const waMsg = encodeURIComponent(`Hi! I found ${shop.name} on Seoul Beauty Trip and I'd like to book a service. Shop: ${shop.name} (${shop.location})`)
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
<title>${shop.name} | ${shop.location} ${shop.category} Beauty | Seoul Beauty Trip</title>
<meta name="description" content="${shop.description.slice(0,155)}. Located in ${shop.location}. Price: ${shop.priceRange}. Book via WhatsApp.">
<meta name="keywords" content="${shop.location} ${shop.category}, ${shop.location} beauty salon, Seoul ${shop.category}, K-beauty, ${shop.services.slice(0,4).join(', ')}">
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
      "@type":"LocalBusiness",
      "@id":"${canonicalUrl}",
      "name":"${shop.name}",
      "description":"${shop.description.replace(/"/g,"'")}",
      "image":"${shop.thumbnail}",
      "url":"${canonicalUrl}",
      "telephone":"",
      "address":{
        "@type":"PostalAddress",
        "streetAddress":"${shop.address.replace(/"/g,"'")}",
        "addressLocality":"Seoul",
        "addressCountry":"KR"
      },
      "geo":{},
      "openingHours":"${shop.hours.replace(/"/g,"'")}",
      "priceRange":"${shop.priceRange}",
      "aggregateRating":{
        "@type":"AggregateRating",
        "ratingValue":"${shop.rating}",
        "reviewCount":"${shop.reviewCount}"
      },
      "hasOfferCatalog":{
        "@type":"OfferCatalog",
        "name":"Services",
        "itemListElement":[${shop.servicePrices.map((sp:any,i:number)=>`{"@type":"Offer","position":${i+1},"name":"${sp.name}","price":"${sp.price}","priceCurrency":"KRW"}`).join(',')}]
      },
      "sameAs":["https://seoulbeautytrip.com"]
    },
    {
      "@type":"BreadcrumbList",
      "itemListElement":[
        {"@type":"ListItem","position":1,"name":"Seoul Beauty Trip","item":"${base}/"},
        {"@type":"ListItem","position":2,"name":"${shop.category.charAt(0).toUpperCase()+shop.category.slice(1)}"},
        {"@type":"ListItem","position":3,"name":"${shop.name}","item":"${canonicalUrl}"}
      ]
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
    <div class="sp-cat-badge">${catIcon} ${shop.category}</div>
    <h1 class="sp-title" itemprop="name">${shop.name}</h1>
    <div class="sp-loc"><i class="fas fa-map-marker-alt" style="color:var(--pk)"></i><span itemprop="addressLocality">${shop.location}</span></div>
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
    <a href="${shop.googleMapUrl||'#'}" target="_blank" rel="noopener" class="sp-gmap">
      <i class="fas fa-map-marker-alt"></i> Google Map
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

  ${shop.googleMapEmbed?`<div class="sp-card"><div class="sp-card-title"><i class="fas fa-map"></i> Location</div><div class="sp-map"><iframe src="${shop.googleMapEmbed}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>${shop.googleMapUrl?`<a href="${shop.googleMapUrl}" target="_blank" rel="noopener" class="sp-map-link"><i class="fas fa-external-link-alt"></i> Open in Google Maps</a>`:''}</div>`:shop.googleMapUrl?`<a href="${shop.googleMapUrl}" target="_blank" rel="noopener" class="sp-gmap" style="margin-bottom:14px"><i class="fas fa-map-marker-alt"></i> View on Google Maps</a>`:''}

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

// ── sitemap.xml ──
app.get('/sitemap.xml', async (c) => {
  const sql = getDb()
  let shopSlugs: string[] = []
  try {
    const rows = await sql`SELECT slug FROM shops WHERE active=true AND slug IS NOT NULL AND slug!=''`
    shopSlugs = rows.map((r: any) => r.slug).filter(Boolean)
  } catch(e) {}
  const base = 'https://seoulbeautytrip.com'
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...shopSlugs.map(slug =>
      `<url><loc>${base}/shop/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    )
  ].join('\n  ')
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`, 200, { 'Content-Type': 'application/xml' })
})

// ── robots.txt ──
app.get('/robots.txt', (c) => c.text(
`User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://seoulbeautytrip.com/sitemap.xml
`))

// ── MAIN PAGE ──
app.get('/', (c) => c.html(MAIN_HTML))
app.get('/admin', (c) => c.html(ADMIN_HTML))
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
html,body{height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:var(--ff-sans)}
/* ── 로딩 ── */
#ld{position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:opacity .6s}
.ld-pre{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.28);text-transform:uppercase;font-family:var(--ff-sans)}
.ld-logo{font-family:var(--ff-serif);font-size:34px;font-weight:900;background:linear-gradient(135deg,#fff 0%,var(--pk3) 60%,var(--gold2) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;text-align:center;line-height:1.1}
.ld-sub{font-size:9px;letter-spacing:6px;color:rgba(255,255,255,.25);text-transform:uppercase;margin-top:2px}
.ld-line{width:1px;height:28px;background:linear-gradient(to bottom,transparent,rgba(201,168,76,.5),transparent);margin:10px 0 6px}
.ld-bar{width:120px;height:1px;background:rgba(255,255,255,.08);border-radius:1px;overflow:hidden}
.ld-prog{height:100%;background:linear-gradient(90deg,var(--pk),var(--gold));animation:ldpg 1.8s ease forwards}
@keyframes ldpg{from{width:0}to{width:100%}}
/* ── 헤더 ── */
#hd{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 16px 0;background:linear-gradient(to bottom,rgba(8,8,14,.97) 55%,transparent)}
.hd-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.logo{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none}
.logo-mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--pk),#7C3AED);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;box-shadow:0 4px 16px rgba(232,65,122,.3)}
.logo-name{font-family:var(--ff-serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,#fff,var(--pk3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:.3px}
.logo-tag{font-size:8px;color:var(--gold);letter-spacing:3px;text-transform:uppercase;-webkit-text-fill-color:var(--gold)}
.mute-btn{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--border);color:rgba(255,255,255,.6);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.mute-btn:hover{background:rgba(255,255,255,.1);color:#fff}
/* ── 카테고리 탭 ── */
.cats{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:12px}
.cats::-webkit-scrollbar{display:none}
.cat{flex-shrink:0;padding:6px 13px;border-radius:20px;border:1px solid rgba(232,65,122,.2);background:rgba(232,65,122,.04);color:rgba(255,255,255,.45);font-size:11px;font-weight:700;cursor:pointer;transition:all .22s;white-space:nowrap;font-family:var(--ff-sans)}
.cat.on,.cat:hover{background:linear-gradient(135deg,var(--pk),#7C3AED);border-color:transparent;color:#fff;box-shadow:0 2px 12px rgba(232,65,122,.3)}
/* ── 피드 ── */
#feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;display:flex;flex-direction:column;align-items:center}
#feed::-webkit-scrollbar{display:none}
/* ── 슬라이드 ── */
.slide{height:100vh;width:100%;max-width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#000;flex-shrink:0}
.bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;background:#000}
.ov{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,.06) 0%,transparent 20%,transparent 45%,rgba(0,0,0,.28) 65%,rgba(0,0,0,.85) 100%);cursor:pointer}
/* ── 슬라이드 정보 영역 ── */
.info{position:absolute;bottom:0;left:0;right:0;padding:14px 16px 28px;z-index:3}
.badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:7px;backdrop-filter:blur(8px);color:rgba(255,255,255,.85)}
.badge-dot{width:5px;height:5px;border-radius:50%;background:var(--pk);display:inline-block;animation:bdp 2s infinite}
@keyframes bdp{0%,100%{opacity:1}50%{opacity:.3}}
.vt{font-size:17px;font-weight:800;line-height:1.28;margin-bottom:5px;text-shadow:0 2px 12px rgba(0,0,0,.8);font-family:var(--ff-sans);letter-spacing:-.2px}
.shop-info-mini{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11.5px;color:rgba(255,255,255,.55)}
.shop-info-mini i{color:var(--pk2);font-size:10px}
.shop-info-sep{color:rgba(255,255,255,.2)}
.vd{font-size:12px;color:rgba(255,255,255,.58);line-height:1.6;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vtags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.vtag{font-size:11px;color:var(--pk3);font-weight:700}
.btns-row{display:flex;gap:8px;align-items:center}
.wa-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:24px;border:none;background:linear-gradient(135deg,#25D366,#0EA855);color:#fff;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 16px rgba(37,211,102,.3);letter-spacing:.2px;transition:opacity .2s}
.wa-btn:hover{opacity:.9}
/* ── 인디케이터 ── */
.hint{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;opacity:.4;animation:hb 2.4s infinite}
.hint span{font-size:8px;color:#fff;letter-spacing:2px;text-transform:uppercase}
@keyframes hb{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-6px)}}
#dots{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:200;display:flex;flex-direction:column;gap:5px}
.dot{width:3px;height:3px;border-radius:2px;background:rgba(255,255,255,.18);transition:all .3s}
.dot.on{background:var(--pk);height:18px;box-shadow:0 0 6px rgba(232,65,122,.5)}
#muteBtn{position:fixed;top:50%;right:12px;transform:translateY(-50%);z-index:200;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);transition:all .2s}
#muteBtn:hover{background:rgba(232,65,122,.3);border-color:rgba(232,65,122,.5)}
/* ── PC 반응형 ── */
@media(min-width:768px){
  #hd{padding:16px 0 0;left:50%;transform:translateX(-50%);width:420px;max-width:420px;padding-left:16px;padding-right:16px}
  #feed{background:#040408}
  .slide{width:420px;max-width:420px;height:100vh;box-shadow:0 0 80px rgba(232,65,122,.06)}
  #dots{left:calc(50% - 234px)}
  #muteBtn{right:calc(50% - 210px - 56px)}
  .modal{max-width:420px}
  .hint{display:none}
}
/* ── 업체 모달 ── */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:500;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(16px)}
.modal-bg.open{display:flex}
.modal{background:linear-gradient(180deg,#111118 0%,#0d0d14 100%);border-radius:28px 28px 0 0;padding:0 0 44px;width:100%;max-width:520px;border:1px solid rgba(255,255,255,.08);border-bottom:none;animation:msu .35s cubic-bezier(.22,1,.36,1);position:relative;height:88vh;display:flex;flex-direction:column;touch-action:pan-y}
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
.m-body{padding:16px 20px 0}
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
.m-map-link{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:11px;color:rgba(96,165,250,.8);text-decoration:none;font-weight:500}
.m-map-link:hover{color:#93c5fd}
/* 버튼 */
.m-btns{flex-shrink:0;padding:14px 20px 0}
.m-wa{
  display:flex;align-items:center;justify-content:center;gap:12px;
  padding:17px 20px;
  background:linear-gradient(135deg,#25D366 0%,#128C5E 100%);
  border:none;border-radius:18px;color:#fff;
  text-decoration:none;cursor:pointer;
  box-shadow:0 8px 28px rgba(37,211,102,.32),inset 0 1px 0 rgba(255,255,255,.18);
  transition:transform .16s,box-shadow .16s;
  position:relative;overflow:hidden;
}
.m-wa:active{transform:scale(.98)}
.m-wa:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(37,211,102,.42),inset 0 1px 0 rgba(255,255,255,.18)}
.m-wa-icon{width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px}
.m-wa-text{display:flex;flex-direction:column;align-items:flex-start}
.m-wa-text b{font-size:15px;font-weight:800;letter-spacing:.2px;line-height:1.2}
.m-wa-text span{font-size:11px;opacity:.72;font-weight:500}
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
</div>

<header id="hd">
  <div class="hd-top">
    <div class="logo" id="logoBtn">
      <div class="logo-mark">&#10024;</div>
      <div>
        <div class="logo-name">Seoul Beauty Trip</div>
        <div class="logo-tag">Korean Beauty Experience</div>
      </div>
    </div>
    <button class="mute-btn" id="muteBtn" onclick="toggleMute()"><i class="fas fa-volume-mute"></i></button>
  </div>
  <nav class="cats" id="cats" aria-label="Beauty categories">
    <button class="cat on" data-cat="all">&#10024; All</button>
    <button class="cat" data-cat="skincare">&#127807; Skincare</button>
    <button class="cat" data-cat="makeup">&#128139; Makeup</button>
    <button class="cat" data-cat="hair">&#128135; Hair</button>
    <button class="cat" data-cat="headspa">&#129496; Head Spa</button>
    <button class="cat" data-cat="nail">&#128133; Nail</button>
    <button class="cat" data-cat="clinic">&#127973; Clinic</button>
  </nav>
</header>

<div id="dots" aria-hidden="true"></div>
<div id="feed" role="feed" aria-label="Beauty videos"></div>
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

<script>
var vids = [], isMuted = true, liked = {}, platform = {};
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',headspa:'&#129496;',nail:'&#128133;',clinic:'&#127973;'};

fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; });

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

function loadVideos(cat) {
  fetch('/api/videos?category='+(cat||'all'))
    .then(function(r){ return r.json(); })
    .then(function(d){
      vids = d.videos || [];
      renderFeed();
      hideLd();
    })
    .catch(function(){
      vids = [];
      renderFeed();
      hideLd();
    });
  setTimeout(hideLd, 5000);
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
  var u = videoUrl.replace('/video/upload/', '/video/upload/so_0,w_800,h_600,c_fill,q_auto,f_jpg/');
  var dot = u.lastIndexOf('.');
  return dot !== -1 ? u.slice(0, dot) + '.jpg' : u + '.jpg';
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
  // use auto thumbnail
  var thumb = v.thumbnail || getAutoThumb(v.videoUrl) || '';

  s.innerHTML =
    '<meta itemprop="name" content="'+esc(v.title)+'">' +
    '<meta itemprop="description" content="'+esc(v.description)+'">' +
    '<meta itemprop="thumbnailUrl" content="'+esc(thumb)+'">' +
    '<meta itemprop="uploadDate" content="'+esc(uploadDate)+'">' +
    (thumb ? '<img class="bg-img" src="'+esc(thumb)+'" alt="'+esc(v.title)+'" loading="lazy">' : '<div class="bg-img" style="background:linear-gradient(135deg,#1a0a14 0%,#1c0e22 40%,#0f0816 100%)"></div>') +
    '<video id="vid'+idx+'" src="'+esc(v.videoUrl)+'" loop muted playsinline preload="auto" poster="'+esc(thumb)+'" itemprop="contentUrl"></video>' +
    '<div id="playic'+idx+'" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:4;width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.55);align-items:center;justify-content:center;pointer-events:none;backdrop-filter:blur(4px)"><i class="fas fa-pause" style="font-size:20px;color:#fff"></i></div>' +
    '<div class="ov"></div>' +
    '<div class="info">' +
      '<div class="badge"><span class="badge-dot"></span>'+(catIcons[shop.category]||'&#10024;')+' '+esc(shop.category||'')+'</div>' +
      '<h2 class="vt" itemprop="name" style="font-size:17px">'+esc(v.title)+'</h2>' +
      '<div class="shop-info-mini"><i class="fas fa-store"></i>'+esc(shop.name||'')+(areaOnly(shop.location||'')?'<span class="shop-info-sep">|</span><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location||'')):'')+'</div>' +
      '<div class="vd">'+esc(v.description)+'</div>' +
      '<div class="vtags">'+tags+'</div>' +
      '<div class="btns-row">' +
        '<button class="wa-btn" id="wabtn'+idx+'"><i class="fab fa-whatsapp" style="font-size:15px"></i> Book & Info</button>' +
      '</div>' +
    '</div>' +
    '<div class="hint"><i class="fas fa-chevron-up" style="font-size:10px"></i><span>Swipe Up</span></div>';

  feed.appendChild(s);

  (function(vid, vidIdx, shopData) {
    var ve  = document.getElementById('vid'+vidIdx);
    var ov  = s.querySelector('.ov');
    var playIc = document.getElementById('playic'+vidIdx);

    if(ve) {
      ve.onerror = function(){ ve.style.display='none'; };
      ve.addEventListener('play',  function(){ if(playIc) playIc.style.display='none'; });
      ve.addEventListener('pause', function(){ if(playIc) playIc.style.display='flex'; });
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

function setupObs(){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var idx=parseInt(e.target.id.replace('sl',''));
      var vid=document.getElementById('vid'+idx);
      document.querySelectorAll('.dot').forEach(function(d,i){d.classList.toggle('on',i===idx);});
      if(e.isIntersecting){ if(vid){vid.muted=isMuted;vid.play().catch(function(){});} }
      else { if(vid){vid.pause();vid.currentTime=0;} }
    });
  },{threshold:0.5});
  document.querySelectorAll('.slide').forEach(function(s){obs.observe(s);});

  // play first slide
  var firstVid0 = document.getElementById('vid0');
  if(firstVid0){ firstVid0.muted=true; firstVid0.play().catch(function(){}); }
  setTimeout(function(){
    var firstVid = document.getElementById('vid0');
    if(firstVid && firstVid.paused){ firstVid.muted=isMuted; firstVid.play().catch(function(){}); }
    var dot0 = document.getElementById('dot0');
    if(dot0) dot0.classList.add('on');
  }, 400);
}

function openShopModal(shopId) {
  if(!shopId) return;
  document.getElementById('modalHero').innerHTML = '';
  document.getElementById('modalContent').innerHTML = '<div style="text-align:center;padding:40px 0;color:rgba(255,255,255,.25)"><i class="fas fa-spinner fa-spin" style="font-size:22px"></i></div>';
  document.getElementById('modalBtns').innerHTML = '';
  document.getElementById('shopModal').classList.add('open');
  document.getElementById('modalScroll').scrollTop = 0;

  fetch('/api/shops/'+shopId).then(function(r){ return r.json(); }).then(function(d){
    var shop = d.shop;
    if(!shop){ document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">Shop information unavailable.</div>'; return; }
    renderShopModal(shop);
  }).catch(function(){
    document.getElementById('modalContent').innerHTML='<div style="padding:20px;color:#f87171">An error occurred.</div>';
  });
}

function renderShopModal(shop) {
  var waNum = platform.whatsapp || '821012345678';
  var waMsg = 'Hi! I found ' + (shop.name||'your shop') + ' on Seoul Beauty Trip and would like to book. Shop: ' + (shop.name||'') + (shop.location ? ' - ' + shop.location : '');
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
        +'<img class="m-hero-img" id="mHeroImg" src="'+esc(allPhotos[0])+'" alt="'+esc(shop.name)+'" loading="lazy">'
        +'<div class="m-hero-ov"></div>'
        +'<div class="m-hero-badge">'+(catIcons[shop.category]||'')+'&nbsp;'+esc((shop.category||'').toUpperCase())+'</div>'
      +'</div>';

    /* 히어로 바로 아래 최대 3개 썸네일 스트립 */
    if(allPhotos.length > 1) {
      var stripPhotos = allPhotos.slice(0, 3);
      var extraCount  = allPhotos.length - 3;
      var strips = stripPhotos.map(function(url, i){
        return '<div class="m-ts-thumb'+(i===0?' on':'')+'" data-photo-url="'+esc(url)+'" onclick="setMHero(this.dataset.photoUrl,this)">'
          +'<img src="'+esc(url)+'" alt="" loading="lazy">'
          +'</div>';
      }).join('');
      if(extraCount > 0) {
        strips += '<div class="m-ts-more"><i class="fas fa-images"></i>+'+extraCount+'</div>';
      }
      heroHtml += '<div class="m-thumbstrip">'+strips+'</div>';
    }
  }
  document.getElementById('modalHero').innerHTML = heroHtml;

  /* ── 별점 ── */
  var rating = shop.rating || 5.0;
  var reviewCount = shop.reviewCount || 0;
  var starsHtml = '';
  for(var si=0; si<5; si++) starsHtml += (si < Math.round(rating)) ? '&#9733;' : '&#9734;';

  /* ── 정보 카드 그리드 ── */
  var infoCards = '';
  if(shop.hours) {
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Hours</div><div class="m-info-card-val"><i class="fas fa-clock"></i>'+esc(shop.hours)+'</div></div>';
  }
  if(shop.location) {
    var locArea = areaOnly(shop.location);
    var locFull = String(shop.location||'');
    var locSuffix = locFull.indexOf(',') !== -1 ? '<span style="font-size:10px;opacity:.5;font-weight:400"> · '+esc(locFull.slice(locFull.indexOf(',')+1).trim())+'</span>' : '';
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Area</div><div class="m-info-card-val"><i class="fas fa-map-marker-alt"></i>'+esc(locArea)+locSuffix+'</div></div>';
  }
  if(shop.priceRange) {
    infoCards += '<div class="m-info-card"><div class="m-info-card-label">Price Range</div><div class="m-info-card-val"><i class="fas fa-won-sign"></i>'+esc(shop.priceRange)+'</div></div>';
  }
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

  /* ── 가격 리스트 ── */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    var rows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+esc(p.name||'')+'</span><span class="m-price-val">'+esc(p.price||'')+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-sec"><div class="m-sec-title">Price List</div><div class="m-price-list">'+rows+'</div></div>';
  }

  /* ── 서비스 태그 ── */
  var svcHtml = '';
  if(shop.services && shop.services.length > 0) {
    var svcs = shop.services.map(function(s){ return '<span class="m-svc-tag">'+esc(s)+'</span>'; }).join('');
    svcHtml = '<div class="m-sec"><div class="m-sec-title">Services</div><div class="m-svc-tags">'+svcs+'</div></div>';
  }

  /* ── 구글맵 embed (없으면 URL로 자동 생성) ── */
  var embedSrc = shop.googleMapEmbed || '';
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
  /* 지도 표시만 (클릭 차단 - 예약은 WhatsApp으로) */
  var mapHtml = embedSrc
    ? '<div class="m-sec"><div class="m-sec-title">Location</div>'
        +'<div class="m-map" style="position:relative">'
          +'<iframe src="'+embedSrc+'" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" style="pointer-events:none"></iframe>'
          +'<div style="position:absolute;inset:0;z-index:2"></div>'
        +'</div>'
      +'</div>'
    : '';

  /* ── 본문 조립 ── */
  document.getElementById('modalContent').innerHTML =
    '<div class="m-shop-header">'
      +'<div class="m-shop-name">'+esc(shop.name||'')+'</div>'
      +'<div class="m-shop-sub">'
        +(shop.location ? '<div class="m-shop-loc"><i class="fas fa-map-marker-alt"></i>'+esc(areaOnly(shop.location))+'</div>' : '')
        +(reviewCount > 0 ? '<div class="m-divider"></div><span class="m-stars">'+starsHtml+'</span><span class="m-rating-txt">'+rating+' ('+reviewCount+')</span>' : '')
      +'</div>'
    +'</div>'
    + addrHtml
    + infoGridHtml
    + descHtml
    + priceHtml
    + svcHtml
    + mapHtml;

  /* ── WhatsApp 버튼 ── */
  document.getElementById('modalBtns').innerHTML =
    '<a href="'+waUrl+'" target="_blank" rel="noopener" class="m-wa">'
      +'<span class="m-wa-icon"><i class="fab fa-whatsapp"></i></span>'
      +'<span class="m-wa-text">'
        +'<b>Book via WhatsApp</b>'
        +'<span>'+esc(shop.name||'this shop')+'</span>'
      +'</span>'
    +'</a>';
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
});
</script>
</body>
</html>`

// ════════════════════════════════════════════
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seoul Beauty Trip - Admin</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
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
@media(max-width:540px){.stats-grid{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}
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
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card"><div class="stat-icon">&#128065;</div><div class="stat-val" id="st-views">-</div><div class="stat-lbl">총 조회수</div></div>
    <div class="stat-card"><div class="stat-icon">&#128197;</div><div class="stat-val" id="st-bookings">-</div><div class="stat-lbl">총 예약수</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#3b82f6">&#128276;</div><div class="stat-val" id="st-new" style="color:#60a5fa">-</div><div class="stat-lbl">신규 예약</div></div>
    <div class="stat-card"><div class="stat-icon" style="color:#10b981">&#127968;</div><div class="stat-val" id="st-shops" style="color:#10b981">-</div><div class="stat-lbl">등록 업체</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title"><i class="fas fa-fire" style="color:#FF4D8D"></i> 인기 영상 TOP 3</div></div>
    <div id="topVids"></div>
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
    <!-- 구글맵 붙여넣기 → 자동완성 -->
    <div style="background:rgba(66,133,244,.08);border:1px solid rgba(66,133,244,.3);border-radius:14px;padding:14px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:10px">
        <i class="fas fa-map-marker-alt"></i> 구글맵 링크 붙여넣기 <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,.4)">→ 업체명·주소·지역 자동입력</span>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="sh-gmap-raw" placeholder="https://maps.app.goo.gl/... 링크를 여기에 붙여넣으세요" style="flex:1;font-size:14px;margin-bottom:0">
        <button type="button" id="sh-gmap-btn" style="padding:0 18px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0">자동입력</button>
      </div>
      <div id="sh-gmap-status" style="font-size:12px;color:rgba(255,255,255,.4);min-height:18px"></div>
    </div>

    <div class="form-grid">
      <div class="full">
        <label>업체명 *</label>
        <input id="sh-name" placeholder="구글맵 붙여넣으면 자동입력">
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
        <label>지역 <span style="font-size:11px;color:rgba(255,255,255,.4)">(자동입력)</span></label>
        <input id="sh-loc" placeholder="자동입력 또는 직접 입력">
      </div>
      <div class="full">
        <label>주소 <span style="font-size:11px;color:rgba(255,255,255,.4)">(자동입력)</span></label>
        <input id="sh-addr" placeholder="자동입력 또는 직접 입력">
      </div>
      <div class="full">
        <label>업체 소개 <span style="font-size:11px;color:rgba(255,255,255,.4)">(선택)</span></label>
        <textarea id="sh-desc" placeholder="고객에게 보여질 소개 문구..."></textarea>
      </div>
      <div class="full">
        <label>구글맵 임베드 URL <span style="font-size:11px;color:rgba(255,255,255,.4)">(지도가 모달 안에 표시됨)</span></label>
        <input id="sh-gmap-embed" placeholder="구글맵 → 공유 → 지도 퍼가기 → src=\"...\" 부분 붙여넣기" oninput="updateGmapEmbedPreview('sh-gmap-embed-preview','sh-gmap-embed')">
        <div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:4px">Google Maps → Share → Embed a map → src=\"...\" 값만 복사</div>
        <div id="sh-gmap-embed-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:160px;border:1px solid rgba(255,255,255,.1)">
          <iframe id="sh-gmap-embed-frame" src="" allowfullscreen loading="lazy" style="width:100%;height:100%;border:0"></iframe>
        </div>
      </div>
    </div>

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
      <div class="full"><label>주소</label><input id="edit-sh-addr" placeholder="주소"></div>
      <div class="full"><label>영업시간</label><input id="edit-sh-hours" placeholder="예: 10:00~20:00 (Mon~Sat)"></div>
      <div class="full">
        <label>구글맵 링크 <span style="font-size:10px;color:rgba(255,255,255,.35)">(Google Maps URL)</span></label>
        <input id="edit-sh-gmap-url" placeholder="https://maps.google.com/...">
      </div>
      <div class="full">
        <label>구글맵 임베드 src <span style="font-size:10px;color:rgba(255,255,255,.35)">(지도가 모달 안에 표시됨)</span></label>
        <input id="edit-sh-gmap-embed" placeholder="https://www.google.com/maps/embed?pb=..." oninput="updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed')">
        <div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px">Google Maps → Share → Embed a map → src=\"...\" 값만 복사</div>
        <div id="edit-gmap-preview" style="display:none;margin-top:8px;border-radius:12px;overflow:hidden;height:180px;border:1px solid rgba(66,133,244,.3)">
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
      <div class="full"><label>업체 소개</label><textarea id="edit-sh-desc" placeholder="업체 소개 문구..."></textarea></div>
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
    document.getElementById('st-views').textContent = d.totalViews>=1000?(d.totalViews/1000).toFixed(1)+'K':d.totalViews;
    document.getElementById('st-bookings').textContent = d.totalBookings;
    document.getElementById('st-new').textContent = d.newBookings;
    document.getElementById('st-shops').textContent = d.totalShops;
    document.getElementById('topVids').innerHTML = (d.topVideos||[]).map(function(v,i){
      return '<div class="top-vid">'+
        '<div class="top-rank">#'+(i+1)+'</div>'+
        '<img src="'+(v.thumbnail||'')+'" class="safe-img">'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;margin-bottom:3px">'+v.title+'</div>'+
        '<div style="font-size:11px;color:rgba(255,255,255,.4)">'+v.views+' 조회 &nbsp; '+v.likes+' 좋아요</div></div>'+
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
    el.innerHTML = '<div style="text-align:center;padding:40px 24px;color:rgba(255,255,255,.25);font-size:13px"><div style="font-size:32px;margin-bottom:8px">🏪</div>등록된 업체가 없습니다<br><span style="font-size:11px">위 폼으로 업체를 등록해보세요</span></div>';
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
  // embed 미리보기 갱신
  setTimeout(function(){ updateGmapEmbedPreview('edit-gmap-preview','edit-sh-gmap-embed'); }, 50);
  document.getElementById('edit-sh-thumb').value = shop.thumbnail || '';
  document.getElementById('edit-sh-commission').value = shop.commission || 15;
  document.getElementById('edit-sh-desc').value = shop.description || '';

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

  // photos 수집
  var photoCards = document.querySelectorAll('#edit-photos-list .edit-photo-card');
  var photosArr = [];
  photoCards.forEach(function(card){
    var u = card.getAttribute('data-url');
    if(u) photosArr.push(u);
  });

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
      thumbnail: document.getElementById('edit-sh-thumb').value || '',
      commission: parseInt(document.getElementById('edit-sh-commission').value)||15,
      description: document.getElementById('edit-sh-desc').value || '',
      services: svcs,
      servicePrices: svcPrices,
      priceRange: svcs.length > 0 ? priceRange : (shop.priceRange||''),
      rating: shop.rating || 5.0,
      reviewCount: shop.reviewCount || 0,
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
    status.textContent='🔄 링크 분석 중...';
    fetch('/api/resolve-gmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d.name) document.getElementById('sh-name').value = d.name;
        if(d.address) document.getElementById('sh-addr').value = d.address;
        if(d.location) document.getElementById('sh-loc').value = d.location;
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
    hours:'', commission:15,
    address:document.getElementById('sh-addr').value||'',
    googleMapUrl:gmapUrl,
    googleMapEmbed:document.getElementById('sh-gmap-embed').value||'',
    thumbnail:'',
    services:svcs,
    servicePrices:svcPrices,
    description:document.getElementById('sh-desc').value||'',
    rating:5.0, reviewCount:0
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

loadAll();

}); // DOMContentLoaded
</script>
</body>
</html>`
