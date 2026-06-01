const { neon } = require('@neondatabase/serverless')
const sql = neon('postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require')

async function run() {
  // 최근 등록 업체 10개
  const rows = await sql`SELECT id, name, slug, thumbnail, photos, created_at FROM shops ORDER BY created_at DESC LIMIT 10`
  for (const r of rows) {
    const thumb = r.thumbnail || ''
    const photos = Array.isArray(r.photos) ? r.photos : (r.photos ? JSON.parse(r.photos) : [])
    const thumbOk = thumb.startsWith('https://') ? '✅' : (thumb ? '⚠️ NOT-HTTPS' : '❌ EMPTY')
    const photosOk = photos.length > 0 ? photos.filter(p => !p.startsWith('https://')).length === 0 ? `✅ ${photos.length}장` : `⚠️ 일부 비정상 ${photos.length}장` : '❌ 없음'
    console.log(`[${r.created_at?.toString().slice(0,10)}] ${r.name}`)
    console.log(`  thumb: ${thumbOk} ${thumb.slice(0,80)}`)
    console.log(`  photos: ${photosOk}`)
    if (photos.length > 0) {
      photos.slice(0,3).forEach((p, i) => {
        const ok = p.startsWith('https://') ? '✅' : '❌'
        console.log(`    [${i}] ${ok} ${p.slice(0,80)}`)
      })
    }
    console.log('')
  }
}
run().catch(console.error)
