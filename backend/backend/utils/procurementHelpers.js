import { query } from '../config/database.js';

export const clearInventoryRecommendationForProduct = async (productId) => {
  if (!productId) return;
  await query('DELETE FROM inventory_recommendations WHERE product_id = ?', [productId]).catch(() => {});
};
