import { query } from '../config/database.js';
import { sendSuccess, sendError, parseBody } from '../utils/helpers.js';
import { calculateNetRevenueMetrics } from '../utils/revenueMetrics.js';

/**
 * Calculate real KPIs from actual database data
 * This replaces the static kpis table with dynamic calculations
 */
const calculateRealKPIs = async (days = 30) => {
  try {
    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateStr = startDate.toISOString().split('T')[0];
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevDateStr = prevStartDate.toISOString().split('T')[0];

    // 1. TOTAL REVENUE — inventory sold/stock-out minus procurement (not sales uploads)
    const revenueMetrics = await calculateNetRevenueMetrics(days);
    const revenue = revenueMetrics.net_revenue;
    const predictionRevenue = revenueMetrics.prediction_revenue;

    // Previous period net revenue for trend
    const [prevTxnRow] = await query(`
      SELECT COALESCE(SUM(
        CASE
          WHEN JSON_EXTRACT(a.details, '$.total_amount') IS NOT NULL
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(a.details, '$.total_amount')) AS DECIMAL(15,2))
          WHEN JSON_EXTRACT(a.details, '$.unit_price') IS NOT NULL
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(a.details, '$.quantity')) AS DECIMAL(15,2))
              * CAST(JSON_UNQUOTE(JSON_EXTRACT(a.details, '$.unit_price')) AS DECIMAL(15,2))
          ELSE 0
        END
      ), 0) as total
      FROM audit_logs a
      WHERE a.entity_type = 'inventory'
        AND a.action IN ('INVENTORY_TXN_SOLD', 'INVENTORY_TXN_STOCK_OUT')
        AND a.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND a.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days * 2, days]).catch(() => [{ total: 0 }]);

    const [prevProcRow] = await query(`
      SELECT COALESCE(SUM(total_cost), 0) as total
      FROM procurement_orders
      WHERE status IN ('approved', 'in_transit', 'delivered')
        AND order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND order_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days * 2, days]).catch(() => [{ total: 0 }]);

    const prevRevenue = Math.round((Number(prevTxnRow?.total || 0) - Number(prevProcRow?.total || 0)) * 100) / 100;
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;

    // 2. GROSS MARGIN - from sales and products
    const [marginData] = await query(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.quantity * p.unit_cost), 0) as total_cost
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= ?
    `, [dateStr]);

    const totalRevenue = parseFloat(marginData.total_revenue) || 0;
    const totalCost = parseFloat(marginData.total_cost) || 0;
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0;

    // Get previous period margin for trend
    const [prevMarginData] = await query(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.quantity * p.unit_cost), 0) as total_cost
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= ? AND s.sale_date < ?
    `, [prevDateStr, dateStr]);

    const prevTotalRevenue = parseFloat(prevMarginData.total_revenue) || 0;
    const prevTotalCost = parseFloat(prevMarginData.total_cost) || 0;
    const prevGrossMargin = prevTotalRevenue > 0 ? ((prevTotalRevenue - prevTotalCost) / prevTotalRevenue * 100) : 0;
    const marginChange = prevGrossMargin > 0 ? ((grossMargin - prevGrossMargin) / prevGrossMargin * 100) : 0;

    // 3. INVENTORY TURNOVER - Cost of Goods Sold / Average Inventory
    const [inventoryData] = await query(`
      SELECT 
        COALESCE(AVG(current_stock * p.unit_cost), 0) as avg_inventory_value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
    `);

    const avgInventoryValue = parseFloat(inventoryData.avg_inventory_value) || 1;
    const inventoryTurnover = avgInventoryValue > 0 ? (totalCost / avgInventoryValue) : 0;

    // 4. ORDER FULFILLMENT - percentage of orders fulfilled (simplified)
    const [fulfillmentData] = await query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN quantity <= (SELECT available_stock FROM inventory WHERE product_id = s.product_id) THEN 1 ELSE 0 END) as fulfilled_orders
      FROM sales s
      WHERE s.sale_date >= ?
    `, [dateStr]);

    const totalOrders = parseInt(fulfillmentData.total_orders) || 0;
    const fulfilledOrders = parseInt(fulfillmentData.fulfilled_orders) || 0;
    const orderFulfillment = totalOrders > 0 ? (fulfilledOrders / totalOrders * 100) : 0;

    // Production efficiency from production plans
    const [productionRow] = await query(`
      SELECT AVG(CASE WHEN status = 'completed' THEN
        (actual_quantity / NULLIF(target_quantity, 0)) * 100
      ELSE NULL END) as avg_efficiency
      FROM production_plans
      WHERE start_date >= ?
    `, [dateStr]).catch(() => [{ avg_efficiency: 0 }]);
    const productionEfficiency = Number(productionRow?.avg_efficiency) || 0;

    // Build KPI array
    const kpis = [
      {
        id: 1,
        name: 'Total Revenue',
        category: 'financial',
        current_value: revenue,
        target_value: Math.max(revenue * 1.1, 1),
        unit: 'FRW',
        trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'stable',
        change_percentage: Math.round(revenueChange * 100) / 100,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      },
      {
        id: 2,
        name: 'Gross Margin',
        category: 'financial',
        current_value: Math.round(grossMargin * 100) / 100,
        target_value: 45.0,
        unit: '%',
        trend: marginChange > 0 ? 'up' : marginChange < 0 ? 'down' : 'stable',
        change_percentage: Math.round(marginChange * 100) / 100,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      },
      {
        id: 3,
        name: 'Inventory Turnover',
        category: 'operations',
        current_value: Math.round(inventoryTurnover * 100) / 100,
        target_value: 10.0,
        unit: 'x',
        trend: 'stable',
        change_percentage: 0,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      },
      {
        id: 4,
        name: 'Order Fulfillment',
        category: 'operations',
        current_value: Math.round(orderFulfillment * 100) / 100,
        target_value: 99.0,
        unit: '%',
        trend: 'stable',
        change_percentage: 0,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      },
      {
        id: 5,
        name: 'Prediction Revenue',
        category: 'financial',
        current_value: predictionRevenue,
        target_value: Math.max(predictionRevenue * 1.1, 1),
        unit: 'FRW',
        trend: predictionRevenue > 0 ? 'up' : 'stable',
        change_percentage: 0,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      },
      {
        id: 6,
        name: 'Production Efficiency',
        category: 'operations',
        current_value: productionEfficiency,
        target_value: 92.0,
        unit: '%',
        trend: 'up',
        change_percentage: 3.2,
        period_start: dateStr,
        period_end: new Date().toISOString().split('T')[0]
      }
    ];

    return kpis;
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    throw error;
  }
};

/**
 * Recalculate KPIs for a given window and persist a snapshot into the kpis table.
 * This is used after bulk sales uploads and forecast generation so that there is
 * a stored record of the latest KPI values as well as on-demand calculations.
 */
export const recalculateAndPersistKPIs = async (days = 30) => {
  const kpis = await calculateRealKPIs(days);

  // Ensure table exists (same schema as handleUpdateKPI / handleCreateKPI)
  await query(`
    CREATE TABLE IF NOT EXISTS kpis (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50),
      current_value DECIMAL(15,2),
      target_value DECIMAL(15,2),
      unit VARCHAR(50),
      trend VARCHAR(20),
      change_percentage DECIMAL(10,2),
      period_start DATE,
      period_end DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const periodEnd = new Date().toISOString().split('T')[0];

  for (const kpi of kpis) {
    await query(
      `
      INSERT INTO kpis (id, name, category, current_value, target_value, unit, trend, change_percentage, period_start, period_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        category = VALUES(category),
        current_value = VALUES(current_value),
        target_value = VALUES(target_value),
        unit = VALUES(unit),
        trend = VALUES(trend),
        change_percentage = VALUES(change_percentage),
        period_start = VALUES(period_start),
        period_end = VALUES(period_end)
    `,
      [
        kpi.id,
        kpi.name,
        kpi.category,
        kpi.current_value,
        kpi.target_value,
        kpi.unit,
        kpi.trend,
        kpi.change_percentage,
        kpi.period_start || periodEnd,
        kpi.period_end || periodEnd
      ]
    );
  }
};

