import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { recalculateAndPersistKPIs } from './kpis.js';
import { parseUploadedFile, validateInventoryFileStructure, transformToForecastData } from '../utils/fileParser.js';
import { ensureRecommendationSchema } from '../utils/schema.js';
import http from 'http';
import Busboy from 'busboy';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const ALLOWED_MODEL_TYPES = new Set(['ensemble', 'prophet', 'lstm']);

const normalizeModelType = (modelType) => {
  const normalized = String(modelType || 'ensemble').toLowerCase();
  return ALLOWED_MODEL_TYPES.has(normalized) ? normalized : 'ensemble';
};

let forecastSchemaEnsured = false;

/** Creates forecast_file_uploads and related tables if missing (Manaf1.sql does not include them). */
export const ensureForecastSchema = async () => {
  if (forecastSchemaEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS forecast_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      forecast_date DATE NOT NULL,
      forecasted_demand INT NOT NULL DEFAULT 0,
      confidence_level DECIMAL(5,4) DEFAULT 0.95,
      trend_indicator VARCHAR(20) DEFAULT 'stable',
      seasonality_factor DECIMAL(10,4) DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_forecast_product_date (product_id, forecast_date),
      KEY idx_forecast_date (forecast_date),
      KEY idx_product_id (product_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS forecast_file_uploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_format VARCHAR(50) NOT NULL,
      row_count INT DEFAULT 0,
      column_count INT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'uploaded',
      forecast_count INT DEFAULT 0,
      error_message TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_user_id (user_id),
      KEY idx_status (status),
      KEY idx_uploaded_at (uploaded_at)
    )
  `);

  const dbName = process.env.DB_NAME || 'manufacturing_system';
  const existingColumns = await query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forecast_results'`,
    [dbName]
  );
  const columnNames = new Set(existingColumns.map((row) => row.COLUMN_NAME));

  const optionalColumns = [
    { name: 'unit_price', definition: 'DECIMAL(15,2) DEFAULT 0' },
    { name: 'confidence', definition: 'DECIMAL(5,4) DEFAULT 0.95' },
    { name: 'model', definition: "VARCHAR(100) DEFAULT 'ensemble'" },
    { name: 'source', definition: "VARCHAR(100) DEFAULT 'system'" },
    { name: 'file_upload_id', definition: 'INT' },
  ];

  for (const column of optionalColumns) {
    if (!columnNames.has(column.name)) {
      await query(`ALTER TABLE forecast_results ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  const uploadColumns = await query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forecast_file_uploads'`,
    [dbName]
  );
  const uploadColumnNames = new Set(uploadColumns.map((row) => row.COLUMN_NAME));
  if (!uploadColumnNames.has('payload')) {
    await query('ALTER TABLE forecast_file_uploads ADD COLUMN payload JSON');
  }

  forecastSchemaEnsured = true;
};

const groupForecastDataByProduct = (forecastData) => {
  const byProduct = {};
  forecastData.forEach((item) => {
    const key = item.product_identifier;
    if (!byProduct[key]) byProduct[key] = [];
    byProduct[key].push(item);
  });
  return byProduct;
};

const countMatchedProducts = async (productIdentifiers) => {
  if (!productIdentifiers.length) return { matched: 0, unmatched: 0 };

  const numericIds = productIdentifiers.filter((id) => /^\d+$/.test(String(id))).map(Number);
  const skuIds = productIdentifiers.map(String);
  const placeholders = skuIds.map(() => '?').join(',');

  let sql = `SELECT DISTINCT sku FROM products WHERE sku IN (${placeholders})`;
  const params = [...skuIds];
  if (numericIds.length) {
    const idPlaceholders = numericIds.map(() => '?').join(',');
    sql += ` OR id IN (${idPlaceholders})`;
    params.push(...numericIds);
  }

  const rows = await query(sql, params);
  const matched = rows.length;
  return { matched, unmatched: productIdentifiers.length - matched };
};

const generateAndSaveForecastsFromProductMap = async (byProduct, daysAhead = 30, modelType = 'ensemble') => {
  const resolvedModelType = normalizeModelType(modelType);

  const productEntries = Object.entries(byProduct);
  const mlPromises = productEntries.map(async ([productId, items]) => {
    try {
      const historicalData = items
        .map((item) => ({ sale_date: item.date, quantity: item.quantity }))
        .filter((d) => d.sale_date);

      if (historicalData.length === 0) {
        return [];
      }

      const mlResponse = await callMLService('/api/forecast/', 'POST', {
        product_id: productId,
        historical_data: historicalData,
        days_ahead: daysAhead,
        model_type: resolvedModelType,
      });

      if (mlResponse?.forecasts && Array.isArray(mlResponse.forecasts)) {
        return mlResponse.forecasts.map((forecast) => ({
          product_identifier: productId,
          ...forecast,
        }));
      }
      return [];
    } catch (productErr) {
      console.error(`[Forecast Predict] Error for product ${productId}: ${productErr.message}`);
      return [];
    }
  });

  const results = await Promise.allSettled(
    mlPromises.map((promise) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Individual ML call timeout')), 60000)
        ),
      ])
    )
  );

  const allForecasts = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allForecasts.push(...result.value);
    }
  });

  if (allForecasts.length === 0) {
    return 0;
  }

  const uniqueSkus = [...new Set(allForecasts.map((f) => f.product_identifier || f.product_id))];
  const placeholders = uniqueSkus.map(() => '?').join(',');
  const numericIds = uniqueSkus.filter((id) => /^\d+$/.test(String(id))).map(Number);
  let productSql = `SELECT id, sku FROM products WHERE sku IN (${placeholders})`;
  const productParams = [...uniqueSkus];
  if (numericIds.length) {
    productSql += ` OR id IN (${numericIds.map(() => '?').join(',')})`;
    productParams.push(...numericIds);
  }
  const productRows = await query(productSql, productParams);

  const skuToIdMap = {};
  productRows.forEach((p) => {
    skuToIdMap[p.sku] = p.id;
    skuToIdMap[String(p.id)] = p.id;
  });

  const insertValues = [];
  const insertParams = [];

  allForecasts.forEach((forecast) => {
    const skuIdentifier = forecast.product_identifier || forecast.product_id;
    const forecastDate = forecast.date || forecast.forecast_date;
    const forecastedDemand = forecast.demand ?? forecast.forecasted_demand;

    if (!forecastDate || forecastedDemand === undefined) return;

    const dbProductId = skuToIdMap[skuIdentifier];
    if (!dbProductId) return;

    insertValues.push('(?, ?, ?)');
    insertParams.push(dbProductId, forecastDate, forecastedDemand);
  });

  if (insertValues.length > 0) {
    await query(
      `INSERT INTO forecast_results (product_id, forecast_date, forecasted_demand)
       VALUES ${insertValues.join(',')}
       ON DUPLICATE KEY UPDATE forecasted_demand = VALUES(forecasted_demand)`,
      insertParams
    );
  }

  return insertValues.length;
};

