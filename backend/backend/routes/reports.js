import { query } from '../config/database.js';
import { sendJSON, sendError, parseBody, parseQuery } from '../utils/helpers.js';

// Operations Reports
export const handleGenerateSalesReport = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = queryParams.days ? parseInt(queryParams.days) : 30;
    const startDate = queryParams.start_date || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = queryParams.end_date || new Date().toISOString().split('T')[0];

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
    const queryParams = req.query || {};
    const days = queryParams.days ? parseInt(queryParams.days) : 30;

    const report = await query(`
      SELECT 
        pp.*,
        p.name as product_name,
        p.sku,
        (pp.completed_quantity / pp.target_quantity * 100) as completion_rate
      FROM production_plans pp
      JOIN products p ON pp.product_id = p.id
      WHERE pp.start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY pp.start_date DESC
    `, [days]);

    const summary = await query(`
      SELECT 
        COUNT(*) as total_plans,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(target_quantity) as total_target,
        SUM(completed_quantity) as total_completed
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'production',
        period: days,
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
    const queryParams = req.query || {};
    const days = queryParams.days ? parseInt(queryParams.days) : 30;

    const report = await query(`
      SELECT 
        f.*,
        p.name as product_name,
        p.sku
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE() 
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY f.forecast_date ASC, f.product_id
    `, [days]);

    const summary = await query(`
      SELECT 
        COUNT(DISTINCT product_id) as products,
        SUM(forecasted_demand) as total_forecasted,
        AVG(forecasted_demand) as avg_demand,
        AVG(confidence_level) as avg_confidence
      FROM forecast_results
      WHERE forecast_date >= CURDATE() 
        AND forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'demand_forecast',
        period: days,
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
        summary: summary[0] || {},
        details: report
      }
    });
  } catch (error) {
    console.error('Generate inventory valuation report error:', error);
    sendError(res, 500, 'Failed to generate inventory valuation report');
  }
};

// Executive Reports
export const handleGenerateExecutiveSummary = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = queryParams.days ? parseInt(queryParams.days) : 30;

    const [salesSummary] = await query(`
      SELECT 
        SUM(total_amount) as revenue,
        SUM(quantity) as units_sold,
        COUNT(*) as transactions,
        AVG(total_amount) as avg_order_value
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    const [productionSummary] = await query(`
      SELECT 
        COUNT(*) as plans,
        SUM(target_quantity) as target_units,
        SUM(completed_quantity) as completed_units
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

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
        SUM(total_cost) as total_spend
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'executive_summary',
        period: days,
        sales: salesSummary || {},
        production: productionSummary || {},
        inventory: inventorySummary || {},
        procurement: procurementSummary || {}
      }
    });
  } catch (error) {
    console.error('Generate executive summary error:', error);
    sendError(res, 500, 'Failed to generate executive summary');
  }
};

export const handleGenerateFinancialReport = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = queryParams.days ? parseInt(queryParams.days) : 30;

    const revenue = await query(`
      SELECT 
        DATE(sale_date) as date,
        SUM(total_amount) as revenue
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(sale_date)
      ORDER BY date ASC
    `, [days]);

    const costs = await query(`
      SELECT 
        DATE(order_date) as date,
        SUM(total_cost) as cost
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `, [days]);

    const [summary] = await query(`
      SELECT 
        (SELECT SUM(total_amount) FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) as total_revenue,
        (SELECT SUM(total_cost) FROM procurement_orders WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) as total_costs,
        (SELECT SUM(i.current_stock * p.unit_cost) FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.is_active = TRUE) as inventory_value
    `, [days, days]);

    sendJSON(res, 200, {
      success: true,
      report: {
        type: 'financial',
        period: days,
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
