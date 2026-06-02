import { query } from '../config/database.js';
import { sendSuccess, sendError, parseBody } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';

export const handleGetProductionPlans = async (req, res) => {
  try {
    const plans = await query(`
      SELECT 
        pp.*,
        p.name as product_name,
        p.sku,
        p.reorder_point,
        p.safety_stock,
        i.current_stock,
        i.available_stock,
        po_latest.id as procurement_order_id,
        po_latest.status as procurement_status,
        po_latest.order_date as procurement_order_date
      FROM production_plans pp
      JOIN products p ON pp.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN (
        SELECT po1.id, po1.product_id, po1.status, po1.order_date
        FROM procurement_orders po1
        JOIN (
          SELECT product_id, MAX(id) as max_id
          FROM procurement_orders
          GROUP BY product_id
        ) latest ON latest.max_id = po1.id
      ) po_latest ON po_latest.product_id = p.id
      ORDER BY pp.start_date DESC
    `);
    sendSuccess(res, plans);
  } catch (error) {
    console.error('Get production plans error:', error);
    sendError(res, 500, 'Failed to fetch production plans');
  }
};

export const handleGetProductionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plans = await query(`
      SELECT 
        pp.*,
        p.name as product_name,
        p.sku,
        p.reorder_point,
        p.safety_stock,
        i.current_stock,
        i.available_stock,
        po_latest.id as procurement_order_id,
        po_latest.status as procurement_status,
        po_latest.order_date as procurement_order_date
      FROM production_plans pp
      JOIN products p ON pp.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN (
        SELECT po1.id, po1.product_id, po1.status, po1.order_date
        FROM procurement_orders po1
        JOIN (
          SELECT product_id, MAX(id) as max_id
          FROM procurement_orders
          GROUP BY product_id
        ) latest ON latest.max_id = po1.id
      ) po_latest ON po_latest.product_id = p.id
      WHERE pp.id = ?
    `, [id]);
    
    if (plans.length === 0) {
      return sendError(res, 404, 'Production plan not found');
    }
    sendSuccess(res, plans[0]);
  } catch (error) {
    console.error('Get production plan error:', error);
    sendError(res, 500, 'Failed to fetch production plan');
  }
};

export const handleCreateProductionPlan = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { product_id, target_quantity, start_date, end_date, priority, notes } = body;
    
    const result = await query(`
      INSERT INTO production_plans (product_id, target_quantity, start_date, end_date, priority, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [product_id, target_quantity, start_date, end_date, priority || 'medium', notes, req.user?.id]);
    
    sendSuccess(res, { id: result.insertId, message: 'Production plan created' }, 201);
  } catch (error) {
    console.error('Create production plan error:', error);
    sendError(res, 500, 'Failed to create production plan');
  }
};

export const handleUpdateProductionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const body = await parseBody(req);
    const { target_quantity, completed_quantity, start_date, end_date, status, priority, notes } = body;

    const toSqlValue = (value) => (value === undefined ? null : value);

    const existingRows = await query(
      'SELECT id, product_id, status FROM production_plans WHERE id = ? LIMIT 1',
      [id]
    ).catch(() => []);
    if (!existingRows.length) return sendError(res, 404, 'Production plan not found');
    const existing = existingRows[0];

    await query(`
      UPDATE production_plans 
      SET target_quantity = COALESCE(?, target_quantity),
          completed_quantity = COALESCE(?, completed_quantity),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `, [
      toSqlValue(target_quantity),
      toSqlValue(completed_quantity),
      toSqlValue(start_date),
      toSqlValue(end_date),
      toSqlValue(status),
      toSqlValue(priority),
      toSqlValue(notes),
      id
    ]);

    // Sync production status -> procurement status (workflow mapping)
    // in_progress -> in_transit, completed -> delivered, cancelled -> cancelled, delayed -> delayed, scheduled -> approved
    if (status && status !== existing.status) {
      const mapToProcurement = (s) => {
        const st = String(s || '').toLowerCase();
        if (st === 'in_progress') return 'in_transit';
        if (st === 'completed') return 'delivered';
        if (st === 'cancelled') return 'cancelled';
        if (st === 'delayed') return 'delayed';
        return 'approved';
      };
      const nextProcurementStatus = mapToProcurement(status);

      const poRows = await query(
        `
          SELECT id, quantity, status
          FROM procurement_orders
          WHERE product_id = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        [existing.product_id]
      ).catch(() => []);

      if (poRows.length) {
        const po = poRows[0];
        if (po.status !== nextProcurementStatus) {
          await query('UPDATE procurement_orders SET status = ? WHERE id = ?', [nextProcurementStatus, po.id]).catch(() => {});

          // If procurement transitions to delivered, also update inventory stock (same rule as procurement handler)
          const transitionedToDelivered = po.status !== 'delivered' && nextProcurementStatus === 'delivered';
          if (transitionedToDelivered) {
            const qty = Number(po.quantity || 0);
            if (qty > 0) {
              const productRows = await query(
                'SELECT sku, name FROM products WHERE id = ? LIMIT 1',
                [existing.product_id]
              ).catch(() => []);
              const product = productRows?.[0] || {};

              const supplierRows = await query(
                'SELECT supplier_name, notes FROM procurement_orders WHERE id = ? LIMIT 1',
                [po.id]
              ).catch(() => []);
              const supplierName = supplierRows?.[0]?.supplier_name || 'Procurement';
              const procurementNotes = String(supplierRows?.[0]?.notes || '');
              const regionMatch = procurementNotes.match(/\[source_region:([^\]]+)\]/i);
              const sourceRegion = regionMatch?.[1]?.trim() || 'Inbound';

              const invRows = await query(
                'SELECT current_stock FROM inventory WHERE product_id = ? LIMIT 1',
                [existing.product_id]
              ).catch(() => []);
              const previousStock = Number(invRows?.[0]?.current_stock || 0);
              const newStock = previousStock + qty;

              await query(
                'UPDATE inventory SET current_stock = ? WHERE product_id = ?',
                [newStock, existing.product_id]
              ).catch(() => {});

              await query(
                `
                  UPDATE alerts
                  SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
                  WHERE product_id = ?
                    AND is_resolved = FALSE
                    AND alert_type IN ('shortage', 'reorder', 'forecast_anomaly')
                `,
                [req.user?.id || null, existing.product_id]
              ).catch(() => {});

              // Write a transaction-like audit row so Inventory → Transactions shows the stock change.
              await logAudit(
                req.user?.id || null,
                'INVENTORY_TXN_ORDERED',
                'inventory',
                existing.product_id,
                {
                  transaction_type: 'ordered',
                  product_id: existing.product_id,
                  product_name: product?.name || null,
                  sku: product?.sku || null,
                  quantity: qty,
                  delta: qty,
                  previous_stock: previousStock,
                  new_stock: newStock,
                  // Displayed in Inventory → Transactions table columns
                  customer_name: supplierName,
                  region: sourceRegion,
                  notes: `Stock received from production completion (linked to procurement order #${po.id})`
                },
                req
              );

              // Also log terminal procurement status change for inventory history.
              await logAudit(
                req.user?.id || null,
                'PROCUREMENT_STATUS_UPDATE',
                'inventory',
                existing.product_id,
                {
                  order_id: po.id,
                  product_id: existing.product_id,
                  previous_status: po.status,
                  new_status: 'delivered',
                  quantity: qty
                },
                req
              );
            }
          }
        }
      }
    }
    
    sendSuccess(res, { message: 'Production plan updated' });
  } catch (error) {
    console.error('Update production plan error:', error);
    sendError(res, 500, 'Failed to update production plan');
  }
};