const callMLService = (endpoint, method = 'GET', data = null, timeoutMs = 120000) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${ML_SERVICE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 8000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data && method !== 'GET') {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        let parsed = null;
        try {
          console.log(`[ML Service] ${method} ${endpoint} → HTTP ${res.statusCode}: ${(responseData || '').substring(0, 200)}`);
          parsed = responseData ? JSON.parse(responseData) : null;
        } catch (error) {
          console.error(`[ML Service] JSON parse error - Response: "${(responseData || '').substring(0, 500)}"`);
          const snippet = (responseData || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          const hint = snippet.includes('<!doctype html') || snippet.includes('<html')
            ? ' (ML service returned HTML — check ALLOWED_HOSTS includes ml-service in Docker)'
            : '';
          return reject(
            new Error(
              `ML service returned non-JSON (HTTP ${res.statusCode})${hint}${snippet ? `: ${snippet}` : ''}`
            )
          );
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(parsed?.error || parsed?.detail || `ML service error (HTTP ${res.statusCode})`));
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`ML service timeout after ${timeoutMs}ms`));
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

const resolveUnitPrice = async (productId, fallbackFromSales = true) => {
  const [productRow] = await query(
    'SELECT unit_price FROM products WHERE id = ? LIMIT 1',
    [productId]
  );
  let unitPrice = Number(productRow?.unit_price) || 0;
  if (unitPrice <= 0 && fallbackFromSales) {
    const [avgRow] = await query(
      'SELECT AVG(unit_price) as avg_price FROM sales WHERE product_id = ? AND unit_price > 0',
      [productId]
    );
    unitPrice = Number(avgRow?.avg_price) || 0;
  }
  return Math.round(unitPrice * 100) / 100;
};

