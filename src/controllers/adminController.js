const crypto = require("node:crypto");
const pool = require("../config/db");

const STAFF_ROLES = new Set(["cashier", "barista"]);
const isId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;
const normalizeName = value => typeof value === "string" ? value.trim() : "";

function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

exports.listStaff = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.employee_id AS employeeId, e.name, e.role, e.branch_id AS branchId,
              b.name AS branchName, (a.employee_id IS NOT NULL) AS loginReady
       FROM employee e JOIN branch b ON b.branch_id = e.branch_id
       LEFT JOIN employee_auth a ON a.employee_id = e.employee_id
       ORDER BY e.branch_id, e.employee_id`);
    return res.json(rows.map(row => ({ ...row, employeeId: Number(row.employeeId), branchId: Number(row.branchId), loginReady: Boolean(row.loginReady) })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "โหลดรายชื่อพนักงานไม่สำเร็จ" });
  }
};

exports.createStaff = async (req, res) => {
  const { name, branchId, role, password } = req.body || {};
  const cleanName = normalizeName(name);
  const cleanRole = String(role || "").trim().toLowerCase();
  if (!cleanName || cleanName.length > 100 || !isId(branchId) || !STAFF_ROLES.has(cleanRole) ||
      typeof password !== "string" || password.length < 12 || password.length > 256)
    return res.status(400).json({ error: "กรอกชื่อ, สาขา, บทบาท และรหัสผ่าน 12–256 ตัวอักษรให้ถูกต้อง" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [branches] = await connection.query("SELECT branch_id FROM branch WHERE branch_id = ?", [branchId]);
    if (!branches.length) {
      await connection.rollback();
      return res.status(400).json({ error: "ไม่พบสาขาที่เลือก" });
    }
    const [employee] = await connection.query(
      "INSERT INTO employee (branch_id, name, role) VALUES (?, ?, ?)", [branchId, cleanName, cleanRole]);
    await connection.query("INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)",
      [employee.insertId, passwordHash(password)]);
    await connection.commit();
    return res.status(201).json({ employeeId: employee.insertId });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ error: "เพิ่มพนักงานไม่สำเร็จ" });
  } finally { connection.release(); }
};

exports.updateStaff = async (req, res) => {
  const employeeId = Number(req.params.id);
  const { name, branchId, role, password } = req.body || {};
  if (!isId(employeeId)) return res.status(400).json({ error: "รหัสพนักงานไม่ถูกต้อง" });
  const assignments = [];
  const values = [];
  if (name !== undefined) {
    const cleanName = normalizeName(name);
    if (!cleanName || cleanName.length > 100) return res.status(400).json({ error: "ชื่อพนักงานไม่ถูกต้อง" });
    assignments.push("name = ?"); values.push(cleanName);
  }
  if (branchId !== undefined) {
    if (!isId(branchId)) return res.status(400).json({ error: "รหัสสาขาไม่ถูกต้อง" });
    assignments.push("branch_id = ?"); values.push(Number(branchId));
  }
  if (role !== undefined) {
    const cleanRole = String(role).trim().toLowerCase();
    if (!STAFF_ROLES.has(cleanRole)) return res.status(400).json({ error: "เลือก cashier หรือ barista" });
    assignments.push("role = ?"); values.push(cleanRole);
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 12 || password.length > 256))
    return res.status(400).json({ error: "รหัสผ่านต้องยาว 12–256 ตัวอักษร" });
  if (!assignments.length && password === undefined) return res.status(400).json({ error: "ไม่มีข้อมูลที่ต้องการแก้ไข" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [current] = await connection.query("SELECT employee_id FROM employee WHERE employee_id = ? FOR UPDATE", [employeeId]);
    if (!current.length) { await connection.rollback(); return res.status(404).json({ error: "ไม่พบพนักงาน" }); }
    if (branchId !== undefined) {
      const [branches] = await connection.query("SELECT branch_id FROM branch WHERE branch_id = ?", [branchId]);
      if (!branches.length) { await connection.rollback(); return res.status(400).json({ error: "ไม่พบสาขาที่เลือก" }); }
    }
    if (assignments.length) {
      values.push(employeeId);
      await connection.query(`UPDATE employee SET ${assignments.join(", ")} WHERE employee_id = ?`, values);
    }
    if (password !== undefined) {
      await connection.query(
        `INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`, [employeeId, passwordHash(password)]);
    }
    await connection.query("DELETE FROM employee_session WHERE employee_id = ?", [employeeId]);
    await connection.commit();
    return res.json({ updated: true, sessionRevoked: true });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error(error);
    return res.status(500).json({ error: "แก้ไขพนักงานไม่สำเร็จ" });
  } finally { connection.release(); }
};

exports.deleteStaff = async (req, res) => {
  const employeeId = Number(req.params.id);
  if (!isId(employeeId)) return res.status(400).json({ error: "รหัสพนักงานไม่ถูกต้อง" });
  if (employeeId === req.user.employeeId) return res.status(400).json({ error: "ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่" });
  try {
    const [employees] = await pool.query("SELECT employee_id, role FROM employee WHERE employee_id = ?", [employeeId]);
    if (!employees.length) return res.status(404).json({ error: "ไม่พบพนักงาน" });
    if (["admin", "manager"].includes(String(employees[0].role).trim().toLowerCase()))
      return res.status(403).json({ error: "บัญชี admin/manager ต้องคงไว้หรือปรับ role ผ่านผู้ดูแลฐานข้อมูล" });
    const [orders] = await pool.query("SELECT COUNT(*) AS total FROM orders WHERE employee_id = ?", [employeeId]);
    if (Number(orders[0].total) > 0) return res.status(409).json({ error: "ลบไม่ได้เพราะพนักงานมีประวัติออเดอร์ ให้เปลี่ยนบทบาทแทน" });
    await pool.query("DELETE FROM employee WHERE employee_id = ?", [employeeId]);
    return res.json({ deleted: true });
  } catch (error) {
    console.error(error);
    if (error.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ error: "ลบพนักงานไม่ได้เพราะมีข้อมูลอ้างอิงอยู่" });
    return res.status(500).json({ error: "ลบพนักงานไม่สำเร็จ" });
  }
};

exports.listBranches = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.branch_id AS branchId, b.name, b.address, COUNT(DISTINCT e.employee_id) AS employeeCount,
              COUNT(DISTINCT m.menu_id) AS menuCount
       FROM branch b LEFT JOIN employee e ON e.branch_id = b.branch_id
       LEFT JOIN menu_item m ON m.branch_id = b.branch_id
       GROUP BY b.branch_id, b.name, b.address ORDER BY b.branch_id`);
    return res.json(rows.map(row => ({ ...row, branchId: Number(row.branchId), employeeCount: Number(row.employeeCount), menuCount: Number(row.menuCount) })));
  } catch (error) { console.error(error); return res.status(500).json({ error: "โหลดสาขาไม่สำเร็จ" }); }
};

