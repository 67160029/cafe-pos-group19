const pool = require("../config/db");

async function findAllByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT mi.menu_id, mi.branch_id, mi.category_id, c.name AS category_name,
            mi.name, mi.price, mi.stock_quantity
     FROM menu_item mi JOIN category c ON c.category_id = mi.category_id
     WHERE mi.branch_id = ? ORDER BY c.name, mi.name`, [branchId]);
  return rows;
}

async function findByIdAndBranch(menuId, branchId) {
  const [rows] = await pool.query(
    `SELECT mi.menu_id, mi.branch_id, mi.category_id, c.name AS category_name,
            mi.name, mi.price, mi.stock_quantity
     FROM menu_item mi JOIN category c ON c.category_id = mi.category_id
     WHERE mi.menu_id = ? AND mi.branch_id = ?`, [menuId, branchId]);
  return rows[0];
}

async function findManyForStockCheck(menuIds, branchId, executor = pool, lockForUpdate = false) {
  if (!menuIds.length) return [];
  const ids = [...menuIds].sort((a, b) => a - b);
  const lockClause = lockForUpdate ? " ORDER BY menu_id FOR UPDATE" : "";
  const [rows] = await executor.query(
    `SELECT menu_id, branch_id, category_id, name, price, stock_quantity
     FROM menu_item WHERE menu_id IN (?) AND branch_id = ?${lockClause}`, [ids, branchId]);
  return rows;
}

async function create(branchId, categoryId, name, price, stockQuantity = 0) {
  const [result] = await pool.query(
    `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity)
     VALUES (?, ?, ?, ?, ?)`,
    [branchId, categoryId, name, price, stockQuantity ?? 0]);
  return result.insertId;
}

async function updateFields(menuId, branchId, { name, price, stockQuantity }) {
  const [result] = await pool.query(
    `UPDATE menu_item SET name = COALESCE(?, name),
      price = COALESCE(?, price), stock_quantity = COALESCE(?, stock_quantity)
      WHERE menu_id = ? AND branch_id = ?`,
    [name ?? null, price ?? null, stockQuantity ?? null, menuId, branchId]);
  return result.affectedRows;
}

async function remove(menuId, branchId) {
  const [result] = await pool.query(
    `DELETE FROM menu_item WHERE menu_id = ? AND branch_id = ?`, [menuId, branchId]);
  return result.affectedRows;
}

async function deductStock(menuId, quantity, branchId, executor = pool) {
  const [result] = await executor.query(
    `UPDATE menu_item SET stock_quantity = stock_quantity - ?
     WHERE menu_id = ? AND branch_id = ? AND stock_quantity >= ?`,
    [quantity, menuId, branchId, quantity]);
  return result.affectedRows;
}

module.exports = { findAllByBranch, findByIdAndBranch, findManyForStockCheck,
  create, updateFields, remove, deductStock };
