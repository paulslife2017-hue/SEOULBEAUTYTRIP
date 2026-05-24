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
    thumbnail: r.thumbnail || '', commission: r.commission || 15,
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
      thumbnail TEXT, commission INTEGER DEFAULT 15,
      active BOOLEAN DEFAULT true, created_at TEXT
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
initDb()

// ── API ──
app.get('/api/videos', async (c) => {
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

// ── Cloudinary 서명 발급 (클라이언트 직접 업로드용) ──
// 브라우저 → 이 API로 서명 받고 → Cloudinary로 직접 업로드 (Vercel 4.5MB 제한 우회)
app.get('/api/upload-sign', async (c) => {
  try {
    const API_KEY = '221647295675392'
    const API_SECRET = 'g10Q4wv2UzDEAGV35QluPCYz4Ms'
    const CLOUD_NAME = 'dc0ouozcd'
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const folder = 'seoul-beauty'
    const strToSign = 'folder=' + folder + '&timestamp=' + timestamp + API_SECRET
    const enc = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-1', enc.encode(strToSign))
    const signature = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return c.json({ cloudName: CLOUD_NAME, apiKey: API_KEY, timestamp, signature, folder })
  } catch(e: any) {
    return c.json({ error: e.message || 'Sign failed' }, 500)
  }
})

app.post('/api/shops', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  const newId = 's' + Date.now()
  const today = new Date().toISOString().split('T')[0]
  await sql`INSERT INTO shops (id,name,slug,category,location,address,google_map_url,google_map_embed,price_range,hours,services,service_prices,description,rating,review_count,thumbnail,commission,active,created_at) VALUES (
    ${newId},${body.name||''},${body.slug||''},${body.category||''},${body.location||''},${body.address||''},
    ${body.googleMapUrl||''},${body.googleMapEmbed||''},${body.priceRange||''},${body.hours||''},
    ${JSON.stringify(body.services||[])},${JSON.stringify(body.servicePrices||[])},
    ${body.description||''},${body.rating||5.0},${body.reviewCount||0},${body.thumbnail||''},
    ${body.commission||15},true,${today}
  )`
  return c.json({ ok: true, id: newId })
})
app.put('/api/shops/:id', async (c) => {
  const sql = getDb()
  const body = await c.req.json()
  await sql`UPDATE shops SET name=${body.name},category=${body.category},location=${body.location},address=${body.address},description=${body.description},active=${body.active} WHERE id=${c.req.param('id')}`
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
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${shop.name} | ${shop.location} ${shop.category} | Seoul Beauty Trip</title>
<meta name="description" content="${shop.description} Located in ${shop.location}. Services: ${shop.services.join(', ')}. Price: ${shop.priceRange}">
<meta name="keywords" content="${shop.location} ${shop.category}, ${shop.location} beauty, Seoul ${shop.category}, ${shop.services.join(', ')}">
<meta property="og:title" content="${shop.name} | Seoul Beauty Trip">
<meta property="og:description" content="${shop.description}">
<meta property="og:image" content="${shop.thumbnail}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30}
body{background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif;min-height:100vh}
.nav{background:var(--bg2);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,77,141,.15)}
.nav-logo{font-size:15px;font-weight:900;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none}
.nav-back{color:#aaa;text-decoration:none;font-size:13px;display:flex;align-items:center;gap:5px}
.hero{position:relative;height:280px;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover}
.hero-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.85) 100%)}
.hero-info{position:absolute;bottom:0;left:0;right:0;padding:20px}
.cat-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border-radius:18px;background:linear-gradient(135deg,var(--pk),var(--pu));font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:8px}
.hero-title{font-size:22px;font-weight:900;margin-bottom:4px}
.hero-loc{font-size:13px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:4px}
.rating{display:flex;align-items:center;gap:4px;margin-top:5px}
.stars{color:#FFD700;font-size:13px}
.rating-num{font-size:13px;color:rgba(255,255,255,.7)}
.wrap{max-width:600px;margin:0 auto;padding:20px}
.action-btns{display:flex;gap:10px;margin-bottom:24px}
.wa-btn{flex:1;padding:14px;background:linear-gradient(135deg,#25D366,#128C7E);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.map-btn{flex:1;padding:14px;background:linear-gradient(135deg,#4285F4,#34A853);border:none;border-radius:14px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.card{background:var(--cd);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px;margin-bottom:16px}
.card-title{font-size:13px;font-weight:800;color:var(--pk);margin-bottom:12px;display:flex;align-items:center;gap:6px;text-transform:uppercase;letter-spacing:.5px}
.info-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:rgba(255,255,255,.75)}
.info-row i{color:var(--pk);width:16px;flex-shrink:0;margin-top:2px}
.services{display:flex;flex-wrap:wrap;gap:7px}
.svc-tag{padding:5px 12px;background:rgba(255,77,141,.1);border:1px solid rgba(255,77,141,.25);border-radius:20px;font-size:12px;color:var(--pl);font-weight:600}
.map-embed{border-radius:12px;overflow:hidden;height:180px;margin-bottom:16px}
.map-embed iframe{width:100%;height:100%;border:0}
.vid-title{font-size:15px;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.vid-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vid-card{border-radius:12px;overflow:hidden;position:relative;cursor:pointer;aspect-ratio:9/16}
.vid-card img{width:100%;height:100%;object-fit:cover}
.vid-card-ov{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.8) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:10px}
.vid-card-title{font-size:11px;font-weight:700;line-height:1.3}
.vid-views{font-size:10px;color:rgba(255,255,255,.6);margin-top:2px}
.book-float{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100}
.book-float a{display:flex;align-items:center;gap:8px;padding:14px 32px;background:linear-gradient(135deg,#25D366,#128C7E);border-radius:30px;color:#fff;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 6px 24px rgba(37,211,102,.45);white-space:nowrap}
</style>
</head>
<body>
<nav class="nav">
  <a href="/" class="nav-logo">&#128132; SEOUL BEAUTY TRIP</a>
  <a href="/" class="nav-back"><i class="fas fa-arrow-left"></i> Back</a>
</nav>

<div class="hero">
  <img src="${shop.thumbnail}" alt="${shop.name}">
  <div class="hero-ov"></div>
  <div class="hero-info">
    <div class="cat-badge">${shop.category}</div>
    <div class="hero-title">${shop.name}</div>
    <div class="hero-loc"><i class="fas fa-map-marker-alt" style="color:#FF4D8D"></i>${shop.location}</div>
    <div class="rating">
      <span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
      <span class="rating-num">${shop.rating} (${shop.reviewCount} reviews)</span>
    </div>
  </div>
</div>

<div class="wrap">
  <div class="action-btns" style="margin-top:20px">
    <a href="${waUrl}" target="_blank" class="wa-btn">
      <i class="fab fa-whatsapp" style="font-size:18px"></i> WhatsApp Book
    </a>
    <a href="${shop.googleMapUrl}" target="_blank" class="map-btn">
      <i class="fas fa-map-marker-alt"></i> Google Map
    </a>
  </div>

  <div class="card">
    <div class="card-title"><i class="fas fa-info-circle"></i> Shop Info</div>
    <div class="info-row"><i class="fas fa-clock"></i><span>${shop.hours}</span></div>
    <div class="info-row"><i class="fas fa-won-sign"></i><span>${shop.priceRange}</span></div>
    <div class="info-row"><i class="fas fa-map-marker-alt"></i><span>${shop.address}</span></div>
    <div class="info-row"><i class="fas fa-info"></i><span>${shop.description}</span></div>
  </div>

  <div class="card">
    <div class="card-title"><i class="fas fa-list"></i> Services</div>
    <div class="services">
      ${shop.services.map(s => `<span class="svc-tag">${s}</span>`).join('')}
    </div>
  </div>

  <div class="map-embed">
    <iframe src="${shop.googleMapEmbed}" allowfullscreen loading="lazy"></iframe>
  </div>

  ${shopVideos.length > 0 ? `
  <div class="vid-title"><i class="fas fa-play-circle" style="color:#FF4D8D"></i> Videos</div>
  <div class="vid-grid">
    ${shopVideos.map(v => `
    <div class="vid-card" onclick="window.location='/'">
      <img src="${v.thumbnail}" alt="${v.title}">
      <div class="vid-card-ov">
        <div class="vid-card-title">${v.title}</div>
        <div class="vid-views"><i class="fas fa-eye"></i> ${(v.views/1000).toFixed(1)}K</div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <div style="height:80px"></div>
</div>

<div class="book-float">
  <a href="${waUrl}" target="_blank">
    <i class="fab fa-whatsapp" style="font-size:20px"></i> Book via WhatsApp
  </a>
</div>
</body>
</html>`)
})

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
<title>Seoul Beauty Trip - Discover Korean Beauty</title>
<meta name="description" content="Book Korean beauty experiences in Seoul. Skincare, makeup, hair, nail and derma clinics. Foreign-friendly with WhatsApp booking.">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--pk:#FF4D8D;--pl:#FF85B3;--pu:#9B59B6;--bg:#0d0d18;--bg2:#13132a;--cd:#1c1c30}
html,body{height:100%;overflow:hidden;background:var(--bg);color:#fff;font-family:"Segoe UI",sans-serif}
#ld{position:fixed;inset:0;background:var(--bg);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .5s}
#ld .sub{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.3);text-transform:uppercase}
#ld .brand{font-size:40px;font-weight:900;letter-spacing:3px;background:linear-gradient(135deg,var(--pk),var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
#ld .sub2{font-size:10px;letter-spacing:5px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-top:-4px}
#ld .bar{width:140px;height:2px;background:rgba(255,255,255,.1);border-radius:2px;margin-top:16px;overflow:hidden}
#ld .prog{height:100%;background:linear-gradient(90deg,var(--pk),var(--pu));animation:lp 1.8s ease forwards}
@keyframes lp{from{width:0}to{width:100%}}
#hd{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 16px 12px;background:linear-gradient(to bottom,rgba(13,13,24,.97) 55%,transparent)}
.logo{display:flex;align-items:center;gap:9px;margin-bottom:11px}
.logo-ic{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--pk),var(--pu));display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.logo-nm{font-size:16px;font-weight:900;letter-spacing:1px;background:linear-gradient(135deg,#fff,var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-tg{font-size:8px;color:rgba(255,255,255,.32);letter-spacing:3px;text-transform:uppercase;-webkit-text-fill-color:rgba(255,255,255,.32)}
.cats{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat{flex-shrink:0;padding:6px 13px;border-radius:20px;border:1.5px solid rgba(255,77,141,.28);background:rgba(255,77,141,.05);color:rgba(255,255,255,.5);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.cat.on,.cat:hover{background:linear-gradient(135deg,var(--pk),var(--pu));border-color:transparent;color:#fff}
#feed{height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none}
#feed::-webkit-scrollbar{display:none}
.slide{height:100vh;width:100%;position:relative;scroll-snap-align:start;overflow:hidden;background:#000}
.bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.slide video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1}
.ov{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 22%,transparent 48%,rgba(0,0,0,.32) 68%,rgba(0,0,0,.88) 100%)}
.acts{position:absolute;right:12px;bottom:150px;z-index:3;display:flex;flex-direction:column;gap:16px;align-items:center}
.act{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer}
.act-ic{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.12);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:19px;color:#fff;transition:all .18s}
.act-ic:active{transform:scale(.9)}
.act-lb{font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9)}
.info{position:absolute;bottom:0;left:0;right:64px;padding:14px 16px 24px;z-index:3}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 11px;border-radius:18px;background:linear-gradient(135deg,var(--pk),var(--pu));font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
.vt{font-size:16px;font-weight:800;line-height:1.3;margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,.7)}
.vl{display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,.7);margin-bottom:5px}
.vd{font-size:12px;color:rgba(255,255,255,.62);line-height:1.55;margin-bottom:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vtags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.vtag{font-size:11px;color:var(--pl);font-weight:700}
.btns-row{display:flex;gap:8px;align-items:center}
.wa-btn{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:24px;border:none;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 14px rgba(37,211,102,.35);letter-spacing:.2px}
.shop-info-mini{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:11.5px;color:rgba(255,255,255,.6)}
.hint{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);z-index:3;display:flex;flex-direction:column;align-items:center;gap:1px;opacity:.45;animation:hb 2.2s infinite}
.hint span{font-size:9px;color:#fff;letter-spacing:1.5px}
@keyframes hb{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
#dots{position:fixed;left:8px;top:50%;transform:translateY(-50%);z-index:200;display:flex;flex-direction:column;gap:5px}
.dot{width:3px;height:3px;border-radius:2px;background:rgba(255,255,255,.2);transition:all .3s}
.dot.on{background:var(--pk);height:18px}
#muteBtn{position:fixed;top:50%;right:12px;transform:translateY(-50%);z-index:200;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px)}
/* 업체 모달 */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(8px)}
.modal-bg.open{display:flex}
.modal{background:var(--bg2);border-radius:24px 24px 0 0;padding:0 0 40px;width:100%;max-width:520px;border:1px solid rgba(255,77,141,.2);border-bottom:none;animation:su .3s cubic-bezier(.32,1,.32,1);position:relative;height:80vh;display:flex;flex-direction:column;touch-action:pan-y}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
/* 모달 핸들 영역 */
.modal-handle-area{flex-shrink:0;padding:12px 20px 0;cursor:grab;display:flex;flex-direction:column;align-items:center;gap:10px}
.mhdl{width:40px;height:4px;background:rgba(255,255,255,.2);border-radius:3px;transition:background .2s}
.mhdl:hover{background:rgba(255,255,255,.4)}
.modal-top-row{display:flex;align-items:center;justify-content:space-between;width:100%}
.modal-top-title{font-size:12px;color:rgba(255,255,255,.35);font-weight:700;letter-spacing:1px;text-transform:uppercase}
.mcls{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.mcls:hover{background:rgba(255,77,141,.2);color:#fff}
/* 모달 스크롤 영역 */
.modal-scroll{flex:1;overflow-y:auto;padding:16px 20px 0;scrollbar-width:thin;scrollbar-color:rgba(255,77,141,.3) transparent}
.modal-scroll::-webkit-scrollbar{width:3px}
.modal-scroll::-webkit-scrollbar-track{background:transparent}
.modal-scroll::-webkit-scrollbar-thumb{background:rgba(255,77,141,.3);border-radius:3px}
/* 숍 헤더 */
.shop-header{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}
.shop-thumb{width:72px;height:72px;border-radius:14px;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,77,141,.2)}
.shop-nm{font-size:17px;font-weight:900;margin-bottom:3px;line-height:1.3}
.shop-loc{font-size:12px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:4px;margin-bottom:5px}
.shop-rating{display:flex;align-items:center;gap:5px;font-size:12px}
.shop-stars{color:#FFD700;font-size:13px}
/* 섹션 */
.m-section{margin-bottom:16px}
.m-section-title{font-size:10px;font-weight:800;color:var(--pk);letter-spacing:1px;text-transform:uppercase;margin-bottom:9px;display:flex;align-items:center;gap:5px;padding-bottom:6px;border-bottom:1px solid rgba(255,77,141,.1)}
.m-info-row{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:rgba(255,255,255,.72);margin-bottom:8px}
.m-info-row i{color:var(--pk);width:14px;flex-shrink:0;margin-top:2px}
/* 가격 리스트 */
.m-price-list{display:flex;flex-direction:column;gap:0}
.m-price-item{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.m-price-item:last-child{border-bottom:none}
.m-price-name{font-size:13px;color:rgba(255,255,255,.8);font-weight:500}
.m-price-val{font-size:13px;color:var(--pl);font-weight:800}
/* 구글맵 임베드 */
.m-map{border-radius:14px;overflow:hidden;height:180px;margin-bottom:16px;border:1px solid rgba(255,255,255,.07);position:relative}
.m-map iframe{width:100%;height:100%;border:0;display:block}
.m-map-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(20,20,40,.9);flex-direction:column;gap:8px;font-size:12px;color:rgba(255,255,255,.5)}
/* 버튼 */
.m-btns{display:flex;flex-direction:column;gap:9px;padding:16px 20px 0}
.m-wa{display:flex;align-items:center;justify-content:center;gap:9px;padding:15px;background:linear-gradient(135deg,#25D366,#128C7E);border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,.3);transition:opacity .2s}
.m-wa:active{opacity:.85}
.m-detail{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:rgba(255,255,255,.65);font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}
.m-detail:hover{background:rgba(255,255,255,.09);color:#fff}
#toast{position:fixed;bottom:70px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba(255,77,141,.9);color:#fff;padding:8px 18px;border-radius:18px;font-size:12px;font-weight:700;z-index:600;opacity:0;transition:all .28s;white-space:nowrap;pointer-events:none}
#toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
/* adm 링크 제거됨 */
</style>
</head>
<body>
<div id="ld">
  <div class="sub">Discover</div>
  <div style="font-size:36px;margin-bottom:-4px">&#10024;</div>
  <div class="brand">SEOUL</div>
  <div class="sub2">BEAUTY TRIP</div>
  <div class="bar"><div class="prog"></div></div>
</div>

<header id="hd">
  <div class="logo" id="logoBtn" style="cursor:pointer;user-select:none">
    <div class="logo-ic">&#10024;</div>
    <div>
      <div class="logo-nm">SEOUL BEAUTY TRIP</div>
      <div class="logo-tg">Korean Beauty Experience</div>
    </div>
  </div>
  <div class="cats" id="cats">
    <button class="cat on" data-cat="all">&#10024; All</button>
    <button class="cat" data-cat="skincare">&#127807; Skincare</button>
    <button class="cat" data-cat="makeup">&#128139; Makeup</button>
    <button class="cat" data-cat="hair">&#128135; Hair</button>
    <button class="cat" data-cat="nail">&#128133; Nail</button>
    <button class="cat" data-cat="clinic">&#127973; Clinic</button>
  </div>
</header>

<div id="dots"></div>
<button id="muteBtn" onclick="toggleMute()"><i class="fas fa-volume-mute"></i></button>
<div id="feed"></div>
<div id="toast"></div>

<!-- 관리자 비밀번호 모달 -->
<div id="adminModal" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.88);backdrop-filter:blur(10px);align-items:center;justify-content:center">
  <div style="background:#13132a;border:1px solid rgba(255,77,141,.25);border-radius:20px;padding:28px 24px;width:280px;max-width:90vw;text-align:center">
    <div style="font-size:28px;margin-bottom:8px">&#128274;</div>
    <div style="font-size:15px;font-weight:800;margin-bottom:4px;background:linear-gradient(135deg,#FF4D8D,#FF85B3);-webkit-background-clip:text;-webkit-text-fill-color:transparent">관리자 로그인</div>
    <div style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:18px">비밀번호를 입력하세요</div>
    <form onsubmit="checkAdminPw();return false;" autocomplete="off">
      <input type="text" name="username" style="display:none" autocomplete="username">
      <input id="adminPwInput" type="password" placeholder="비밀번호" autocomplete="current-password" style="width:100%;padding:11px 14px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,77,141,.25);border-radius:11px;color:#fff;font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:12px">
      <div style="display:flex;gap:8px">
        <button type="submit" style="flex:1;padding:11px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer">확인</button>
        <button type="button" onclick="closeAdminModal()" style="flex:1;padding:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.5);font-size:13px;font-weight:700;cursor:pointer">취소</button>
      </div>
    </form>
    <div id="adminPwErr" style="font-size:11px;color:#ef4444;margin-top:10px;display:none">❌ 비밀번호가 틀렸습니다</div>
  </div>
</div>

<!-- 업체 정보 모달 -->
<div class="modal-bg" id="shopModal">
  <div class="modal" id="modalPanel">
    <div class="modal-handle-area" id="modalHandle">
      <div class="mhdl"></div>
      <div class="modal-top-row">
        <span class="modal-top-title">Shop Info</span>
        <button class="mcls" onclick="closeModal()">&#10005;</button>
      </div>
    </div>
    <div class="modal-scroll" id="modalContent"></div>
    <div class="m-btns" id="modalBtns"></div>
  </div>
</div>

<script>
var vids = [], isMuted = true, liked = {}, platform = {};
var catIcons = {skincare:'&#127807;',makeup:'&#128139;',hair:'&#128135;',nail:'&#128133;',clinic:'&#127973;'};

fetch('/api/platform').then(function(r){return r.json();}).then(function(d){ platform = d; });

function loadVideos(cat) {
  fetch('/api/videos?category='+(cat||'all')).then(function(r){return r.json();}).then(function(d){
    vids = d.videos || [];
    renderFeed();
  });
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderFeed() {
  var feed = document.getElementById('feed');
  var dots = document.getElementById('dots');
  feed.innerHTML = ''; dots.innerHTML = '';
  for(var i=0;i<vids.length;i++){
    var dot=document.createElement('div');
    dot.className='dot'+(i===0?' on':''); dot.id='dot'+i;
    dots.appendChild(dot);
  }
  for(var i=0;i<vids.length;i++){ buildSlide(vids[i],i); }
  setupObs();
}

function buildSlide(v, idx) {
  var feed = document.getElementById('feed');
  var shop = v.shop || {};
  var s = document.createElement('div');
  s.className='slide'; s.id='sl'+idx;
  var tags = (v.tags||[]).map(function(t){return '<span class="vtag">'+esc(t)+'</span>';}).join('');

  s.innerHTML =
    '<img class="bg-img" src="'+esc(v.thumbnail)+'" alt="'+esc(v.title)+'">' +
    '<video id="vid'+idx+'" src="'+esc(v.videoUrl)+'" loop muted playsinline preload="metadata" poster="'+esc(v.thumbnail)+'"></video>' +
    '<div class="ov"></div>' +
    '<div class="acts">' +
      '<div class="act" id="alke'+idx+'"><div class="act-ic" id="lkic'+esc(v.id)+'"><i class="fas fa-heart"></i></div><span class="act-lb" id="lklb'+esc(v.id)+'">Like</span></div>' +
      '<div class="act" id="ashop'+idx+'"><div class="act-ic"><i class="fas fa-store"></i></div><span class="act-lb">Shop</span></div>' +
      '<div class="act" id="ashare'+idx+'"><div class="act-ic"><i class="fas fa-share"></i></div><span class="act-lb">Share</span></div>' +
    '</div>' +
    '<div class="info">' +
      '<div class="badge">'+(catIcons[shop.category]||'&#10024;')+' '+esc(shop.category||'')+'</div>' +
      '<div class="vt">'+esc(v.title)+'</div>' +
      '<div class="shop-info-mini"><i class="fas fa-store" style="color:#FF4D8D"></i>'+esc(shop.name||'')+' &nbsp;|&nbsp; <i class="fas fa-map-marker-alt" style="color:#FF4D8D"></i>'+esc(shop.location||'')+'</div>' +
      '<div class="vd">'+esc(v.description)+'</div>' +
      '<div class="vtags">'+tags+'</div>' +
      '<div class="btns-row">' +
        '<div class="wa-btn" id="wabtn'+idx+'"><i class="fab fa-whatsapp" style="font-size:15px"></i> Book & Shop Info</div>' +
      '</div>' +
    '</div>' +
    '<div class="hint"><i class="fas fa-chevron-up" style="font-size:11px"></i><span>SWIPE UP</span></div>';

  feed.appendChild(s);

  (function(vid, vidIdx, shop) {
    var ve = document.getElementById('vid'+vidIdx);
    if(ve) ve.onerror = function(){ ve.style.display='none'; };
    document.getElementById('alke'+vidIdx).onclick = function(){ doLike(vid.id); };
    document.getElementById('ashop'+vidIdx).onclick = function(){ openShopModal(shop); };
    document.getElementById('ashare'+vidIdx).onclick = function(){ doShare(vid.title); };
    document.getElementById('wabtn'+vidIdx).onclick = function(){ openShopModal(shop); };
    // 조회수 기록
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
  },{threshold:0.65});
  document.querySelectorAll('.slide').forEach(function(s){obs.observe(s);});
}

function openWhatsApp(shop, videoTitle) {
  var waNum = platform.whatsapp || '821012345678';
  var msg = 'Hi! I found ' + (shop.name||'your shop') + ' on Seoul Beauty Trip and I would like to book a service.';
  if(shop.location) msg += ' Location: ' + shop.location + '.';
  if(shop.priceRange) msg += ' Price range: ' + shop.priceRange + '.';
  var url = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(msg);
  window.open(url, '_blank');
}

function openShopModal(shop) {
  if(!shop || !shop.id) return;
  var waNum = platform.whatsapp || '821012345678';
  var waMsg = 'Hi! I found ' + (shop.name||'your shop') + ' on Seoul Beauty Trip and I would like to book a service. Shop: ' + (shop.name||'') + ' (' + (shop.location||'') + ')';
  var waUrl = 'https://wa.me/'+waNum+'?text='+encodeURIComponent(waMsg);
  var mapUrl = shop.googleMapUrl || ('https://maps.google.com/?q='+encodeURIComponent((shop.name||'')+(shop.address?' '+shop.address:'')));

  /* 구글맵 임베드 */
  var embedSrc = shop.googleMapEmbed || '';
  var mapHtml = embedSrc
    ? '<div class="m-section"><div class="m-section-title"><i class="fas fa-map"></i> Location</div><div class="m-map"><iframe src="'+embedSrc+'" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div></div>'
    : '';

  /* 가격 리스트 */
  var prices = shop.servicePrices || [];
  var priceHtml = '';
  if(prices.length > 0) {
    var rows = prices.map(function(p){
      return '<div class="m-price-item"><span class="m-price-name">'+p.name+'</span><span class="m-price-val">'+p.price+'</span></div>';
    }).join('');
    priceHtml = '<div class="m-section"><div class="m-section-title"><i class="fas fa-tag"></i> Price List</div><div class="m-price-list">'+rows+'</div></div>';
  } else if(shop.priceRange) {
    priceHtml = '<div class="m-section"><div class="m-section-title"><i class="fas fa-tag"></i> Price</div><div class="m-info-row"><i class="fas fa-won-sign"></i><span>'+shop.priceRange+'</span></div></div>';
  }

  /* 모달 콘텐츠 */
  var thumbHtml = shop.thumbnail
    ? '<img class="shop-thumb" id="mThumb" src="'+esc(shop.thumbnail)+'">'
    : '';
  document.getElementById('modalContent').innerHTML =
    '<div class="shop-header">' +
      thumbHtml +
      '<div style="flex:1;min-width:0">' +
        '<div class="shop-nm">'+esc(shop.name||'')+'</div>' +
        '<div class="shop-loc"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;font-size:11px"></i><span style="margin-left:2px">'+esc(shop.location||'')+'</span></div>' +
        '<div class="shop-rating"><span class="shop-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><span style="color:rgba(255,255,255,.45);font-size:11px;margin-left:4px">'+(shop.rating||5.0)+' ('+(shop.reviewCount||0)+' reviews)</span></div>' +
      '</div>' +
    '</div>' +

    '<div class="m-section">' +
      '<div class="m-section-title"><i class="fas fa-store"></i> Basic Info</div>' +
      '<div class="m-info-row"><i class="fas fa-clock"></i><span>'+(shop.hours||'Please contact us')+'</span></div>' +
      '<div class="m-info-row"><i class="fas fa-map-marker-alt"></i><span>'+(shop.address||shop.location||'')+'</span></div>' +
    '</div>' +

    priceHtml +
    mapHtml;

  /* 하단 버튼 - WhatsApp 예약만 */
  document.getElementById('modalBtns').innerHTML =
    '<a href="'+waUrl+'" target="_blank" class="m-wa"><i class="fab fa-whatsapp" style="font-size:19px"></i> Book via WhatsApp</a>';

  document.getElementById('shopModal').classList.add('open');
  /* 열릴 때 스크롤 최상단으로 */
  document.getElementById('modalContent').scrollTop = 0;
  /* 썸네일 에러 처리 */
  var mThumb = document.getElementById('mThumb');
  if(mThumb) mThumb.onerror = function(){ this.style.display='none'; };
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

/* 배경 클릭으로 닫기 */
document.getElementById('shopModal').addEventListener('click', function(e){
  if(e.target === this) closeModal();
});

/* 스와이프 다운으로 닫기 */
(function(){
  var panel = document.getElementById('modalPanel');
  var handle = document.getElementById('modalHandle');
  var startY = 0, startScrollTop = 0, dragging = false, isDragFromHandle = false;

  function onStart(e) {
    var touch = e.touches ? e.touches[0] : e;
    startY = touch.clientY;
    startScrollTop = document.getElementById('modalContent').scrollTop;
    dragging = true;
    isDragFromHandle = e.currentTarget === handle;
    panel.style.transition = 'none';
  }
  function onMove(e) {
    if(!dragging) return;
    var touch = e.touches ? e.touches[0] : e;
    var dy = touch.clientY - startY;
    /* 핸들에서 드래그하거나, 콘텐츠 최상단에서 아래로 당길 때만 */
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
  /* 마우스 드래그 (데스크톱) */
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

function doLike(id){
  liked[id]=!liked[id];
  var ic=document.getElementById('lkic'+id);
  var lb=document.getElementById('lklb'+id);
  if(ic){ic.style.color=liked[id]?'#FF4D8D':'#fff';ic.style.background=liked[id]?'rgba(255,77,141,.4)':'rgba(255,255,255,.12)';}
  if(lb){lb.textContent=liked[id]?'Liked!':'Like';}
  showToast(liked[id]?'&#10084;&#65039; Added to favorites!':'Removed');
}
function doShare(title){
  if(navigator.share){navigator.share({title:title,url:location.href});}
  else{navigator.clipboard.writeText(location.href);showToast('&#128279; Link copied!');}
}
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
  /* 카테고리 필터 */
  document.querySelectorAll('.cat').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.cat').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      loadVideos(b.getAttribute('data-cat'));
      document.getElementById('feed').scrollTo({top:0});
    });
  });

  /* ── 로고 3번 클릭 → 관리자 비밀번호 모달 ── */
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
      setTimeout(function(){ inp.style.borderColor = 'rgba(255,77,141,.25)'; }, 1200);
    }
  };
  document.getElementById('adminModal').addEventListener('click', function(e){
    if(e.target === this) window.closeAdminModal();
  });

  /* 로딩 스크린 */
  setTimeout(function(){
    var ld = document.getElementById('ld');
    ld.style.opacity = '0';
    setTimeout(function(){ ld.style.display = 'none'; }, 500);
  }, 1800);

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

  <!-- ③ 영상 추가 패널 (업체 클릭 시 슬라이드다운) -->
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

  <!-- ④ 영상 목록 (업체별) -->
  <div class="card">
    <div class="card-title" style="margin-bottom:14px"><i class="fas fa-film" style="color:#FF4D8D"></i> 등록된 영상 목록</div>
    <div id="videoList"></div>
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

// safe-img: data-fallback 속성으로 onerror 대체 (스크립트 문자열 이스케이프 문제 방지)
document.addEventListener('error', function(e){
  var t = e.target;
  if(t && t.tagName === 'IMG' && t.classList.contains('safe-img')){
    var fb = t.getAttribute('data-fallback');
    if(fb) t.src = fb;
    else t.style.display = 'none';
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
  var delVideoBtn = e.target.closest('.del-video-btn');
  if(delVideoBtn){ delVideo(delVideoBtn.getAttribute('data-id')); return; }
  var addVideoBtn = e.target.closest('[data-add-video]');
  if(addVideoBtn){ openVideoPanel(addVideoBtn.getAttribute('data-add-video')); return; }
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
  var catColors = {skincare:'#f472b6',makeup:'#c084fc',hair:'#60a5fa',nail:'#34d399',clinic:'#fb923c',spa:'#a78bfa'};
  var catLabels = {skincare:'스킨케어',makeup:'메이크업',hair:'헤어',nail:'네일',clinic:'클리닉',spa:'스파'};
  el.innerHTML = '<div style="display:grid;gap:12px">' + shops.map(function(s){
    var vcount = videos.filter(function(v){return v.shopId===s.id;}).length;
    var catColor = catColors[s.category] || '#aaa';
    var catLabel = catLabels[s.category] || s.category;
    var initial = (s.name||'S')[0].toUpperCase();
    return '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;display:flex;gap:14px;align-items:flex-start;transition:border .2s" onmouseover="this.style.borderColor=\'rgba(255,77,141,.4)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\'">'
      // 썸네일 or 이니셜
      +'<div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,rgba(255,77,141,.2),rgba(155,89,182,.2));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#FF4D8D">'
        +(s.thumbnail ? '<img src="'+s.thumbnail+'" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent=\''+initial+'\'">' : initial)
      +'</div>'
      // 메타정보
      +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
          +'<span style="font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.name+'</span>'
          +'<span style="flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:rgba(255,255,255,.07);color:'+catColor+'">'+catLabel+'</span>'
        +'</div>'
        +(s.location ? '<div style="font-size:11px;color:rgba(255,255,255,.45);margin-bottom:4px"><i class="fas fa-map-marker-alt" style="color:#FF4D8D;margin-right:4px"></i>'+s.location+'</div>' : '')
        +(s.address ? '<div style="font-size:11px;color:rgba(255,255,255,.3);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+s.address+'</div>' : '')
        +'<div style="display:flex;align-items:center;gap:10px">'
          +'<span style="font-size:11px;color:#a78bfa"><i class="fas fa-film" style="margin-right:3px"></i>'+vcount+'개 영상</span>'
          +(s.priceRange ? '<span style="font-size:11px;color:#34d399">'+s.priceRange+'</span>' : '')
        +'</div>'
      +'</div>'
      // 액션 버튼
      +'<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
        +'<button data-add-video="'+s.id+'" style="padding:6px 12px;background:linear-gradient(135deg,#FF4D8D,#9B59B6);border:none;border-radius:8px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap"><i class="fas fa-plus"></i> 영상</button>'
        +'<button class="del-shop-btn" data-id="'+s.id+'" style="padding:6px 12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);border-radius:8px;color:#f87171;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap"><i class="fas fa-trash"></i> 삭제</button>'
      +'</div>'
    +'</div>';
  }).join('') + '</div>';
}

// ── 영상 목록 렌더 (업체별 그룹) ──
function renderVideos(){
  var el = document.getElementById('videoList');
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

  // 숨겨진 title 저장용 (파일명 자동 사용)
  var titleIn = document.createElement('input');
  titleIn.className = 'vid-form-title';
  titleIn.type = 'hidden';

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
    titleIn.value = file.name.split('.').slice(0,-1).join('.') || file.name;
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
  row.appendChild(titleIn);
  row.appendChild(descIn);
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
    googleMapEmbed:'',
    thumbnail:'',
    services:svcs,
    servicePrices:svcPrices,
    description:document.getElementById('sh-desc').value||'',
    rating:5.0, reviewCount:0
  })}).then(function(r){return r.json();}).then(function(res){
    var newShopId = res.id || null;
    // 폼 초기화
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
