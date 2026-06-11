import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import Busboy from 'busboy';
import ExcelJS from 'exceljs';
import path from 'path';

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

export const handleGetProducts = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit) || 10));
    const offset = (page - 1) * limit;

    const products = await query(
      `SELECT * FROM products WHERE is_active = TRUE ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await query('SELECT COUNT(*) as total FROM products WHERE is_active = TRUE');
    const total = countResult.total;

    sendJSON(res, 200, {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    sendError(res, 500, 'Failed to fetch products');
  }
};

export const handleGetProduct = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const productId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(productId)) {
      return sendError(res, 400, 'Invalid product ID');
    }

    const products = await query('SELECT * FROM products WHERE id = ?', [productId]);
    
    if (products.length === 0) {
      return sendError(res, 404, 'Product not found');
    }

    sendJSON(res, 200, { product: products[0] });
  } catch (error) {
    console.error('Get product error:', error);
    sendError(res, 500, 'Failed to fetch product');
  }
};

export const handleCreateProduct = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { sku, name, description, category, unit_price, unit_cost, lead_time_days, reorder_point, safety_stock } = body;

    if (!sku || !name || !unit_price || !unit_cost) {
      return sendError(res, 400, 'Required fields: sku, name, unit_price, unit_cost');
    }

    const result = await query(
      `INSERT INTO products (sku, name, description, category, unit_price, unit_cost, lead_time_days, reorder_point, safety_stock) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, description || null, category || null, unit_price, unit_cost, lead_time_days || 7, reorder_point || 100, safety_stock || 50]
    );

    const productId = result.insertId;
    const initialQty = Number(body.initial_quantity || 0);
    await query(
      'INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, ?, 0)',
      [productId, initialQty]
    );

    const autoCreatePo = body.auto_create_po !== false && initialQty <= 0;
    if (autoCreatePo) {
      const orderQty = Math.max(Number(body.order_quantity || reorder_point || 100), 1);
      const totalCost = orderQty * Number(unit_cost);
      await query(
        `INSERT INTO procurement_orders (product_id, supplier_name, quantity, unit_cost, total_cost, order_date, expected_delivery, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'pending', ?, ?)`,
        [
          productId,
          body.supplier_name || 'Kinglion Rwanda Main Supplier',
          orderQty,
          unit_cost,
          totalCost,
          `Auto order for new product with zero stock${body.warehouse ? ` — Warehouse: ${body.warehouse}` : ''}`,
          req.user?.id || null,
        ]
      ).catch(() => {});
    }

    await logAudit(req.user.id, 'CREATE_PRODUCT', 'product', productId, { sku, name, warehouse: body.warehouse || null, auto_create_po: autoCreatePo }, req);

    sendJSON(res, 201, {
      success: true,
      product: {
        id: productId,
        ...body,
        auto_order_created: autoCreatePo,
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'SKU already exists');
    }
    console.error('Create product error:', error);
    sendError(res, 500, 'Failed to create product');
  }
};

export const handleUpdateProduct = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const productId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(productId)) {
      return sendError(res, 400, 'Invalid product ID');
    }

    const body = await parseBody(req);
    const updates = [];
    const values = [];

    const allowedFields = ['name', 'description', 'category', 'unit_price', 'unit_cost', 'lead_time_days', 'reorder_point', 'safety_stock', 'is_active'];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return sendError(res, 400, 'No fields to update');
    }

    values.push(productId);
    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

    await logAudit(req.user.id, 'UPDATE_PRODUCT', 'product', productId, body, req);

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Update product error:', error);
    sendError(res, 500, 'Failed to update product');
  }
};

export const handleUploadProducts = async (req, res) => {
  try {
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
                console.error('File parse error: .xls not supported, use .xlsx or CSV');
                return;
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
        message: 'No valid product records found in uploaded file.',
        recordsProcessed: 0
      });
    }

    let processed = 0;
    const errors = [];

    for (const raw of records) {
      const row = raw || {};

      const sku = row.sku || row['product sku'];
      const name = row.name || row['product name'] || row.product;
      const unitPrice = Number(row.unit_price || row['unit price'] || row.price);
      const unitCost = Number(row.unit_cost || row['unit cost'] || row.cost);

      if (!sku || !name || !unitPrice || !unitCost) {
        errors.push(`Row missing required fields: SKU=${sku}, Name=${name}`);
        continue;
      }

      try {
        const description = row.description || null;
        const category = row.category || null;
        const reorderPoint = row.reorder_point || row['reorder point'] ? Number(row.reorder_point || row['reorder point']) : 100;
        const safetyStock = row.safety_stock || row['safety stock'] ? Number(row.safety_stock || row['safety stock']) : 50;
        const leadTimeDays = row.lead_time_days || row['lead time days'] || row['lead time'] ? Number(row.lead_time_days || row['lead time days'] || row['lead time']) : 7;

        const result = await query(
          `INSERT INTO products (sku, name, description, category, unit_price, unit_cost, lead_time_days, reorder_point, safety_stock) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sku, name, description, category, unitPrice, unitCost, leadTimeDays, reorderPoint, safetyStock]
        );

        await query('INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, 0, 0)', [result.insertId]);
        await logAudit(req.user?.id, 'CREATE_PRODUCT', 'product', result.insertId, { sku, name }, req);
        processed += 1;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          errors.push(`SKU ${sku} already exists`);
        } else {
          errors.push(`Failed to create product ${sku}: ${error.message}`);
        }
      }
    }

    await logAudit(
      req.user?.id,
      'UPLOAD_PRODUCTS',
      'product',
      null,
      { recordsUploaded: records.length, recordsProcessed: processed, errors: errors.length },
      req
    );

    sendJSON(res, 200, {
      success: true,
      message: `Processed ${processed} products from upload.${errors.length > 0 ? ` ${errors.length} errors.` : ''}`,
      recordsProcessed: processed,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('Upload products error:', error);
    sendError(res, 500, 'Failed to upload products');
  }
};
