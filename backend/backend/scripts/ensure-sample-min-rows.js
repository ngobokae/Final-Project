/**
 * Ensures sample_real_sales_data_ml.xlsx has at least MIN_POINTS (10) data rows per product
 * so the ML forecast (which requires 7+) works.
 *
 * Usage (pick one):
 *   From project root:  node backend/scripts/ensure-sample-min-rows.js
 *   From backend folder: node scripts/ensure-sample-min-rows.js
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIN_POINTS = 10;
const samplePath = path.resolve(__dirname, '../../sample_real_sales_data_ml.xlsx');

function normalizeKey(k) {
  return String(k || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function findCol(obj, ...names) {
  const keys = Object.keys(obj);
  const lower = names.map((n) => normalizeKey(n));
  for (const k of keys) {
    if (lower.includes(normalizeKey(k))) return k;
  }
  return null;
}

function parseDate(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(v).trim());
  return isNaN(d.getTime()) ? null : d;
}

async function run() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(samplePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error('No sheet in workbook');
    process.exit(1);
  }

  const headers = [];
  const headerRow = sheet.getRow(1);
  for (let c = 1; c <= (headerRow.cellCount || 0); c++) {
    const v = headerRow.getCell(c).value;
    headers.push(v != null ? String(v).trim() : `Column${c}`);
  }

  const dataRows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1] || `Column${colNumber}`;
      obj[key] = cell.value;
    });
    dataRows.push(obj);
  });

  if (dataRows.length === 0) {
    console.error('No data rows found');
    process.exit(1);
  }

  const productKey = findCol(dataRows[0], 'product_id', 'product id', 'productid', 'product', 'product_name', 'product name', 'productname', 'sku', 'product_sku', 'product sku');
  const dateKey = findCol(dataRows[0], 'sale_date', 'sale date', 'saledate', 'date', 'order_date', 'order date');
  const qtyKey = findCol(dataRows[0], 'quantity', 'qty', 'quantity sold', 'units_sold', 'units sold', 'unitssold');
  const priceKey = findCol(dataRows[0], 'unit_price', 'unit price', 'unitprice', 'price', 'cost');

  if (!productKey || !dateKey) {
    console.error('Need at least product and date columns. Found headers:', headers);
    process.exit(1);
  }

  const byProduct = new Map();
  for (const row of dataRows) {
    const pid = row[productKey] != null ? String(row[productKey]).trim() : '';
    if (!pid) continue;
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push({ ...row });
  }

  const allNewDataRows = [];
  let added = 0;

  for (const [productId, rows] of byProduct) {
    const list = [...rows];
    while (list.length < MIN_POINTS) {
      const template = list[list.length % rows.length];
      const clone = {};
      for (const k of Object.keys(template)) {
        let val = template[k];
        if (k === dateKey && val != null) {
          const d = parseDate(val);
          if (d) {
            const newDate = new Date(d);
            newDate.setDate(newDate.getDate() + list.length * 7);
            val = newDate.toISOString().split('T')[0];
          }
        } else if (k === qtyKey && typeof val === 'number') {
          val = Math.max(1, val + (list.length % 3) - 1);
        } else if (k === qtyKey && val != null) {
          const n = Number(String(val).replace(/,/g, ''));
          val = isNaN(n) ? val : Math.max(1, n + (list.length % 3) - 1);
        }
        clone[k] = val;
      }
      list.push(clone);
      added++;
    }
    allNewDataRows.push(...list);
  }

  if (added === 0) {
    console.log('Sample already has at least', MIN_POINTS, 'rows per product. No changes.');
    process.exit(0);
  }

  const rowArrays = allNewDataRows.map((row) => headers.map((h) => row[h] ?? ''));

  const rowsToRemove = Math.max(1, sheet.rowCount - 1);
  sheet.spliceRows(2, rowsToRemove, ...rowArrays);

  await workbook.xlsx.writeFile(samplePath);
  console.log('Updated', samplePath, ': added', added, 'rows so every product has at least', MIN_POINTS, 'data points.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