const saveForecastRows = async (productId, forecasts, { unitPrice = 0, modelType = 'ensemble' } = {}) => {
  if (!Array.isArray(forecasts) || !forecasts.length) return 0;

  let saved = 0;
  for (const forecast of forecasts) {
    await query(
      `INSERT INTO forecast_results 
       (product_id, forecast_date, forecasted_demand, confidence_level, trend_indicator, seasonality_factor, unit_price, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       forecasted_demand = VALUES(forecasted_demand),
       confidence_level = VALUES(confidence_level),
       trend_indicator = VALUES(trend_indicator),
       seasonality_factor = VALUES(seasonality_factor),
       unit_price = VALUES(unit_price),
       model = VALUES(model)`,
      [
        productId,
        forecast.date,
        forecast.demand,
        forecast.confidence || 0.95,
        forecast.trend || 'stable',
        forecast.seasonality || 1.0,
        unitPrice,
        modelType,
      ]
    );
    saved += 1;
  }
  return saved;
};

// Shared helper to generate and persist an inventory recommendation for a single product.
// Used both by the explicit recommendations endpoint and automatically after forecasts are generated.
const generateInventoryRecommendationForProduct = async (product_id, userId = null, req = null) => {
  await ensureRecommendationSchema();

  // Get product inventory and forecast data
  const [inventory] = await query(
    `
      SELECT i.*, p.*
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.product_id = ?
    `,
    [product_id]
  );

  if (!inventory) {
    throw new Error('Product not found');
  }

  // Get recent forecasts
  const forecasts = await query(
    `
      SELECT forecast_date, forecasted_demand
      FROM forecast_results
      WHERE product_id = ?
      ORDER BY forecast_date ASC
      LIMIT 30
    `,
    [product_id]
  );

  const currentStock = Number(inventory.current_stock || 0);
  const availableStock = Number(inventory.available_stock ?? currentStock);
  const reorderPoint = Number(inventory.reorder_point || 0);
  const safetyStock = Number(inventory.safety_stock || 0);
  const forecastDemand = forecasts.reduce(
    (sum, row) => sum + Number(row.forecasted_demand || 0),
    0
  );
  const projectedGap = Math.max(0, Math.ceil(forecastDemand * 1.2 - availableStock));
  const reorderGap = Math.max(0, reorderPoint - availableStock);
  const safetyGap = Math.max(0, safetyStock - availableStock);

  let mlResponse = {
    recommended_stock: reorderPoint,
    optimal_order_quantity: 0,
    risk_level: 'low',
    risk_type: 'none',
    reasoning: 'Stock levels are within target range.',
  };

  try {
    mlResponse = await callMLService('/api/optimize-inventory/', 'POST', {
      product_id,
      current_stock: inventory.current_stock,
      reorder_point: inventory.reorder_point,
      safety_stock: inventory.safety_stock,
      lead_time_days: inventory.lead_time_days,
      forecasts,
    });
  } catch (mlError) {
    console.warn(`ML optimize-inventory failed for product ${product_id}:`, mlError.message);
  }

  const rawQty = Number(mlResponse.optimal_order_quantity || 0);
  const riskLevel = String(mlResponse.risk_level || '').toLowerCase();
  const fallbackQty = Math.max(reorderGap, safetyGap, projectedGap, 1);
  const shouldForcePositiveQty =
    rawQty <= 0 &&
    (availableStock < reorderPoint || projectedGap > 0 || riskLevel === 'critical' || riskLevel === 'high' || riskLevel === 'medium');
  let finalOptimalQty = shouldForcePositiveQty ? fallbackQty : Math.max(0, rawQty);
  if (projectedGap > finalOptimalQty) {
    finalOptimalQty = projectedGap;
  }

  let riskType = mlResponse.risk_type || 'none';
  let reasoning = mlResponse.reasoning || 'Inventory optimization recommendation.';
  if (finalOptimalQty > 0 && availableStock < safetyStock) {
    riskType = 'shortage';
    reasoning = `Below safety stock (${availableStock}/${safetyStock}). Forecast demand (${forecastDemand}) suggests ordering ${finalOptimalQty} units.`;
  } else if (finalOptimalQty > 0 && projectedGap > 0) {
    riskType = 'shortage';
    reasoning = `Forecast demand (${forecastDemand}) exceeds available stock (${availableStock}). Suggested order: ${finalOptimalQty} units.`;
  } else if (finalOptimalQty > 0 && availableStock < reorderPoint) {
    riskType = 'shortage';
    reasoning = `Below reorder point (${availableStock}/${reorderPoint}). Suggested order: ${finalOptimalQty} units.`;
  } else if (finalOptimalQty <= 0 && availableStock > reorderPoint * 2) {
    riskType = 'overstock';
    reasoning = mlResponse.reasoning || 'Current stock is above recommended levels.';
  }

  // Store recommendation
  await query(
    `INSERT INTO inventory_recommendations 
       (product_id, recommended_stock, optimal_order_quantity, risk_level, risk_type, reasoning)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       recommended_stock = VALUES(recommended_stock),
       optimal_order_quantity = VALUES(optimal_order_quantity),
       risk_level = VALUES(risk_level),
       risk_type = VALUES(risk_type),
       reasoning = VALUES(reasoning)`,
    [
      product_id,
      mlResponse.recommended_stock || reorderPoint,
      finalOptimalQty,
      mlResponse.risk_level || (finalOptimalQty > 0 ? 'medium' : 'low'),
      riskType,
      reasoning,
    ]
  );

  if (userId && req) {
    // Best-effort audit logging; failures here should not break main logic
    await logAudit(userId, 'GENERATE_RECOMMENDATIONS', 'recommendation', product_id, null, req).catch(() => {});
  }

  const [savedRec] = await query(
    `
      SELECT ir.*, p.sku, p.name as product_name, i.current_stock, i.available_stock
      FROM inventory_recommendations ir
      JOIN products p ON ir.product_id = p.id
      LEFT JOIN inventory i ON ir.product_id = i.product_id
      WHERE ir.product_id = ?
    `,
    [product_id]
  );

  return {
    recommendation: mlResponse,
    saved_recommendation: savedRec || null,
  };
};

