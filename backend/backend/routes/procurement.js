import { query } from '../config/database.js';
import { sendSuccess, sendError, parseBody } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { clearInventoryRecommendationForProduct } from '../utils/procurementHelpers.js';

const getProcurementColumnInfo = async () => {
  let cols = [];
  try {
    cols = await query('SHOW COLUMNS FROM procurement_orders');
  } catch {
    cols = [];
  }
  const hasCol = (name) =>
    (cols || []).some((c) => String(c.Field || '').toLowerCase() === String(name).toLowerCase());
  return {
    hasCreatedBy: hasCol('created_by'),
    hasStatus: hasCol('status'),
    expectedCol: hasCol('expected_delivery')
      ? 'expected_delivery'
      : hasCol('expected_delivery_date')
        ? 'expected_delivery_date'
        : null,
    actualCol: hasCol('actual_delivery')
      ? 'actual_delivery'
      : hasCol('delivery_date')
        ? 'delivery_date'
        : hasCol('actual_delivery_date')
          ? 'actual_delivery_date'
          : null,
  };
};

const toSqlValue = (value) => (value === undefined ? null : value);

const getProductInventoryContext = async (productId) => {
  const rows = await query(
    `
      SELECT p.id, p.sku, p.name as product_name, i.current_stock
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.id = ?
    `,
    [productId]
  );
  return rows[0] || null;
};

const statusToTransactionType = (status) => {
  const st = String(status || '').toLowerCase();
  if (st === 'approved') return 'order_approved';
  if (st === 'in_transit') return 'in_transit';
  if (st === 'delivered') return 'stock_in';
  if (st === 'cancelled') return 'order_cancelled';
  if (st === 'delayed') return 'order_delayed';
  return 'procurement_status';
};

const logInventoryProcurementEvent = async (
  req,
  {
    productId,
    productName,
    sku,
    transactionType,
    quantity,
    unitCost,
    delta,
    previousStock,
    newStock,
    notes,
    procurementOrderId,
    previousStatus,
    newStatus,
  }
) => {
  const actionKey = String(transactionType).toUpperCase().replace(/-/g, '_');
  const unitPrice = Number(unitCost || 0);
  const qty = Number(quantity || 0);
  await logAudit(
    req.user?.id || null,
    `INVENTORY_TXN_${actionKey}`,
    'inventory',
    productId,
    {
      product_id: productId,
      product_name: productName,
      sku,
      transaction_type: transactionType,
      quantity: qty,
      unit_price: unitPrice > 0 ? unitPrice : null,
      total_amount: unitPrice > 0 && qty > 0 ? unitPrice * qty : null,
      delta: Number(delta || 0),
      previous_stock: previousStock ?? null,
      new_stock: newStock ?? null,
      procurement_order_id: procurementOrderId,
      previous_status: previousStatus || null,
      new_status: newStatus || null,
      notes,
    },
    req
  );
};

export const handleGetProcurementOrders = async (req, res) => {
  try {
    const orders = await query(`
      SELECT 
        po.*,
        p.name as product_name,
        p.sku,
        i.current_stock,
        i.available_stock,
        p.reorder_point,
        p.safety_stock,
        pp_linked.status as production_status
      FROM procurement_orders po
      LEFT JOIN products p ON po.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id
      LEFT JOIN production_plans pp_linked
        ON pp_linked.id = (
          SELECT pp2.id
          FROM production_plans pp2
          WHERE pp2.product_id = po.product_id
            AND pp2.notes LIKE CONCAT('%procurement order #', po.id, '%')
          ORDER BY pp2.id DESC
          LIMIT 1
        )
      ORDER BY po.order_date DESC
    `);
    sendSuccess(res, Array.isArray(orders) ? orders : []);
  } catch (error) {
    console.error('Get procurement orders error:', error);
    sendSuccess(res, []);
  }
};