export const handleDeleteProductionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM production_plans WHERE id = ?', [id]);
    sendSuccess(res, { message: 'Production plan deleted' });
  } catch (error) {
    console.error('Delete production plan error:', error);
    sendError(res, 500, 'Failed to delete production plan');
  }
};

export const handleGetProductionStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as \`delayed\`,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
      FROM production_plans
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);
    sendSuccess(res, stats[0]);
  } catch (error) {
    console.error('Get production stats error:', error);
    sendError(res, 500, 'Failed to fetch production stats');
  }
};

export const handleGenerateProductionFromForecasts = async (req, res) => {
  try {
    const days = 30;
    const rows = await query(
      `
      SELECT 
        f.product_id,
        SUM(f.forecasted_demand) as forecast_qty,
        MAX(f.forecast_date) as max_date,
        p.name as product_name,
        COALESCE(i.available_stock, i.current_stock, 0) as available_stock,
        p.reorder_point,
        p.safety_stock
      FROM forecast_results f
      JOIN products p ON f.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE f.forecast_date >= CURDATE()
        AND f.forecast_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      GROUP BY f.product_id, p.name, available_stock, p.reorder_point, p.safety_stock
    `,
      [days]
    );

    let created = 0;

    for (const row of rows) {
      const forecastQty = Number(row.forecast_qty) || 0;
      const available = Number(row.available_stock) || 0;
      const safety = Number(row.safety_stock) || 0;
      const required = Math.max(0, Math.round(forecastQty + safety - available));
      if (!required) continue;

      const priority =
        required > (Number(row.reorder_point) || 0) ? 'high' : 'medium';
      const endDate = row.max_date || new Date();

      await query(
        `
        INSERT INTO production_plans 
          (product_id, target_quantity, completed_quantity, start_date, end_date, status, priority, notes, created_by)
        VALUES 
          (?, ?, 0, CURDATE(), ?, 'scheduled', ?, 'Auto-generated from demand forecasts', ?)
      `,
        [row.product_id, required, endDate, priority, req.user?.id || null]
      );

      created += 1;
    }

    sendSuccess(res, { created });
  } catch (error) {
    console.error('Generate production from forecasts error:', error);
    sendError(res, 500, 'Failed to generate production plans from forecasts');
  }
};
