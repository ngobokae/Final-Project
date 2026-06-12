import { query } from '../config/database.js';
import { sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { generateAlertsFromInventory } from './inventory.js';
import { calculateNetRevenueMetrics, calculateStockFlow } from '../utils/revenueMetrics.js';

// Helper to calculate forecast accuracy
const calculateForecastAccuracy = async () => {
  try {
    const forecasts = await query(`
      SELECT f.forecasted_demand, f.confidence_level, s.quantity as actual
      FROM forecast_results f
      LEFT JOIN sales s ON f.product_id = s.product_id AND DATE(s.sale_date) = f.forecast_date
      WHERE f.forecast_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND f.forecast_date <= CURDATE()
      LIMIT 100
    `);

    let totalError = 0;
    let count = 0;
    forecasts.forEach((f) => {
      if (f.actual) {
        const error = Math.abs(f.forecasted_demand - f.actual) / f.actual;
        totalError += error;
        count++;
      }
    });

    if (count > 0) {
      return Math.max(0, Math.min(100, (1 - totalError / count) * 100));
    }

    const [confidenceRow] = await query(`
      SELECT AVG(confidence_level) as avg_confidence, COUNT(*) as total
      FROM forecast_results
      WHERE forecast_date >= CURDATE()
    `);

    if (confidenceRow?.total > 0 && confidenceRow.avg_confidence) {
      const avg = Number(confidenceRow.avg_confidence);
      return Math.round((avg <= 1 ? avg * 100 : avg) * 10) / 10;
    }

    return 0;
  } catch {
    return 0;
  }
};

// Helper to calculate inventory turnover
const calculateInventoryTurnover = async (days = 30) => {
  try {
    const [sales] = await query(`
      SELECT SUM(quantity) as total_sold
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    const [inventory] = await query(`
      SELECT AVG(i.current_stock) as avg_stock
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    if (!inventory?.avg_stock || inventory.avg_stock === 0) return 0;
    return (sales?.total_sold || 0) / inventory.avg_stock;
  } catch {
    return 0;
  }
};

const calculateForecastErrorMetrics = async (days = 30) => {
  try {
    const rows = await query(`
      SELECT f.id, p.name as product_name, p.sku, f.forecast_date,
        f.forecasted_demand,
        COALESCE(SUM(s.quantity), 0) as actual
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      LEFT JOIN sales s ON f.product_id = s.product_id AND DATE(s.sale_date) = f.forecast_date
      WHERE f.forecast_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND f.forecast_date <= CURDATE()
      GROUP BY f.id
      ORDER BY ABS(f.forecasted_demand - COALESCE(SUM(s.quantity), 0)) DESC
      LIMIT 200
    `, [days]);

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
        ...row,
        forecasted_demand: forecast,
        actual,
        error_direction: forecast >= actual ? 'over' : 'under',
        absolute_error: Math.round(absoluteError * 100) / 100,
        percent_error: actual > 0 ? Math.round((Math.abs(error / actual) * 100) * 100) / 100 : null
      };
    });

    const count = details.length;
    const mae = count > 0 ? totalAbsolute / count : 0;
    const rmse = count > 0 ? Math.sqrt(totalSquared / count) : 0;
    const mape = mapeCount > 0 ? (totalPct / mapeCount) * 100 : 0;

    return {
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      count,
      topErrors: details.slice(0, 10)
    };
  } catch (error) {
    console.error('Forecast error metrics calculation failed:', error);
    return {
      mae: 0,
      rmse: 0,
      mape: 0,
      count: 0,
      topErrors: []
    };
  }
};