export const handleGetProcurementOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await query(`
      SELECT po.*, p.name as product_name, p.sku
      FROM procurement_orders po
      JOIN products p ON po.product_id = p.id
      WHERE po.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return sendError(res, 404, 'Procurement order not found');
    }
    sendSuccess(res, orders[0]);
  } catch (error) {
    console.error('Get procurement order error:', error);
    sendError(res, 500, 'Failed to fetch procurement order');
  }
};

export const handleCreateProcurementOrder = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { product_id, supplier_name, quantity, unit_cost, expected_delivery, notes } = body;
    const total_cost = quantity * unit_cost;

    const productCtx = await getProductInventoryContext(product_id);
    if (!productCtx) {
      return sendError(res, 404, 'Product not found');
    }

    const { hasCreatedBy, hasStatus, expectedCol } = await getProcurementColumnInfo();
    const fields = [
      'product_id',
      'supplier_name',
      'quantity',
      'unit_cost',
      'total_cost',
      'order_date',
      ...(expectedCol ? [expectedCol] : []),
      'notes',
      ...(hasCreatedBy ? ['created_by'] : []),
      ...(hasStatus ? ['status'] : []),
    ];
    const values = [
      product_id,
      supplier_name,
      quantity,
      unit_cost,
      total_cost,
      new Date().toISOString().slice(0, 10),
      ...(expectedCol ? [expected_delivery || null] : []),
      notes,
      ...(hasCreatedBy ? [req.user?.id || null] : []),
      ...(hasStatus ? ['pending'] : []),
    ];
    const placeholders = fields.map(() => '?').join(', ');
    const result = await query(
      `INSERT INTO procurement_orders (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const orderId = result.insertId;
    const previousStock = Number(productCtx.current_stock || 0);
    await logInventoryProcurementEvent(req, {
      productId: product_id,
      productName: productCtx.product_name,
      sku: productCtx.sku,
      transactionType: 'ordered',
      quantity,
      unitCost: unit_cost,
      delta: 0,
      previousStock,
      newStock: previousStock,
      procurementOrderId: orderId,
      previousStatus: null,
      newStatus: 'pending',
      notes: notes || `Procurement order #${orderId} created — awaiting Operations approval`,
    });

    sendSuccess(res, { id: orderId, message: 'Procurement order created and sent for approval' }, 201);
  } catch (error) {
    console.error('Create procurement order error:', error);
    sendError(res, 500, 'Failed to create procurement order');
  }
};

export const handleUpdateProcurementOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const body = await parseBody(req);
    const { supplier_name, quantity, unit_cost, expected_delivery, actual_delivery, status, notes } = body;

    const existingRows = await query(
      `SELECT po.id, po.product_id, po.quantity, po.unit_cost, po.supplier_name, po.status,
              p.sku, p.name as product_name, i.current_stock
       FROM procurement_orders po
       JOIN products p ON p.id = po.product_id
       LEFT JOIN inventory i ON i.product_id = po.product_id
       WHERE po.id = ? LIMIT 1`,
      [id]
    );
    if (!existingRows.length) {
      return sendError(res, 404, 'Procurement order not found');
    }
    const existing = existingRows[0];
    
    let total_cost = null;
    if (quantity && unit_cost) {
      total_cost = quantity * unit_cost;
    }
    
    const { expectedCol, actualCol } = await getProcurementColumnInfo();
    const setParts = [
      'supplier_name = COALESCE(?, supplier_name)',
      'quantity = COALESCE(?, quantity)',
      'unit_cost = COALESCE(?, unit_cost)',
      'total_cost = COALESCE(?, total_cost)',
      ...(expectedCol ? [`${expectedCol} = COALESCE(?, ${expectedCol})`] : []),
      ...(actualCol ? [`${actualCol} = COALESCE(?, ${actualCol})`] : []),
      'status = COALESCE(?, status)',
      'notes = COALESCE(?, notes)',
    ];
    const updateValues = [
      toSqlValue(supplier_name),
      toSqlValue(quantity),
      toSqlValue(unit_cost),
      toSqlValue(total_cost),
      ...(expectedCol ? [toSqlValue(expected_delivery)] : []),
      ...(actualCol ? [toSqlValue(actual_delivery)] : []),
      toSqlValue(status),
      toSqlValue(notes),
      id,
    ];
    await query(
      `UPDATE procurement_orders SET ${setParts.join(', ')} WHERE id = ?`,
      updateValues
    );

    const nextStatus = status || existing.status;
    const statusChanged = nextStatus !== existing.status;
    const prevStatus = String(existing.status || '').toLowerCase();
    const nextStatusLower = String(nextStatus || '').toLowerCase();
    const transitionedToDelivered = prevStatus !== 'delivered' && nextStatusLower === 'delivered';
    const orderQty = Number(quantity ?? existing.quantity ?? 0);
    const unitCost = Number(unit_cost ?? existing.unit_cost ?? 0);
    const previousStock = Number(existing.current_stock || 0);
    let newStock = previousStock;

    if (transitionedToDelivered && orderQty > 0) {
      newStock = previousStock + orderQty;
      await query(
        'UPDATE inventory SET current_stock = ? WHERE product_id = ?',
        [newStock, existing.product_id]
      );

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

      await clearInventoryRecommendationForProduct(existing.product_id);
    }

    if (statusChanged) {
      // --- Sync procurement status -> production plan status ---
      // Rule: Procurement is the upstream workflow; production reflects it.
      // Mapping:
      // pending/approved/in_transit -> scheduled
      // delivered -> in_progress (materials arrived, production can start)
      // delayed -> delayed
      // cancelled -> cancelled
      const mapToProductionStatus = (s) => {
        const st = String(s || '').toLowerCase();
        if (st === 'delayed') return 'delayed';
        if (st === 'cancelled') return 'cancelled';
        if (st === 'delivered') return 'in_progress';
        return 'scheduled';
      };

      const productionStatus = mapToProductionStatus(nextStatus);
      const qty = Number(quantity ?? existing.quantity ?? 0);

      // Find most recent production plan for this product (if exists), else create one.
      const planRows = await query(
        `
          SELECT id, status
          FROM production_plans
          WHERE product_id = ?
          ORDER BY start_date DESC, id DESC
          LIMIT 1
        `,
        [existing.product_id]
      ).catch(() => []);

      if (planRows.length) {
        const planId = planRows[0].id;
        await query(
          `
            UPDATE production_plans
            SET status = ?,
                notes = CONCAT(COALESCE(notes,''), CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE '\n' END,
                  'Linked procurement order #', ?, ': ', ?, ' -> ', ?)
            WHERE id = ?
          `,
          [productionStatus, existing.id, existing.status, nextStatus, planId]
        ).catch(() => {});
      } else {
        // Create a production plan placeholder from procurement.
        // Target quantity defaults to procurement quantity.
        // End date defaults to +7 days; this can be edited later.
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await query(
          `
            INSERT INTO production_plans
              (product_id, target_quantity, completed_quantity, start_date, end_date, status, priority, notes, created_by)
            VALUES
              (?, ?, 0, CURDATE(), ?, ?, 'medium', ?, ?)
          `,
          [
            existing.product_id,
            qty > 0 ? qty : 0,
            endDate,
            productionStatus,
            `Created from procurement order #${existing.id}. Status: ${existing.status} -> ${nextStatus}`,
            req.user?.id || null,
          ]
        ).catch(() => {});
      }

      const txnType = statusToTransactionType(nextStatus);
      const statusNotes = {
        approved: `Procurement order #${existing.id} approved — ${orderQty} units confirmed for delivery and production planning`,
        in_transit: `Procurement order #${existing.id} in transit — delivery pending`,
        delivered: `Procurement order #${existing.id} delivered — stock received`,
        cancelled: `Procurement order #${existing.id} declined/cancelled`,
        delayed: `Procurement order #${existing.id} marked delayed`,
      };
      const st = String(nextStatus || '').toLowerCase();
      await logInventoryProcurementEvent(req, {
        productId: existing.product_id,
        productName: existing.product_name,
        sku: existing.sku,
        transactionType: txnType,
        quantity: orderQty,
        unitCost,
        delta: transitionedToDelivered ? orderQty : 0,
        previousStock,
        newStock: transitionedToDelivered ? newStock : previousStock,
        procurementOrderId: existing.id,
        previousStatus: existing.status,
        newStatus: nextStatus,
        notes: statusNotes[st] || `Procurement order #${existing.id}: ${existing.status} → ${nextStatus}`,
      });
    }
    
    sendSuccess(res, { message: 'Procurement order updated' });
  } catch (error) {
    console.error('Update procurement order error:', error);
    sendError(res, 500, 'Failed to update procurement order');
  }
};

