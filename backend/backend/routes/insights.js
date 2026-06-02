import { query } from '../config/database.js';
import { sendSuccess, sendError, parseBody } from '../utils/helpers.js';

export const handleGetInsights = async (req, res) => {
  try {
    const { type, dismissed } = req.query;
    
    let sql = 'SELECT * FROM ai_insights WHERE 1=1';
    const params = [];
    
    if (type && type !== 'all') {
      sql += ' AND insight_type = ?';
      params.push(type);
    }
    
    if (dismissed === 'false') {
      sql += ' AND is_dismissed = FALSE';
    }
    
    sql += ' ORDER BY priority DESC, created_at DESC';
    
    const insights = await query(sql, params);
    sendSuccess(res, insights);
  } catch (error) {
    console.error('Get insights error:', error);
    sendError(res, 500, 'Failed to fetch insights');
  }
};

export const handleGetInsight = async (req, res) => {
  try {
    const { id } = req.params;
    const insights = await query('SELECT * FROM ai_insights WHERE id = ?', [id]);
    
    if (insights.length === 0) {
      return sendError(res, 404, 'Insight not found');
    }
    sendSuccess(res, insights[0]);
  } catch (error) {
    console.error('Get insight error:', error);
    sendError(res, 500, 'Failed to fetch insight');
  }
};

export const handleDismissInsight = async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(`
      UPDATE ai_insights 
      SET is_dismissed = TRUE, dismissed_by = ?
      WHERE id = ?
    `, [req.user?.id, id]);
    
    sendSuccess(res, { message: 'Insight dismissed' });
  } catch (error) {
    console.error('Dismiss insight error:', error);
    sendError(res, 500, 'Failed to dismiss insight');
  }
};

export const handleCreateInsight = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { insight_type, priority, title, description, impact, recommended_action } = body;
    
    const result = await query(`
      INSERT INTO ai_insights (insight_type, priority, title, description, impact, recommended_action)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [insight_type, priority || 'medium', title, description, impact, recommended_action]);
    
    sendSuccess(res, { id: result.insertId, message: 'Insight created' }, 201);
  } catch (error) {
    console.error('Create insight error:', error);
    sendError(res, 500, 'Failed to create insight');
  }
};

export const handleGetInsightStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN insight_type = 'opportunity' AND is_dismissed = FALSE THEN 1 ELSE 0 END) as opportunities,
        SUM(CASE WHEN insight_type = 'warning' AND is_dismissed = FALSE THEN 1 ELSE 0 END) as warnings,
        SUM(CASE WHEN insight_type = 'success' AND is_dismissed = FALSE THEN 1 ELSE 0 END) as successes
      FROM ai_insights
    `);
    sendSuccess(res, stats[0]);
  } catch (error) {
    console.error('Get insight stats error:', error);
    sendError(res, 500, 'Failed to fetch insight stats');
  }
};