exports.createBranch = async (req, res) => {
  const name = normalizeName(req.body?.name);
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  if (!name || name.length > 100 || address.length > 255) return res.status(400).json({ error: "ชื่อหรือที่อยู่สาขาไม่ถูกต้อง" });
  try {
    const [result] = await pool.query("INSERT INTO branch (name, address) VALUES (?, ?)", [name, address || null]);
    return res.status(201).json({ branchId: result.insertId });
  } catch (error) { console.error(error); return res.status(500).json({ error: "เพิ่มสาขาไม่สำเร็จ" }); }
};

exports.updateBranch = async (req, res) => {
  const branchId = Number(req.params.id);
  const name = normalizeName(req.body?.name);
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  if (!isId(branchId) || !name || name.length > 100 || address.length > 255)
    return res.status(400).json({ error: "ข้อมูลสาขาไม่ถูกต้อง" });
  try {
    const [result] = await pool.query("UPDATE branch SET name = ?, address = ? WHERE branch_id = ?", [name, address || null, branchId]);
    if (!result.affectedRows) return res.status(404).json({ error: "ไม่พบสาขา" });
    return res.json({ updated: true });
  } catch (error) { console.error(error); return res.status(500).json({ error: "แก้ไขสาขาไม่สำเร็จ" }); }
};
