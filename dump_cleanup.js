import { query } from './backend/backend/config/database.js';

async function dump() {
  try {
    const products = await query('SELECT id, name, sku FROM products');
    console.log('PRODUCTS:');
    console.log(JSON.stringify(products, null, 2));

    const logs = await query("SELECT id, action, entity_type, created_at FROM audit_logs WHERE created_at >= '2026-04-24 00:00:00' AND created_at < '2026-04-25 00:00:00'");
    console.log('LOGS 2026-04-24:');
    console.log(JSON.stringify(logs, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

dump();