export const handleGetForecasts = async (req, res) => {
  try {
    await ensureForecastSchema();
    const queryParams = req.query || {};
    const productId = queryParams.product_id;
    const days = parseInt(queryParams.days, 10);
    const effectiveDays = Number.isFinite(days) && days > 0 ? Math.min(days, 730) : 365;

    let sql = `
      SELECT 
        f.*,
        p.sku,
        p.name as product_name,
        p.unit_price,
        p.unit_cost
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE()
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `;
    const params = [effectiveDays];

    if (productId) {
      sql += ' AND f.product_id = ?';
      params.push(productId);
    }

    sql += ' ORDER BY f.forecast_date DESC, f.product_id ASC';

    const forecasts = await query(sql, params);

    sendJSON(res, 200, { forecasts });
  } catch (error) {
    console.error('Get forecasts error:', error);
    sendError(res, 500, 'Failed to fetch forecasts');
  }
};

// Delete forecasts (previous predictions)
// Supports:
// - DELETE /api/forecast?scope=all                        -> delete all forecasts
// - DELETE /api/forecast?product_id=123                   -> delete all forecasts for a product
// - DELETE /api/forecast?product_id=123&date=2025-02-01   -> delete one forecast row
export const handleDeleteForecasts = async (req, res) => {
  try {
    const params = req.query || {};
    const scope = params.scope;
    const productId = params.product_id ? parseInt(params.product_id, 10) : null;
    const date = params.date ? String(params.date) : null;

    const clearForecastDependentData = async (pid = null) => {
      if (pid !== null) {
        await query('DELETE FROM inventory_recommendations WHERE product_id = ?', [pid]).catch(() => {});
        await query(
          "DELETE FROM production_plans WHERE product_id = ? AND (notes LIKE '%forecast%' OR notes LIKE '%demand forecast%')",
          [pid]
        ).catch(() => {});
      } else {
        await query('DELETE FROM inventory_recommendations', []).catch(() => {});
        await query(
          "DELETE FROM production_plans WHERE notes LIKE '%forecast%' OR notes LIKE '%demand forecast%'",
          []
        ).catch(() => {});
      }
    };

    if (scope === 'all') {
      await query('DELETE FROM forecast_results', []);
      await clearForecastDependentData(null);
      await logAudit(req.user.id, 'DELETE_FORECAST', 'forecast', null, { scope: 'all' }, req).catch(() => {});
      return sendJSON(res, 200, { success: true });
    }

    if (productId && date) {
      await query(
        'DELETE FROM forecast_results WHERE product_id = ? AND forecast_date = ?',
        [productId, date]
      );
      await clearForecastDependentData(productId);
      await logAudit(
        req.user.id,
        'DELETE_FORECAST',
        'forecast',
        productId,
        { date },
        req
      ).catch(() => {});
      return sendJSON(res, 200, { success: true });
    }

    if (productId) {
      await query('DELETE FROM forecast_results WHERE product_id = ?', [productId]);
      await clearForecastDependentData(productId);
      await logAudit(
        req.user.id,
        'DELETE_FORECAST',
        'forecast',
        productId,
        { scope: 'product' },
        req
      ).catch(() => {});
      return sendJSON(res, 200, { success: true });
    }

    return sendError(
      res,
      400,
      'Specify scope=all or product_id (and optionally date=YYYY-MM-DD) to delete forecasts'
    );
  } catch (error) {
    console.error('Delete forecasts error:', error);
    sendError(res, 500, 'Failed to delete forecasts');
  }
};

