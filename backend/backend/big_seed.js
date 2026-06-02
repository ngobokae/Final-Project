import 'dotenv/config';
import { query } from './config/database.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bigSeed() {
    console.log('--- KINGLION BIG SEED START ---');

    try {
        // 1. Clear existing noise
        console.log('Clearing old data...');
        await query('DELETE FROM sales');
        await query('DELETE FROM forecast_results');
        await query('DELETE FROM production_plans');
        await query('DELETE FROM inventory_recommendations');

        // 2. Fetch products
        const products = await query('SELECT * FROM products WHERE sku LIKE "KL-%"');
        if (products.length === 0) {
            console.error('No Kinglion products found. Run setup_kinglion.js first.');
            process.exit(1);
        }

        // 3. Insert Historical Sales (Last 60 days)
        console.log('Inserting 150 historical sales records...');
        const customers = ["Kigali Construction Ltd", "Rubavu Hardware", "Musanze Builders", "Huye Traders", "City Delivery Services"];
        const regions = ["Kigali", "Eastern", "Western", "Northern", "Southern"];
        
        for (let i = 0; i < 150; i++) {
            const p = products[Math.floor(Math.random() * products.length)];
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 60));
            const qty = (p.category === 'Motorcycles' || p.category === 'Motorcycle') ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 50) + 20;
            const total = qty * p.unit_price;
            
            await query(
                'INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [p.id, date.toISOString().split('T')[0], qty, p.unit_price, total, customers[Math.floor(Math.random() * customers.length)], regions[Math.floor(Math.random() * regions.length)]]
            );
        }

        // 4. Seed "Past Forecasts" and MATCHING "Past Sales" for Accuracy Calculation
        console.log('Seeding historical forecast/sales pairs for accuracy metrics...');
        for (const p of products) {
            for (let day = 1; day <= 10; day++) {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - (day + 1));
                const dateStr = pastDate.toISOString().split('T')[0];
                
                const forecastQty = (p.category === 'Motorcycles' || p.category === 'Motorcycle') ? 5 : 50;
                const actualQty = Math.round(forecastQty * (0.9 + Math.random() * 0.2)); // ~90-110% accuracy
                
                await query(
                    'INSERT IGNORE INTO forecast_results (product_id, forecast_date, forecasted_demand, confidence_level) VALUES (?, ?, ?, ?)',
                    [p.id, dateStr, forecastQty, 0.95]
                );
                
                await query(
                    'INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [p.id, dateStr, actualQty, p.unit_price, actualQty * p.unit_price, 'Historical Match', 'Kigali']
                );
            }
        }

        // 5. Update Inventory to realistic Kinglion levels
        console.log('Updating inventory levels...');
        for (const p of products) {
            await query(
                'UPDATE inventory SET current_stock = ?, reserved_stock = ? WHERE product_id = ?',
                [Math.floor(Math.random() * 300) + 50, Math.floor(Math.random() * 20), p.id]
            );
        }

        // 6. Seed Future Forecasts (Next 30 days)
        console.log('Seeding future forecasts (Next 30 days)...');
        for (const p of products) {
            for (let i = 1; i <= 30; i++) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + i);
                const demand = (p.category === 'Motorcycles' || p.category === 'Motorcycle') ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 40) + 60;
                
                await query(
                    'INSERT IGNORE INTO forecast_results (product_id, forecast_date, forecasted_demand, confidence_level) VALUES (?, ?, ?, ?)',
                    [p.id, futureDate.toISOString().split('T')[0], demand, 0.88 + Math.random() * 0.1]
                );
            }
        }

        // 7. Seed Production Plans
        console.log('Seeding production plans...');
        for (let i = 0; i < 5; i++) {
            const p = products[Math.floor(Math.random() * products.length)];
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 2);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 5);
            const target = (p.category === 'Motorcycles' || p.category === 'Motorcycle') ? 20 : 500;
            
            await query(
                'INSERT INTO production_plans (product_id, start_date, end_date, target_quantity, completed_quantity, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [p.id, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], target, Math.floor(target * 0.3), 'in_progress', i % 2 === 0 ? 'high' : 'medium']
            );
        }

        // 8. Seed Inventory Recommendations (Procurement)
        console.log('Seeding inventory recommendations...');
        for (let i = 0; i < 4; i++) {
            const p = products[Math.floor(Math.random() * products.length)];
            await query(
                'INSERT INTO inventory_recommendations (product_id, recommended_stock, optimal_order_quantity, risk_level, risk_type, reasoning) VALUES (?, ?, ?, ?, ?, ?)',
                [p.id, 200, 150, 'medium', 'shortage', `Strategic restock for ${p.name} based on rising Kigali demand.`]
            );
        }

        console.log('--- SEED COMPLETE ---');
        console.log('Refresh your dashboard now!');
        process.exit(0);
    } catch (err) {
        console.error('Seed crash:', err);
        process.exit(1);
    }
}

bigSeed();
