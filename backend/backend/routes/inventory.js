import { query } from '../config/database.js';
import { clearInventoryRecommendationForProduct } from '../utils/procurementHelpers.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { buildAlertEmailHtml, sendEmail } from '../utils/email.js';
import { getManySettings } from '../utils/systemSettings.js';

const INVENTORY_TRANSACTION_TYPES = new Set([
  'stock_in',
  'stock_out',
  'sold',
  'ordered',
  'adjustment_in',
  'adjustment_out'
]);

export const handleGetInventory = async (req, res) => {
  try {
    const inventory = await query(`
      SELECT 
        i.*,
        p.sku,
        p.name as product_name,
        p.category,
        p.unit_cost,
        p.reorder_point,
        p.safety_stock,
        p.lead_time_days,
        CASE 
          WHEN i.available_stock <= p.safety_stock THEN 'shortage'
          WHEN i.available_stock >= (p.reorder_point * 2) THEN 'overstock'
          ELSE 'normal'
        END as status
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY i.available_stock ASC
    `);

    sendJSON(res, 200, { inventory });
  } catch (error) {
    console.error('Get inventory error:', error);
    sendError(res, 500, 'Failed to fetch inventory');
  }
};

export const handleGetInventoryAlerts = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const severity = queryParams.severity;
    const resolvedParam = String(queryParams.resolved ?? '').toLowerCase();
    const hasResolvedFilter = resolvedParam === 'true' || resolvedParam === 'false';
    const isResolved = resolvedParam === 'true';

    // First, generate alerts from current inventory if needed
    await generateAlertsFromInventory();

    let sql = `
      SELECT a.*, p.sku, p.name as product_name, p.category,
        i.current_stock, i.available_stock, p.reorder_point, p.safety_stock
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN inventory i ON a.product_id = i.product_id
      WHERE a.alert_type IN ('shortage', 'overstock', 'reorder', 'forecast_anomaly')
    `;
    const params = [];

    if (severity) {
      sql += ' AND a.severity = ?';
      params.push(severity);
    }
    if (hasResolvedFilter) {
      sql += ' AND a.is_resolved = ?';
      params.push(isResolved);
    }

    sql += ' ORDER BY a.is_resolved ASC, FIELD(a.severity, \'critical\', \'high\', \'medium\', \'low\') ASC, a.created_at DESC';

    const alerts = await query(sql, params);

    sendJSON(res, 200, { alerts });
  } catch (error) {
    console.error('Get inventory alerts error:', error);
    sendError(res, 500, 'Failed to fetch alerts');
  }
};

