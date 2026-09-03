const db = require("../config/db");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");

const VALID_PAYMENT_METHODS = ["cash", "credit", "qr"];

// POST /api/orders
exports.createOrder = async (req, res) => {
  const { items, paymentMethod } = req.body;

  // ตรวจสอบว่ามีสินค้าอย่างน้อย 1 รายการ
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ",
    });
  }

  // ตรวจสอบชื่อสินค้า
  const hasInvalidName = items.some(
    (item) => typeof item.name !== "string" || item.name.trim() === "",
  );

  if (hasInvalidName) {
    return res.status(400).json({
      error: "ต้องระบุชื่อสินค้าให้ครบทุกรายการ",
    });
  }

  // ตรวจสอบราคา
  const hasInvalidPrice = items.some(
    (item) => !Number.isFinite(item.price) || item.price <= 0,
  );

  if (hasInvalidPrice) {
    return res.status(400).json({
      error: "price ต้องมากกว่า 0",
    });
  }

  // ตรวจสอบจำนวน
  const hasInvalidQuantity = items.some(
    (item) => !Number.isInteger(item.quantity) || item.quantity <= 0,
  );

  if (hasInvalidQuantity) {
    return res.status(400).json({
      error: "quantity ต้องมากกว่า 0",
    });
  }

  // ตรวจสอบวิธีชำระเงิน
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({
      error: "paymentMethod ไม่ถูกต้องหรือไม่ได้ระบุ",
    });
  }

  // สร้าง Order
  const order = new Order(null, paymentMethod);

  // สร้าง OrderItem และเพิ่มเข้า Order
  for (const item of items) {
    const orderItem = new OrderItem(
      item.name.trim(),
      item.price,
      item.quantity,
    );

    order.addItem(orderItem);
  }

  try {
    // บันทึก Order ลง MySQL
    const [result] = await db.query(
      `INSERT INTO orders
            (payment_method, total_amount, created_at)
            VALUES (?, ?, NOW())`,
      [order.paymentMethod, order.totalAmount],
    );

    order.orderId = result.insertId;

    return res.status(201).json({
      orderId: order.orderId,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์",
    });
  }
};

// GET /api/orders
exports.getAllOrders = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM orders ORDER BY id DESC");

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Get orders error:", error);

    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์",
    });
  }
};
