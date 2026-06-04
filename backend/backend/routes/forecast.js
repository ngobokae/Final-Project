import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { recalculateAndPersistKPIs } from './kpis.js';
import { parseUploadedFile, validateInventoryFileStructure, transformToForecastData } from '../utils/fileParser.js';
import http from 'http';
import Busboy from 'busboy';

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
          console.log(`[Forecast Upload] ML Service response (raw): ${responseData.substring(0, 200)}`);
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || 'ML Service error'));
          }
        } catch (error) {
          console.error(`[Forecast Upload] JSON parse error - Response: "${responseData.substring(0, 500)}"`);
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

/**
 * Handle file upload for forecast prediction
 * Accepts CSV or XLSX files with historical inventory/sales data
 * Validates file structure and generates forecast from uploaded data
 */
export const handleUploadForecastData = async (req, res) => {
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

      // Group data by product and date for aggregation
      const productMap = new Map();
      console.log(`[Forecast Upload] Starting forEach on forecastData, length: ${forecastData.length}`);
      
      try {
        forecastData.forEach(item => {
          const key = item.product_identifier;
          if (!productMap.has(key)) {
            productMap.set(key, []);
          }
          productMap.get(key).push(item);
        });
      } catch (forEachErr) {
        console.error(`[Forecast Upload] Error in forEach: ${forEachErr.message}`, forEachErr);
        throw forEachErr;
      }
      
      console.log(`[Forecast Upload] Grouped into ${productMap.size} unique products`);

      // AUTO-GENERATE PRODUCTION AND PROCUREMENT PLANS IMMEDIATELY FROM UPLOADED DATA
      console.log(`[Forecast Upload] Creating production and procurement plans from uploaded data...`);
      try {
        for (const [productSku, items] of productMap.entries()) {
          try {
            const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            
            if (totalQuantity <= 0) {
              console.log(`[Forecast Upload] Skipping production plan for ${productSku} - zero quantity`);
              continue;
            }

            // Find product in database to get ID and name
            const productInfo = await query('SELECT id, name FROM products WHERE id = ? OR sku = ? LIMIT 1', [productSku, productSku]);
            if (productInfo.length === 0) {
              console.log(`[Forecast Upload] Product not found for SKU/ID: ${productSku}`);
              continue;
            }
            
            const productId = productInfo[0].id;
            const productName = productInfo[0].name;

            // Create production plan
            const ppResult = await query(`
              INSERT INTO production_plans (product_id, target_quantity, start_date, end_date, priority, notes, created_by)
              VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, ?)
            `, [
              productId,
              Math.ceil(totalQuantity),
              'medium',
              `Auto-generated from file upload (${Math.ceil(totalQuantity)} units)`,
              req.user.id
            ]);

            console.log(`[Forecast Upload] Created production plan ${ppResult.insertId} for ${productName} (${totalQuantity} units)`);

            // Create procurement order
            const unit_cost = 100;
            const total_cost = Math.ceil(totalQuantity) * unit_cost;
            
            const poResult = await query(`
              INSERT INTO procurement_orders (product_id, supplier_name, quantity, unit_cost, total_cost, order_date, expected_delivery, notes, created_by)
              VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), ?, ?)
            `, [
              productId,
              'Auto-Supplier',
              Math.ceil(totalQuantity),
              unit_cost,
              total_cost,
              `Auto-generated procurement (${Math.ceil(totalQuantity)} units)`,
              req.user.id
            ]);

            console.log(`[Forecast Upload] Created procurement order ${poResult.insertId} for ${productName}`);
          } catch (planErr) {
            console.error(`[Forecast Upload] Error creating plans for ${productSku}: ${planErr.message}`);
          }
        }
      } catch (autoGenErr) {
        console.error(`[Forecast Upload] Error in auto-generation: ${autoGenErr.message}`);
      }

      // Emit Socket.io update for production/procurement data
      if (global.io) {
        console.log(`[Forecast Upload] Emitting operations data update...`);
        global.io.emit('app:operations-data-updated', {
          source: 'file_upload',
          fileId: fileUploadId,
          timestamp: new Date()
        });
      }

      // Prepare historical data for each product and call ML service in parallel
      const allForecasts = [];
      
      // Create array of ML service promises for parallel execution
      const mlPromises = Array.from(productMap.entries()).map(async ([productId, items]) => {
        try {
          console.log(`[Forecast Upload] Processing forecasts for product: ${productId} (${items.length} records)`);
          
          // Transform items to historical_data format expected by ML service
          const historicalData = items.map(item => ({
            sale_date: item.date,
            quantity: item.quantity
          })).filter(d => d.sale_date); // Only include records with dates

          if (historicalData.length === 0) {
            console.log(`[Forecast Upload] Skipping ${productId} - no valid date records`);
            return [];
          }

          // Call ML service for this product
          const mlResponse = await callMLService('/api/forecast/', 'POST', {
            product_id: productId,
            historical_data: historicalData,
            days_ahead: 30,
            model_type: 'ensemble'
          });

          console.log(`[Forecast Upload] ML service returned forecasts for ${productId}: ${mlResponse?.forecasts?.length || 0}`);
          
          // Return forecasts with product identifier attached
          if (mlResponse && mlResponse.forecasts && Array.isArray(mlResponse.forecasts)) {
            return mlResponse.forecasts.map(forecast => ({
              product_identifier: productId,
              ...forecast
            }));
          }
          return [];
        } catch (productErr) {
          console.error(`[Forecast Upload] Error processing product ${productId}: ${productErr.message}`);
          return [];
        }
      });

      // Wait for all ML service calls to complete in parallel (with individual timeouts)
      console.log(`[Forecast Upload] Making ${mlPromises.length} parallel ML service calls...`);
      
      // Use allSettled to wait for all promises, whether they succeed or fail
      const results = await Promise.allSettled(
        mlPromises.map(promise => 
          Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Individual ML call timeout')), 60000)
            )
          ])
        )
      );
      
      // Process all successful results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allForecasts.push(...result.value);
        } else {
          console.warn(`[Forecast Upload] ML call ${index} failed or timed out: ${result.reason?.message || 'Unknown error'}`);
        }
      });
      
      console.log(`[Forecast Upload] Completed ML service calls. Got ${allForecasts.length} forecasts total.`);

      // Store forecasts from uploaded data with optimized batch insert
      if (allForecasts.length > 0) {
        console.log(`[Forecast Upload] Starting batch insert of ${allForecasts.length} forecasts...`);
        
        try {
          // Get unique SKUs first
          const uniqueSkus = [...new Set(allForecasts.map(f => f.product_identifier || f.product_id))];
          console.log(`[Forecast Upload] Found ${uniqueSkus.length} unique products from ${allForecasts.length} forecasts`);
          
          // Get all product SKU->ID mappings in one query (MUCH faster than individual lookups)
          const placeholders = uniqueSkus.map(() => '?').join(',');
          const productMap = await query(
            `SELECT id, sku FROM products WHERE sku IN (${placeholders})`,
            uniqueSkus
          );
          
          const skuToIdMap = {};
          productMap.forEach(p => {
            skuToIdMap[p.sku] = p.id;
          });
          console.log(`[Forecast Upload] Loaded product mappings for ${Object.keys(skuToIdMap).length} products`);

          // Build batch insert values
          const insertValues = [];
          const insertParams = [];
          let skippedCount = 0;

          allForecasts.forEach(forecast => {
            const skuIdentifier = forecast.product_identifier || forecast.product_id;
            const forecastDate = forecast.date || forecast.forecast_date;
            const forecastedDemand = forecast.demand || forecast.forecasted_demand;
            
            if (!forecastDate || forecastedDemand === undefined) {
              console.warn(`[Forecast Upload] Skipping forecast for ${skuIdentifier} - missing date or demand`);
              skippedCount++;
              return;
            }

            const productId = skuToIdMap[skuIdentifier];
            if (!productId) {
              console.warn(`[Forecast Upload] Product not found for SKU: ${skuIdentifier}`);
              skippedCount++;
              return;
            }

            insertValues.push('(?, ?, ?)');
            insertParams.push(productId, forecastDate, forecastedDemand);
          });

          if (insertValues.length > 0) {
            console.log(`[Forecast Upload] Inserting ${insertValues.length} forecasts (skipped ${skippedCount})...`);
            const sql = `INSERT INTO forecast_results (product_id, forecast_date, forecasted_demand) 
                         VALUES ${insertValues.join(',')}
                         ON DUPLICATE KEY UPDATE forecasted_demand = VALUES(forecasted_demand)`;
            
            await query(sql, insertParams);
            console.log(`[Forecast Upload] Batch insert completed successfully!`);
          }
        } catch (batchErr) {
          console.error(`[Forecast Upload] Batch insert error: ${batchErr.message}`);
          throw batchErr;
        }
      }

      // Update file status
      console.log(`[Forecast Upload] Updating file status to 'processed'...`);
      await query(
        `UPDATE forecast_file_uploads SET status = 'processed', processed_at = NOW(), forecast_count = ? WHERE id = ?`,
        [allForecasts.length, fileUploadId]
      );
      console.log(`[Forecast Upload] File status updated.`);

      // Log audit
      console.log(`[Forecast Upload] Logging audit event...`);
      await logAudit(
        req.user.id,
        'UPLOAD_FORECAST_DATA',
        'forecast_file',
        fileUploadId,
        {
          fileName,
          rowCount: parsed.rowCount,
          columnCount: parsed.columnCount,
          forecastsGenerated: allForecasts.length
        },
        req
      );
      console.log(`[Forecast Upload] Audit logged.`);

      // Trigger refresh event
      if (global.io) {
        console.log(`[Forecast Upload] Emitting Socket.io event...`);
        global.io.emit('app:forecasts-updated', {
          source: 'file_upload',
          fileId: fileUploadId,
          timestamp: new Date(),
          forecastCount: allForecasts.length
        });
        console.log(`[Forecast Upload] Socket.io event emitted.`);
      }

      console.log(`[Forecast Upload] Sending success response with ${allForecasts.length} forecasts...`);
      sendJSON(res, 200, {
        success: true,
        message: `File processed successfully. Generated ${allForecasts.length} forecasts.`,
        fileUploadId,
        fileInfo: {
          fileName,
          format: parsed.format,
          rowCount: parsed.rowCount,
          columnCount: parsed.columnCount
        },
        forecastsGenerated: allForecasts.length,
        forecasts: allForecasts.slice(0, 10) // Return first 10 for preview
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

// Clear all forecast data (for fresh start before new upload)
export const handleClearForecasts = async (req, res) => {
  try {
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