// Generate alerts from current inventory levels
export const generateAlertsFromInventory = async () => {
  try {
    const settings = await getManySettings([
      'site_name',
      'email_notifications',
      'alert_threshold',
      'alert_email_recipients'
    ]);

    const emailEnabled =
      settings.email_notifications === true || String(settings.email_notifications) === 'true';
    const threshold = String(settings.alert_threshold || 'medium').toLowerCase();
    const recipientsRaw = String(settings.alert_email_recipients || '').trim();
    const configuredRecipients = recipientsRaw
      ? recipientsRaw
          .split(/[;,]/g)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Always include active Operations + Executive + Admin emails for alerting.
    const roleRecipientsRows = await query(
      `
        SELECT email
        FROM users
        WHERE is_active = TRUE
          AND role IN ('operations', 'executive', 'admin')
          AND email IS NOT NULL
          AND email != ''
      `
    ).catch(() => []);
    const roleRecipients = (roleRecipientsRows || []).map((r) => String(r.email || '').trim()).filter(Boolean);

    const recipients = Array.from(new Set([...configuredRecipients, ...roleRecipients]));
    const recipientsCsv = recipients.join(', ');

    const severityRank = (sev) => {
      const s = String(sev || 'low').toLowerCase();
      if (s === 'critical') return 4;
      if (s === 'high') return 3;
      if (s === 'medium') return 2;
      return 1; // low
    };

    const thresholdMinRank = (t) => {
      if (t === 'low') return 1;
      if (t === 'high') return 3;
      return 2; // medium default
    };

    // Business rule: alert emails should include at least medium and high (and critical).
    const minEmailRank = Math.max(2, thresholdMinRank(threshold));
    const shouldEmail = (sev) => severityRank(sev) >= minEmailRank;

    const alertsToEmail = [];

    // Get all inventory items with product details
    const inventory = await query(`
      SELECT 
        i.product_id,
        i.current_stock,
        i.available_stock,
        i.reserved_stock,
        p.sku,
        p.name as product_name,
        p.reorder_point,
        p.safety_stock,
        p.lead_time_days
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    for (const item of inventory) {
      const currentStock = Number(item.current_stock || 0);
      const reservedStock = Number(item.reserved_stock || 0);
      const computedAvailable = Math.max(0, currentStock - reservedStock);
      const available = Number.isFinite(computedAvailable)
        ? computedAvailable
        : Number(item.available_stock ?? item.current_stock ?? 0);
      const safetyStock = item.safety_stock || 0;
      const reorderPoint = item.reorder_point || 100;
      let stockSignal = 'normal';

      // Check for critical shortage
      if (available <= safetyStock) {
        stockSignal = 'shortage';
        const existingAlert = await query(`
          SELECT id FROM alerts 
          WHERE product_id = ? AND alert_type = 'shortage' AND severity = 'critical' AND is_resolved = FALSE
          LIMIT 1
        `, [item.product_id]);

        if (existingAlert.length === 0) {
          const message = `${item.product_name} (${item.sku}) is critically low. Current stock: ${available} units, Safety stock: ${safetyStock} units. Immediate reorder required.`;
          await query(`
            INSERT INTO alerts (product_id, alert_type, severity, message, is_resolved)
            VALUES (?, 'shortage', 'critical', ?, FALSE)
          `, [
            item.product_id,
            message
          ]);
          if (emailEnabled && recipients.length > 0 && shouldEmail('critical')) {
            alertsToEmail.push({
              severity: 'critical',
              alert_type: 'shortage',
              product_name: item.product_name,
              sku: item.sku,
              message
            });
          }
        }
      }
      // Check for low stock (below reorder point)
      else if (available < reorderPoint && available > safetyStock) {
        stockSignal = 'reorder';
        const existingAlert = await query(`
          SELECT id FROM alerts 
          WHERE product_id = ? AND alert_type = 'reorder' AND is_resolved = FALSE
          LIMIT 1
        `, [item.product_id]);

        if (existingAlert.length === 0) {
          const severity = available < (reorderPoint * 0.5) ? 'high' : 'medium';
          const message = `${item.product_name} (${item.sku}) is below reorder point. Current: ${available} units, Reorder point: ${reorderPoint} units.`;
          await query(`
            INSERT INTO alerts (product_id, alert_type, severity, message, is_resolved)
            VALUES (?, 'reorder', ?, ?, FALSE)
          `, [
            item.product_id,
            severity,
            message
          ]);
          if (emailEnabled && recipients.length > 0 && shouldEmail(severity)) {
            alertsToEmail.push({
              severity,
              alert_type: 'reorder',
              product_name: item.product_name,
              sku: item.sku,
              message
            });
          }
        }
      }
      // Check for overstock
      else if (available >= (reorderPoint * 2)) {
        stockSignal = 'overstock';
        const existingAlert = await query(`
          SELECT id FROM alerts 
          WHERE product_id = ? AND alert_type = 'overstock' AND is_resolved = FALSE
          LIMIT 1
        `, [item.product_id]);

        if (existingAlert.length === 0) {
          const message = `${item.product_name} (${item.sku}) exceeds optimal levels. Current: ${available} units, Optimal: ${reorderPoint} units. Consider reducing future orders.`;
          await query(`
            INSERT INTO alerts (product_id, alert_type, severity, message, is_resolved)
            VALUES (?, 'overstock', 'low', ?, FALSE)
          `, [
            item.product_id,
            message
          ]);
          if (emailEnabled && recipients.length > 0 && shouldEmail('low')) {
            alertsToEmail.push({
              severity: 'low',
              alert_type: 'overstock',
              product_name: item.product_name,
              sku: item.sku,
              message
            });
          }
        }
      }

      // Keep alert state in sync with current stock band by resolving stale stock alerts.
      if (stockSignal === 'shortage') {
        await query(
          `
            UPDATE alerts
            SET is_resolved = TRUE, resolved_at = NOW()
            WHERE product_id = ?
              AND is_resolved = FALSE
              AND alert_type IN ('reorder', 'overstock')
          `,
          [item.product_id]
        ).catch(() => {});
      } else if (stockSignal === 'reorder') {
        await query(
          `
            UPDATE alerts
            SET is_resolved = TRUE, resolved_at = NOW()
            WHERE product_id = ?
              AND is_resolved = FALSE
              AND alert_type IN ('shortage', 'overstock')
          `,
          [item.product_id]
        ).catch(() => {});
      } else if (stockSignal === 'overstock') {
        await query(
          `
            UPDATE alerts
            SET is_resolved = TRUE, resolved_at = NOW()
            WHERE product_id = ?
              AND is_resolved = FALSE
              AND alert_type IN ('shortage', 'reorder')
          `,
          [item.product_id]
        ).catch(() => {});
      } else {
        await query(
          `
            UPDATE alerts
            SET is_resolved = TRUE, resolved_at = NOW()
            WHERE product_id = ?
              AND is_resolved = FALSE
              AND alert_type IN ('shortage', 'reorder', 'overstock')
          `,
          [item.product_id]
        ).catch(() => {});
      }
    }

    // Forecast and movement-aware alerts: identify products where projected demand
    // plus recent outflow is likely to exceed available stock.
    const movementRiskRows = await query(`
      SELECT
        p.id as product_id,
        p.sku,
        p.name as product_name,
        i.available_stock,
        p.reorder_point,
        COALESCE((
          SELECT SUM(fr.forecasted_demand)
          FROM forecast_results fr
          WHERE fr.product_id = p.id
            AND fr.forecast_date >= CURDATE()
            AND fr.forecast_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ), 0) as forecast_30d,
        COALESCE((
          SELECT SUM(s.quantity)
          FROM sales s
          WHERE s.product_id = p.id
            AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ), 0) as sold_30d,
        COALESCE((
          SELECT SUM(po.quantity)
          FROM procurement_orders po
          WHERE po.product_id = p.id
            AND po.status IN ('pending', 'approved', 'in_transit')
            AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ), 0) as ordered_30d
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE
    `);

    for (const row of movementRiskRows) {
      const available = Number(row.available_stock || 0);
      const forecast30 = Number(row.forecast_30d || 0);
      const sold30 = Number(row.sold_30d || 0);
      const ordered30 = Number(row.ordered_30d || 0);
      const projectedGap = forecast30 + sold30 - ordered30 - available;

      if (projectedGap <= 0) {
        await query(
          `
            UPDATE alerts
            SET is_resolved = TRUE, resolved_at = NOW()
            WHERE product_id = ?
              AND alert_type = 'forecast_anomaly'
              AND is_resolved = FALSE
          `,
          [row.product_id]
        ).catch(() => {});
        continue;
      }

      const severity = projectedGap > (Number(row.reorder_point || 100) * 0.5) ? 'high' : 'medium';
      const existingForecastAlert = await query(
        `
          SELECT id
          FROM alerts
          WHERE product_id = ?
            AND alert_type = 'forecast_anomaly'
            AND is_resolved = FALSE
          LIMIT 1
        `,
        [row.product_id]
      );

      if (existingForecastAlert.length === 0) {
        const message = `${row.product_name} (${row.sku}) projected shortage: demand+sells (${Math.round(forecast30 + sold30)}) exceeds stock+ordered (${Math.round(available + ordered30)}).`;
        await query(
          `
            INSERT INTO alerts (product_id, alert_type, severity, message, is_resolved)
            VALUES (?, 'forecast_anomaly', ?, ?, FALSE)
          `,
          [
            row.product_id,
            severity,
            message
          ]
        );
        if (emailEnabled && recipients.length > 0 && shouldEmail(severity)) {
          alertsToEmail.push({
            severity,
            alert_type: 'forecast_anomaly',
            product_name: row.product_name,
            sku: row.sku,
            message
          });
        }
      } else {
        await query(
          `
            UPDATE alerts
            SET severity = ?, message = ?, is_resolved = FALSE
            WHERE id = ?
          `,
          [
            severity,
            `${row.product_name} (${row.sku}) projected shortage: demand+sells (${Math.round(forecast30 + sold30)}) exceeds stock+ordered (${Math.round(available + ordered30)}).`,
            existingForecastAlert[0].id
          ]
        );
      }
    }

    if (emailEnabled && recipients.length > 0 && alertsToEmail.length > 0) {
      try {
        const html = buildAlertEmailHtml({
          siteName: settings.site_name || 'Kinglion',
          alerts: alertsToEmail.slice(0, 25)
        });
        await sendEmail({
          to: recipientsCsv,
          subject: `${settings.site_name || 'Kinglion'} · ${alertsToEmail.length} alert(s) detected`,
          html,
          text: `The system detected ${alertsToEmail.length} alert(s).`
        });
      } catch (e) {
        console.warn('Alert email send failed:', e?.message || e);
      }
    }
  } catch (error) {
    console.error('Generate alerts error:', error);
  }
};

const getStockDelta = (transactionType, quantity) => {
  switch (transactionType) {
    case 'stock_in':
    case 'adjustment_in':
      return quantity;
    // "ordered" means order placed (procurement), not stock received yet.
    // Stock is increased later when production/procurement is completed.
    case 'ordered':
      return 0;
    case 'stock_out':
    case 'sold':
    case 'adjustment_out':
      return -quantity;
    default:
      return 0;
  }
};

export const handleCreateInventoryTransaction = async (req, res) => {
  try {
    const body = await parseBody(req);
    const productId = Number(body.product_id);
    const transactionType = String(body.transaction_type || '').trim();
    const quantity = Number(body.quantity);
    let notes = body.notes ? String(body.notes).trim() : '';
    const customerName = body.customer_name ? String(body.customer_name).trim() : null;
    const region = body.region ? String(body.region).trim() : null;
    const inputUnitPrice = body.unit_price !== undefined && body.unit_price !== null && body.unit_price !== ''
      ? Number(body.unit_price)
      : null;

    if (!productId || Number.isNaN(productId)) {
      return sendError(res, 400, 'product_id is required');
    }
    if (!INVENTORY_TRANSACTION_TYPES.has(transactionType)) {
      return sendError(res, 400, 'Invalid transaction_type');
    }
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) {
      return sendError(res, 400, 'quantity must be greater than 0');
    }

    const [inventory] = await query(
      `
        SELECT i.product_id, i.current_stock, i.reserved_stock, p.sku, p.name as product_name, p.unit_price, p.unit_cost
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE i.product_id = ?
      `,
      [productId]
    );

    if (!inventory) {
      return sendError(res, 404, 'Product inventory not found');
    }

    const previousStock = Number(inventory.current_stock || 0);
    const delta = getStockDelta(transactionType, quantity);
    if (delta < 0 && previousStock < Math.abs(delta)) {
      return sendError(res, 400, `Insufficient stock. Available: ${previousStock}, requested: ${Math.abs(delta)}`);
    }
    const newStock = Math.max(0, previousStock + delta);
    const unitPrice = inputUnitPrice && Number.isFinite(inputUnitPrice) && inputUnitPrice >= 0
      ? inputUnitPrice
      : Number(inventory.unit_price || 0);
    const totalAmount = (unitPrice > 0 && quantity > 0) ? unitPrice * quantity : 0;

    await query(
      'UPDATE inventory SET current_stock = ? WHERE product_id = ?',
      [newStock, productId]
    );

    // For "sold" and priced "stock_out" transactions, also create a sales row
    // so executive/dashboard revenue calculations are updated.
    const shouldCreateSale =
      transactionType === 'sold' || (transactionType === 'stock_out' && unitPrice > 0);
    if (shouldCreateSale) {
      await query(
        `
          INSERT INTO sales (product_id, sale_date, quantity, unit_price, total_amount, customer_name, region)
          VALUES (?, CURDATE(), ?, ?, ?, ?, ?)
        `,
        [
          productId,
          quantity,
          unitPrice,
          totalAmount,
          customerName || 'Inventory transaction',
          region || null
        ]
      );
    }

    // If inventory places an "ordered" transaction, also create a procurement order
    // so Operations → Procurement Plan totals include it.
    if (transactionType === 'ordered') {
      const inputUnitCost = body.unit_price || body.unit_cost;
      const unitCost = inputUnitCost && Number.isFinite(Number(inputUnitCost))
        ? Number(inputUnitCost)
        : Number(inventory.unit_cost || 0);
      const totalCost = unitCost > 0 ? unitCost * quantity : 0;
      let procurementOrderId = null;
      const baseNotes =
        [
          (notes && String(notes).trim().length ? notes : 'Created from Inventory order'),
          '(Created from Inventory order)',
          region ? `[source_region:${region}]` : null
        ]
          .filter(Boolean)
          .join(' ');

      // Detect optional columns (status / expected_delivery vs expected_delivery_date)
      let cols = [];
      try {
        cols = await query('SHOW COLUMNS FROM procurement_orders');
      } catch {
        cols = [];
      }
      const hasCol = (name) =>
        (cols || []).some((c) => String(c.Field || '').toLowerCase() === String(name).toLowerCase());

      const hasStatus = hasCol('status');
      const hasCreatedBy = hasCol('created_by');
      let expectedCol = hasCol('expected_delivery')
        ? 'expected_delivery'
        : hasCol('expected_delivery_date')
          ? 'expected_delivery_date'
          : null;

      // Fallback: if detection failed but we are in manufacturing context, assume 'expected_delivery'
      // which is the standard in our schema (Manaf1.sql).
      if (!expectedCol && cols.length === 0) {
        expectedCol = 'expected_delivery';
      }

      const expectedDeliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        ...(hasStatus ? ['status'] : [])
      ];

      const placeholders = fields.map(() => '?').join(', ');
      const values = [
        productId,
        customerName || 'Auto (Inventory)',
        quantity,
        unitCost || 0,
        totalCost || 0,
        new Date().toISOString().slice(0, 10),
        ...(expectedCol ? [expectedDeliveryDate] : []),
        baseNotes,
        ...(hasCreatedBy ? [req.user?.id || null] : []),
        ...(hasStatus ? ['pending'] : [])
      ];

      try {
        const result = await query(
          `INSERT INTO procurement_orders (${fields.join(', ')}) VALUES (${placeholders})`,
          values
        );
        procurementOrderId = result?.insertId || null;
      } catch (e) {
        console.error('Create procurement order from inventory ordered txn failed:', e?.message || e);
        console.error('Diagnostic - fields:', fields);
        console.error('Diagnostic - values:', values);
        // Do NOT return here. Allow the main inventory transaction to complete.
        // We will just log the failure to link to procurement.
      }

      // Mark active low-stock/reorder alerts as resolved once an order is successfully placed.
      await query(
        `
          UPDATE alerts
          SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
          WHERE product_id = ?
            AND is_resolved = FALSE
            AND alert_type IN ('shortage', 'reorder', 'forecast_anomaly')
        `,
        [req.user?.id || null, productId]
      ).catch(() => {});

      // Include linked procurement id in audit notes for traceability.
      if (procurementOrderId) {
        const linkedNote = `Linked procurement order #${procurementOrderId}`;
        if (!notes) {
          notes = linkedNote;
        } else if (!String(notes).includes(linkedNote)) {
          notes = `${notes} | ${linkedNote}`;
        }
      }
    }

    if (transactionType === 'stock_in' || transactionType === 'adjustment_in') {
      await query(
        `
          UPDATE alerts
          SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
          WHERE product_id = ?
            AND is_resolved = FALSE
            AND alert_type IN ('shortage', 'reorder', 'forecast_anomaly')
        `,
        [req.user?.id || null, productId]
      ).catch(() => {});
    }

    await logAudit(
      req.user?.id || null,
      `INVENTORY_TXN_${transactionType.toUpperCase()}`,
      'inventory',
      productId,
      {
        product_id: productId,
        product_name: inventory.product_name,
        sku: inventory.sku,
        transaction_type: transactionType,
        quantity,
        unit_price: unitPrice > 0 ? unitPrice : null,
        total_amount: totalAmount > 0 ? totalAmount : null,
        customer_name: customerName,
        region,
        delta,
        previous_stock: previousStock,
        new_stock: newStock,
        notes
      },
      req
    );

    sendJSON(res, 201, {
      success: true,
      transaction: {
        product_id: productId,
        transaction_type: transactionType,
        quantity,
        unit_price: unitPrice > 0 ? unitPrice : null,
        total_amount: totalAmount > 0 ? totalAmount : null,
        customer_name: customerName,
        region,
        delta,
        previous_stock: previousStock,
        new_stock: newStock,
        notes
      }
    });
  } catch (error) {
    console.error('Create inventory transaction error:', error);
    sendError(res, 500, `Failed to create inventory transaction: ${error.message}${error.stack ? `\n${error.stack.split('\n')[1]}` : ''}`);
  }
};

