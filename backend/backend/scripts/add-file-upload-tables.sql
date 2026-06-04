-- Forecast file upload tracking tables
-- Run this to add file upload capability for forecasting

CREATE TABLE IF NOT EXISTS forecast_file_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_format VARCHAR(50) NOT NULL,
  row_count INT DEFAULT 0,
  column_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'uploaded',
  forecast_count INT DEFAULT 0,
  error_message TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  KEY idx_uploaded_at (uploaded_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add columns to forecast_results to track source
ALTER TABLE forecast_results ADD COLUMN unit_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE forecast_results ADD COLUMN confidence DECIMAL(5,4) DEFAULT 0.95;
ALTER TABLE forecast_results ADD COLUMN model VARCHAR(100) DEFAULT 'ensemble';
ALTER TABLE forecast_results ADD COLUMN source VARCHAR(100) DEFAULT 'system';
ALTER TABLE forecast_results ADD COLUMN file_upload_id INT;
ALTER TABLE forecast_results ADD CONSTRAINT fk_file_upload_id FOREIGN KEY (file_upload_id) REFERENCES forecast_file_uploads(id) ON DELETE SET NULL;

-- Cross-department event log for single-cell architecture
CREATE TABLE IF NOT EXISTS system_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INT,
  source_department VARCHAR(50),
  target_department VARCHAR(50),
  user_id INT,
  payload JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  KEY idx_event_type (event_type),
  KEY idx_entity (entity_type, entity_id),
  KEY idx_department (source_department, target_department),
  KEY idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Purchase order integration with forecasts
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  forecast_id INT,
  created_by INT NOT NULL,
  approved_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  expected_arrival_date DATE,
  KEY idx_product_id (product_id),
  KEY idx_status (status),
  KEY idx_created_by (created_by),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (forecast_id) REFERENCES forecast_results(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Approval workflow tracking
CREATE TABLE IF NOT EXISTS approval_workflows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INT NOT NULL,
  current_approver_id INT,
  status VARCHAR(50) DEFAULT 'pending',
  step_number INT DEFAULT 1,
  total_steps INT DEFAULT 1,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  KEY idx_status (status),
  KEY idx_approver (current_approver_id),
  FOREIGN KEY (current_approver_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
