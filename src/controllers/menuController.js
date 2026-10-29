const menuModel = require("../models/menuModel");
const pool = require("../config/db");
const { requireBranch } = require("../middleware/auth");
const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

exports.listCategories = async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT category_id AS categoryId, name FROM category ORDER BY name, category_id");
    return res.json(rows.map(row => ({ ...row, categoryId: Number(row.categoryId) })));
  } catch (error) { console.error(error); return res.status(500).json({ error: "โหลดหมวดหมู่ไม่สำเร็จ" }); }
};

// แปลงชื่อคอลัมน์ฐานข้อมูลแบบ snake_case เป็น API contract แบบ camelCase
function toMenuResponse(row) {
  return {
    menuId: row.menu_id,
    branchId: row.branch_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    price: Number(row.price),
    stockQuantity: row.stock_quantity,
  };
}

exports.listMenu = async (req, res) => {
  const branchId = Number(req.query.branchId);
  if (!req.query.branchId || !isPositiveInteger(branchId))
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นจำนวนเต็มบวก" });
  if (!requireBranch(req, res, branchId)) return;
  try { return res.json((await menuModel.findAllByBranch(branchId)).map(toMenuResponse)); }
  catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" }); }
};

exports.getMenuById = async (req, res) => {
  const branchId = Number(req.query.branchId);
  const menuId = Number(req.params.id);
  if (!req.query.branchId || !isPositiveInteger(branchId) || !isPositiveInteger(menuId))
    return res.status(400).json({ error: "menuId และ branchId ต้องเป็นจำนวนเต็มบวก" });
  if (!requireBranch(req, res, branchId)) return;
  try {
    const menu = await menuModel.findByIdAndBranch(menuId, branchId);
    if (!menu) return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    return res.json(toMenuResponse(menu));
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" }); }
};

exports.createMenu = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return res.status(400).json({ error: "รูปแบบข้อมูลเมนูไม่ถูกต้อง" });
  const { branchId, categoryId, name, price, stockQuantity } = body;
  if (!isPositiveInteger(branchId) || !isPositiveInteger(categoryId) ||
      typeof name !== "string" || !name.trim() || name.trim().length > 100)
    return res.status(400).json({ error: "ต้องระบุ branchId, categoryId และ name ที่ถูกต้อง" });
  if (!requireBranch(req, res, branchId)) return;
  if (!Number.isFinite(price) || price <= 0 || price > 99999999.99)
    return res.status(400).json({ error: "price ต้องมากกว่า 0 และไม่เกิน 99,999,999.99" });
  if (stockQuantity !== undefined && (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647))
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  try {
    const menuId = await menuModel.create(branchId, categoryId, name.trim(), price, stockQuantity);
    return res.status(201).json({ menuId });
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มเมนู" }); }
};

exports.updateMenu = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body))
    return res.status(400).json({ error: "รูปแบบข้อมูลเมนูไม่ถูกต้อง" });
  const { branchId, name, price, stockQuantity } = body;
  const menuId = Number(req.params.id);
  if (!isPositiveInteger(branchId) || !isPositiveInteger(menuId))
    return res.status(400).json({ error: "menuId และ branchId ต้องเป็นจำนวนเต็มบวก" });
  if (!requireBranch(req, res, branchId)) return;
  if (name === undefined && price === undefined && stockQuantity === undefined)
    return res.status(400).json({ error: "ต้องระบุ field ที่ต้องการแก้ไขอย่างน้อย 1 รายการ" });
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 100))
    return res.status(400).json({ error: "name ไม่ถูกต้อง" });
  if (price !== undefined && (!Number.isFinite(price) || price <= 0 || price > 99999999.99))
    return res.status(400).json({ error: "price ต้องมากกว่า 0 และไม่เกิน 99,999,999.99" });
  if (stockQuantity !== undefined && (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647))
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      name: name?.trim(), price, stockQuantity });
    if (!affectedRows) return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    return res.json({ updated: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการแก้ไขเมนู" }); }
};

exports.deleteMenu = async (req, res) => {
  const branchId = Number(req.query.branchId);
  const menuId = Number(req.params.id);
  if (!req.query.branchId || !isPositiveInteger(branchId) || !isPositiveInteger(menuId))
    return res.status(400).json({ error: "menuId และ branchId ต้องเป็นจำนวนเต็มบวก" });
  if (!requireBranch(req, res, branchId)) return;
  try {
    const affectedRows = await menuModel.remove(menuId, branchId);
    if (!affectedRows) return res.status(404).json({ error: `ไม่พบเมนู id ${menuId} ในสาขานี้` });
    return res.json({ deleted: true });
  } catch (err) {
    if (err.code === "ER_ROW_IS_REFERENCED_2")
      return res.status(409).json({ error: "ไม่สามารถลบเมนูที่มีรายการออเดอร์อ้างอิงอยู่" });
    console.error(err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนู" });
  }
};
