const menuModel = require("../models/menuModel");
const orderModel = require("../models/orderModel");

const VALID_PAYMENT_METHODS = ["cash", "credit", "qr"];

exports.createOrder = async (req, res) => {
  const { items, paymentMethod, employeeId, branchId } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  if (!branchId || !employeeId || !paymentMethod)
    return res.status(400).json({ error: "ต้องระบุ branchId, employeeId, paymentMethod" });
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod))
    return res.status(400).json({ error: "paymentMethod ไม่ถูกต้อง" });

  const hasInvalidItem = items.some(item =>
    typeof item.menuId !== "number" || !Number.isInteger(item.menuId) ||
    typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0);
  if (hasInvalidItem)
    return res.status(400).json({ error: "menuId และ quantity ของทุกรายการต้องเป็นตัวเลขที่ถูกต้อง" });

  try {
    const quantityByMenuId = new Map();
    for (const item of items)
      quantityByMenuId.set(item.menuId, (quantityByMenuId.get(item.menuId) || 0) + item.quantity);

    const menuIds = [...quantityByMenuId.keys()];
    const menuRows = await menuModel.findManyForStockCheck(menuIds, branchId);
    const menuMap = new Map(menuRows.map(row => [row.menu_id, row]));

    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (!menu || menu.stock_quantity < totalQuantity)
        return res.status(400).json({ error: `สต็อกไม่เพียงพอสำหรับเมนู id ${menuId}` });
    }

    const orderId = await orderModel.create(branchId, employeeId, paymentMethod);

    for (const item of items) {
      const menu = menuMap.get(item.menuId);
      await orderModel.addItem(orderId, item.menuId, item.quantity, menu.price);
      await menuModel.deductStock(item.menuId, item.quantity, branchId);
    }

    const lowStockMenuIds = [];
    for (const [menuId, totalQuantity] of quantityByMenuId) {
      const menu = menuMap.get(menuId);
      if (menu.stock_quantity - totalQuantity < 10) lowStockMenuIds.push(menuId);
    }
    if (lowStockMenuIds.length) console.warn("สต็อกใกล้หมด menu_id:", lowStockMenuIds);

    return res.status(201).json({ orderId, lowStockMenuIds });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกออเดอร์" });
  }
};

exports.getAllOrders = async (req, res) => {
  try { return res.status(200).json(await orderModel.findAll()); }
  catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" }); }
};
