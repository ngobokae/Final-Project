/**
 * Generates sample report files for visual verification (CSV, Excel, PDF).
 * Run from frontend/frontend: npx vite-node scripts/test-report-export.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCsvContent, buildExcelBuffer, buildPdfDocument } from '../src/utils/reportExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'test-output');

const sampleSalesReport = {
  type: 'sales',
  period: { start: '2026-03-01', end: '2026-04-24' },
  summary: {
    products: 12,
    total_units: 1540,
    total_revenue: 42500000,
    avg_order_value: 27600,
  },
  details: [
    {
      date: '2026-04-20',
      product_name: 'Motorcycle Model X',
      sku: 'MCX-001',
      total_quantity: 45,
      total_revenue: 6750000,
      avg_price: 150000,
      transaction_count: 12,
    },
    {
      date: '2026-04-18',
      product_name: 'Roofing Sheet Premium',
      sku: 'RSP-200',
      total_quantity: 320,
      total_revenue: 9600000,
      avg_price: 30000,
      transaction_count: 8,
    },
    {
      date: '2026-04-15',
      product_name: 'Three-Wheeler Cargo',
      sku: 'TWC-050',
      total_quantity: 18,
      total_revenue: 5400000,
      avg_price: 300000,
      transaction_count: 6,
    },
  ],
};

const sampleExecutiveReport = {
  type: 'executive_summary',
  period: 30,
  sales: {
    net_revenue: 41795960,
    actual_revenue: 38500000,
    prediction_revenue: 45200000,
    units_sold: 2100,
    transactions: 156,
    avg_order_value: 268000,
  },
  production: { plans: 8, target_units: 5000, completed_units: 4200 },
  inventory: { inventory_value: 128000000, active_products: 17 },
  procurement: { orders: 24, total_spend: 18500000, delivered_orders: 18, delivered_spend: 14200000 },
  recent_transactions: [
    {
      date: '2026-04-24T10:30:00',
      product_name: 'Motorcycle Model X',
      transaction_type: 'sold',
      quantity: 5,
      total_amount: 750000,
      user_name: 'Inventory Manager',
    },
    {
      date: '2026-04-23T14:15:00',
      product_name: 'Roofing Sheet Premium',
      transaction_type: 'stock_in',
      quantity: 200,
      total_amount: 6000000,
      user_name: 'Warehouse Staff',
    },
  ],
};

async function writeReport(name, report, title) {
  const stamp = new Date().toISOString().split('T')[0];
  const base = `${name}-${stamp}`;

  const csv = buildCsvContent(report, title);
  fs.writeFileSync(path.join(outDir, `${base}.csv`), `\uFEFF${csv}`, 'utf8');
  console.log(`✓ CSV  → test-output/${base}.csv`);

  const xlsxBuffer = await buildExcelBuffer(report, title);
  fs.writeFileSync(path.join(outDir, `${base}.xlsx`), Buffer.from(xlsxBuffer));
  console.log(`✓ XLSX → test-output/${base}.xlsx`);

  const pdfDoc = await buildPdfDocument(report, title);
  const pdfBuffer = pdfDoc.output('arraybuffer');
  fs.writeFileSync(path.join(outDir, `${base}.pdf`), Buffer.from(pdfBuffer));
  console.log(`✓ PDF  → test-output/${base}.pdf`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  console.log('Generating sample reports in test-output/...\n');
  await writeReport('sales-report', sampleSalesReport, 'Sales Report');
  await writeReport('executive-summary', sampleExecutiveReport, 'Executive Summary Report');
  console.log('\nDone. Open files in frontend/frontend/test-output/ to review formatting.');
}

main().catch((err) => {
  console.error('Report export test failed:', err);
  process.exit(1);
});