export const handleGenerateForecast = async (req, res) => {
  try {
    await ensureForecastSchema();
    const body = await parseBody(req);
    const { product_id, days_ahead = 30, model_type = 'ensemble', bulk_mode = false } = body;
    const resolvedModelType = normalizeModelType(model_type);
    const effectiveDays = Math.min(Math.max(1, Number(days_ahead) || 30), 90);

    if (!product_id) {
      return sendError(res, 400, 'product_id is required');
    }

    // Get historical sales data
    const salesData = await query(`
      SELECT sale_date, quantity, total_amount
      FROM sales
      WHERE product_id = ?
      ORDER BY sale_date ASC
    `, [product_id]);

    if (salesData.length === 0) {
      return sendError(res, 400, 'No historical sales data available for this product');
    }

    const unitPrice = await resolveUnitPrice(product_id);
    const mlModelType = bulk_mode && resolvedModelType === 'ensemble' ? 'prophet' : resolvedModelType;
    const mlTimeout = bulk_mode ? 45000 : 120000;

    // Call ML service
    const mlResponse = await callMLService('/api/forecast/', 'POST', {
      product_id,
      historical_data: salesData,
      days_ahead: effectiveDays,
      model_type: mlModelType,
      bulk_mode: Boolean(bulk_mode),
    }, mlTimeout);

    // Store forecast results in database
    const forecasts = mlResponse.forecasts || [];
    await saveForecastRows(product_id, forecasts, { unitPrice, modelType: resolvedModelType });

    await logAudit(req.user.id, 'GENERATE_FORECAST', 'forecast', product_id, { days_ahead, model_type: resolvedModelType }, req);

    // Skip heavy side effects during bulk "Predict 2" runs (done once at the end).
    if (!bulk_mode) {
      try {
        await generateInventoryRecommendationForProduct(product_id, req.user.id, req);
      } catch (recError) {
        console.warn('Auto-generate inventory recommendation after forecast failed:', recError);
      }
      try {
        await recalculateAndPersistKPIs(30);
      } catch (kpiError) {
        console.warn('Recalculate KPIs after forecast generation failed:', kpiError);
      }
    }

    const savedForecasts = await query(`
      SELECT f.*, p.sku, p.name as product_name, p.unit_price
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.product_id = ? AND f.forecast_date >= CURDATE()
      ORDER BY f.forecast_date ASC
      LIMIT ?
    `, [product_id, effectiveDays]);

    sendJSON(res, 200, {
      success: true,
      forecasts: mlResponse.forecasts,
      saved_forecasts: savedForecasts,
      insights: mlResponse.insights,
      model_type: mlResponse.model_type || resolvedModelType
    });
  } catch (error) {
    console.error('Generate forecast error:', error);
    const code = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' ? 503 : 500;
    const message = error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET'
      ? 'ML service is not running. Start it with: cd ml-service && python manage.py runserver (port 8000).'
      : `Failed to generate forecast: ${error.message}`;
    sendError(res, code, message);
  }
};

