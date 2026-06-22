import { query } from '../config/database.js';
import { sendJSON, sendError, parseBody, parseQuery } from '../utils/helpers.js';
import { calculateNetRevenueMetrics, calculatePredictionRevenue } from '../utils/revenueMetrics.js';

const parseReportDateRange = (queryParams, res) => {
  const startDate = queryParams.start_date ? String(queryParams.start_date).slice(0, 10) : null;
  const endDate = queryParams.end_date ? String(queryParams.end_date).slice(0, 10) : null;

  if (!startDate || !endDate) {
    sendError(res, 400, 'start_date and end_date are required');
    return null;
  }

  if (startDate > endDate) {
    sendError(res, 400, 'start_date must be on or before end_date');
    return null;
  }

  return { startDate, endDate };
};

// Operations Reports
export const handleGenerateSalesReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const report = await query(`
      SELECT 
        DATE(s.sale_date) as date,
        p.name as product_name,
        p.sku,
        SUM(s.quantity) as total_quantity,
        SUM(s.total_amount) as total_revenue,
        AVG(s.unit_price) as avg_price,
        COUNT(*) as transaction_count
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= ? AND s.sale_date <= ?
      GROUP BY DATE(s.sale_date), s.product_id
      ORDER BY date DESC, total_revenue DESC
    `, [startDate, endDate]);

    const summary = await query(`
      SELECT 
        COUNT(DISTINCT s.product_id) as products,
        SUM(s.quantity) as total_units,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value
      FROM sales s
      WHERE s.sale_date >= ? AND s.sale_date <= ?
    `, [startDate, endDate]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'sales',
        period: { start: startDate, end: endDate },
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate sales report error:', error);
    sendError(res, 500, 'Failed to generate sales report');
  }
};

export const handleGenerateProductionReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const report = await query(`
      SELECT 
        pp.*,
        p.name as product_name,
        p.sku,
        (pp.completed_quantity / pp.target_quantity * 100) as completion_rate
      FROM production_plans pp
      JOIN products p ON pp.product_id = p.id
      WHERE pp.start_date >= ? AND pp.start_date <= ?
      ORDER BY pp.start_date DESC
    `, [startDate, endDate]);

    const summary = await query(`
      SELECT 
        COUNT(*) as total_plans,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(target_quantity) as total_target,
        SUM(completed_quantity) as total_completed
      FROM production_plans
      WHERE start_date >= ? AND start_date <= ?
    `, [startDate, endDate]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'production',
        period: { start: startDate, end: endDate },
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate production report error:', error);
    sendError(res, 500, 'Failed to generate production report');
  }
};

export const handleGenerateDemandForecastReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const report = await query(`
      SELECT 
        f.*,
        p.name as product_name,
        p.sku
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= ?
        AND f.forecast_date <= ?
      ORDER BY f.forecast_date ASC, f.product_id
    `, [startDate, endDate]);

    const summary = await query(`
      SELECT 
        COUNT(DISTINCT product_id) as products,
        SUM(forecasted_demand) as total_forecasted,
        AVG(forecasted_demand) as avg_demand,
        AVG(confidence_level) as avg_confidence
      FROM forecast_results
      WHERE forecast_date >= ?
        AND forecast_date <= ?
    `, [startDate, endDate]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'demand_forecast',
        period: { start: startDate, end: endDate },
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate demand forecast report error:', error);
    sendError(res, 500, 'Failed to generate demand forecast report');
  }
};

// Inventory Reports
export const handleGenerateStockLevelReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const report = await query(`
      SELECT 
        i.*,
        p.name as product_name,
        p.sku,
        p.category,
        p.unit_cost,
        (i.current_stock * p.unit_cost) as stock_value,
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 'critical'
          WHEN i.available_stock < p.reorder_point THEN 'low'
          WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock'
          ELSE 'normal'
        END as stock_status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY stock_status DESC, i.available_stock ASC
    `);

    const summary = await query(`
      SELECT 
        COUNT(*) as total_skus,
        SUM(CASE WHEN i.available_stock <= p.safety_stock THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN i.available_stock < p.reorder_point AND i.available_stock > p.safety_stock THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN i.available_stock >= p.reorder_point THEN 1 ELSE 0 END) as in_stock,
        SUM(i.current_stock * p.unit_cost) as total_value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'stock_level',
        period: { start: startDate, end: endDate },
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate stock level report error:', error);
    sendError(res, 500, 'Failed to generate stock level report');
  }
};

export const handleGenerateInventoryValuationReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const report = await query(`
      SELECT 
        p.category,
        COUNT(DISTINCT i.product_id) as sku_count,
        SUM(i.current_stock) as total_units,
        SUM(i.current_stock * p.unit_cost) as total_value,
        AVG(p.unit_cost) as avg_unit_cost
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND p.category IS NOT NULL
      GROUP BY p.category
      ORDER BY total_value DESC
    `);

    const summary = await query(`
      SELECT 
        SUM(i.current_stock * p.unit_cost) as total_inventory_value,
        COUNT(DISTINCT i.product_id) as total_skus,
        SUM(i.current_stock) as total_units
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'inventory_valuation',
        period: { start: startDate, end: endDate },
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate inventory valuation report error:', error);
    sendError(res, 500, 'Failed to generate inventory valuation report');
  }
};

export const handleGenerateInventoryForecastErrorReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const rows = await query(`
      SELECT f.id, p.name as product_name, p.sku, f.forecast_date, f.forecasted_demand,
        COALESCE(SUM(s.quantity), 0) as actual
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      LEFT JOIN sales s ON f.product_id = s.product_id AND DATE(s.sale_date) = f.forecast_date
      WHERE f.forecast_date >= ?
        AND f.forecast_date <= ?
      GROUP BY f.id
      ORDER BY ABS(f.forecasted_demand - COALESCE(SUM(s.quantity), 0)) DESC
      LIMIT 500
    `, [startDate, endDate]);

    let totalAbsolute = 0;
    let totalSquared = 0;
    let totalPct = 0;
    let mapeCount = 0;
    const details = rows.map((row) => {
      const forecast = Number(row.forecasted_demand || 0);
      const actual = Number(row.actual || 0);
      const error = forecast - actual;
      const absoluteError = Math.abs(error);
      if (actual > 0) {
        totalPct += Math.abs(error / actual);
        mapeCount += 1;
      }
      totalAbsolute += absoluteError;
      totalSquared += absoluteError * absoluteError;
      return {
        product_name: row.product_name,
        sku: row.sku,
        forecast_date: row.forecast_date,
        forecasted_demand: forecast,
        actual,
        absolute_error: Math.round(absoluteError * 100) / 100,
        error_direction: forecast >= actual ? 'over' : 'under',
        percent_error: actual > 0 ? Math.round((Math.abs(error / actual) * 100) * 100) / 100 : null
      };
    });

    const count = details.length;
    const mae = count > 0 ? totalAbsolute / count : 0;
    const rmse = count > 0 ? Math.sqrt(totalSquared / count) : 0;
    const mape = mapeCount > 0 ? (totalPct / mapeCount) * 100 : 0;

    const summary = {
      records: count,
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      mapped_records: mapeCount
    };

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'inventory_forecast_error',
        period: { start: startDate, end: endDate },
        summary,
        details
      }
    });
  } catch (error) {
    console.error('Generate inventory forecast error report:', error);
    sendError(res, 500, 'Failed to generate inventory forecast error report');
  }
};

export const handleGenerateInventoryABCAnalysisReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const rows = await query(`
      SELECT p.id as product_id, p.name as product_name, p.sku, p.category,
        i.current_stock, i.available_stock, p.unit_cost,
        (i.current_stock * p.unit_cost) as stock_value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY stock_value DESC
      LIMIT 500
    `);

    const totalValue = rows.reduce((sum, item) => sum + Number(item.stock_value || 0), 0);
    let cumulativeValue = 0;
    const details = rows.map((row) => {
      const stockValue = Number(row.stock_value || 0);
      cumulativeValue += stockValue;
      const cumulativeShare = totalValue > 0 ? cumulativeValue / totalValue : 0;
      const abcCategory = cumulativeShare <= 0.7 ? 'A' : cumulativeShare <= 0.9 ? 'B' : 'C';
      return {
        product_name: row.product_name,
        sku: row.sku,
        category: row.category || 'Uncategorized',
        current_stock: row.current_stock,
        available_stock: row.available_stock,
        unit_cost: Number(row.unit_cost || 0),
        stock_value: Math.round(stockValue * 100) / 100,
        value_share: totalValue ? Math.round((stockValue / totalValue) * 10000) / 100 : 0,
        cumulative_share: Math.round(cumulativeShare * 10000) / 100,
        abc_category: abcCategory
      };
    });

    const summary = {
      total_items: rows.length,
      total_inventory_value: Math.round(totalValue * 100) / 100,
      a_count: details.filter((i) => i.abc_category === 'A').length,
      b_count: details.filter((i) => i.abc_category === 'B').length,
      c_count: details.filter((i) => i.abc_category === 'C').length,
      a_value: Math.round(details.filter((i) => i.abc_category === 'A').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100,
      b_value: Math.round(details.filter((i) => i.abc_category === 'B').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100,
      c_value: Math.round(details.filter((i) => i.abc_category === 'C').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100
    };

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'inventory_abc_analysis',
        period: { start: startDate, end: endDate },
        summary,
        details
      }
    });
  } catch (error) {
    console.error('Generate inventory ABC analysis report:', error);
    sendError(res, 500, 'Failed to generate inventory ABC analysis report');
  }
};

export const handleGenerateInventoryTransactionsReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;
    const queryParams = req.query || {};
    const limit = Math.max(1, Math.min(500, parseInt(queryParams.limit, 10) || 200));

    const logs = await query(
      `
        SELECT
          a.id,
          a.created_at,
          a.action,
          a.entity_id as product_id,
          a.details,
          u.name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.entity_type = 'inventory'
          AND (
            a.action LIKE 'INVENTORY_TXN_%'
            OR a.action = 'PROCUREMENT_STATUS_UPDATE'
          )
          AND DATE(a.created_at) >= ?
          AND DATE(a.created_at) <= ?
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `,
      [startDate, endDate]
    );

    const details = (logs || []).map((l) => {
      let parsed = l.details;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          parsed = {};
        }
      }
      parsed = parsed || {};
      const qty = Number(parsed.quantity || 0);
      const unitPrice = parsed.unit_price != null ? Number(parsed.unit_price) : null;
      let totalAmount = parsed.total_amount != null ? Number(parsed.total_amount) : null;
      if (totalAmount == null && unitPrice != null && qty > 0) {
        totalAmount = unitPrice * qty;
      }
      const txnType =
        parsed.transaction_type ||
        (l.action.startsWith('INVENTORY_TXN_')
          ? l.action.replace('INVENTORY_TXN_', '').toLowerCase()
          : 'procurement_status');

      return {
        id: l.id,
        date: l.created_at,
        product_name: parsed.product_name || null,
        sku: parsed.sku || null,
        transaction_type: txnType,
        quantity: qty,
        unit_price: unitPrice,
        total_amount: totalAmount,
        previous_stock: parsed.previous_stock ?? null,
        new_stock: parsed.new_stock ?? null,
        user_name: l.user_name || 'System',
        notes: parsed.notes || null,
      };
    });

    let stockInValue = 0;
    let stockInUnits = 0;
    let soldRevenue = 0;
    let soldUnits = 0;
    let orderedValue = 0;
    let orderedUnits = 0;

    for (const row of details) {
      const amount = Number(row.total_amount || 0);
      const qty = Number(row.quantity || 0);
      const type = String(row.transaction_type || '').toLowerCase();
      if (type === 'stock_in') {
        stockInUnits += qty;
        stockInValue += amount;
      } else if (type === 'sold') {
        soldUnits += qty;
        soldRevenue += amount;
      } else if (type === 'ordered') {
        orderedUnits += qty;
        orderedValue += amount;
      }
    }

    const summary = {
      total_transactions: details.length,
      stock_in_units: stockInUnits,
      stock_in_value: Math.round(stockInValue * 100) / 100,
      sold_units: soldUnits,
      sold_revenue: Math.round(soldRevenue * 100) / 100,
      ordered_units: orderedUnits,
      ordered_value: Math.round(orderedValue * 100) / 100,
    };

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'inventory_transactions',
        period: { start: startDate, end: endDate },
        summary,
        details,
      },
    });
  } catch (error) {
    console.error('Generate inventory transactions report error:', error);
    sendError(res, 500, 'Failed to generate inventory transactions report');
  }
};

