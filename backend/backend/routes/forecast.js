import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { recalculateAndPersistKPIs } from './kpis.js';
import http from 'http';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const callMLService = (endpoint, method = 'GET', data = null) => {
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
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || 'ML Service error'));
          }
        } catch (error) {
          reject(new Error('Invalid JSON response from ML service'));
        }
      });
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

// Shared helper to generate and persist an inventory recommendation for a single product.
// Used both by the explicit recommendations endpoint and automatically after forecasts are generated.
const generateInventoryRecommendationForProduct = async (product_id, userId = null, req = null) => {
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

  // Call ML service for optimization
  const mlResponse = await callMLService('/api/optimize-inventory/', 'POST', {
    product_id,
    current_stock: inventory.current_stock,
    reorder_point: inventory.reorder_point,
    safety_stock: inventory.safety_stock,
    lead_time_days: inventory.lead_time_days,
    forecasts,
  });

  const currentStock = Number(inventory.current_stock || 0);
  const availableStock = Number(inventory.available_stock ?? currentStock);
  const reorderPoint = Number(inventory.reorder_point || 0);
  const fallbackQty = Math.max(1, reorderPoint - availableStock);
  const rawQty = Number(mlResponse.optimal_order_quantity || 0);
  const riskLevel = String(mlResponse.risk_level || '').toLowerCase();
  const shouldForcePositiveQty =
    rawQty <= 0 &&
    (availableStock < reorderPoint || riskLevel === 'critical' || riskLevel === 'high' || riskLevel === 'medium');
  const finalOptimalQty = shouldForcePositiveQty ? fallbackQty : Math.max(0, rawQty);

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
      mlResponse.recommended_stock,
      finalOptimalQty,
      mlResponse.risk_level,
      mlResponse.risk_type,
      mlResponse.reasoning,
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
    const body = await parseBody(req);
    const { product_id, days_ahead = 30, model_type = 'ensemble' } = body;

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

    // Call ML service
    const mlResponse = await callMLService('/api/forecast/', 'POST', {
      product_id,
      historical_data: salesData,
      days_ahead,
      model_type
    });

    // Store forecast results in database
    const forecasts = mlResponse.forecasts || [];
    for (const forecast of forecasts) {
      await query(
        `INSERT INTO forecast_results 
         (product_id, forecast_date, forecasted_demand, confidence_level, trend_indicator, seasonality_factor)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         forecasted_demand = VALUES(forecasted_demand),
         confidence_level = VALUES(confidence_level),
         trend_indicator = VALUES(trend_indicator),
         seasonality_factor = VALUES(seasonality_factor)`,
        [
          product_id,
          forecast.date,
          forecast.demand,
          forecast.confidence || 0.95,
          forecast.trend || 'stable',
          forecast.seasonality || 1.0
        ]
      );
    }

    await logAudit(req.user.id, 'GENERATE_FORECAST', 'forecast', product_id, { days_ahead, model_type }, req);

    // After forecasts are generated, automatically (re)generate an inventory recommendation
    // for this product so procurement views always have up-to-date suggestions.
    try {
      await generateInventoryRecommendationForProduct(product_id, req.user.id, req);
    } catch (recError) {
      // Do not fail the forecast endpoint if recommendation generation fails
      console.warn('Auto-generate inventory recommendation after forecast failed:', recError);
    }

    // Also recalculate KPIs and persist a snapshot so executive dashboards
    // and KPI pages can read the latest metrics from the kpis table if needed.
    try {
      await recalculateAndPersistKPIs(30);
    } catch (kpiError) {
      console.warn('Recalculate KPIs after forecast generation failed:', kpiError);
    }

    const savedForecasts = await query(`
      SELECT f.*, p.sku, p.name as product_name
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.product_id = ? AND f.forecast_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY f.forecast_date ASC
    `, [product_id, Math.min(days_ahead, 365)]);

    sendJSON(res, 200, {
      success: true,
      forecasts: mlResponse.forecasts,
      saved_forecasts: savedForecasts,
      insights: mlResponse.insights,
      model_type: mlResponse.model_type || model_type
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

export const handleGetInventoryRecommendations = async (req, res) => {
  try {
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
        CASE
          WHEN COALESCE(ir.optimal_order_quantity, 0) > 0 THEN ir.optimal_order_quantity
          WHEN COALESCE(i.available_stock, i.current_stock, 0) < COALESCE(p.reorder_point, 0)
            THEN GREATEST(1, COALESCE(p.reorder_point, 0) - COALESCE(i.available_stock, i.current_stock, 0))
          ELSE 0
        END as effective_order_quantity
      FROM inventory_recommendations ir
      JOIN products p ON ir.product_id = p.id
      JOIN inventory i ON ir.product_id = i.product_id
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      sql += ' AND ir.product_id = ?';
      params.push(productId);
    }

    sql += ' ORDER BY ir.risk_level DESC, ir.created_at DESC';

    const recommendations = await query(sql, params);

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
