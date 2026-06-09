-- Adds forecast file upload tracking (not in Manaf1.sql dump)
USE manufacturing_system;

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
  KEY idx_uploaded_at (uploaded_at)
);
