const menuModel = require("../models/menuModel");

exports.listMenu = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "ต้องระบุ branchId" });
  try { return res.json(await menuModel.findAllByBranch(branchId)); }
  catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" }); }
};

exports.getMenuById = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "ต้องระบุ branchId" });
  try {
    const menu = await menuModel.findByIdAndBranch(req.params.id, branchId);
    if (!menu) return res.status(404).json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    return res.json(menu);
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเมนู" }); }
};

exports.createMenu = async (req, res) => {
  const { branchId, categoryId, name, price, stockQuantity } = req.body;
  if (!branchId || !categoryId || typeof name !== "string" || !name.trim())
    return res.status(400).json({ error: "ต้องระบุ branchId, categoryId และ name" });
  if (!Number.isFinite(price) || price <= 0)
    return res.status(400).json({ error: "price ต้องเป็นตัวเลขมากกว่า 0" });
  if (stockQuantity !== undefined && (!Number.isInteger(stockQuantity) || stockQuantity < 0))
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  try {
    const menuId = await menuModel.create(branchId, categoryId, name.trim(), price, stockQuantity);
    return res.status(201).json({ menuId });
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการเพิ่มเมนู" }); }
};

exports.updateMenu = async (req, res) => {
  const { branchId, name, price, stockQuantity } = req.body;
  if (!branchId) return res.status(400).json({ error: "ต้องระบุ branchId" });
  if (name !== undefined && (typeof name !== "string" || !name.trim()))
    return res.status(400).json({ error: "name ไม่ถูกต้อง" });
  if (price !== undefined && (!Number.isFinite(price) || price <= 0))
    return res.status(400).json({ error: "price ต้องเป็นตัวเลขมากกว่า 0" });
  if (stockQuantity !== undefined && (!Number.isInteger(stockQuantity) || stockQuantity < 0))
    return res.status(400).json({ error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" });
  try {
    const affectedRows = await menuModel.updateFields(req.params.id, branchId, {
      name: name?.trim(), price, stockQuantity });
    if (!affectedRows) return res.status(404).json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    return res.json({ updated: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการแก้ไขเมนู" }); }
};

exports.deleteMenu = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "ต้องระบุ branchId" });
  try {
    const affectedRows = await menuModel.remove(req.params.id, branchId);
    if (!affectedRows) return res.status(404).json({ error: `ไม่พบเมนู id ${req.params.id} ในสาขานี้` });
    return res.json({ deleted: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบเมนู" }); }
};
