// Script to seed sample sales data for testing
import { query } from '../config/database.js';

const seedSalesData = async () => {
  try {
    console.log('Seeding sample sales data...');

    // Get products
    const products = await query('SELECT id FROM products LIMIT 5');
    
    if (products.length === 0) {
      console.log('No products found. Please ensure products are created first.');
      return;
    }

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
      
      // Get product price
      const [productData] = await query('SELECT unit_price FROM products WHERE id = ?', [product.id]);
      const unitPrice = productData.unit_price;
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
    
    // Update inventory based on sales
    for (const product of products) {
      const [totalSold] = await query(
        'SELECT SUM(quantity) as total FROM sales WHERE product_id = ?',
        [product.id]
      );
      
      if (totalSold.total) {
        await query(
          'UPDATE inventory SET current_stock = GREATEST(0, current_stock - ?) WHERE product_id = ?',
          [totalSold.total, product.id]
        );
      }
    }

    console.log('✅ Updated inventory levels');
    console.log('✅ Seeding complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedSalesData();
