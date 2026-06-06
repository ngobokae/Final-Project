import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    console.log('Checking alert product_id values...\n');
    
    // Check what product_ids are in the alerts
    const alertProducts = await query(`
      SELECT DISTINCT a.product_id, COUNT(*) as count
      FROM alerts a
      GROUP BY a.product_id
      LIMIT 15
    `);
    
    console.log('Product IDs in alerts:');
    alertProducts.forEach(row => {
      console.log(`  ${row.product_id}: ${row.count} alerts`);
    });
    
    // Check what product IDs we have in products table
    console.log('\nProducts in database (first 10):');
    const products = await query('SELECT id, sku, name FROM products LIMIT 10');
    products.forEach(p => {
      console.log(`  ID ${p.id}: ${p.sku} - ${p.name}`);
    });
    
    // Try JOIN with proper CAST/type handling
    console.log('\nAlert with product info (with CAST):');
    const alertsWithProducts = await query(`
      SELECT 
        a.id, a.alert_type, a.severity, a.message,
        CAST(a.product_id AS CHAR) as alert_product_id,
        p.id as product_id, p.name as product_name, p.sku
      FROM alerts a
      LEFT JOIN products p ON CAST(a.product_id AS UNSIGNED) = p.id
      WHERE a.is_resolved = 0
      LIMIT 5
    `);
    
    console.log(JSON.stringify(alertsWithProducts, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
