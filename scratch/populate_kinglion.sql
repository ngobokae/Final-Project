-- New Kinglion Products and Inventory Setup
USE manufacturing_system;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-RS-001', 'Roofing Sheet Corrugated 0.5mm', 'Roofing sheets', 7699.999999999999, 11000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Roofing Sheet Corrugated 0.5mm', category='Roofing sheets', unit_cost=7699.999999999999, unit_price=11000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-RS-001' 
ON DUPLICATE KEY UPDATE current_stock = 300;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-RS-002', 'Roofing Sheet Step Tile 0.5mm', 'Roofing sheets', 9450, 13500, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Roofing Sheet Step Tile 0.5mm', category='Roofing sheets', unit_cost=9450, unit_price=13500, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 120, 0 FROM products WHERE sku = 'KL-RS-002' 
ON DUPLICATE KEY UPDATE current_stock = 120;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-MC-150', 'Kinglion Motorcycle - Model 150', 'Motorcycle', 875000, 1250000, 10, 5, TRUE) 
ON DUPLICATE KEY UPDATE name='Kinglion Motorcycle - Model 150', category='Motorcycle', unit_cost=875000, unit_price=1250000, reorder_point=10, safety_stock=5;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 12, 0 FROM products WHERE sku = 'KL-MC-150' 
ON DUPLICATE KEY UPDATE current_stock = 12;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-MC-200', 'Kinglion Motorcycle - Model 200', 'Motorcycle', 1050000, 1500000, 10, 5, TRUE) 
ON DUPLICATE KEY UPDATE name='Kinglion Motorcycle - Model 200', category='Motorcycle', unit_cost=1050000, unit_price=1500000, reorder_point=10, safety_stock=5;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 12, 0 FROM products WHERE sku = 'KL-MC-200' 
ON DUPLICATE KEY UPDATE current_stock = 12;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-MC-250', 'Kinglion Motorcycle - Cargo Special', 'Motorcycle', 1295000, 1850000, 10, 5, TRUE) 
ON DUPLICATE KEY UPDATE name='Kinglion Motorcycle - Cargo Special', category='Motorcycle', unit_cost=1295000, unit_price=1850000, reorder_point=10, safety_stock=5;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 2, 0 FROM products WHERE sku = 'KL-MC-250' 
ON DUPLICATE KEY UPDATE current_stock = 2;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-SP-001', 'Motorcycle Engine Oil 1L', 'Spare Parts', 3150, 4500, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Motorcycle Engine Oil 1L', category='Spare Parts', unit_cost=3150, unit_price=4500, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 120, 0 FROM products WHERE sku = 'KL-SP-001' 
ON DUPLICATE KEY UPDATE current_stock = 120;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-SP-002', 'Brake Pad Set - Model 150', 'Spare Parts', 5600, 8000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Brake Pad Set - Model 150', category='Spare Parts', unit_cost=5600, unit_price=8000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-SP-002' 
ON DUPLICATE KEY UPDATE current_stock = 300;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-SP-003', 'Motorcycle Tire 18-inch', 'Spare Parts', 17500, 25000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Motorcycle Tire 18-inch', category='Spare Parts', unit_cost=17500, unit_price=25000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 120, 0 FROM products WHERE sku = 'KL-SP-003' 
ON DUPLICATE KEY UPDATE current_stock = 120;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-CB-001', 'Cement Board 6mm 4x8ft', 'Pre-fabricated Cement Board', 12600, 18000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Cement Board 6mm 4x8ft', category='Pre-fabricated Cement Board', unit_cost=12600, unit_price=18000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 25, 0 FROM products WHERE sku = 'KL-CB-001' 
ON DUPLICATE KEY UPDATE current_stock = 25;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-CB-002', 'Cement Board 9mm 4x8ft', 'Pre-fabricated Cement Board', 16800, 24000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Cement Board 9mm 4x8ft', category='Pre-fabricated Cement Board', unit_cost=16800, unit_price=24000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-CB-002' 
ON DUPLICATE KEY UPDATE current_stock = 300;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-SL-001', 'Solar Panel 100W Poly', 'Solar Products', 31499.999999999996, 45000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Solar Panel 100W Poly', category='Solar Products', unit_cost=31499.999999999996, unit_price=45000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-SL-001' 
ON DUPLICATE KEY UPDATE current_stock = 300;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-SL-002', 'Solar Inverter 1kW Hybrid', 'Solar Products', 196000, 280000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Solar Inverter 1kW Hybrid', category='Solar Products', unit_cost=196000, unit_price=280000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 25, 0 FROM products WHERE sku = 'KL-SL-002' 
ON DUPLICATE KEY UPDATE current_stock = 25;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-IS-001', 'Iron Sheet - Blue 0.5mm', 'Iron Sheets', 8400, 12000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Iron Sheet - Blue 0.5mm', category='Iron Sheets', unit_cost=8400, unit_price=12000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-IS-001' 
ON DUPLICATE KEY UPDATE current_stock = 300;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-IS-002', 'Iron Sheet - Red 0.4mm', 'Iron Sheets', 7349.999999999999, 10500, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Iron Sheet - Red 0.4mm', category='Iron Sheets', unit_cost=7349.999999999999, unit_price=10500, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 120, 0 FROM products WHERE sku = 'KL-IS-002' 
ON DUPLICATE KEY UPDATE current_stock = 120;

INSERT INTO products (sku, name, category, unit_cost, unit_price, reorder_point, safety_stock, is_active) 
VALUES ('KL-IS-006', 'Iron Sheet - Matte Grey 0.5mm', 'Iron Sheets', 9100, 13000, 100, 50, TRUE) 
ON DUPLICATE KEY UPDATE name='Iron Sheet - Matte Grey 0.5mm', category='Iron Sheets', unit_cost=9100, unit_price=13000, reorder_point=100, safety_stock=50;

INSERT INTO inventory (product_id, current_stock, reserved_stock) 
SELECT id, 300, 0 FROM products WHERE sku = 'KL-IS-006' 
ON DUPLICATE KEY UPDATE current_stock = 300;

