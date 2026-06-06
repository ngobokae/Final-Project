import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    const result = await query('SELECT i.product_id, i.current_stock, i.available_stock, p.name, p.unit_cost, p.unit_price FROM inventory i JOIN products p ON i.product_id = p.id LIMIT 5');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