const calculateInventoryABCAnalysis = async () => {
  try {
    const rows = await query(`
      SELECT p.id as product_id, p.name as product_name, p.sku, p.category,
        i.current_stock, i.available_stock, p.unit_cost,
        (i.current_stock * p.unit_cost) as stock_value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY stock_value DESC
    `);

    const totalValue = rows.reduce((sum, item) => sum + Number(item.stock_value || 0), 0);
    let cumulativeValue = 0;
    const details = rows.map((item) => {
      const stockValue = Number(item.stock_value || 0);
      cumulativeValue += stockValue;
      const cumulativeShare = totalValue > 0 ? cumulativeValue / totalValue : 0;
      const abcCategory = cumulativeShare <= 0.7 ? 'A' : cumulativeShare <= 0.9 ? 'B' : 'C';
      return {
        ...item,
        stock_value: Math.round(stockValue * 100) / 100,
        value_share: totalValue ? Math.round((stockValue / totalValue) * 10000) / 100 : 0,
        cumulative_share: totalValue ? Math.round(cumulativeShare * 10000) / 100 : 0,
        abc_category: abcCategory
      };
    });

    const summary = {
      total_items: rows.length,
      total_value: Math.round(totalValue * 100) / 100,
      a_count: details.filter((i) => i.abc_category === 'A').length,
      b_count: details.filter((i) => i.abc_category === 'B').length,
      c_count: details.filter((i) => i.abc_category === 'C').length,
      a_value: Math.round(details.filter((i) => i.abc_category === 'A').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100,
      b_value: Math.round(details.filter((i) => i.abc_category === 'B').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100,
      c_value: Math.round(details.filter((i) => i.abc_category === 'C').reduce((sum, i) => sum + i.stock_value, 0) * 100) / 100
    };

    return { summary, details: details.slice(0, 30) };
  } catch (error) {
    console.error('Inventory ABC analysis failed:', error);
    return { summary: { total_items: 0, total_value: 0, a_count: 0, b_count: 0, c_count: 0, a_value: 0, b_value: 0, c_value: 0 }, details: [] };
  }
};

export const handleGetDashboardStats = async (req, res) => {
  try {
    await generateAlertsFromInventory();
    const userRole = req.user.role;
    const days = Math.min(730, Math.max(1, parseInt(req.query?.days) || 30));

    // Common stats
    const [productCount] = await query('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE');
    const [inventoryValue] = await query(`
      SELECT SUM(i.current_stock * p.unit_cost) as value
      FROM inventory i
      JOIN products p ON i.product_id = p.id
    `);

    // Sales stats (use requested period)
    const [salesStats] = await query(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as total_revenue
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);
    // Previous period for growth %
    const [prevSales] = await query(`
      SELECT SUM(total_amount) as total_revenue
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND sale_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days * 2, days]);
    const currRev = Number(salesStats?.total_revenue) || 0;
    const prevRev = Number(prevSales?.total_revenue) || 0;
    const sales_growth_pct = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : 0;

    const revenueMetrics = await calculateNetRevenueMetrics(days);
    const total_revenue_forecast = revenueMetrics.prediction_revenue;

    // Alerts
    const [alertCount] = await query(`
      SELECT COUNT(*) as count
      FROM alerts
      WHERE is_resolved = FALSE AND severity IN ('high', 'critical')
    `);

    // Role-specific stats
    let roleSpecificStats = {};

    if (userRole === 'admin' || userRole === 'executive') {
      const [userCount] = await query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
      roleSpecificStats.active_users = userCount.count;
    }

    if (userRole === 'admin' || userRole === 'executive' || userRole === 'operations' || userRole === 'operations_manager') {
      const [forecastCount] = await query(`
        SELECT COUNT(*) as count
        FROM forecast_results
        WHERE forecast_date >= CURDATE()
      `);
      roleSpecificStats.active_forecasts = forecastCount.count;
      roleSpecificStats.forecast_accuracy = Math.round(await calculateForecastAccuracy());
    }

    if (userRole === 'operations' || userRole === 'executive' || userRole === 'operations_manager') {
      const [procurementPending] = await query(`
        SELECT COUNT(*) as count FROM procurement_orders
        WHERE status IN ('pending', 'approved', 'in_transit')
      `);
      roleSpecificStats.pending_orders = procurementPending?.count ?? 0;
      const [productionBacklog] = await query(`
        SELECT COUNT(*) as count FROM production_plans
        WHERE status IN ('in_progress', 'scheduled')
          AND start_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);
      roleSpecificStats.production_backlog = productionBacklog?.count ?? 0;
    }

    if (userRole === 'inventory' || userRole === 'executive') {
      const [lowStockCount] = await query(`
        SELECT COUNT(*) as count
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        WHERE i.available_stock <= p.safety_stock
      `);
      roleSpecificStats.low_stock_items = lowStockCount.count;
    }

    sendJSON(res, 200, {
      stats: {
        total_products: productCount.count,
        inventory_value: inventoryValue.value || 0,
        total_sales: salesStats.total_sales || 0,
        total_quantity: salesStats.total_quantity || 0,
        total_revenue: revenueMetrics.net_revenue,
        actual_revenue: revenueMetrics.actual_revenue,
        transaction_revenue: revenueMetrics.transaction_revenue,
        sales_revenue: revenueMetrics.sales_revenue,
        procurement_deductions: revenueMetrics.procurement_deductions,
        prediction_revenue: revenueMetrics.prediction_revenue,
        total_revenue_forecast: total_revenue_forecast,
        net_revenue: revenueMetrics.net_revenue,
        sales_growth_pct: Math.round(sales_growth_pct * 10) / 10,
        critical_alerts: alertCount.count,
        inventory_turnover: Math.round((await calculateInventoryTurnover(days)) * 10) / 10,
        ...roleSpecificStats
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    sendError(res, 500, 'Failed to fetch dashboard statistics');
  }
};

export const handleGetSalesChart = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = parseInt(queryParams.days) || 30;

    const chartData = await query(`
      SELECT 
        DATE(sale_date) as date,
        SUM(quantity) as quantity,
        SUM(total_amount) as revenue,
        COUNT(*) as sales_count
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(sale_date)
      ORDER BY date ASC
    `, [days]);

    sendJSON(res, 200, { chartData });
  } catch (error) {
    console.error('Get sales chart error:', error);
    sendError(res, 500, 'Failed to fetch sales chart data');
  }
};

export const handleGetInventoryChart = async (req, res) => {
  try {
    const chartData = await query(`
      SELECT 
        p.name as product_name,
        i.current_stock,
        i.available_stock,
        p.reorder_point,
        p.safety_stock,
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 'shortage'
          WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock'
          ELSE 'normal'
        END as status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY i.available_stock ASC
      LIMIT 20
    `);

    sendJSON(res, 200, { chartData });
  } catch (error) {
    console.error('Get inventory chart error:', error);
    sendError(res, 500, 'Failed to fetch inventory chart data');
  }
};

export const handleGetInventoryDashboard = async (req, res) => {
  try {
    await generateAlertsFromInventory();
    const [productCount] = await query('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE');
    const [stockValue] = await query(`
      SELECT SUM(i.current_stock * p.unit_cost) as value
      FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.is_active = TRUE
    `);
    const [lowStock] = await query(`
      SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock <= p.safety_stock
    `);
    const [overstock] = await query(`
      SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock >= (p.reorder_point * 2)
    `);
    const turnoverRate = await calculateInventoryTurnover(30);
    const forecastAccuracy = await calculateForecastAccuracy();
    const [forecastSummary] = await query(`
      SELECT COUNT(DISTINCT product_id) as products_with_forecast,
        COALESCE(SUM(forecasted_demand), 0) as total_forecasted_demand
      FROM forecast_results
      WHERE forecast_date >= CURDATE() AND forecast_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `).catch(() => [{ products_with_forecast: 0, total_forecasted_demand: 0 }]);
    const inventoryChart = await query(`
      SELECT p.name as product_name, p.category, i.current_stock, i.available_stock, p.reorder_point, p.safety_stock,
        CASE WHEN i.available_stock <= p.safety_stock THEN 'shortage' WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock' ELSE 'normal' END as status
      FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.is_active = TRUE ORDER BY i.available_stock ASC LIMIT 20
    `);
    const alerts = await query(`
      SELECT a.*, p.name as product_name FROM alerts a LEFT JOIN products p ON a.product_id = p.id
      WHERE a.is_resolved = FALSE AND a.alert_type IN ('shortage', 'overstock', 'reorder')
      ORDER BY a.severity DESC, a.created_at DESC LIMIT 20
    `);
    const lowStockItems = await query(`
      SELECT i.*, p.sku, p.name as product_name, p.reorder_point, p.safety_stock
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock <= p.safety_stock ORDER BY i.available_stock ASC LIMIT 15
    `);
    const overstockItems = await query(`
      SELECT i.*, p.sku, p.name as product_name, p.reorder_point
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock >= (p.reorder_point * 2) ORDER BY i.available_stock DESC LIMIT 15
    `);
    const forecastErrorStats = await calculateForecastErrorMetrics(30);
    const abcAnalysis = await calculateInventoryABCAnalysis();
    const forecastRecommendation = forecastErrorStats.mape > 20
      ? 'Forecast error is elevated; review seasonality and SKU-level model tuning for high variance items.'
      : 'Forecast performance is within expected tolerance.';

    const stockFlow = await calculateStockFlow(30);

    sendJSON(res, 200, {
      totalProducts: productCount.count,
      stockValue: Number(stockValue?.value) || 0,
      lowStockCount: lowStock.count,
      overstockCount: overstock.count,
      turnoverRate: Math.round(turnoverRate * 10) / 10,
      forecastAccuracy: Math.round(forecastAccuracy * 10) / 10,
      forecastErrorStats,
      forecastRecommendation,
      abcSummary: abcAnalysis.summary,
      abcTopProducts: abcAnalysis.details,
      productsWithForecast: forecastSummary?.products_with_forecast ?? 0,
      totalForecastedDemand: Number(forecastSummary?.total_forecasted_demand) || 0,
      stockFlow,
      chartData: inventoryChart,
      alerts,
      lowStockItems,
      overstockItems,
    });
  } catch (error) {
    console.error('Inventory dashboard error:', error);
    sendError(res, 500, 'Failed to fetch inventory dashboard');
  }
};

export const handleGetExecutiveDashboard = async (req, res) => {
  try {
    await generateAlertsFromInventory();
    const days = 30;
    const [salesStats] = await query(`
      SELECT SUM(total_amount) as total_revenue, SUM(quantity) as total_quantity
      FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);
    const [forecastStats] = await query(`
      SELECT COUNT(*) as count FROM forecast_results WHERE forecast_date >= CURDATE()
    `);
    const [inventoryValue] = await query(`
      SELECT SUM(i.current_stock * p.unit_cost) as value
      FROM inventory i JOIN products p ON i.product_id = p.id WHERE p.is_active = TRUE
    `);
    const [lowStock] = await query(`
      SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock <= p.safety_stock
    `);
    const [overstock] = await query(`
      SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND i.available_stock >= (p.reorder_point * 2)
    `);
    const productsAtRisk = await query(`
      SELECT p.name as product_name, i.available_stock, p.safety_stock, p.reorder_point,
        CASE WHEN i.available_stock <= p.safety_stock THEN 'shortage' WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock' ELSE 'normal' END as status
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND (i.available_stock <= p.safety_stock OR i.available_stock >= (p.reorder_point * 2))
      LIMIT 15
    `);
    const recentForecasts = await query(`
      SELECT f.forecasted_demand, f.confidence_level, f.trend_indicator, p.name as product_name
      FROM forecast_results f JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE() ORDER BY f.forecast_date ASC LIMIT 8
    `);
    const alerts = await query(`
      SELECT a.*, p.name as product_name FROM alerts a LEFT JOIN products p ON a.product_id = p.id
      WHERE a.is_resolved = FALSE ORDER BY a.severity DESC, a.created_at DESC LIMIT 10
    `);
    const salesChart = await query(`
      SELECT DATE(sale_date) as date, SUM(quantity) as quantity, SUM(total_amount) as revenue
      FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(sale_date) ORDER BY date ASC
    `, [days]);
    const productionPlans = await query(`
      SELECT pp.*, p.name as product_name FROM production_plans pp
      JOIN products p ON pp.product_id = p.id ORDER BY pp.start_date DESC LIMIT 5
    `).catch(() => []);
    const procurementOrders = await query(`
      SELECT po.*, p.name as product_name FROM procurement_orders po
      JOIN products p ON po.product_id = p.id WHERE po.status IN ('pending','approved','in_transit') ORDER BY po.order_date DESC LIMIT 5
    `).catch(() => []);
    const insights = await query(`
      SELECT * FROM ai_insights WHERE is_dismissed = FALSE ORDER BY priority DESC, created_at DESC LIMIT 10
    `).catch(() => []);

    sendJSON(res, 200, {
      totalRevenue: salesStats?.total_revenue || 0,
      totalQuantity: salesStats?.total_quantity || 0,
      forecastCount: forecastStats?.count || 0,
      inventoryValue: inventoryValue?.value || 0,
      lowStockCount: lowStock?.count || 0,
      overstockCount: overstock?.count || 0,
      productsAtRisk,
      recentForecasts,
      alerts,
      salesChartData: salesChart,
      productionPlans: productionPlans || [],
      procurementOrders: procurementOrders || [],
      insights: insights || [],
    });
  } catch (error) {
    console.error('Executive dashboard error:', error);
    sendError(res, 500, 'Failed to fetch executive dashboard');
  }
};

export const handleGetOperationsDashboard = async (req, res) => {
  try {
    await generateAlertsFromInventory();
    const days = 30;
    const [salesStats] = await query(`
      SELECT SUM(total_amount) as total_revenue, SUM(quantity) as total_quantity
      FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);
    const [forecastStats] = await query(`
      SELECT COUNT(*) as count FROM forecast_results WHERE forecast_date >= CURDATE()
    `);
    const productsAtRisk = await query(`
      SELECT p.name as product_name, i.available_stock, p.safety_stock, p.reorder_point,
        CASE WHEN i.available_stock <= p.safety_stock THEN 'shortage' WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock' ELSE 'normal' END as status
      FROM inventory i JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE AND (i.available_stock <= p.safety_stock OR i.available_stock >= (p.reorder_point * 2))
      LIMIT 20
    `);
    const recentForecasts = await query(`
      SELECT f.forecasted_demand, f.confidence_level, f.trend_indicator, p.name as product_name
      FROM forecast_results f JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE() ORDER BY f.forecast_date ASC LIMIT 10
    `);
    const alerts = await query(`
      SELECT a.*, p.name as product_name FROM alerts a LEFT JOIN products p ON a.product_id = p.id
      WHERE a.is_resolved = FALSE ORDER BY a.severity DESC, a.created_at DESC LIMIT 15
    `);
    const salesChart = await query(`
      SELECT DATE(sale_date) as date, SUM(quantity) as quantity, SUM(total_amount) as revenue
      FROM sales WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(sale_date) ORDER BY date ASC
    `, [days]);
    const productionPlans = await query(`
      SELECT pp.*, p.name as product_name FROM production_plans pp
      JOIN products p ON pp.product_id = p.id ORDER BY pp.start_date DESC LIMIT 5
    `).catch(() => []);
    const procurementOrders = await query(`
      SELECT po.*, p.name as product_name FROM procurement_orders po
      JOIN products p ON po.product_id = p.id WHERE po.status IN ('pending','approved','in_transit') ORDER BY po.order_date DESC LIMIT 5
    `).catch(() => []);

    sendJSON(res, 200, {
      totalSales: salesStats?.total_revenue || 0,
      totalQuantity: salesStats?.total_quantity || 0,
      forecastCount: forecastStats?.count || 0,
      productsAtRisk,
      recentForecasts,
      alerts,
      salesChartData: salesChart,
      productionPlans: productionPlans || [],
      procurementOrders: procurementOrders || [],
    });
  } catch (error) {
    console.error('Operations dashboard error:', error);
    sendError(res, 500, 'Failed to fetch operations dashboard');
  }
};

export const handleGetForecastChart = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const productId = queryParams.product_id;
    const days = parseInt(queryParams.days) || 30;

    // 1. Get past actual sales
    let salesSql = `
      SELECT 
        DATE(sale_date) as date,
        SUM(quantity) as actual_sales,
        0 as forecasted_demand,
        'Past' as product_name
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const salesParams = [days];
    if (productId) {
      salesSql += ' AND product_id = ?';
      salesParams.push(productId);
    }
    salesSql += ' GROUP BY DATE(sale_date)';

    // 2. Get future forecasts
    let forecastSql = `
      SELECT 
        f.forecast_date as date,
        0 as actual_sales,
        f.forecasted_demand,
        p.name as product_name
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE()
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    `;
    const forecastParams = [days];
    if (productId) {
      forecastSql += ' AND f.product_id = ?';
      forecastParams.push(productId);
    }

    const salesResults = await query(salesSql, salesParams);
    const forecastResults = await query(forecastSql, forecastParams);

    // Merge by date
    const merged = {};
    [...salesResults, ...forecastResults].forEach(item => {
      const d = item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0];
      if (!merged[d]) {
        merged[d] = { date: d, actual_sales: 0, forecasted_demand: 0, product_name: item.product_name };
      }
      merged[d].actual_sales += Number(item.actual_sales) || 0;
      merged[d].forecasted_demand += Number(item.forecasted_demand) || 0;
      if (item.product_name !== 'Past') merged[d].product_name = item.product_name;
    });

    const chartData = Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));

    sendJSON(res, 200, { chartData });
  } catch (error) {
    console.error('Get forecast chart error:', error);
    sendError(res, 500, 'Failed to fetch forecast chart data');
  }
};

// Get category performance data (sales + forecast)
export const handleGetCategoryPerformance = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = parseInt(queryParams.days) || 30;

    const categoryData = await query(`
      SELECT 
        p.category,
        SUM(s.total_amount) as revenue,
        COUNT(DISTINCT s.product_id) as product_count,
        SUM(s.quantity) as units_sold,
        AVG(p.unit_price - p.unit_cost) as avg_margin
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND (p.category IS NOT NULL AND p.category != '')
      GROUP BY p.category
      ORDER BY revenue DESC
    `, [days]);

    const forecastByCategory = await query(`
      SELECT 
        p.category,
        COALESCE(SUM(f.forecasted_demand * p.unit_price), 0) as forecast_revenue,
        COALESCE(SUM(f.forecasted_demand), 0) as forecast_units
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE()
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND (p.category IS NOT NULL AND p.category != '')
      GROUP BY p.category
    `, [days]).catch(() => []);

    const forecastMap = (forecastByCategory || []).reduce((acc, row) => {
      acc[row.category || 'Uncategorized'] = { forecast_revenue: Number(row.forecast_revenue) || 0, forecast_units: Number(row.forecast_units) || 0 };
      return acc;
    }, {});

    const allCategories = new Set([
      ...(categoryData || []).map(c => c.category || 'Uncategorized'),
      ...Object.keys(forecastMap)
    ]);

    const performance = Array.from(allCategories).map(cat => {
      const salesRow = (categoryData || []).find(c => (c.category || 'Uncategorized') === cat);
      const rev = Number(salesRow?.revenue) || 0;
      const fc = forecastMap[cat] || { forecast_revenue: 0, forecast_units: 0 };
      return {
        category: cat,
        revenue: rev,
        forecast_revenue: fc.forecast_revenue,
        forecast_units: fc.forecast_units,
        target: Math.max((rev || 1) * 1.1, 1),
        growth: 0,
        margin: salesRow?.avg_margin || 0,
        units_sold: salesRow?.units_sold || 0
      };
    }).filter(p => p.revenue > 0 || p.forecast_revenue > 0).sort((a, b) => b.revenue - a.revenue);

    sendJSON(res, 200, { performance });
  } catch (error) {
    console.error('Get category performance error:', error);
    sendError(res, 500, 'Failed to fetch category performance');
  }
};

// Get regional data from sales (and optionally forecast if region linked later)
export const handleGetRegionalData = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = parseInt(queryParams.days) || 30;

    const regionalData = await query(`
      SELECT 
        COALESCE(s.region, 'Unknown') as region,
        SUM(s.total_amount) as revenue,
        COUNT(*) as orders,
        SUM(s.quantity) as units_sold
      FROM sales s
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY s.region
      ORDER BY revenue DESC
    `, [days]);

    const totalRevenue = regionalData.reduce((sum, r) => sum + Number(r.revenue || 0), 0);
    const formatted = (regionalData || []).map(reg => ({
      name: reg.region || 'Unknown',
      value: totalRevenue > 0 ? Math.round((Number(reg.revenue) / totalRevenue) * 100) : 0,
      revenue: Number(reg.revenue) || 0,
      growth: 0,
      orders: reg.orders || 0
    }));

    sendJSON(res, 200, { regionalData: formatted });
  } catch (error) {
    console.error('Get regional data error:', error);
    sendError(res, 500, 'Failed to fetch regional data');
  }
};

// Revenue & profit trend: past from sales, future from forecast (post-prediction)
export const handleGetRevenueProfitTrend = async (req, res) => {
  try {
    const days = Math.min(730, Math.max(7, parseInt(req.query?.days) || 30));

    const salesTrend = await query(`
      SELECT 
        DATE(sale_date) as date,
        SUM(total_amount) as revenue,
        SUM((p.unit_price - p.unit_cost) * s.quantity) as profit,
        COUNT(*) as orders
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(s.sale_date)
      ORDER BY date ASC
    `, [days]).catch(() => []);

    const forecastTrend = await query(`
      SELECT 
        f.forecast_date as date,
        SUM(f.forecasted_demand * p.unit_price) as revenue,
        SUM(f.forecasted_demand * (p.unit_price - p.unit_cost)) as profit
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      WHERE f.forecast_date >= CURDATE()
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      GROUP BY f.forecast_date
      ORDER BY date ASC
    `, [days]).catch(() => []);

    const byDate = {};
    (salesTrend || []).forEach(row => {
      const d = row.date ? String(row.date).slice(0, 10) : null;
      if (!d) return;
      byDate[d] = { date: d, revenue_actual: Number(row.revenue) || 0, profit_actual: Number(row.profit) || 0, revenue_forecast: 0, profit_forecast: 0, orders: Number(row.orders) || 0 };
    });
    (forecastTrend || []).forEach(row => {
      const d = row.date ? String(row.date).slice(0, 10) : null;
      if (!d) return;
      if (!byDate[d]) byDate[d] = { date: d, revenue_actual: 0, profit_actual: 0, revenue_forecast: 0, profit_forecast: 0, orders: 0 };
      byDate[d].revenue_forecast = Number(row.revenue) || 0;
      byDate[d].profit_forecast = Number(row.profit) || 0;
    });

    const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    const trend = sorted.map(row => ({
      date: row.date,
      month: new Date(row.date + 'Z').toLocaleDateString('en-US', { month: 'short' }),
      revenue: row.revenue_actual,
      profit: row.profit_actual,
      revenue_actual: row.revenue_actual,
      revenue_forecast: row.revenue_forecast,
      profit_actual: row.profit_actual,
      profit_forecast: row.profit_forecast,
      orders: row.orders
    }));

    sendJSON(res, 200, { trend });
  } catch (error) {
    console.error('Get revenue profit trend error:', error);
    sendError(res, 500, 'Failed to fetch revenue profit trend');
  }
};

// Get health metrics (uses forecast accuracy and post-prediction context)
export const handleGetHealthMetrics = async (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query?.days) || 30));
    const forecastAccuracy = await calculateForecastAccuracy();
    const inventoryTurnover = await calculateInventoryTurnover(days);

    // Calculate inventory management score
    const [inventoryStats] = await query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN i.available_stock <= p.safety_stock THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN i.available_stock >= (p.reorder_point * 2) THEN 1 ELSE 0 END) as overstock
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    const inventoryScore = inventoryStats?.total_products > 0
      ? Math.max(0, Math.min(100, 100 - ((inventoryStats.low_stock + inventoryStats.overstock) / inventoryStats.total_products * 100)))
      : 0;

    // Calculate supply chain score (based on procurement orders status)
    const [procurementStats] = await query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' AND actual_delivery <= expected_delivery THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
    `).catch(() => [{ total_orders: 0, on_time: 0, delayed_count: 0 }]);

    const supplyChainScore = procurementStats?.total_orders > 0
      ? Math.max(0, Math.min(100, (procurementStats.on_time / procurementStats.total_orders) * 100))
      : 0;

    // Financial performance (sales + forecast consideration)
    const [salesTrend] = await query(`
      SELECT 
        SUM(CASE WHEN sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN total_amount ELSE 0 END) as current_period,
        SUM(CASE WHEN sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) 
                 AND sale_date < DATE_SUB(CURDATE(), INTERVAL ? DAY) THEN total_amount ELSE 0 END) as previous_period
      FROM sales
    `, [days, days * 2, days]);

    const financialScore = salesTrend?.previous_period > 0
      ? Math.max(0, Math.min(100, 50 + ((salesTrend.current_period - salesTrend.previous_period) / salesTrend.previous_period * 50)))
      : 50;

    const healthMetrics = [
      { name: 'Demand Forecasting', score: Math.round(forecastAccuracy), trend: forecastAccuracy > 90 ? 'up' : 'stable', change: 0 },
      { name: 'Inventory Management', score: Math.round(inventoryScore), trend: inventoryScore > 80 ? 'stable' : 'down', change: 0 },
      { name: 'Supply Chain', score: Math.round(supplyChainScore), trend: supplyChainScore > 85 ? 'up' : 'stable', change: 0 },
      { name: 'Financial Performance', score: Math.round(financialScore), trend: financialScore > 50 ? 'up' : 'down', change: 0 },
      { name: 'Customer Experience', score: 85, trend: 'stable', change: 0 }, // Would need customer feedback data
      { name: 'Operational Efficiency', score: Math.round((forecastAccuracy + inventoryScore + supplyChainScore) / 3), trend: 'up', change: 0 }
    ];

    sendJSON(res, 200, { healthMetrics });
  } catch (error) {
    console.error('Get health metrics error:', error);
    sendError(res, 500, 'Failed to fetch health metrics');
  }
};

