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
