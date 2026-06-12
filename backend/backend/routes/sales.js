import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import Busboy from 'busboy';
import ExcelJS from 'exceljs';
import path from 'path';
import { recalculateAndPersistKPIs } from './kpis.js';
import { calculateNetRevenueMetrics } from '../utils/revenueMetrics.js';

/** Revenue KPI window — must match Operations dashboard (30 days). */
const REVENUE_WINDOW_DAYS = 30;

async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  const headerRow = sheet.getRow(1);
  const headers = [];
  for (let c = 1; c <= (headerRow.cellCount || 0); c++) {
    const v = headerRow.getCell(c).value;
    headers.push(v != null ? String(v) : `Column${c}`);
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1] || `Column${colNumber}`;
      obj[key] = cell.value;
    });
    rows.push(obj);
  });
  return rows;
}

export const handleGetSales = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit) || 50));
    const offset = (page - 1) * limit;
    const productId = queryParams.product_id;
    const startDate = queryParams.start_date;
    const endDate = queryParams.end_date;
    const region = queryParams.region;

    let sql = `
      SELECT s.*, p.name as product_name, p.sku 
      FROM sales s 
      JOIN products p ON s.product_id = p.id 
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      sql += ' AND s.product_id = ?';
      params.push(productId);
    }
    if (startDate) {
      sql += ' AND s.sale_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND s.sale_date <= ?';
      params.push(endDate);
    }
    if (region) {
      sql += ' AND s.region = ?';
      params.push(region);
    }

    sql += ` ORDER BY s.sale_date DESC, s.id DESC LIMIT ${limit} OFFSET ${offset}`;

    const sales = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM sales WHERE 1=1';
    const countParams = [];
    if (productId) {
      countSql += ' AND product_id = ?';
      countParams.push(productId);
    }
    if (startDate) {
      countSql += ' AND sale_date >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countSql += ' AND sale_date <= ?';
      countParams.push(endDate);
    }
    if (region) {
      countSql += ' AND region = ?';
      countParams.push(region);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult.total;

    sendJSON(res, 200, {
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get sales error:', error);
    sendError(res, 500, 'Failed to fetch sales');
  }
};

export const handleGetSalesProductIds = async (req, res) => {
  try {
    const rows = await query(`
      SELECT DISTINCT product_id
      FROM sales
      WHERE product_id IS NOT NULL
      ORDER BY product_id
    `);
    const productIds = rows.map((r) => r.product_id).filter(Boolean);
    sendJSON(res, 200, { productIds });
  } catch (error) {
    console.error('Get sales product IDs error:', error);
    sendError(res, 500, 'Failed to fetch product IDs');
  }
};

export const handleGetSalesStats = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = parseInt(queryParams.days) || 30;
    const productId = queryParams.product_id;

    let sql = `
      SELECT 
        COUNT(*) as totalRecords,
        SUM(quantity) as totalQuantity,
        SUM(total_amount) as totalRevenue,
        AVG(total_amount) as avgOrderValue
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const params = [days];

    if (productId) {
      sql += ' AND product_id = ?';
      params.push(productId);
    }

    const [stats] = await query(sql, params);
    const revenueMetrics = await calculateNetRevenueMetrics(REVENUE_WINDOW_DAYS);

    sendJSON(res, 200, {
      totalRecords: stats?.totalRecords || 0,
      totalQuantity: stats?.totalQuantity || 0,
      totalRevenue: revenueMetrics.net_revenue,
      netRevenue: revenueMetrics.net_revenue,
      actualRevenue: revenueMetrics.actual_revenue,
      salesRevenue: revenueMetrics.sales_revenue,
      procurementDeductions: revenueMetrics.procurement_deductions,
      predictionRevenue: revenueMetrics.prediction_revenue,
      revenueWindowDays: REVENUE_WINDOW_DAYS,
      avgOrderValue: stats?.avgOrderValue || 0,
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    sendError(res, 500, 'Failed to fetch sales statistics');
  }
};

