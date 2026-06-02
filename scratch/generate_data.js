import fs from 'fs';
import path from 'path';

const categories = {
  'Roofing sheets': [
    { sku: 'KL-RS-001', name: 'Roofing Sheet Corrugated 0.5mm', price: 11000 },
    { sku: 'KL-RS-002', name: 'Roofing Sheet Step Tile 0.5mm', price: 13500 }
  ],
  'Motorcycle': [
    { sku: 'KL-MC-150', name: 'Kinglion Motorcycle - Model 150', price: 1250000 },
    { sku: 'KL-MC-200', name: 'Kinglion Motorcycle - Model 200', price: 1500000 },
    { sku: 'KL-MC-250', name: 'Kinglion Motorcycle - Cargo Special', price: 1850000 }
  ],
  'Spare Parts': [
    { sku: 'KL-SP-001', name: 'Motorcycle Engine Oil 1L', price: 4500 },
    { sku: 'KL-SP-002', name: 'Brake Pad Set - Model 150', price: 8000 },
    { sku: 'KL-SP-003', name: 'Motorcycle Tire 18-inch', price: 25000 }
  ],
  'Pre-fabricated Cement Board': [
    { sku: 'KL-CB-001', name: 'Cement Board 6mm 4x8ft', price: 18000 },
    { sku: 'KL-CB-002', name: 'Cement Board 9mm 4x8ft', price: 24000 }
  ],
  'Solar Products': [
    { sku: 'KL-SL-001', name: 'Solar Panel 100W Poly', price: 45000 },
    { sku: 'KL-SL-002', name: 'Solar Inverter 1kW Hybrid', price: 280000 }
  ],
  'Iron Sheets': [
    { sku: 'KL-IS-001', name: 'Iron Sheet - Blue 0.5mm', price: 12000 },
    { sku: 'KL-IS-002', name: 'Iron Sheet - Red 0.4mm', price: 10500 },
    { sku: 'KL-IS-006', name: 'Iron Sheet - Matte Grey 0.5mm', price: 13000 }
  ]
};

const regions = ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'];
const customers = [
  'Kigali Construction Ltd', 'Musanze Builders', 'Huye Traders', 
  'Rubavu Hardware', 'Nyagatare Contractors', 'Bugesera Estate', 
  'Rusizi Engineering', 'Gicumbi Wholesalers', 'Eastern Supplies',
  'Rwanda Logistics', 'Lake Kivu Transport', 'City Delivery Services'
];

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const startDate = new Date('2025-01-01');
const endDate = new Date('2026-12-31');

let csvContent = 'Date,Product SKU,Product Name,Quantity,Unit Price,Customer Name,Region\n';
const allProducts = Object.values(categories).flat();

for (let i = 0; i < 320; i++) {
  const date = getRandomDate(startDate, endDate).toISOString().split('T')[0];
  const product = allProducts[Math.floor(Math.random() * allProducts.length)];
  const qty = product.sku.includes('MC') ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 100) + 10;
  const customer = customers[Math.floor(Math.random() * customers.length)];
  const region = regions[Math.floor(Math.random() * regions.length)];
  
  csvContent += `${date},${product.sku},${product.name},${qty},${product.price},${customer},${region}\n`;
}

fs.writeFileSync('c:/Users/NGOBOKAE/Desktop/Project/sales_template.csv', csvContent);
console.log('Successfully generated 320 sales records in sales_template.csv');

// Generate SQL to create products and inventory
let sql = '-- New Kinglion Products and Inventory Setup\n';
sql += 'USE manufacturing_system;\n\n';

Object.entries(categories).forEach(([category, products]) => {
  products.forEach(p => {
    // Determine reorder/safety points to create overstock/shortage scenarios
    const safety = p.sku.includes('MC') ? 5 : 50;
    const reorder = p.sku.includes('MC') ? 10 : 100;
    
    sql += `INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) \n`;
    sql += `VALUES ('${p.sku}', '${p.name.replace(/'/g, "''")}', '${category}', ${p.price * 0.7}, ${p.price}, ${reorder}, ${safety}, TRUE) \n`;
    sql += `ON DUPLICATE KEY UPDATE name='${p.name.replace(/'/g, "''")}', category='${category}', unit_cost=${p.price * 0.7}, unit_price=${p.price}, reorder_point=${reorder}, safety_stock=${safety};\n\n`;
    
    // Set inventory levels
    // Randomly assign some as 'shortage' (below safety) and some as 'overstock' (above 2*reorder)
    let currentStock;
    const scenario = Math.random();
    if (scenario < 0.3) {
       currentStock = Math.floor(safety * 0.5); // Shortage
    } else if (scenario < 0.6) {
       currentStock = Math.floor(reorder * 3); // Overstock
    } else {
       currentStock = Math.floor(reorder * 1.2); // Normal
    }
    
    sql += `INSERT INTO inventory (product_id, current_stock, reserved_stock) \n`;
    sql += `SELECT id, ${currentStock}, 0 FROM products WHERE sku = '${p.sku}' \n`;
    sql += `ON DUPLICATE KEY UPDATE current_stock = ${currentStock};\n\n`;
  });
});

fs.writeFileSync('c:/Users/NGOBOKAE/Desktop/Project/scratch/populate_kinglion.sql', sql);
console.log('Generated SQL to populate database: scratch/populate_kinglion.sql');