// Generate new insights based primarily on forecast + KPI data
export const handleGenerateInsights = async (req, res) => {
  try {
    // Use KPI snapshot + forecast results instead of raw sales rows
    const [kpiRows, forecastAgg, lowStockInventory] = await Promise.all([
      query('SELECT * FROM kpis'),
      query(`
        SELECT 
          COALESCE(SUM(f.forecasted_demand * p.unit_price), 0) as forecast_revenue,
          COALESCE(SUM(f.forecasted_demand), 0) as forecast_units,
          MIN(f.forecast_date) as start_date,
          MAX(f.forecast_date) as end_date
        FROM forecast_results f
        JOIN products p ON f.product_id = p.id
        WHERE f.forecast_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
      `),
      // Still allow inventory-driven shortage warnings, but no direct sales usage
      query(`
        SELECT i.*, p.name, p.reorder_point, p.safety_stock
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        WHERE i.available_stock <= p.safety_stock
      `)
    ]);

    const kpis = kpiRows || [];
    const [forecastSummary] = forecastAgg || [];

    const kpiByName = (name) =>
      kpis.find((k) => (k.name || '').toLowerCase() === name.toLowerCase());

    const revenueKpi = kpiByName('Revenue');
    const marginKpi = kpiByName('Gross Margin');
    const inventoryTurnoverKpi = kpiByName('Inventory Turnover');
    const orderFulfillmentKpi = kpiByName('Order Fulfillment');
    const productionEfficiencyKpi = kpiByName('Production Efficiency');
    const customerSatisfactionKpi = kpiByName('Customer Satisfaction');

    const newInsights = [];

    // 1) Growth opportunity based on forecast vs current revenue
    if (revenueKpi && forecastSummary) {
      const currentRevenue = Number(revenueKpi.current_value) || 0;
      const forecastRevenue = Number(forecastSummary.forecast_revenue) || 0;

      if (forecastRevenue > currentRevenue * 1.05 && forecastRevenue > 0 && currentRevenue > 0) {
        const upliftPct = ((forecastRevenue - currentRevenue) / currentRevenue) * 100;
        newInsights.push({
          type: 'opportunity',
          priority: 'high',
          title: 'Forecasted Revenue Uplift',
          description: `Forecasts indicate approximately ${upliftPct.toFixed(
            1
          )}% higher revenue over the next 2 months compared to the recent period.`,
          impact: 'Revenue growth opportunity',
          action: 'Increase stock and marketing for high‑demand products'
        });
      }
    }

    // 2) Margin pressure warning from Gross Margin KPI
    if (marginKpi) {
      const margin = Number(marginKpi.current_value) || 0;
      const target = Number(marginKpi.target_value) || 0;
      if (target > 0 && margin < target * 0.9) {
        newInsights.push({
          type: 'warning',
          priority: 'medium',
          title: 'Gross Margin Below Target',
          description: `Current gross margin (${margin.toFixed(
            2
          )}%) is significantly below the target (${target.toFixed(2)}%).`,
          impact: 'Profitability risk',
          action: 'Review pricing, discounts, and supplier costs'
        });
      }
    }

    // 3) Inventory risk from Inventory Turnover + low stock + forecasts
    if (inventoryTurnoverKpi && lowStockInventory.length > 0) {
      const turnover = Number(inventoryTurnoverKpi.current_value) || 0;
      const targetTurnover = Number(inventoryTurnoverKpi.target_value) || 0;

      lowStockInventory.forEach((item) => {
        newInsights.push({
          type: 'warning',
          priority: 'high',
          title: `Low Stock at Forecasted Demand: ${item.name}`,
          description: `Available stock (${item.available_stock}) is at/below safety stock (${item.safety_stock}) while inventory turnover is ${turnover.toFixed(
            2
          )}x versus target ${targetTurnover.toFixed(2)}x.`,
          impact: 'Potential stockout on high‑risk SKUs',
          action: 'Increase purchase orders and review safety stock levels'
        });
      });
    }

    // 4) Operational efficiency opportunity from Order Fulfillment + Production Efficiency
    if (orderFulfillmentKpi && productionEfficiencyKpi) {
      const fulfil = Number(orderFulfillmentKpi.current_value) || 0;
      const prodEff = Number(productionEfficiencyKpi.current_value) || 0;

      if (fulfil < 97 || prodEff < 90) {
        newInsights.push({
          type: 'efficiency',
          priority: 'medium',
          title: 'Operational Efficiency Improvement',
          description: `Order fulfillment (${fulfil.toFixed(
            2
          )}%) or production efficiency (${prodEff.toFixed(
            2
          )}%) are below ideal thresholds.`,
          impact: 'Opportunity to reduce delays and costs',
          action: 'Review bottlenecks in production and order processing'
        });
      }
    }

    // 5) Customer satisfaction opportunity
    if (customerSatisfactionKpi) {
      const csat = Number(customerSatisfactionKpi.current_value) || 0;
      const csatTarget = Number(customerSatisfactionKpi.target_value) || 0;
      if (csatTarget > 0 && csat < csatTarget) {
        newInsights.push({
          type: 'opportunity',
          priority: 'medium',
          title: 'Customer Satisfaction Improvement',
          description: `Customer satisfaction is ${csat.toFixed(
            2
          )}/${customerSatisfactionKpi.unit?.includes('/5') ? '5' : ''}, slightly below target ${
            csatTarget
          }.`,
          impact: 'Retention and repeat‑purchase potential',
          action: 'Improve service levels for delayed orders and stockouts'
        });
      }
    }
    
    // Insert new insights
    for (const insight of newInsights) {
      await query(`
        INSERT INTO ai_insights (insight_type, priority, title, description, impact, recommended_action)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [insight.type, insight.priority, insight.title, insight.description, insight.impact, insight.action]);
    }
    
    sendSuccess(res, { generated: newInsights.length, insights: newInsights });
  } catch (error) {
    console.error('Generate insights error:', error);
    sendError(res, 500, 'Failed to generate insights');
  }
};
