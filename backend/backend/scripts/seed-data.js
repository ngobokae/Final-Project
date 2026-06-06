// Script to seed sample sales data for testing
import 'dotenv/config';
import { query } from '../config/database.js';

const seedSalesData = async () => {
  try {
    console.log('Seeding sample sales data...');

    // Get ALL active products (not just 5)
    const products = await query('SELECT id, unit_price FROM products WHERE is_active = TRUE');
    
    if (products.length === 0) {
      console.log('No products found. Please ensure products are created first.');
      return;
    }

    console.log(`Found ${products.length} products. Creating inventory records...`);

    // Ensure inventory records exist for all products
    for (const product of products) {
      await query(
        'INSERT IGNORE INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, ?, ?)',
        [product.id, Math.floor(Math.random() * 300) + 200, Math.floor(Math.random() * 20)]
      );
    }

    console.log('✅ Created/verified inventory records for all products');

    // Generate sales data for the last 90 days
    const sales = [];
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const saleDate = new Date(today);
      saleDate.setDate(saleDate.getDate() - i);
      
      // Random product
      const product = products[Math.floor(Math.random() * products.length)];
      
      // Random quantity (1-50)
      const quantity = Math.floor(Math.random() * 50) + 1;
      
      const unitPrice = product.unit_price;
      const totalAmount = quantity * unitPrice;
      
      sales.push({
        product_id: product.id,
        sale_date: saleDate.toISOString().split('T')[0],
        quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        customer_name: `Customer ${Math.floor(Math.random() * 100)}`,
        region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)]
      });
    }

    // Insert sales
    for (const sale of sales) {
      await query(
        `INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sale.product_id, sale.sale_date, sale.quantity, sale.unit_price, sale.total_amount, sale.customer_name, sale.region]
      );
    }

    console.log(`✅ Seeded ${sales.length} sales records`);
    
    // Set realistic inventory levels (NOT depleted by sales)
    // This ensures Inventory module shows data like Operations module does
    for (const product of products) {
      await query(
        'UPDATE inventory SET current_stock = ?, reserved_stock = ? WHERE product_id = ?',
        [Math.floor(Math.random() * 300) + 200, Math.floor(Math.random() * 20), product.id]
      );
    }

    console.log('✅ Set realistic inventory levels for all products');
    console.log('✅ Seeding complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedSalesData();

seedSalesData();