export const handleGetInventoryTransactions = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const limit = Math.max(1, Math.min(200, parseInt(queryParams.limit, 10) || 100));
    const days = Math.max(1, Math.min(365, parseInt(queryParams.days, 10) || 30));
    const fromDate = queryParams.from_date ? String(queryParams.from_date).slice(0, 10) : null;
    const toDate = queryParams.to_date ? String(queryParams.to_date).slice(0, 10) : null;
    const useCustomRange = Boolean(fromDate && toDate);
    const whereDate = useCustomRange
      ? 'AND DATE(a.created_at) BETWEEN ? AND ?'
      : 'AND a.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
    const params = useCustomRange ? [fromDate, toDate] : [days];

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
            OR a.action = 'STOCK_ADJUSTMENT'
            OR a.action = 'UPDATE_INVENTORY'
            OR a.action = 'PROCUREMENT_STATUS_UPDATE'
          )
          ${whereDate}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `,
      params
    );

    const transactions = (logs || []).map((l) => {
      let details = l.details;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          details = {};
        }
      }
      details = details || {};

      const isProcurementStatusUpdate = l.action === 'PROCUREMENT_STATUS_UPDATE';
      const procurementStatusNote = isProcurementStatusUpdate
        ? `Procurement status: ${String(details.previous_status || '-')} -> ${String(details.new_status || '-')}`
        : '';

      return {
        id: l.id,
        created_at: l.created_at,
        action: l.action,
        product_id: l.product_id,
        user_name: l.user_name,
        transaction_type:
          details.transaction_type ||
          (l.action === 'PROCUREMENT_STATUS_UPDATE'
            ? 'procurement_status'
            : l.action.startsWith('INVENTORY_TXN_')
              ? l.action.replace('INVENTORY_TXN_', '').toLowerCase()
              : 'adjustment'),
        product_name: details.product_name || null,
        sku: details.sku || null,
        quantity: Number(details.quantity || 0),
        unit_price: details.unit_price != null ? Number(details.unit_price) : null,
        total_amount:
          details.total_amount != null
            ? Number(details.total_amount)
            : details.unit_price != null && Number(details.quantity || 0) > 0
              ? Number(details.unit_price) * Number(details.quantity)
              : null,
        customer_name: details.customer_name || null,
        region: details.region || null,
        delta: Number(details.delta || 0),
        previous_stock: details.previous_stock ?? null,
        new_stock: details.new_stock ?? null,
        notes: details.notes || details.reason || procurementStatusNote || ''
      };
    });

    sendJSON(res, 200, { transactions });
  } catch (error) {
    console.error('Get inventory transactions error:', error);
    sendError(res, 500, 'Failed to fetch inventory transactions');
  }
};

export const handleExportInventoryCsv = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const days = Math.max(1, Math.min(365, parseInt(queryParams.days, 10) || 30));
    const fromDate = queryParams.from_date ? String(queryParams.from_date).slice(0, 10) : null;
    const toDate = queryParams.to_date ? String(queryParams.to_date).slice(0, 10) : null;
    const useCustomRange = Boolean(fromDate && toDate);
    const rangeStart = useCustomRange
      ? fromDate
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rangeEnd = useCustomRange
      ? toDate
      : new Date().toISOString().slice(0, 10);

    const reportRows = await query(`
      SELECT
        p.id as product_id,
        p.sku,
        p.name as product_name,
        p.category,
        i.current_stock,
        i.available_stock,
        p.reorder_point,
        p.safety_stock,
        p.unit_cost,
        p.unit_price,
        COALESCE((
          SELECT SUM(s.quantity)
          FROM sales s
          WHERE s.product_id = p.id
            AND s.sale_date BETWEEN ? AND ?
        ), 0) as sold_30d,
        COALESCE((
          SELECT SUM(po.quantity)
          FROM procurement_orders po
          WHERE po.product_id = p.id
            AND po.status IN ('pending', 'approved', 'in_transit', 'delivered')
            AND po.order_date BETWEEN ? AND ?
        ), 0) as ordered_30d,
        COALESCE((
          SELECT SUM(fr.forecasted_demand)
          FROM forecast_results fr
          WHERE fr.product_id = p.id
            AND fr.forecast_date BETWEEN ? AND ?
        ), 0) as forecast_30d
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY p.name ASC
    `, [rangeStart, rangeEnd, rangeStart, rangeEnd, rangeStart, rangeEnd]);

    const manualFlowRows = await query(`
      SELECT entity_id as product_id, details
      FROM audit_logs
      WHERE entity_type = 'inventory'
        AND action LIKE 'INVENTORY_TXN_%'
        AND DATE(created_at) BETWEEN ? AND ?
    `, [rangeStart, rangeEnd]);

    const flowMap = new Map();
    for (const row of manualFlowRows || []) {
      const productId = Number(row.product_id);
      if (!flowMap.has(productId)) {
        flowMap.set(productId, {
          stock_in_30d: 0,
          stock_out_30d: 0,
          sold_txn_30d: 0,
          ordered_txn_30d: 0
        });
      }

      let details = row.details;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          details = {};
        }
      }
      details = details || {};
      const qty = Number(details.quantity || 0);
      const type = String(details.transaction_type || '').toLowerCase();
      const rec = flowMap.get(productId);

      if (type === 'stock_in' || type === 'adjustment_in') rec.stock_in_30d += qty;
      if (type === 'stock_out' || type === 'adjustment_out') rec.stock_out_30d += qty;
      if (type === 'sold') rec.sold_txn_30d += qty;
      if (type === 'ordered') rec.ordered_txn_30d += qty;
    }

    const escapeCsv = (value) => {
      const str = value == null ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'product_id',
      'sku',
      'product_name',
      'category',
      'current_stock',
      'available_stock',
      'reorder_point',
      'safety_stock',
      'unit_cost',
      'unit_price',
      'stock_value',
      'sold_in_range',
      'ordered_in_range',
      'manual_stock_in_range',
      'manual_stock_out_range',
      'manual_sold_range',
      'manual_ordered_range',
      'forecast_demand_in_range',
      'projected_gap_in_range',
      'range_start',
      'range_end'
    ];

    const lines = [header.join(',')];
    for (const row of reportRows || []) {
      const flow = flowMap.get(Number(row.product_id)) || {
        stock_in_30d: 0,
        stock_out_30d: 0,
        sold_txn_30d: 0,
        ordered_txn_30d: 0
      };

      const currentStock = Number(row.current_stock || 0);
      const sold = Number(row.sold_30d || 0);
      const ordered = Number(row.ordered_30d || 0);
      const forecast = Number(row.forecast_30d || 0);
      const projectedGap = forecast + sold - ordered - currentStock;
      const stockValue = currentStock * Number(row.unit_cost || 0);

      const values = [
        row.product_id,
        row.sku,
        row.product_name,
        row.category,
        row.current_stock,
        row.available_stock,
        row.reorder_point,
        row.safety_stock,
        row.unit_cost,
        row.unit_price,
        stockValue.toFixed(2),
        sold,
        ordered,
        flow.stock_in_30d,
        flow.stock_out_30d,
        flow.sold_txn_30d,
        flow.ordered_txn_30d,
        Math.round(forecast),
        Math.round(projectedGap),
        rangeStart,
        rangeEnd
      ];
      lines.push(values.map(escapeCsv).join(','));
    }

    const csv = lines.join('\n');
    const filename = `inventory-stock-report-${rangeStart}_to_${rangeEnd}-${new Date().toISOString().split('T')[0]}.csv`;

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.end(csv);
  } catch (error) {
    console.error('Export inventory CSV error:', error);
    sendError(res, 500, 'Failed to export inventory report');
  }
};

export const handleUpdateInventory = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const productId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(productId)) {
      return sendError(res, 400, 'Invalid product ID');
    }

    const body = await parseBody(req);
    const { current_stock, reserved_stock, reason } = body;

    if (current_stock === undefined && reserved_stock === undefined) {
      return sendError(res, 400, 'At least one field (current_stock or reserved_stock) is required');
    }

    const [existing] = await query('SELECT current_stock, reserved_stock FROM inventory WHERE product_id = ?', [productId]);
    const previous_stock = existing ? existing.current_stock : null;

    const updates = [];
    const values = [];

    if (current_stock !== undefined) {
      updates.push('current_stock = ?');
      values.push(current_stock);
    }
    if (reserved_stock !== undefined) {
      updates.push('reserved_stock = ?');
      values.push(reserved_stock);
    }

    values.push(productId);
    await query(`UPDATE inventory SET ${updates.join(', ')} WHERE product_id = ?`, values);

    const auditDetails = { ...body };
    if (reason) auditDetails.reason = reason;
    if (previous_stock !== null && current_stock !== undefined) auditDetails.previous_stock = previous_stock;
    const action = reason ? 'STOCK_ADJUSTMENT' : 'UPDATE_INVENTORY';
    await logAudit(req.user.id, action, 'inventory', productId, auditDetails, req);

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Update inventory error:', error);
    sendError(res, 500, 'Failed to update inventory');
  }
};

export const handleGetInventoryHistory = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit) || 50));
    const offset = (page - 1) * limit;
    const productId = queryParams.product_id;

    let sql = `
      SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
        u.name as user_name, u.email as user_email,
        p.name as product_name, p.sku
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN products p ON a.entity_id = p.id AND a.entity_type = 'inventory'
      WHERE a.entity_type = 'inventory'
    `;
    const params = [];

    if (productId) {
      sql += ' AND a.entity_id = ?';
      params.push(productId);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const logs = await query(sql, params);

    let countSql = "SELECT COUNT(*) as total FROM audit_logs WHERE entity_type = 'inventory'";
    const countParams = productId ? [productId] : [];
    if (productId) countSql += ' AND entity_id = ?';
    const [countResult] = await query(countSql, countParams);
    const total = countResult.total;

    sendJSON(res, 200, {
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get inventory history error:', error);
    sendError(res, 500, 'Failed to fetch inventory history');
  }
};

export const handleResolveAlert = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const alertId = parseInt(urlParts[urlParts.length - 2]);
    
    if (isNaN(alertId)) {
      return sendError(res, 400, 'Invalid alert ID');
    }

    await query(
      'UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
      [req.user.id, alertId]
    );

    await logAudit(req.user.id, 'RESOLVE_ALERT', 'alert', alertId, null, req);

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Resolve alert error:', error);
    sendError(res, 500, 'Failed to resolve alert');
  }
};

// Receive procurement goods as stock_in in inventory
export const handleReceiveProcurementGoods = async (req, res) => {
  try {
    const body = await parseBody(req);
    const procurementOrderId = Number(body.procurement_order_id);
    const autoConfirm = body.auto_confirm === true;

    if (isNaN(procurementOrderId) || procurementOrderId <= 0) {
      return sendError(res, 400, 'Invalid procurement order ID');
    }

    // Get procurement order details
    const procurementRows = await query(
      `SELECT po.*, p.sku, p.name as product_name, i.current_stock
       FROM procurement_orders po
       JOIN products p ON po.product_id = p.id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE po.id = ?`,
      [procurementOrderId]
    );

    if (!procurementRows.length) {
      return sendError(res, 404, 'Procurement order not found');
    }

    const order = procurementRows[0];
    const currentStatus = String(order.status || '').toLowerCase();

    if (currentStatus === 'delivered') {
      return sendError(res, 400, 'Goods for this order have already been received.');
    }
    if (currentStatus === 'cancelled') {
      return sendError(res, 400, 'Cannot receive goods for a cancelled order.');
    }
    if (!['approved', 'in_transit'].includes(currentStatus)) {
      return sendError(
        res,
        400,
        `Order must be approved or in transit before receiving. Current status: ${order.status || 'pending'}.`
      );
    }

    const productId = order.product_id;
    const quantity = Number(order.quantity || 0);
    const previousStock = Number(order.current_stock || 0);
    const newStock = previousStock + quantity;
    const unitCost = Number(order.unit_cost || 0);
    const totalAmount = unitCost > 0 && quantity > 0 ? unitCost * quantity : 0;

    if (quantity <= 0) {
      return sendError(res, 400, 'Invalid quantity in procurement order');
    }

    // Update inventory stock
    await query(
      'UPDATE inventory SET current_stock = ? WHERE product_id = ?',
      [newStock, productId]
    );

    // Create stock_in transaction record
    await logAudit(
      req.user?.id || null,
      'INVENTORY_TXN_STOCK_IN',
      'inventory',
      productId,
      {
        product_id: productId,
        product_name: order.product_name,
        sku: order.sku,
        transaction_type: 'stock_in',
        quantity: quantity,
        unit_price: unitCost > 0 ? unitCost : null,
        total_amount: totalAmount > 0 ? totalAmount : null,
        procurement_order_id: procurementOrderId,
        supplier_name: order.supplier_name,
        delta: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        notes: `Stock received from procurement order #${procurementOrderId} (Supplier: ${order.supplier_name})`
      },
      req
    );

    // Resolve any reorder/shortage alerts for this product
    await query(
      `UPDATE alerts
       SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
       WHERE product_id = ?
       AND is_resolved = FALSE
       AND alert_type IN ('shortage', 'reorder', 'forecast_anomaly')`,
      [req.user?.id || null, productId]
    ).catch(() => {});

    // Update procurement order status
    if (autoConfirm) {
      await query(
        'UPDATE procurement_orders SET status = ? WHERE id = ?',
        ['delivered', procurementOrderId]
      );
    }

    await clearInventoryRecommendationForProduct(productId);

    sendJSON(res, 200, {
      success: true,
      message: `Successfully received ${quantity} units of ${order.product_name}`,
      transaction: {
        product_id: productId,
        product_name: order.product_name,
        quantity: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        procurement_order_id: procurementOrderId
      }
    });
  } catch (error) {
    console.error('Receive procurement goods error:', error);
    sendError(res, 500, `Failed to receive goods: ${error.message}`);
  }
};

