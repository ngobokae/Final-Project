import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    const schema = await query("DESCRIBE inventory_recommendations");
    console.log(JSON.stringify(schema, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
