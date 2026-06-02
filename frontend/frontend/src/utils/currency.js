/**
 * Currency formatting for Rwandan Francs (FRW).
 * All monetary values in the app are stored and calculated in FRW.
 */

const CURRENCY_CODE = 'FRW';
const CURRENCY_LABEL = 'Rwandan Francs';

/**
 * Format a number as Rwandan Francs (FRW).
 * @param {number} value - Amount in FRW
 * @param {object} options - { compact: boolean } for 1.2M style
 * @returns {string} e.g. "FRW 1,234,567" or "FRW 1.2M"
 */
export function formatCurrency(value, options = {}) {
  if (value == null || isNaN(value)) return 'FRW 0';
  const num = Number(value);
  if (options.compact !== false) {
    if (num >= 1_000_000_000) return `FRW ${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `FRW ${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `FRW ${(num / 1_000).toFixed(1)}K`;
  }
  return `FRW ${num.toLocaleString('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format for use in tables/charts (no "FRW " prefix if you want to show it separately).
 */
export function formatCurrencyValue(value, compact = true) {
  if (value == null || isNaN(value)) return '0';
  const num = Number(value);
  if (compact && num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (compact && num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export { CURRENCY_CODE, CURRENCY_LABEL };