// Get pending procurement orders that can be received
export const handleGetPendingProcurementReceivables = async (req, res) => {
  try {
    const orders = await query(
      `SELECT 
        po.*,
        p.name as product_name,
        p.sku,
        p.unit_cost,
        i.current_stock,
        i.available_stock
      FROM procurement_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE po.status IN ('pending', 'approved', 'in_transit', 'delayed')
         OR (po.status = 'delivered' AND po.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
      ORDER BY
        FIELD(po.status, 'pending', 'approved', 'in_transit', 'delayed', 'delivered'),
        po.order_date DESC`
    );

    const list = Array.isArray(orders) ? orders : [];
    const openOrders = list.filter((o) => !['delivered', 'cancelled'].includes(String(o.status || '').toLowerCase()));
    const completedOrders = list.filter((o) => String(o.status || '').toLowerCase() === 'delivered');

    sendJSON(res, 200, {
      pending_goods: list,
      open_orders: openOrders,
      completed_orders: completedOrders,
      summary: {
        open_count: openOrders.length,
        completed_count: completedOrders.length,
        open_units: openOrders.reduce((s, o) => s + Number(o.quantity || 0), 0),
        completed_units: completedOrders.reduce((s, o) => s + Number(o.quantity || 0), 0),
        open_value: openOrders.reduce((s, o) => s + Number(o.total_cost || 0), 0),
        completed_value: completedOrders.reduce((s, o) => s + Number(o.total_cost || 0), 0),
      },
    });
  } catch (error) {
    console.error('Get pending receivables error:', error);
    sendError(res, 500, 'Failed to fetch pending goods');
  }
};
