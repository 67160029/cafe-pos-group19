const menuModel = require("../models/menuModel");
const orderModel = require("../models/orderModel");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const pool = require("../config/db");
const { requireBranch } = require("../middleware/auth");

const VALID_PAYMENT_METHODS = ["cash", "credit", "qr"];
const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

exports.createOrder = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return res.status(400).json({ error: "รูปแบบข้อมูลออเดอร์ไม่ถูกต้อง" });

  const { items, paymentMethod, employeeId, branchId } = body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  if (!isPositiveInteger(branchId) || !isPositiveInteger(employeeId) || !paymentMethod)
    return res.status(400).json({ error: "ต้องระบุ branchId และ employeeId เป็นจำนวนเต็มบวก พร้อม paymentMethod" });
  if (!requireBranch(req, res, branchId)) return;
  if (employeeId !== req.user.employeeId)
    return res.status(403).json({ error: "ไม่สามารถสร้างออเดอร์ในชื่อพนักงานคนอื่นได้" });
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod))
    return res.status(400).json({ error: "paymentMethod ไม่ถูกต้อง" });

  const hasInvalidItem = items.some(item =>
    !item || typeof item !== "object" ||
    typeof item.menuId !== "number" || !Number.isSafeInteger(item.menuId) || item.menuId <= 0 ||
    typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) ||
    item.quantity <= 0 || item.quantity > 2147483647);
  if (hasInvalidItem)
    return res.status(400).json({ error: "menuId และ quantity ของทุกรายการต้องเป็นจำนวนเต็มบวก" });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const quantityByMenuId = new Map();
    for (const item of items)
      quantityByMenuId.set(item.menuId, (quantityByMenuId.get(item.menuId) || 0) + item.quantity);

    const menuIds = [...quantityByMenuId.keys()];
    // ล็อกแถวตาม menu_id เพื่อให้ request ที่สั่งเมนูเดียวกันต้องรอ transaction ก่อนหน้า
    const menuRows = await menuModel.findManyForStockCheck(menuIds, branchId, connection, true);
    const menuMap = new Map(menuRows.map(row => [row.menu_id, row]));

    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (!menu || menu.stock_quantity < totalQuantity) {
        await connection.rollback();
        return res.status(400).json({ error: `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}` });
      }
    }

    if (!await orderModel.employeeBelongsToBranch(employeeId, branchId, connection)) {
      await connection.rollback();
      return res.status(400).json({ error: "employeeId ไม่อยู่ในสาขาที่เลือก" });
    }

    // Domain class: คำนวณยอดรวมจากราคาใน DB (ไม่รับราคาจาก client)
    const order = new Order(null, paymentMethod);
    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      order.addItem(new OrderItem(menu.name, Number(menu.price), item.quantity));
    }

    const orderId = await orderModel.create(branchId, employeeId, paymentMethod, connection);

    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      await orderModel.addItem(orderId, item.menuId, item.quantity, menu.price, connection);
      const affectedRows = await menuModel.deductStock(item.menuId, item.quantity, branchId, connection);
      if (!affectedRows) {
        const error = new Error(`สต็อกไม่เพียงพอสำหรับเมนู id ${item.menuId}`);
        error.code = "INSUFFICIENT_STOCK";
        throw error;
      }
    }

    const lowStockMenuIds = [];
    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (menu.stock_quantity - totalQuantity < 10) lowStockMenuIds.push(menuId);
    }
    await connection.commit();
    if (lowStockMenuIds.length) console.warn("สต็อกใกล้หมด menu_id:", lowStockMenuIds);
    return res.status(201).json({ orderId, totalAmount: order.totalAmount, lowStockMenuIds });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    if (err.code === "INSUFFICIENT_STOCK")
      return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
  } finally {
    connection?.release();
  }
};

exports.getAllOrders = async (req, res) => {
  const branchId = Number(req.query.branchId);
  if (!req.query.branchId || !Number.isSafeInteger(branchId) || branchId <= 0)
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นจำนวนเต็มบวก" });
  if (!requireBranch(req, res, branchId)) return;
  try {
    const rows = await orderModel.findAllByBranch(branchId);
    return res.status(200).json(rows.map(row => ({
      orderId: Number(row.order_id),
      branchId: Number(row.branch_id),
      employeeId: Number(row.employee_id),
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
    })));
  }
  catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" }); }
};

exports.getBaristaQueue = async (req, res) => {
  const requestedBranch = req.query.branchId === undefined ? null : Number(req.query.branchId);
  if (requestedBranch !== null && (!Number.isSafeInteger(requestedBranch) || requestedBranch < 1 || requestedBranch > 2147483647))
    return res.status(400).json({ error: "branchId ไม่ถูกต้อง" });
  const branchId = req.user.role === "admin" ? requestedBranch : req.user.branchId;
  if (requestedBranch !== null && !requireBranch(req, res, requestedBranch)) return;
  try { return res.json(await orderModel.findQueue(branchId)); }
  catch (error) { console.error(error); return res.status(500).json({ error: "โหลดคิวเครื่องดื่มไม่สำเร็จ กรุณาตรวจ migration สถานะออเดอร์" }); }
};

exports.updateOrderStatus = async (req, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = req.body?.status;
  const transitions = { pending: "preparing", preparing: "ready", ready: "completed" };
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !Object.values(transitions).includes(nextStatus))
    return res.status(400).json({ error: "สถานะหรือรหัสออเดอร์ไม่ถูกต้อง" });
  try {
    const order = await orderModel.getStatus(orderId);
    if (!order) return res.status(404).json({ error: "ไม่พบออเดอร์" });
    if (!requireBranch(req, res, order.branch_id)) return;
    if (transitions[order.status] !== nextStatus)
      return res.status(409).json({ error: "เปลี่ยนสถานะออเดอร์ลำดับนี้ไม่ได้" });
    const updated = await orderModel.changeStatus(orderId, order.branch_id, order.status, nextStatus);
    if (!updated) return res.status(409).json({ error: "สถานะออเดอร์เปลี่ยนไปแล้ว โหลดคิวใหม่อีกครั้ง" });
    return res.json({ orderId, status: nextStatus });
  } catch (error) { console.error(error); return res.status(500).json({ error: "อัปเดตสถานะออเดอร์ไม่สำเร็จ" }); }
};
