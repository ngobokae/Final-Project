import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Jtesire74!',
  database: 'manufacturing_system'
};

const pool = mysql.createPool(dbConfig);
const query = async (sql, params = []) => {
  const [results] = await pool.execute(sql, params);
  return results;
};

async function cleanup() {
  console.log('Starting cleanup...');
  try {
    // 1. Identify and delete trial products
    // Trial products have SKUs starting with 'UPLOAD-' or names like 'Sneakers White', 'Hoodie Black', etc.
    const trialSkus = [
      'UPLOAD-sneakers-white-mlbhrfpz',
      'UPLOAD-hoodie-black-mlbhrfo8',
      'UPLOAD-cap-sports-mlbhrfrz',
      'UPLOAD-jeans-slim-fit-mlbhrflk',
      'UPLOAD-t-shirt-classic-mlbhrff4',
      'UPLOAD-classic-t-shirt-mlcr7ful',
      'UPLOAD-baseball-cap-mlcr7h1a',
      'UPLOAD-denim-jeans-mlcr7hf3',
      'UPLOAD-polo-t-shirt-mlcr7gbv',
      'UPLOAD-hoodie-mlcr7gpj',
      'UPLOAD-jacket-winter-mlbhrfuq'
    ];
    
    // Also including SKUs that contain 'UPLOAD-' just in case
    const deleteProductsQuery = `
      DELETE FROM products 
      WHERE sku IN (${trialSkus.map(() => '?').join(',')}) 
         OR sku LIKE 'UPLOAD-%'
    `;
    
    const productResult = await query(deleteProductsQuery, trialSkus);
    console.log(`Deleted ${productResult.affectedRows} trial products.`);

    // 2. Delete audit logs from 2026-04-24 as requested
    const deleteLogsQuery = `
      DELETE FROM audit_logs 
      WHERE created_at >= '2026-04-24 00:00:00' 
        AND created_at < '2026-04-25 00:00:00'
    `;
    const logResult = await query(deleteLogsQuery);
    console.log(`Deleted ${logResult.affectedRows} audit logs from 24/04/2026.`);

    // 3. Clear inventory records for these products (though CASCADE should handle it, let's be safe)
    // Actually, foreign keys should handle it.

    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
