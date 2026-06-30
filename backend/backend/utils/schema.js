import { query } from '../config/database.js';

let moneyColumnsEnsured = false;

const MONEY_ALTER_STATEMENTS = [
  'ALTER TABLE sales MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL',
  'ALTER TABLE sales MODIFY COLUMN total_amount DECIMAL(15,2) NOT NULL',
  'ALTER TABLE products MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL',
  'ALTER TABLE products MODIFY COLUMN unit_cost DECIMAL(15,2) NOT NULL',
  'ALTER TABLE procurement_orders MODIFY COLUMN unit_cost DECIMAL(15,2) NOT NULL',
  'ALTER TABLE procurement_orders MODIFY COLUMN total_cost DECIMAL(15,2) NOT NULL',
];

/** Widen money columns so large FRW totals (e.g. bulk inventory report uploads) do not overflow. */
export const ensureMoneyColumnPrecision = async () => {
  if (moneyColumnsEnsured) return;

  const dbName = process.env.DB_NAME || 'manufacturing_system';

  for (const sql of MONEY_ALTER_STATEMENTS) {
    const table = sql.match(/ALTER TABLE (\w+)/)?.[1];
    const column = sql.match(/MODIFY COLUMN (\w+)/)?.[1];
    if (!table || !column) continue;

    const rows = await query(
      `SELECT NUMERIC_PRECISION
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, column]
    );
    if (!rows.length) continue;

    const precision = Number(rows[0].NUMERIC_PRECISION);
    if (Number.isFinite(precision) && precision >= 15) continue;

    await query(sql);
  }

  const forecastPrice = await query(
    `SELECT NUMERIC_PRECISION
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forecast_results' AND COLUMN_NAME = 'unit_price'`,
    [dbName]
  );
  if (forecastPrice.length) {
    const precision = Number(forecastPrice[0].NUMERIC_PRECISION);
    if (!Number.isFinite(precision) || precision < 15) {
      await query('ALTER TABLE forecast_results MODIFY COLUMN unit_price DECIMAL(15,2) DEFAULT 0');
    }
  }

  moneyColumnsEnsured = true;
};

let recommendationSchemaEnsured = false;

/** One recommendation row per product so upserts work correctly. */
export const ensureRecommendationSchema = async () => {
  if (recommendationSchemaEnsured) return;

  const dbName = process.env.DB_NAME || 'manufacturing_system';
  const indexes = await query(
    `SELECT INDEX_NAME, NON_UNIQUE
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inventory_recommendations' AND COLUMN_NAME = 'product_id'`,
    [dbName]
  );

  const hasUniqueProduct = indexes.some(
    (row) => row.NON_UNIQUE === 0 || row.NON_UNIQUE === '0'
  );

  if (!hasUniqueProduct) {
    await query(`
      DELETE ir1 FROM inventory_recommendations ir1
      INNER JOIN inventory_recommendations ir2
        ON ir1.product_id = ir2.product_id AND ir1.id > ir2.id
    `).catch(() => {});
    await query(
      'ALTER TABLE inventory_recommendations ADD UNIQUE KEY uq_inventory_rec_product (product_id)'
    ).catch(() => {});
  }

  recommendationSchemaEnsured = true;
};