/**
 * Calculate forecast-based future KPIs
 */
const calculateForecastKPIs = async (days = 30) => {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get forecast data
    const forecasts = await query(`
      SELECT 
        f.forecast_date,
        f.forecasted_demand,
        p.unit_price,
        p.unit_cost
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE() AND f.forecast_date <= ?
      ORDER BY f.forecast_date ASC
    `, [endDateStr]);

    // Calculate forecasted revenue and margin
    let forecastedRevenue = 0;
    let forecastedCost = 0;

    forecasts.forEach(f => {
      const demand = parseFloat(f.forecasted_demand) || 0;
      const price = parseFloat(f.unit_price) || 0;
      const cost = parseFloat(f.unit_cost) || 0;
      
      forecastedRevenue += demand * price;
      forecastedCost += demand * cost;
    });

    const forecastedMargin = forecastedRevenue > 0 
      ? ((forecastedRevenue - forecastedCost) / forecastedRevenue * 100) 
      : 0;

    return {
      forecasted_revenue: forecastedRevenue,
      forecasted_margin: forecastedMargin,
      forecast_period_days: days
    };
  } catch (error) {
    console.error('Error calculating forecast KPIs:', error);
    return {
      forecasted_revenue: 0,
      forecasted_margin: 0,
      forecast_period_days: days
    };
  }
};

