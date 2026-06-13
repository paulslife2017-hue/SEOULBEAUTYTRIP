const { Client } = require('pg');
const DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const r = await c.query('SELECT id, name, review_summary FROM shops WHERE review_summary IS NOT NULL LIMIT 3');
  r.rows.forEach(row => {
    console.log('name:', row.name);
    console.log('  typeof review_summary:', typeof row.review_summary);
    console.log('  value:', JSON.stringify(row.review_summary));
    console.log('  truthy:', !!row.review_summary);
    // simulate mapShop logic
    const rs = row.review_summary;
    let result;
    if (!rs) result = null;
    else if (typeof rs === 'object' && !Array.isArray(rs)) result = rs;
    else { try { result = JSON.parse(rs); } catch { result = null; } }
    console.log('  -> mapped:', JSON.stringify(result));
    console.log();
  });
  await c.end();
}
main().catch(console.error);
