import 'dotenv/config';
import { query } from './config/database.js';

(async () => {
  try {
    // Check forecast data
    const forecasts = await query('SELECT COUNT(*) as count FROM forecast_results');
    console.log('Forecast records:', forecasts[0].count);
    
    // Check recommendations
    const recs = await query('SELECT COUNT(*) as count FROM inventory_recommendations');
    console.log('Recommendation records:', recs[0].count);
    
    // Get all products
    const products = await query('SELECT id, name, safety_stock, reorder_point FROM products WHERE is_active = TRUE');
    console.log(`\nGenerating recommendations for ${products.length} products...`);
    
    for (const product of products) {
      // Get average sales for this product in last 30 days
      const [salesAvg] = await query(`
        SELECT COUNT(*) as total_sales, AVG(quantity) as avg_qty FROM sales 
        WHERE product_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `, [product.id]);
      
      const avgQty = salesAvg?.avg_qty ? Math.ceil(salesAvg.avg_qty) : 10;
      const recommendedStock = avgQty * 7;
      const optimalOrderQty = avgQty * 14;
      
      // Determine risk level
      let riskLevel = 'low';
      let riskType = 'none';
      
      try {
        await query(`
          INSERT INTO inventory_recommendations 
          (product_id, recommended_stock, optimal_order_quantity, risk_level, risk_type, reasoning)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            recommended_stock = VALUES(recommended_stock),
            optimal_order_quantity = VALUES(optimal_order_quantity),
            risk_level = VALUES(risk_level),
            risk_type = VALUES(risk_type)
        `, [
          product.id,
          recommendedStock,
          optimalOrderQty,
          riskLevel,
          riskType,
          `Based on average ${avgQty} units/day over last 30 days`
        ]);
        console.log(`✅ Generated recommendation for: ${product.name}`);
      } catch (e) {
        console.log(`⚠️  Skipped ${product.name}: ${e.message}`);
      }
    }
    
    const finalCount = await query('SELECT COUNT(*) as count FROM inventory_recommendations');
    console.log(`\n✅ Total recommendations: ${finalCount[0].count}`);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