// Executive Reports
export const handleGenerateExecutiveSummary = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const [salesSummary] = await query(`
      SELECT 
        SUM(total_amount) as revenue,
        SUM(quantity) as units_sold,
        COUNT(*) as transactions,
        AVG(total_amount) as avg_order_value
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `, [startDate, endDate]);

    const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
    const revenueMetrics = await calculateNetRevenueMetrics(days);
    const predictionInRange = await calculatePredictionRevenue(days);

    const [productionSummary] = await query(`
      SELECT 
        COUNT(*) as plans,
        SUM(target_quantity) as target_units,
        SUM(completed_quantity) as completed_units
      FROM production_plans
      WHERE start_date >= ? AND start_date <= ?
    `, [startDate, endDate]);

    const [inventorySummary] = await query(`
      SELECT 
        SUM(i.current_stock * p.unit_cost) as inventory_value,
        COUNT(DISTINCT i.product_id) as active_products
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    const [procurementSummary] = await query(`
      SELECT 
        COUNT(*) as orders,
        SUM(total_cost) as total_spend,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'delivered' THEN total_cost ELSE 0 END) as delivered_spend
      FROM procurement_orders
      WHERE order_date >= ? AND order_date <= ?
    `, [startDate, endDate]);

    const recentTransactions = await query(
      `
        SELECT
          a.id,
          a.created_at,
          a.details,
          u.name as user_name
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.entity_type = 'inventory'
          AND a.action LIKE 'INVENTORY_TXN_%'
          AND DATE(a.created_at) >= ?
          AND DATE(a.created_at) <= ?
        ORDER BY a.created_at DESC
        LIMIT 25
      `,
      [startDate, endDate]
    );

    const transactionHistory = (recentTransactions || []).map((l) => {
      let parsed = l.details;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          parsed = {};
        }
      }
      parsed = parsed || {};
      const qty = Number(parsed.quantity || 0);
      const unitPrice = parsed.unit_price != null ? Number(parsed.unit_price) : null;
      let totalAmount = parsed.total_amount != null ? Number(parsed.total_amount) : null;
      if (totalAmount == null && unitPrice != null && qty > 0) {
        totalAmount = unitPrice * qty;
      }
      return {
        date: l.created_at,
        product_name: parsed.product_name || null,
        transaction_type: parsed.transaction_type || null,
        quantity: qty,
        total_amount: totalAmount,
        user_name: l.user_name || 'System',
      };
    });

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'executive_summary',
        period: { start: startDate, end: endDate },
        sales: {
          ...(salesSummary || {}),
          gross_sales_revenue: Number(salesSummary?.revenue || 0),
          revenue: revenueMetrics.net_revenue,
          net_revenue: revenueMetrics.net_revenue,
          actual_revenue: revenueMetrics.actual_revenue,
          prediction_revenue: predictionInRange.prediction_revenue,
          procurement_deductions: revenueMetrics.procurement_deductions,
        },
        production: productionSummary || {},
        inventory: inventorySummary || {},
        procurement: procurementSummary || {},
        recent_transactions: transactionHistory,
      }
    });
  } catch (error) {
    console.error('Generate executive summary error:', error);
    sendError(res, 500, 'Failed to generate executive summary');
  }
};

export const handleGenerateFinancialReport = async (req, res) => {
  try {
    const range = parseReportDateRange(req.query || {}, res);
    if (!range) return;
    const { startDate, endDate } = range;

    const revenue = await query(`
      SELECT 
        DATE(sale_date) as date,
        SUM(total_amount) as revenue
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY DATE(sale_date)
      ORDER BY date ASC
    `, [startDate, endDate]);

    const costs = await query(`
      SELECT 
        DATE(COALESCE(actual_delivery, updated_at, order_date)) as date,
        SUM(total_cost) as cost
      FROM procurement_orders
      WHERE status = 'delivered'
        AND DATE(COALESCE(actual_delivery, updated_at, order_date)) >= ?
        AND DATE(COALESCE(actual_delivery, updated_at, order_date)) <= ?
      GROUP BY DATE(COALESCE(actual_delivery, updated_at, order_date))
      ORDER BY date ASC
    `, [startDate, endDate]);

    const [summary] = await query(`
      SELECT 
        (SELECT SUM(total_amount) FROM sales WHERE sale_date >= ? AND sale_date <= ?) as total_revenue,
        (SELECT SUM(total_cost) FROM procurement_orders WHERE status = 'delivered' AND DATE(COALESCE(actual_delivery, updated_at, order_date)) >= ? AND DATE(COALESCE(actual_delivery, updated_at, order_date)) <= ?) as total_costs,
        (SELECT SUM(i.current_stock * p.unit_cost) FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.is_active = TRUE) as inventory_value
    `, [startDate, endDate, startDate, endDate]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'financial',
        period: { start: startDate, end: endDate },
        summary: summary || {},
        revenue: revenue,
        costs: costs
      }
    });
  } catch (error) {
    console.error('Generate financial report error:', error);
    sendError(res, 500, 'Failed to generate financial report');
  }
};