export const handleCreateSale = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { product_id, sale_date, quantity, unit_price, customer_name, region } = body;

    if (!product_id || !sale_date || !quantity || !unit_price) {
      return sendError(res, 400, 'Required fields: product_id, sale_date, quantity, unit_price');
    }

    const total_amount = quantity * unit_price;

    const result = await query(
      `INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, sale_date, quantity, unit_price, total_amount, customer_name || null, region || null]
    );

    // Update inventory (reduce stock)
    await query(
      'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
      [quantity, product_id]
    );

    await logAudit(req.user.id, 'CREATE_SALE', 'sale', result.insertId, { product_id, quantity, total_amount }, req);

    // Persist a fresh KPI snapshot after each manual sale
    try {
      await recalculateAndPersistKPIs(30);
    } catch (kpiError) {
      console.warn('Recalculate KPIs after creating sale failed:', kpiError);
    }

    sendJSON(res, 201, {
      success: true,
      sale: {
        id: result.insertId,
        ...body,
        total_amount
      }
    });
  } catch (error) {
    console.error('Create sale error:', error);
    sendError(res, 500, 'Failed to create sale');
  }
};

export const handleGetSale = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, 'Invalid sale ID');

    const rows = await query(
      `SELECT s.*, p.name as product_name, p.sku 
       FROM sales s JOIN products p ON s.product_id = p.id WHERE s.id = ?`,
      [id]
    );
    if (!rows.length) return sendError(res, 404, 'Sale not found');
    sendJSON(res, 200, { sale: rows[0] });
  } catch (error) {
    console.error('Get sale error:', error);
    sendError(res, 500, 'Failed to fetch sale');
  }
};

export const handleUpdateSale = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, 'Invalid sale ID');

    const [existing] = await query('SELECT * FROM sales WHERE id = ?', [id]);
    if (!existing) return sendError(res, 404, 'Sale not found');

    const body = await parseBody(req);
    const { product_id, sale_date, quantity, unit_price, customer_name, region } = body;
    const finalProductId = product_id !== undefined ? product_id : existing.product_id;
    const finalDate = sale_date || existing.sale_date;
    const finalQty = quantity !== undefined ? parseInt(quantity, 10) : existing.quantity;
    const finalPrice = unit_price !== undefined ? parseFloat(unit_price) : existing.unit_price;
    const total_amount = finalQty * finalPrice;

    // Adjust inventory: reverse old sale then apply new
    await query(
      'UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?',
      [existing.quantity, existing.product_id]
    );
    await query(
      'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
      [finalQty, finalProductId]
    );

    await query(
      `UPDATE sales SET product_id=?, sale_date=?, quantity=?, unit_price=?, total_amount=?, customer_name=?, region=? WHERE id=?`,
      [finalProductId, finalDate, finalQty, finalPrice, total_amount, customer_name !== undefined ? customer_name : existing.customer_name, region !== undefined ? region : existing.region, id]
    );

    await logAudit(req.user.id, 'UPDATE_SALE', 'sale', id, { quantity: finalQty, total_amount }, req);
    const [updated] = await query(
      `SELECT s.*, p.name as product_name, p.sku FROM sales s JOIN products p ON s.product_id = p.id WHERE s.id = ?`,
      [id]
    );
    sendJSON(res, 200, { success: true, sale: updated });
  } catch (error) {
    console.error('Update sale error:', error);
    sendError(res, 500, 'Failed to update sale');
  }
};

export const handleDeleteSale = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendError(res, 400, 'Invalid sale ID');

    const [existing] = await query('SELECT * FROM sales WHERE id = ?', [id]);
    if (!existing) return sendError(res, 404, 'Sale not found');

    await query('UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?', [existing.quantity, existing.product_id]);
    await query('DELETE FROM sales WHERE id = ?', [id]);
    await logAudit(req.user.id, 'DELETE_SALE', 'sale', id, { product_id: existing.product_id, quantity: existing.quantity }, req);
    try {
      await recalculateAndPersistKPIs(30);
    } catch (e) {
      console.warn('KPI recalc after sale delete:', e);
    }
    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Delete sale error:', error);
    sendError(res, 500, 'Failed to delete sale');
  }
};

// Delete all sales and all related data (forecasts, recommendations, forecast-based plans, KPIs)
export const handleDeleteAllSales = async (req, res) => {
  try {
    const scope = req.query?.scope;
    if (scope !== 'all') {
      return sendError(res, 400, 'Specify scope=all to delete all sales and related data. This cannot be undone.');
    }

    await query('DELETE FROM sales', []);
    await query('DELETE FROM forecast_results', []);
    await query('DELETE FROM inventory_recommendations', []);
    await query(
      "DELETE FROM production_plans WHERE notes LIKE '%forecast%' OR notes LIKE '%demand forecast%'",
      []
    ).catch(() => {});

    try {
      await recalculateAndPersistKPIs(30);
    } catch (e) {
      console.warn('KPI recalc after delete all sales:', e);
    }
    await logAudit(req.user.id, 'DELETE_SALES_ALL', 'sale', null, { scope: 'all' }, req).catch(() => {});

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Delete all sales error:', error);
    sendError(res, 500, 'Failed to delete sales data');
  }
};

export const handleUploadSales = async (req, res) => {
  try {
    // Parse multipart/form-data upload using Busboy
    const records = await new Promise((resolve, reject) => {
      const allRecords = [];
      const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });

      const parseCsv = (text) => {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return [];

        const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length === 0) continue;
          const row = {};
          header.forEach((h, idx) => {
            row[h] = (cols[idx] ?? '').trim();
          });
          rows.push(row);
        }
        return rows;
      };

      const normalizeRows = (rows) => {
        return rows.map((raw) => {
          const obj = {};
          // Normalize keys to lower-case for consistency
          Object.keys(raw).forEach((k) => {
            obj[k.toLowerCase()] = raw[k];
          });
          return obj;
        });
      };

      const parsePromises = [];

      busboy.on('file', (_fieldname, file, info) => {
        const filename = typeof info === 'string' ? info : info?.filename;
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('limit', () => {
          file.resume();
        });
        file.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const ext = (path.extname(filename || '') || '').toLowerCase();
          const p = (async () => {
            try {
              let parsed = [];
              if (ext === '.xlsx') {
                parsed = await parseExcelBuffer(buffer);
                parsed = normalizeRows(parsed);
              } else if (ext === '.xls') {
                return Promise.reject(new Error('Please use .xlsx (Excel 2007+) or CSV. .xls format is not supported.'));
              } else {
                const text = buffer.toString('utf-8');
                parsed = normalizeRows(parseCsv(text));
              }
              allRecords.push(...parsed);
            } catch (err) {
              console.error('File parse error:', err);
            }
          })();
          parsePromises.push(p);
        });
      });

      busboy.on('error', (err) => reject(err));
      busboy.on('finish', () => Promise.all(parsePromises).then(() => resolve(allRecords)));

      req.pipe(busboy);
    });

    if (!records.length) {
      return sendJSON(res, 400, {
        success: false,
        message: 'No valid sales records found in uploaded file.',
        recordsProcessed: 0
      });
    }

    // Log what we received (so you can see in backend terminal)
    const cols = Object.keys(records[0] || {});
    const sample = records[0];
    console.log('[Sales Upload] Columns received:', cols.join(', '));
    console.log('[Sales Upload] First row sample:', JSON.stringify(sample));

    // Preload products for SKU and name mapping
    const productRows = await query('SELECT id, sku, name FROM products');
    const skuToId = {};
    const nameToId = {};
    productRows.forEach((p) => {
      if (p.sku) skuToId[p.sku.toString().toLowerCase().trim()] = p.id;
      if (p.name) nameToId[p.name.toString().toLowerCase().trim()] = p.id;
    });
    console.log('[Sales Upload] Available products:', productRows.map((p) => `${p.id}:${p.sku}:${p.name}`).join(' | '));

    const get = (row, keys) => {
      const r = row || {};
      const rLower = {};
      Object.keys(r).forEach((k) => { rLower[String(k).toLowerCase().trim()] = r[k]; });
      for (const k of keys) {
        const v = r[k] ?? rLower[String(k).toLowerCase().trim()];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return null;
    };
    const parseDate = (v) => {
      if (!v) return null;
      if (typeof v === 'number') {
        const d = new Date((v - 25569) * 86400 * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(String(v).trim());
      return isNaN(d.getTime()) ? null : d;
    };
    const parseNum = (v) => {
      if (v == null || v === '') return NaN;
      const n = Number(String(v).replace(/,/g, ''));
      return isNaN(n) ? NaN : n;
    };

    let processed = 0;
    let skippedUnknownProducts = 0;
    const looksLikeInventoryReport = cols.some((c) =>
      ['current_stock', 'available_stock', 'reorder_point', 'safety_stock', 'sold_30d', 'sold_in_range'].includes(String(c || '').toLowerCase())
    );

    for (const raw of records) {
      const row = raw || {};
      const allKeys = Object.keys(row);
      const rowAny = {};
      allKeys.forEach((k) => { rowAny[k] = row[k]; rowAny[k.toLowerCase?.()] = row[k]; });

      // Date (inventory report rows may not have explicit sale_date; use range_end or today)
      const dateVal = get(rowAny, [
        'sale_date', 'sale date', 'saledate', 'date', 'order_date', 'order date',
        'transaction_date', 'transaction date', 'sales date', 'salesdate',
        'range_end', 'report_date'
      ]);
      const saleDate = parseDate(dateVal) || new Date();
      if (!saleDate) continue;

      // Quantity (supports normal sales files + inventory report aggregates)
      let qtyVal = get(rowAny, [
        'quantity', 'qty', 'quantity sold', 'quantitysold', 'units_sold', 'units sold',
        'sold_in_range', 'sold_30d', 'manual_sold_range', 'manual_sold_30d',
        'manual_sold_txn', 'amount', 'unitssold', 'volume', 'count'
      ]);
      let quantity = parseNum(qtyVal);
      if (!quantity || quantity <= 0) {
        const totalSales = parseNum(get(rowAny, ['total_sales', 'total amount', 'total_amount', 'total', 'revenue', 'amount']));
        const up = parseNum(get(rowAny, ['unit_price', 'unit price', 'price', 'cost']));
        if (totalSales > 0 && up > 0) quantity = Math.round(totalSales / up);
      }
      if (!quantity || quantity <= 0) continue;

      // Unit price (or derive from total/quantity)
      let unitPrice = parseNum(get(rowAny, [
        'unit_price', 'unit price', 'unitprice', 'price', 'unit cost', 'cost', 'rate'
      ]));
      if (!unitPrice || unitPrice <= 0) {
        const total = parseNum(get(rowAny, [
          'total_amount', 'total amount', 'totalamount', 'total', 'revenue', 'amount', 'value'
        ]));
        if (total > 0 && quantity > 0) unitPrice = total / quantity;
      }
      if (!unitPrice || unitPrice <= 0) continue;

      // Product: resolve against existing products only (never auto-create).
      const productVal = get(rowAny, [
        'product_id', 'product id', 'productid', 'product',
        'product_sku', 'product sku', 'productsku', 'sku',
        'product_name', 'product name', 'productname', 'item', 'item name',
        'category'
      ]);
      if (!productVal) continue;

      const s = String(productVal).trim();
      let resolvedProductId = null;
      const num = parseInt(s, 10);
      if (!isNaN(num) && num > 0) resolvedProductId = num;
      if (!resolvedProductId) resolvedProductId = skuToId[s.toLowerCase()];
      if (!resolvedProductId) resolvedProductId = nameToId[s.toLowerCase()];
      if (!resolvedProductId || !productRows.find((p) => p.id === resolvedProductId)) {
        // --- AUTO-CREATE PRODUCT FOR KINGLION DATA SYNC ---
        // If product doesn't exist, create it with defaults.
        try {
          const sku = String(productVal).trim();
          const name = get(rowAny, ['product_name', 'name', 'product']) || sku;
          const category = get(rowAny, ['category', 'product_category']) || 'General';
          const costPrice = unitPrice > 0 ? unitPrice * 0.7 : 0; // Default cost to 70% of selling price
          
          const insertResult = await query(
            'INSERT INTO products (sku, name, category, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)',
            [sku, name, category, unitPrice, costPrice]
          );
          resolvedProductId = insertResult.insertId;
          
          // Also create initial inventory record
          await query(
            'INSERT INTO inventory (product_id, current_stock, available_stock) VALUES (?, 0, 0)',
            [resolvedProductId]
          );
          
          console.log(`Auto-created product: ${name} (${sku})`);
        } catch (createErr) {
          console.error('Failed to auto-create product during sales upload:', createErr);
          skippedUnknownProducts += 1;
          continue;
        }
      }

      const customerName = get(rowAny, ['customer_name', 'customer name', 'customer', 'client']) || null;

      // Region: accept any column whose header contains "region" (in addition to common aliases)
      let region = get(rowAny, ['region', 'sales region', 'area', 'location']);
      if (!region) {
        const regionKey = Object.keys(rowAny).find((k) =>
          String(k || '').toLowerCase().includes('region')
        );
        if (regionKey) {
          region = rowAny[regionKey];
        }
      }
      region = region || null;
      const totalAmount = quantity * unitPrice;

      await query(
        `INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedProductId,
          saleDate.toISOString().split('T')[0],
          quantity,
          unitPrice,
          totalAmount,
          customerName || null,
          region || null
        ]
      );

      // For inventory aggregate report imports, do not mutate current stock again.
      if (!looksLikeInventoryReport) {
        await query(
          'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
          [quantity, resolvedProductId]
        );
      }

      processed += 1;
    }

    await logAudit(
      req.user.id,
      'UPLOAD_SALES',
      'sale',
      null,
      { recordsUploaded: records.length, recordsProcessed: processed },
      req
    );

    const message = processed > 0
      ? `Processed ${processed} sales records from upload.${skippedUnknownProducts > 0 ? ` Skipped ${skippedUnknownProducts} row(s) with unknown products.` : ''}`
      : looksLikeInventoryReport
        ? `Processed 0 records. Inventory report format detected, but no usable sold quantity was found. Required mapping: product_id or sku (or product_name), sold_in_range/sold_30d (or manual_sold_range/manual_sold_30d), and unit_price (or unit_cost).`
        : `Processed 0 records. Your file has columns: [${cols.join(', ')}]. We need: product_id or sku (or product name), sale_date or date, quantity, unit_price or price. Products in DB: ${productRows.map((p) => p.sku || p.id).join(', ')}. Check backend terminal for details.`;

    let sales = [];
    let stats = null;
    if (processed > 0) {
      sales = await query(`
        SELECT s.*, p.name as product_name, p.sku
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
        ORDER BY s.sale_date DESC, s.id DESC
        LIMIT 500
      `);
      const statsRows = await query(`
        SELECT
          COUNT(*) as total_sales,
          SUM(quantity) as total_quantity,
          SUM(total_amount) as total_revenue
        FROM sales
        WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      `);
      const row = statsRows && statsRows[0] ? statsRows[0] : { total_sales: 0, total_quantity: 0, total_revenue: 0 };
      const revenueMetrics = await calculateNetRevenueMetrics(REVENUE_WINDOW_DAYS);
      stats = {
        totalRecords: row.total_sales || 0,
        totalQuantity: row.total_quantity || 0,
        totalRevenue: revenueMetrics.net_revenue,
        netRevenue: revenueMetrics.net_revenue,
        actualRevenue: revenueMetrics.actual_revenue,
        salesRevenue: revenueMetrics.sales_revenue,
        procurementDeductions: revenueMetrics.procurement_deductions,
        predictionRevenue: revenueMetrics.prediction_revenue,
        revenueWindowDays: REVENUE_WINDOW_DAYS,
      };
    }

    // Refresh KPI snapshot after a bulk sales upload.
    // Use a 2-year window (730 days) so the KPIs combine
    // all historical data you may have imported.
    try {
      await recalculateAndPersistKPIs(730);
    } catch (kpiError) {
      console.warn('Recalculate KPIs after sales upload failed:', kpiError);
    }

    sendJSON(res, 200, {
      success: true,
      message,
      recordsProcessed: processed,
      sales,
      stats,
      ...(processed === 0 && { debug: { columns: cols, sampleRow: sample, products: productRows.map((p) => ({ id: p.id, sku: p.sku, name: p.name })) } })
    });
  } catch (error) {
    console.error('Upload sales error:', error);
    sendError(res, 500, error?.message || 'Failed to upload sales data');
  }
};
