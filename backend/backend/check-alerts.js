import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    console.log('Checking alerts in database...\n');
    
    // Check if alerts exist
    const alertCount = await query('SELECT COUNT(*) as count FROM alerts');
    console.log(`Total alerts in database: ${alertCount[0].count}`);
    
    // Check active alerts
    const activeAlerts = await query(`
      SELECT a.id, a.alert_type, a.severity, a.message, a.is_resolved, 
             p.name as product_name, p.sku,
             i.current_stock, i.available_stock, p.reorder_point, p.safety_stock
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN inventory i ON a.product_id = i.product_id
      WHERE a.is_resolved = 0
      LIMIT 10
    `);
    
    if (activeAlerts.length > 0) {
      console.log('\n✅ Active Alerts Found:');
      console.log(JSON.stringify(activeAlerts, null, 2));
    } else {
      console.log('\n⚠️  No active alerts found. Generating alerts from inventory...\n');
      
      // Get inventory with stock issues
      const issues = await query(`
        SELECT 
          i.product_id, 
          i.current_stock, 
          i.available_stock,
          p.name, p.sku, p.safety_stock, p.reorder_point
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LIMIT 5
      `);
      
      console.log('Inventory Status:');
      issues.forEach(item => {
        console.log(`  ${item.sku}: ${item.available_stock} units (safety: ${item.safety_stock}, reorder: ${item.reorder_point})`);
      });
      
      // Try to generate alerts by calling the endpoint
      console.log('\nNote: Alerts are generated when the /api/inventory/alerts endpoint is called.');
      console.log('Try opening the Alerts page in the browser to trigger alert generation.');
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
