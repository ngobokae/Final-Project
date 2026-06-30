-- Widen money columns for large FRW totals (inventory report / bulk sales uploads).
ALTER TABLE sales MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL;
ALTER TABLE sales MODIFY COLUMN total_amount DECIMAL(15,2) NOT NULL;
ALTER TABLE products MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL;
ALTER TABLE products MODIFY COLUMN unit_cost DECIMAL(15,2) NOT NULL;
ALTER TABLE procurement_orders MODIFY COLUMN unit_cost DECIMAL(15,2) NOT NULL;
ALTER TABLE procurement_orders MODIFY COLUMN total_cost DECIMAL(15,2) NOT NULL;