// Get demand forecast metrics
export const handleGetDemandForecastMetrics = async (req, res) => {
  try {
    const days = parseInt(req.query?.days) || 30;

    // Calculate forecast accuracy
    let forecastAccuracy = await calculateForecastAccuracy();

    // Calculate average confidence from recent forecasts
    const [confidenceData] = await query(`
      SELECT AVG(confidence_level) as avg_confidence
      FROM forecast_results
      WHERE forecast_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);
    const avgConfidence = (confidenceData?.avg_confidence || 0) * 100;

    if (forecastAccuracy <= 0 && avgConfidence > 0) {
      forecastAccuracy = Math.round(avgConfidence * 10) / 10;
    }

    // Count products with active forecasts
    const [productCount] = await query(`
      SELECT COUNT(DISTINCT product_id) as count
      FROM forecast_results
      WHERE forecast_date >= CURDATE()
    `);

    // Get model status (last forecast timestamp)
    const [lastForecast] = await query(`
      SELECT MAX(created_at) as last_run
      FROM forecast_results
    `);
    const modelStatus = lastForecast?.last_run ? 'Active' : 'Inactive';
    const lastUpdated = lastForecast?.last_run || null;

    // Get seasonality data from forecast results
    const seasonalityData = await query(`
      SELECT 
        MONTH(forecast_date) as month,
        AVG(seasonality_factor) as avg_seasonality
      FROM forecast_results
      WHERE forecast_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY MONTH(forecast_date)
      ORDER BY month
    `);

    // Get model performance comparison.
    // Note: current schema of forecast_results does not include model_type,
    // so we treat all forecasts as coming from a single "ensemble" model.
    const modelPerformance = await query(`
      SELECT 
        'ensemble' AS model_type,
        AVG(confidence_level * 100) AS accuracy,
        COUNT(*) AS predictions
      FROM forecast_results
    `).catch(() => []);

    // --- Executive-style KPI metrics (real net revenue + prediction revenue) ---
    const revenueMetrics = await calculateNetRevenueMetrics(days);
    const netRevenue = revenueMetrics.net_revenue;
    const predictionRevenue = revenueMetrics.prediction_revenue;

    // Gross margin still derived from sales uploads (training data)
    const [revenueRow] = await query(`
      SELECT 
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM((p.unit_price - p.unit_cost) * s.quantity), 0) as gross_profit
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]).catch(() => [{ total_revenue: 0, gross_profit: 0 }]);

    const salesRevenue = Number(revenueRow?.total_revenue) || 0;
    const grossProfit = Number(revenueRow?.gross_profit) || 0;
    const grossMarginPct = salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0;

    // Inventory turnover for the same window
    const inventoryTurnover = await calculateInventoryTurnover(days);

    // Order fulfilment rate from procurement orders
    const [fulfilmentRow] = await query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as fulfilled
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]).catch(() => [{ total_orders: 0, fulfilled: 0 }]);

    const orderFulfilmentPct = fulfilmentRow?.total_orders > 0
      ? (fulfilmentRow.fulfilled / fulfilmentRow.total_orders) * 100
      : 0;

    // Production efficiency from production plans
    const [productionRow] = await query(`
      SELECT 
        AVG(CASE WHEN status = 'completed' THEN 
          (actual_quantity / NULLIF(target_quantity, 0)) * 100 
        ELSE NULL END) as avg_efficiency
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]).catch(() => [{ avg_efficiency: 0 }]);

    const productionEfficiency = Number(productionRow?.avg_efficiency) || 0;

    const executiveKpis = {
      revenue: netRevenue,
      predictionRevenue,
      grossMarginPct,
      inventoryTurnover,
      orderFulfilmentPct,
      productionEfficiency,
    };

    sendJSON(res, 200, {
      forecastAccuracy: Math.round(forecastAccuracy * 10) / 10,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
      productsTracked: productCount?.count || 0,
      modelStatus,
      lastUpdated,
      seasonalityData: seasonalityData || [],
      modelPerformance: modelPerformance || [],
      executiveKpis
    });
  } catch (error) {
    console.error('Get demand forecast metrics error:', error);
    sendError(res, 500, 'Failed to fetch demand forecast metrics');
  }
};

// Get analytics metrics
export const handleGetAnalyticsMetrics = async (req, res) => {
  try {
    const days = parseInt(req.query?.days) || 30;

    // Get sales analytics
    const [salesAnalytics] = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_transaction_value,
        SUM(quantity) as total_units
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    // Get product performance
    const productPerformance = await query(`
      SELECT 
        p.name as product,
        SUM(s.total_amount) as sales,
        SUM(s.quantity) as units_sold,
        COUNT(*) as transactions
      FROM sales s
      JOIN products p ON s.product_id = p.id
      WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY p.id, p.name
      ORDER BY sales DESC
      LIMIT 10
    `, [days]);

    // Calculate data accuracy
    const [dataQuality] = await query(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN total_amount > 0 AND quantity > 0 THEN 1 ELSE 0 END) as valid_records
      FROM sales
      WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);
    const dataAccuracy = dataQuality?.total_records > 0
      ? (dataQuality.valid_records / dataQuality.total_records) * 100
      : 0;

    sendJSON(res, 200, {
      totalTransactions: salesAnalytics?.total_transactions || 0,
      totalRevenue: salesAnalytics?.total_revenue || 0,
      avgTransactionValue: salesAnalytics?.avg_transaction_value || 0,
      totalUnits: salesAnalytics?.total_units || 0,
      dataAccuracy: Math.round(dataAccuracy * 10) / 10,
      productPerformance: productPerformance || []
    });
  } catch (error) {
    console.error('Get analytics metrics error:', error);
    sendError(res, 500, 'Failed to fetch analytics metrics');
  }
};

// Get procurement metrics
export const handleGetProcurementMetrics = async (req, res) => {
  try {
    // Get pending orders count and total value
    const [orderStats] = await query(`
      SELECT 
        COUNT(*) as pending_orders,
        SUM(total_cost) as total_value
      FROM procurement_orders
      WHERE status IN ('pending', 'approved', 'in_transit')
    `).catch(() => [{ pending_orders: 0, total_value: 0 }]);

    // Calculate on-time delivery rate
    const [deliveryStats] = await query(`
      SELECT 
        COUNT(*) as total_completed,
        SUM(CASE WHEN actual_delivery <= expected_delivery THEN 1 ELSE 0 END) as on_time
      FROM procurement_orders
      WHERE status = 'delivered' 
        AND actual_delivery >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `).catch(() => [{ total_completed: 0, on_time: 0 }]);
    const onTimeRate = deliveryStats?.total_completed > 0
      ? (deliveryStats.on_time / deliveryStats.total_completed) * 100
      : 0;

    // Count active suppliers
    const [supplierCount] = await query(`
      SELECT COUNT(DISTINCT supplier_id) as count
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
    `).catch(() => [{ count: 0 }]);

    // Get cost trends
    const costTrend = await query(`
      SELECT 
        DATE_FORMAT(order_date, '%b') as month,
        SUM(total_cost) as cost,
        COUNT(*) as orders
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(order_date, '%Y-%m'), DATE_FORMAT(order_date, '%b')
      ORDER BY DATE_FORMAT(order_date, '%Y-%m')
    `).catch(() => []);

    sendJSON(res, 200, {
      pendingOrders: orderStats?.pending_orders || 0,
      totalValue: orderStats?.total_value || 0,
      onTimeDelivery: Math.round(onTimeRate * 10) / 10,
      activeSuppliers: supplierCount?.count || 0,
      costTrend: costTrend || []
    });
  } catch (error) {
    console.error('Get procurement metrics error:', error);
    sendError(res, 500, 'Failed to fetch procurement metrics');
  }
};

// Get procurement recommendations based on forecasts
export const handleGetProcurementRecommendations = async (req, res) => {
  try {
    // Get products that need procurement based on forecasts and inventory
    const recommendations = await query(`
      SELECT 
        p.id,
        p.name as item,
        p.category,
        i.current_stock,
        p.reorder_point,
        GREATEST(0, CEIL(
          (f.forecasted_demand * 1.2) - i.available_stock
        )) as recommended_order,
        p.unit_cost as unit_price,
        GREATEST(0, CEIL(
          (f.forecasted_demand * 1.2) - i.available_stock
        )) * p.unit_cost as total_cost,
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 'urgent'
          WHEN i.available_stock <= p.reorder_point THEN 'pending'
          ELSE 'scheduled'
        END as status,
        p.lead_time_days as lead_time
      FROM products p
      JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN (
        SELECT product_id, SUM(forecasted_demand) as forecasted_demand
        FROM forecast_results
        WHERE forecast_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        GROUP BY product_id
      ) f ON p.id = f.product_id
      WHERE p.is_active = TRUE
        AND (i.available_stock <= p.reorder_point OR f.forecasted_demand IS NOT NULL)
      ORDER BY 
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 1
          WHEN i.available_stock <= p.reorder_point THEN 2
          ELSE 3
        END,
        i.available_stock ASC
      LIMIT 50
    `);

    sendJSON(res, 200, { recommendations: recommendations || [] });
  } catch (error) {
    console.error('Get procurement recommendations error:', error);
    sendError(res, 500, 'Failed to fetch procurement recommendations');
  }
};

// Get production metrics
export const handleGetProductionMetrics = async (req, res) => {
  try {
    // Get production plan statistics
    const [planStats] = await query(`
      SELECT 
        COUNT(*) as total_plans,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count,
        AVG(CASE WHEN status = 'completed' THEN 
          (actual_quantity / target_quantity) * 100 
        ELSE NULL END) as avg_efficiency
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `).catch(() => [{ total_plans: 0, completed: 0, in_progress: 0, delayed_count: 0, avg_efficiency: 0 }]);

    // Get active orders
    const [activeOrders] = await query(`
      SELECT COUNT(*) as count
      FROM production_plans
      WHERE status IN ('in_progress', 'scheduled')
    `).catch(() => [{ count: 0 }]);

    // Calculate capacity utilization
    const [capacityData] = await query(`
      SELECT 
        AVG(CASE WHEN status = 'in_progress' THEN 
          (actual_quantity / target_quantity) * 100 
        ELSE 0 END) as utilization
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `).catch(() => [{ utilization: 0 }]);

    // Calculate on-time delivery
    const [deliveryStats] = await query(`
      SELECT 
        COUNT(*) as total_completed,
        SUM(CASE WHEN completion_date <= end_date THEN 1 ELSE 0 END) as on_time
      FROM production_plans
      WHERE status = 'completed'
        AND completion_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `).catch(() => [{ total_completed: 0, on_time: 0 }]);
    const onTimeRate = deliveryStats?.total_completed > 0
      ? (deliveryStats.on_time / deliveryStats.total_completed) * 100
      : 0;

    sendJSON(res, 200, {
      totalPlans: planStats?.total_plans || 0,
      completed: planStats?.completed || 0,
      inProgress: planStats?.in_progress || 0,
      delayed: planStats?.delayed || 0,
      overallEfficiency: Math.round((planStats?.avg_efficiency || 0) * 10) / 10,
      activeOrders: activeOrders?.count || 0,
      capacityUtilization: Math.round((capacityData?.utilization || 0) * 10) / 10,
      onTimeDelivery: Math.round(onTimeRate * 10) / 10
    });
  } catch (error) {
    console.error('Get production metrics error:', error);
    sendError(res, 500, 'Failed to fetch production metrics');
  }
};

// Get production plans based on forecasts
export const handleGetProductionPlans = async (req, res) => {
  try {
    const plans = await query(`
      SELECT 
        pp.*,
        p.name as product,
        f.forecasted_demand,
        i.current_stock as current_inventory,
        CASE 
          WHEN pp.actual_quantity >= pp.target_quantity * 0.95 THEN 'on-track'
          WHEN pp.actual_quantity >= pp.target_quantity * 0.8 THEN 'behind'
          WHEN pp.actual_quantity >= pp.target_quantity * 1.05 THEN 'ahead'
          ELSE 'planned'
        END as status,
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 'high'
          WHEN i.available_stock <= p.reorder_point THEN 'medium'
          ELSE 'low'
        END as priority,
        ROUND((pp.actual_quantity / pp.target_quantity) * 100, 0) as completion_rate
      FROM production_plans pp
      JOIN products p ON pp.product_id = p.id
      JOIN inventory i ON pp.product_id = i.product_id
      LEFT JOIN (
        SELECT product_id, SUM(forecasted_demand) as forecasted_demand
        FROM forecast_results
        WHERE forecast_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        GROUP BY product_id
      ) f ON pp.product_id = f.product_id
      WHERE pp.start_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ORDER BY pp.start_date DESC
      LIMIT 20
    `).catch(() => []);

    sendJSON(res, 200, { plans: plans || [] });
  } catch (error) {
    console.error('Get production plans error:', error);
    sendError(res, 500, 'Failed to fetch production plans');
  }
};
