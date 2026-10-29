const reportModel = require("../models/reportModel");
const { requireBranch } = require("../middleware/auth");

exports.getSalesReport = async (req, res) => {
  const rawBranchId = req.query.branchId;
  const branchId = Number(rawBranchId);
  if (!rawBranchId || !Number.isSafeInteger(branchId) || branchId < 1 || branchId > 2147483647) {
    return res.status(400).json({ error: "ต้องระบุ branchId เป็นจำนวนเต็มบวก" });
  }
  if (!requireBranch(req, res, branchId)) return;

  const fromDate = req.query.fromDate || null;
  const toDate = req.query.toDate || null;
  const validDate = value => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  };
  if ((fromDate && !validDate(fromDate)) || (toDate && !validDate(toDate)) ||
      Boolean(fromDate) !== Boolean(toDate) || (fromDate && fromDate > toDate))
    return res.status(400).json({ error: "ช่วงวันที่ไม่ถูกต้อง" });

  try {
    const rows = await reportModel.getSalesByBranch(branchId, fromDate, toDate);
    return res.json(rows.map(row => ({
      menuId: Number(row.menuId),
      name: row.name,
      totalQuantity: Number(row.totalQuantity),
      totalSales: Number(row.totalSales),
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงรายงานยอดขาย" });
  }
};
