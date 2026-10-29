-- รันบน schema Cafe POS ที่ใช้งาน เพื่อเปิดสถานะคิวสำหรับ Barista KDS
SET @has_order_status = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'
);
SET @add_order_status = IF(
  @has_order_status = 0,
  "ALTER TABLE orders ADD COLUMN status ENUM('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending' AFTER payment_method",
  'SELECT 1'
);
PREPARE group10_module_stmt FROM @add_order_status;
EXECUTE group10_module_stmt;
DEALLOCATE PREPARE group10_module_stmt;