/** Fast bulk predictions for Sales Data "Predict 2" — parallel, 30-day horizon, saves to forecast_results. */
export const handleBulkGenerateForecast = async (req, res) => {
  try {
    await ensureForecastSchema();
    const body = await parseBody(req);
    const {
      product_ids: rawIds = [],
      days_ahead = 30,
      model_type = 'prophet',
    } = body;

    const productIds = [...new Set((Array.isArray(rawIds) ? rawIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0))].slice(0, 12);

    if (!productIds.length) {
      return sendError(res, 400, 'product_ids array is required');
    }

    const resolvedModelType = normalizeModelType(model_type);
    const effectiveDays = Math.min(Math.max(1, Number(days_ahead) || 30), 30);
    const mlModelType = resolvedModelType === 'ensemble' ? 'prophet' : resolvedModelType;
    const concurrency = 3;

    let generated = 0;
    let skipped = 0;
    let rowsSaved = 0;
    const errors = [];
    const generatedProductIds = [];

    const runOne = async (productId) => {
      const salesData = await query(
        `SELECT sale_date, quantity, total_amount FROM sales WHERE product_id = ? ORDER BY sale_date ASC`,
        [productId]
      );
      if (!salesData.length) {
        skipped += 1;
        return null;
      }

      const unitPrice = await resolveUnitPrice(productId);
      const mlResponse = await callMLService(
        '/api/forecast/',
        'POST',
        {
          product_id: productId,
          historical_data: salesData,
          days_ahead: effectiveDays,
          model_type: mlModelType,
          bulk_mode: true,
        },
        45000
      );

      const saved = await saveForecastRows(productId, mlResponse.forecasts || [], {
        unitPrice,
        modelType: resolvedModelType,
      });
      if (saved > 0) {
        generated += 1;
        rowsSaved += saved;
        return productId;
      }
      skipped += 1;
      return null;
    };

    for (let i = 0; i < productIds.length; i += concurrency) {
      const batch = productIds.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map((pid) => runOne(pid)));
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          generatedProductIds.push(result.value);
        } else if (result.status === 'rejected') {
          skipped += 1;
          errors.push({ product_id: batch[idx], message: result.reason?.message || 'Failed' });
        }
      });
    }

    if (generatedProductIds.length > 0) {
      for (const productId of generatedProductIds) {
        try {
          await generateInventoryRecommendationForProduct(productId, req.user.id, req);
        } catch (recError) {
          console.warn(`Bulk recommendation failed for product ${productId}:`, recError.message);
        }
      }
      try {
        await recalculateAndPersistKPIs(30);
      } catch (kpiError) {
        console.warn('Recalculate KPIs after bulk forecast failed:', kpiError);
      }
    }

    sendJSON(res, 200, {
      success: true,
      generated,
      skipped,
      rows_saved: rowsSaved,
      model_type: resolvedModelType,
      ml_model_used: mlModelType,
      days_ahead: effectiveDays,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error('Bulk generate forecast error:', error);
    sendError(res, 500, error.message || 'Bulk forecast failed');
  }
};

export const handleGetInventoryRecommendations = async (req, res) => {
  try {
    await ensureRecommendationSchema();
    const queryParams = req.query || {};
    const productId = queryParams.product_id;

    // Get current inventory and forecasts
    let sql = `
      SELECT 
        ir.*,
        p.sku,
        p.name as product_name,
        p.unit_cost,
        p.reorder_point,
        i.current_stock,
        i.available_stock,
        COALESCE(f.forecast_demand, 0) as forecast_demand,
        CASE
          WHEN COALESCE(ir.optimal_order_quantity, 0) > 0 THEN ir.optimal_order_quantity
          WHEN COALESCE(i.available_stock, i.current_stock, 0) < COALESCE(p.reorder_point, 0)
            THEN GREATEST(1, COALESCE(p.reorder_point, 0) - COALESCE(i.available_stock, i.current_stock, 0))
          WHEN COALESCE(f.forecast_demand, 0) > COALESCE(i.available_stock, i.current_stock, 0)
            THEN GREATEST(1, CEIL(COALESCE(f.forecast_demand, 0) * 1.2 - COALESCE(i.available_stock, i.current_stock, 0)))
          ELSE 0
        END as effective_order_quantity
      FROM inventory_recommendations ir
      JOIN products p ON ir.product_id = p.id
      JOIN inventory i ON ir.product_id = i.product_id
      LEFT JOIN (
        SELECT product_id, SUM(forecasted_demand) as forecast_demand
        FROM forecast_results
        WHERE forecast_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        GROUP BY product_id
      ) f ON f.product_id = ir.product_id
      WHERE ir.risk_type != 'overstock'
        AND NOT EXISTS (
          SELECT 1 FROM procurement_orders po
          WHERE po.product_id = ir.product_id
            AND po.status IN ('pending', 'approved', 'in_transit', 'delayed')
        )
    `;
    const params = [];

    if (productId) {
      sql += ' AND ir.product_id = ?';
      params.push(productId);
    }

    sql += ` HAVING effective_order_quantity > 0
      ORDER BY ir.risk_level DESC, ir.created_at DESC`;

    let recommendations = await query(sql, params);

    if (!recommendations.length && !productId) {
      const forecastProducts = await query(`
        SELECT DISTINCT product_id
        FROM forecast_results
        WHERE forecast_date >= CURDATE()
        ORDER BY product_id ASC
        LIMIT 20
      `);
      for (const row of forecastProducts) {
        try {
          await generateInventoryRecommendationForProduct(row.product_id);
        } catch (syncError) {
          console.warn(`Recommendation sync failed for product ${row.product_id}:`, syncError.message);
        }
      }
      if (forecastProducts.length) {
        recommendations = await query(sql, params);
      }
    }

    sendJSON(res, 200, { recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    sendError(res, 500, 'Failed to fetch recommendations');
  }
};

export const handleGenerateRecommendations = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { product_id } = body;

    const { recommendation, saved_recommendation } = await generateInventoryRecommendationForProduct(
      product_id,
      req.user.id,
      req
    );

    sendJSON(res, 200, {
      success: true,
      recommendation,
      saved_recommendation
    });
  } catch (error) {
    console.error('Generate recommendations error:', error);
    sendError(res, 500, `Failed to generate recommendations: ${error.message}`);
  }
};