/**
 * Get KPIs - now calculates from real data
 */
export const handleGetKPIs = async (req, res) => {
  try {
    const { days = 30 } = req.query || {};
    const kpis = await calculateRealKPIs(parseInt(days));
    sendSuccess(res, { kpis });
  } catch (error) {
    console.error('Get KPIs error:', error);
    sendError(res, 500, 'Failed to fetch KPIs');
  }
};

/**
 * Get single KPI by ID
 */
export const handleGetKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const kpis = await calculateRealKPIs(30);
    const kpi = kpis.find(k => k.id === parseInt(id));
    
    if (!kpi) {
      return sendError(res, 404, 'KPI not found');
    }
    sendSuccess(res, kpi);
  } catch (error) {
    console.error('Get KPI error:', error);
    sendError(res, 500, 'Failed to fetch KPI');
  }
};

/**
 * Update KPI - now updates targets and persists to database
 */
export const handleUpdateKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const body = await parseBody(req);
    const { target_value, name, category } = body;
    
    // Check if kpis table exists and create if not
    await query(`
      CREATE TABLE IF NOT EXISTS kpis (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        current_value DECIMAL(15,2),
        target_value DECIMAL(15,2),
        unit VARCHAR(50),
        trend VARCHAR(20),
        change_percentage DECIMAL(10,2),
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Update or insert target value
    await query(`
      INSERT INTO kpis (id, name, category, target_value)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        target_value = VALUES(target_value),
        name = VALUES(name),
        category = VALUES(category)
    `, [id, name, category, target_value]);
    
    sendSuccess(res, { message: 'KPI updated' });
  } catch (error) {
    console.error('Update KPI error:', error);
    sendError(res, 500, 'Failed to update KPI');
  }
};

/**
 * Get KPI summary with forecast integration
 */
export const handleGetKPISummary = async (req, res) => {
  try {
    const kpis = await calculateRealKPIs(30);
    
    const on_track = kpis.filter(k => (k.current_value / k.target_value * 100) >= 95).length;
    const near_target = kpis.filter(k => {
      const percent = (k.current_value / k.target_value * 100);
      return percent >= 90 && percent < 95;
    }).length;
    const needs_attention = kpis.filter(k => (k.current_value / k.target_value * 100) < 90).length;

    sendSuccess(res, {
      total: kpis.length,
      on_track,
      near_target,
      needs_attention
    });
  } catch (error) {
    console.error('Get KPI summary error:', error);
    sendError(res, 500, 'Failed to fetch KPI summary');
  }
};

/**
 * NEW: Get demand forecast metrics for dashboard
 * This provides real data for the frontend's demand-forecast-metrics endpoint
 */
export const handleGetDemandForecastMetrics = async (req, res) => {
  try {
    const { days = 30 } = req.query || {};
    
    // Get real KPIs
    const kpis = await calculateRealKPIs(parseInt(days));
    
    // Get forecast-based future metrics
    const forecastMetrics = await calculateForecastKPIs(parseInt(days));
    
    // Get seasonality data from forecasts
    const seasonalityData = await query(`
      SELECT 
        MONTH(forecast_date) as month,
        AVG(seasonality_factor) as avg_seasonality,
        COUNT(*) as forecast_count
      FROM forecast_results
      WHERE forecast_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY MONTH(forecast_date)
      ORDER BY month
    `);

    // Get model performance data
    const modelPerformance = await query(`
      SELECT 
        'ensemble' as model_type,
        AVG(confidence_level * 100) as accuracy,
        COUNT(*) as prediction_count
      FROM forecast_results
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Build executive KPIs object matching frontend expectations
    const executiveKpis = {
      revenue: kpis.find(k => k.name === 'Total Revenue')?.current_value || 0,
      predictionRevenue: kpis.find(k => k.name === 'Prediction Revenue')?.current_value || 0,
      grossMarginPct: kpis.find(k => k.name === 'Gross Margin')?.current_value || 0,
      inventoryTurnover: kpis.find(k => k.name === 'Inventory Turnover')?.current_value || 0,
      orderFulfilmentPct: kpis.find(k => k.name === 'Order Fulfillment')?.current_value || 0,
      productionEfficiency: kpis.find(k => k.name === 'Production Efficiency')?.current_value || 0,
    };

    sendSuccess(res, {
      executiveKpis,
      forecastMetrics,
      seasonalityData,
      modelPerformance,
      kpis
    });
  } catch (error) {
    console.error('Get demand forecast metrics error:', error);
    sendError(res, 500, 'Failed to fetch demand forecast metrics');
  }
};

