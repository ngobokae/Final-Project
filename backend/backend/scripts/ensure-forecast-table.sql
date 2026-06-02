-- Run this once so forecast_results has the right structure and ON DUPLICATE KEY UPDATE works.
-- mysql -u root -p manufacturing_system < scripts/ensure-forecast-table.sql

CREATE TABLE IF NOT EXISTS forecast_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  forecast_date DATE NOT NULL,
  forecasted_demand INT NOT NULL DEFAULT 0,
  confidence_level DECIMAL(5,4) DEFAULT 0.95,
  trend_indicator VARCHAR(20) DEFAULT 'stable',
  seasonality_factor DECIMAL(10,4) DEFAULT 1.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_forecast_product_date (product_id, forecast_date),
  KEY idx_forecast_date (forecast_date),
  KEY idx_product_id (product_id)
);

-- If the table already existed without UNIQUE key, add it (run only if no duplicate rows):
-- ALTER TABLE forecast_results ADD UNIQUE KEY uq_forecast_product_date (product_id, forecast_date);
