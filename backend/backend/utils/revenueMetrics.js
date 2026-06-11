import { query } from '../config/database.js';

const parseDetails = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const txnAmount = (details) => {
  const d = parseDetails(details);
  const qty = Number(d.quantity || 0);
  const unit = d.unit_price != null ? Number(d.unit_price) : null;
  if (d.total_amount != null && Number.isFinite(Number(d.total_amount))) {
    return Number(d.total_amount);
  }
  if (unit != null && qty > 0) return unit * qty;
  return 0;
};

/** Revenue from inventory sold / stock-out transactions (audit trail). */
export const calculateTransactionRevenue = async (days = 30) => {
  try {
    const rows = await query(
      `
        SELECT a.details, a.action
        FROM audit_logs a
        WHERE a.entity_type = 'inventory'
          AND a.action IN ('INVENTORY_TXN_SOLD', 'INVENTORY_TXN_STOCK_OUT')
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `,
      [days]
    );
    let total = 0;
    let units = 0;
    let count = 0;
    for (const row of rows || []) {
      const d = parseDetails(row.details);
      const amount = txnAmount(row.details);
      if (amount > 0) {
        total += amount;
        count += 1;
      }
      units += Number(d.quantity || 0);
    }

    const [salesRow] = await query(
      `
        SELECT COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(quantity), 0) as units, COUNT(*) as cnt
        FROM sales
        WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      `,
      [days]
    );

    const salesRevenue = Number(salesRow?.revenue || 0);
    const txnRevenue = Math.round(total * 100) / 100;
    const combined = Math.max(txnRevenue, salesRevenue);

    return {
      transaction_revenue: txnRevenue,
      sales_revenue: salesRevenue,
      actual_revenue: Math.round(combined * 100) / 100,
      sold_units: Math.max(units, Number(salesRow?.units || 0)),
      transaction_count: count + Number(salesRow?.cnt || 0),
    };
  } catch (error) {
    console.error('calculateTransactionRevenue error:', error);
    return { transaction_revenue: 0, sales_revenue: 0, actual_revenue: 0, sold_units: 0, transaction_count: 0 };
  }
};

/** Procurement spend to deduct from net revenue (approved through delivered). */
export const calculateProcurementDeductions = async (days = 30) => {
  try {
    const [row] = await query(
      `
        SELECT
          COALESCE(SUM(total_cost), 0) as total_deduct,
          COUNT(*) as order_count
        FROM procurement_orders
        WHERE status IN ('approved', 'in_transit', 'delivered')
          AND order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      `,
      [days]
    );
    return {
      procurement_deductions: Math.round(Number(row?.total_deduct || 0) * 100) / 100,
      procurement_order_count: Number(row?.order_count || 0),
    };
  } catch (error) {
    console.error('calculateProcurementDeductions error:', error);
    return { procurement_deductions: 0, procurement_order_count: 0 };
  }
};

/** Forecast-based revenue (prediction only — not actual sales). */
export const calculatePredictionRevenue = async (days = 30) => {
  try {
    const [row] = await query(
      `
        SELECT COALESCE(SUM(f.forecasted_demand * p.unit_price), 0) as prediction_revenue,
               COALESCE(SUM(f.forecasted_demand), 0) as forecast_units
        FROM forecast_results f
        JOIN products p ON f.product_id = p.id
        WHERE f.forecast_date >= CURDATE()
          AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      `,
      [days]
    );
    return {
      prediction_revenue: Math.round(Number(row?.prediction_revenue || 0) * 100) / 100,
      forecast_units: Number(row?.forecast_units || 0),
    };
  } catch (error) {
    console.error('calculatePredictionRevenue error:', error);
    return { prediction_revenue: 0, forecast_units: 0 };
  }
};

export const calculateNetRevenueMetrics = async (days = 30) => {
  const [actual, deductions, prediction] = await Promise.all([
    calculateTransactionRevenue(days),
    calculateProcurementDeductions(days),
    calculatePredictionRevenue(days),
  ]);

  const netRevenue = Math.round((actual.actual_revenue - deductions.procurement_deductions) * 100) / 100;

  return {
    ...actual,
    ...deductions,
    ...prediction,
    net_revenue: netRevenue,
    total_revenue_forecast: prediction.prediction_revenue,
  };
};

/** Stock flow summary from inventory transaction audit logs. */
export const calculateStockFlow = async (days = 30) => {
  try {
    const rows = await query(
      `
        SELECT a.action, a.details
        FROM audit_logs a
        WHERE a.entity_type = 'inventory'
          AND a.action LIKE 'INVENTORY_TXN_%'
          AND a.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `,
      [days]
    );

    let stockIn = 0;
    let stockOut = 0;
    let sold = 0;
    let ordered = 0;

    for (const row of rows || []) {
      const d = parseDetails(row.details);
      const qty = Number(d.quantity || 0);
      const type = String(d.transaction_type || row.action.replace('INVENTORY_TXN_', '').toLowerCase());
      if (type === 'stock_in') stockIn += qty;
      else if (type === 'stock_out') stockOut += qty;
      else if (type === 'sold') sold += qty;
      else if (type === 'ordered') ordered += qty;
    }

    return { stock_in: stockIn, stock_out: stockOut, sold, ordered };
  } catch (error) {
    console.error('calculateStockFlow error:', error);
    return { stock_in: 0, stock_out: 0, sold: 0, ordered: 0 };
  }
};