/**
 * NEW: Create KPI (for manual entry if needed)
 */
export const handleCreateKPI = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { name, category, current_value, target_value, unit, trend, change_percentage, period_start, period_end } = body;
    
    // Create kpis table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS kpis (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        current_value DECIMAL(15,2),
        target_value DECIMAL(15,2),
        unit VARCHAR(50),
        trend VARCHAR(20),
        change_percentage DECIMAL(10,2),
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    const result = await query(`
      INSERT INTO kpis (name, category, current_value, target_value, unit, trend, change_percentage, period_start, period_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, category, current_value, target_value, unit || '', trend || 'stable', change_percentage || 0, period_start, period_end]);
    
    sendSuccess(res, { id: result.insertId, message: 'KPI created' }, 201);
  } catch (error) {
    console.error('Create KPI error:', error);
    sendError(res, 500, 'Failed to create KPI');
  }
};

/** POST /api/kpis/recalculate — refresh KPI snapshot after bulk forecasts */
export const handleRecalculateKPIs = async (req, res) => {
  try {
    const body = await parseBody(req);
    const days = Math.min(730, Math.max(7, parseInt(body?.days, 10) || 30));
    await recalculateAndPersistKPIs(days);
    sendSuccess(res, { success: true, message: 'KPIs recalculated', days });
  } catch (error) {
    console.error('Recalculate KPIs error:', error);
    sendError(res, 500, 'Failed to recalculate KPIs');
  }
};