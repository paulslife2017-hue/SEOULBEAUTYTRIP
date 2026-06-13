const { Client } = require('pg');
const DB_URL = 'postgresql://neondb_owner:npg_EH0lzSpsK4Ah@ep-floral-forest-aqvv2mhn-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const r = await client.query('SELECT id, name, reviews, review_summary FROM shops WHERE reviews IS NOT NULL LIMIT 5');
  r.rows.forEach(row => {
    console.log('\n---', row.id, row.name);
    console.log('review_summary:', row.review_summary);
    const revs = Array.isArray(row.reviews) ? row.reviews : [];
    revs.slice(0, 3).forEach((rv, i) => {
      console.log('  [' + (i+1) + ']', (rv.text || '').slice(0, 120));
    });
  });

  await client.end();
}

main().catch(console.error);
