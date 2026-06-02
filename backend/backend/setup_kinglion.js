import 'dotenv/config';
import { query } from './config/database.js';

const kinglionProducts = [
    { sku: 'KL-IS-001', name: 'Iron Sheet - Blue 0.5mm', category: 'Iron Sheets', unit_price: 12000, unit_cost: 9000 },
    { sku: 'KL-IS-002', name: 'Iron Sheet - Red 0.4mm', category: 'Iron Sheets', unit_price: 10500, unit_cost: 8000 },
    { sku: 'KL-IS-003', name: 'Iron Sheet - Green 0.5mm', category: 'Iron Sheets', unit_price: 12500, unit_cost: 9500 },
    { sku: 'KL-IS-004', name: 'Iron Sheet - Charcoal 0.5mm', category: 'Iron Sheets', unit_price: 13000, unit_cost: 10000 },
    { sku: 'KL-IS-005', name: 'Iron Sheet - Tile Profile 0.5mm', category: 'Iron Sheets', unit_price: 14500, unit_cost: 11000 },
    { sku: 'KL-MC-150', name: 'Kinglion Motorcycle - Model 150', category: 'Motorcycles', unit_price: 1250000, unit_cost: 900000 },
    { sku: 'KL-MC-200', name: 'Kinglion Motorcycle - Model 200', category: 'Motorcycles', unit_price: 1500000, unit_cost: 1100000 },
    { sku: 'KL-MC-250', name: 'Kinglion Motorcycle - Cargo Special', category: 'Motorcycles', unit_price: 1850000, unit_cost: 1400000 },
];

async function setupKinglionProducts() {
    console.log('Setting up Kinglion products...');
    
    for (const p of kinglionProducts) {
        try {
            // Check if product already exists
            const existing = await query('SELECT id FROM products WHERE sku = ?', [p.sku]);
            
            let productId;
            if (existing.length === 0) {
                const result = await query(
                    'INSERT INTO products (sku, name, category, unit_price, unit_cost, lead_time_days, reorder_point, safety_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [p.sku, p.name, p.category, p.unit_price, p.unit_cost, 7, 50, 20, 1]
                );
                productId = result.insertId;
                console.log(`Created product: ${p.sku}`);
            } else {
                productId = existing[0].id;
                console.log(`Product ${p.sku} already exists.`);
            }
            
            // Check inventory
            const inv = await query('SELECT id FROM inventory WHERE product_id = ?', [productId]);
            if (inv.length === 0) {
                await query(
                    'INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, ?, ?)',
                    [productId, 500, 0]
                );
                console.log(`Initialized inventory for: ${p.sku}`);
            }
        } catch (err) {
            console.error(`Error processing ${p.sku}:`, err.message);
        }
    }
    
    console.log('Setup complete. You can now upload the sales data.');
    process.exit(0);
}

setupKinglionProducts();