export const handleDeleteProcurementOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM procurement_orders WHERE id = ?', [id]);
    sendSuccess(res, { message: 'Procurement order deleted' });
  } catch (error) {
    console.error('Delete procurement order error:', error);
    sendError(res, 500, 'Failed to delete procurement order');
  }
};

export const handleGetProcurementStats = async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_cost), 0) as total_value,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status IN ('pending', 'approved', 'in_transit') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as \`delayed\`
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);
    sendSuccess(res, stats && stats[0] ? stats[0] : { total_orders: 0, total_value: 0, delivered: 0, pending: 0, delayed: 0 });
  } catch (error) {
    console.error('Get procurement stats error:', error);
    sendSuccess(res, { total_orders: 0, total_value: 0, delivered: 0, pending: 0, delayed: 0 });
  }
};

export const handleGetSupplierAnalytics = async (req, res) => {
  try {
    const analytics = await query(`
      SELECT 
        supplier_name,
        COUNT(*) as orders,
        SUM(total_cost) as value,
        AVG(total_cost) as avg_order_value,
        SUM(CASE WHEN status = 'delivered' AND actual_delivery <= expected_delivery THEN 1 ELSE 0 END) as on_time_deliveries,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered,
        SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END) as delayed_count
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY supplier_name
      ORDER BY value DESC
    `);
    
    const enriched = (analytics || []).map(s => ({
      ...s,
      supplier_name: s.supplier_name || 'Unknown',
      onTime: s.total_delivered > 0 ? Math.round((s.on_time_deliveries / s.total_delivered) * 100) : 0
    }));
    
    sendSuccess(res, enriched);
  } catch (error) {
    console.error('Get supplier analytics error:', error);
    sendSuccess(res, []);
  }
};

export const handleGetProcurementCostTrends = async (req, res) => {
  try {
    const trends = await query(`
      SELECT 
        DATE_FORMAT(order_date, '%Y-%m') as month,
        SUM(total_cost) as total,
        AVG(total_cost) as avg,
        COUNT(*) as order_count
      FROM procurement_orders
      WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(order_date, '%Y-%m')
      ORDER BY month ASC
    `);
    sendSuccess(res, Array.isArray(trends) ? trends : []);
  } catch (error) {
    console.error('Get procurement cost trends error:', error);
    sendSuccess(res, []);
  }
};