/**
 * Handle file upload for forecast prediction
 * Accepts CSV or XLSX files with historical inventory/sales data
 * Validates file structure and generates forecast from uploaded data
 */
export const handleUploadForecastData = async (req, res) => {
  try {
    await ensureForecastSchema();
  } catch (error) {
    console.error('Forecast schema init error:', error);
    return sendError(res, 500, `Failed to initialize forecast tables: ${error.message}`);
  }

  let fileBuffer = Buffer.alloc(0);
  let fileName = '';

  const bb = Busboy({ headers: req.headers });

  bb.on('file', (fieldname, file, fileInfo) => {
    fileName = fileInfo.filename;
    file.on('data', (data) => {
      fileBuffer = Buffer.concat([fileBuffer, data]);
    });
  });

  bb.on('finish', async () => {
    try {
      if (!fileBuffer.length) {
        return sendError(res, 400, 'No file uploaded');
      }

      // Parse file
      const parsed = parseUploadedFile(fileBuffer, fileName);
      console.log(`[Forecast Upload] Parsed file: ${fileName}, ${parsed.rowCount} rows, ${parsed.columnCount} columns`);

      // Validate structure
      const validation = validateInventoryFileStructure(parsed.columns);
      console.log(`[Forecast Upload] Validation passed. Product column: ${validation.productColumn}, Quantity: ${validation.quantityColumn}`);

      // Transform to forecast format
      const forecastData = transformToForecastData(parsed.rows, validation);
      console.log(`[Forecast Upload] Transformed ${forecastData?.length || 0} records for forecast`);
      console.log(`[Forecast Upload] forecastData type: ${typeof forecastData}, is array: ${Array.isArray(forecastData)}`);
      
      if (!Array.isArray(forecastData)) {
        throw new Error(`Transform returned non-array: ${typeof forecastData}`);
      }

      // Store file metadata
      const fileRecord = await query(
        `INSERT INTO forecast_file_uploads (user_id, file_name, file_format, row_count, column_count, status, uploaded_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [req.user.id, fileName, parsed.format, parsed.rowCount, parsed.columnCount, 'uploaded']
      );

      const fileUploadId = fileRecord.insertId;
      const byProduct = groupForecastDataByProduct(forecastData);
      const productIdentifiers = Object.keys(byProduct);
      const { matched, unmatched } = await countMatchedProducts(productIdentifiers);

      await query(
        `UPDATE forecast_file_uploads SET payload = ? WHERE id = ?`,
        [JSON.stringify({ byProduct }), fileUploadId]
      );

      await logAudit(
        req.user.id,
        'UPLOAD_FORECAST_DATA',
        'forecast_file',
        fileUploadId,
        {
          fileName,
          rowCount: parsed.rowCount,
          columnCount: parsed.columnCount,
          productCount: productIdentifiers.length,
          matchedProducts: matched,
          unmatchedProducts: unmatched,
        },
        req
      );

      sendJSON(res, 200, {
        success: true,
        message: 'File uploaded successfully. Click "Run Predict 2 (Demand)" to generate forecasts.',
        fileUploadId,
        readyForPrediction: true,
        fileInfo: {
          fileName,
          format: parsed.format,
          rowCount: parsed.rowCount,
          columnCount: parsed.columnCount,
        },
        productCount: productIdentifiers.length,
        matchedProducts: matched,
        unmatchedProducts: unmatched,
      });
    } catch (error) {
      console.error('Upload forecast data error:', error);
      sendError(res, 500, `Failed to process upload: ${error.message}`);
    }
  });

  bb.on('error', (error) => {
    console.error('Busboy error:', error);
    sendError(res, 400, 'File upload error');
  });

  req.pipe(bb);
};

/** Run ML predictions from a previously uploaded file (does not create products). */
export const handlePredictFromUpload = async (req, res) => {
  try {
    await ensureForecastSchema();
    const body = await parseBody(req);
    const { file_upload_id, days_ahead = 30, model_type = 'ensemble' } = body;
    const resolvedModelType = normalizeModelType(model_type);

    if (!file_upload_id) {
      return sendError(res, 400, 'file_upload_id is required');
    }

    const uploads = await query(
      `SELECT id, file_name, payload, status FROM forecast_file_uploads WHERE id = ?`,
      [file_upload_id]
    );

    if (!uploads.length) {
      return sendError(res, 404, 'Upload not found');
    }

    const upload = uploads[0];
    if (!upload.payload) {
      return sendError(res, 400, 'Upload has no staged data. Please upload the file again.');
    }

    const staged = typeof upload.payload === 'string' ? JSON.parse(upload.payload) : upload.payload;
    const byProduct = staged?.byProduct || {};
    const productCount = Object.keys(byProduct).length;

    if (productCount === 0) {
      return sendError(res, 400, 'No product data found in upload');
    }

    console.log(`[Forecast Predict] Running predictions for upload ${file_upload_id} (${productCount} products)...`);
    const forecastsSaved = await generateAndSaveForecastsFromProductMap(byProduct, days_ahead, resolvedModelType);

    await query(
      `UPDATE forecast_file_uploads SET status = 'processed', processed_at = NOW(), forecast_count = ? WHERE id = ?`,
      [forecastsSaved, file_upload_id]
    );

    await logAudit(
      req.user.id,
      'PREDICT_FROM_UPLOAD',
      'forecast_file',
      file_upload_id,
      { fileName: upload.file_name, forecastsSaved, days_ahead, model_type: resolvedModelType },
      req
    );

    try {
      await recalculateAndPersistKPIs(30);
    } catch (kpiError) {
      console.warn('Recalculate KPIs after upload prediction failed:', kpiError);
    }

    if (global.io) {
      global.io.emit('app:forecasts-updated', {
        source: 'file_upload_predict',
        fileId: file_upload_id,
        timestamp: new Date(),
        forecastCount: forecastsSaved,
      });
    }

    sendJSON(res, 200, {
      success: true,
      message: `Generated ${forecastsSaved} forecasts from uploaded file.`,
      fileUploadId: file_upload_id,
      forecastsGenerated: forecastsSaved,
    });
  } catch (error) {
    console.error('Predict from upload error:', error);
    sendError(res, 500, `Failed to generate predictions: ${error.message}`);
  }
};

// Clear all forecast data (for fresh start before new upload)
export const handleClearForecasts = async (req, res) => {
  try {
    await ensureForecastSchema();
    console.log(`[Forecast Clear] Clearing ALL system data for fresh prediction start...`);
    
    // Delete all operational data for clean prediction restart
    await query(`DELETE FROM forecast_results`);
    console.log(`[Forecast Clear] Deleted forecast results`);
    
    await query(`DELETE FROM forecast_file_uploads`);
    console.log(`[Forecast Clear] Deleted forecast file uploads`);
    
    await query(`DELETE FROM production_plans`);
    console.log(`[Forecast Clear] Deleted production plans`);
    
    await query(`DELETE FROM procurement_orders`);
    console.log(`[Forecast Clear] Deleted procurement orders`);
    
    await query(`DELETE FROM sales`);
    console.log(`[Forecast Clear] Deleted sales data`);
    
    await query(`DELETE FROM inventory`);
    console.log(`[Forecast Clear] Deleted inventory data`);
    
    await query(`DELETE FROM inventory_recommendations`);
    console.log(`[Forecast Clear] Deleted inventory recommendations`);
    
    await query(`DELETE FROM ai_insights`);
    console.log(`[Forecast Clear] Deleted AI insights`);
    
    // Reset KPIs
    await query(`DELETE FROM kpis`);
    console.log(`[Forecast Clear] Deleted KPIs`);
    
    // Log audit
    await logAudit(
      req.user.id,
      'CLEAR_ALL_DATA',
      'system_data',
      null,
      { action: 'Cleared all operational data for fresh prediction start', tables_cleared: [
        'forecast_results', 'forecast_file_uploads', 'production_plans', 'procurement_orders',
        'sales', 'inventory', 'inventory_recommendations', 'ai_insights', 'kpis'
      ]},
      req
    );
    
    // Trigger refresh event
    if (global.io) {
      global.io.emit('app:operations-data-updated', {
        timestamp: new Date()
      });
      global.io.emit('app:forecasts-updated', {
        timestamp: new Date()
      });
    }
    
    sendJSON(res, 200, {
      success: true,
      message: 'All operational data cleared successfully. System ready for fresh prediction start.',
      tablesCleared: [
        'forecast_results',
        'forecast_file_uploads', 
        'production_plans',
        'procurement_orders',
        'sales',
        'inventory',
        'inventory_recommendations',
        'ai_insights',
        'kpis'
      ]
    });
  } catch (error) {
    console.error('Clear all data error:', error);
    sendError(res, 500, `Failed to clear data: ${error.message}`);
  }
};


