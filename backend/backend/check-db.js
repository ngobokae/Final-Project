import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    const products = await query('SELECT id, name, unit_cost, unit_price FROM products LIMIT 10');
    console.log('PRODUCTS:');
    console.log(JSON.stringify(products, null, 2));
    
    const inventory = await query('SELECT product_id, current_stock, available_stock FROM inventory LIMIT 10');
    console.log('\nINVENTORY:');
    console.log(JSON.stringify(inventory, null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
