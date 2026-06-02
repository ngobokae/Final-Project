import { query } from './backend/backend/config/database.js';

async function test() {
  try {
    const cols = await query('SHOW COLUMNS FROM procurement_orders');
    console.log('Columns:', JSON.stringify(cols, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

test();
