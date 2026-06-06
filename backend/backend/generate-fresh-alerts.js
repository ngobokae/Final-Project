import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    console.log('Generating fresh alerts for current inventory...\n');
    
    // Get all current Kinglion products (IDs 18-27)
    const products = await query('SELECT id, name, sku, safety_stock, reorder_point FROM products WHERE id >= 18 AND id <= 27');
    
    console.log(`Found ${products.length} Kinglion products. Generating alerts...\n`);
    
    for (const product of products) {
      const inventory = await query('SELECT available_stock FROM inventory WHERE product_id = ?', [product.id]);
      
      if (!inventory.length) continue;
      
      const availableStock = inventory[0].available_stock || 0;
      const safetyStock = product.safety_stock || 50;
      const reorderPoint = product.reorder_point || 100;
      
      // Determine alert type based on stock levels
      let alertType = 'normal';
      let severity = 'low';
      let message = '';
      
      if (availableStock <= safetyStock) {
        alertType = 'shortage';
        severity = 'critical';
        message = `CRITICAL: ${product.name} (${product.sku}) is below safety stock. Current: ${availableStock} units, Safety stock: ${safetyStock} units. IMMEDIATE ACTION REQUIRED.`;
      } else if (availableStock < reorderPoint) {
        alertType = 'reorder';
        severity = availableStock <= (reorderPoint * 0.5) ? 'high' : 'medium';
        message = `${product.name} (${product.sku}) is below reorder point. Current: ${availableStock} units, Reorder point: ${reorderPoint} units.`;
      } else if (availableStock >= (reorderPoint * 2)) {
        alertType = 'overstock';
        severity = 'low';
        message = `${product.name} (${product.sku}) exceeds optimal levels. Current: ${availableStock} units. Consider reducing orders.`;
      }
      
      if (alertType !== 'normal') {
        // Check if alert already exists for this product
        const existing = await query('SELECT id FROM alerts WHERE product_id = ? AND alert_type = ? AND is_resolved = 0', [product.id, alertType]);
        
        if (existing.length === 0) {
          await query(
            'INSERT INTO alerts (product_id, alert_type, severity, message, is_resolved) VALUES (?, ?, ?, ?, 0)',
            [product.id, alertType, severity, message]
          );
          console.log(`✅ ${alertType.toUpperCase()}: ${product.name}`);
        }
      }
    }
    
    // Show summary
    const totalAlerts = await query('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0 AND product_id IS NOT NULL AND product_id >= 18');
    const critical = await query('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0 AND severity = "critical" AND product_id IS NOT NULL');
    const high = await query('SELECT COUNT(*) as count FROM alerts WHERE is_resolved = 0 AND severity = "high" AND product_id IS NOT NULL');
    
    console.log(`\n📊 Alert Summary:`);
    console.log(`  Total Active Alerts: ${totalAlerts[0].count}`);
    console.log(`  🔴 Critical: ${critical[0].count}`);
    console.log(`  🟠 High: ${high[0].count}`);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
