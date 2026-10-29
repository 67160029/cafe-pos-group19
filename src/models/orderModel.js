const pool = require("../config/db");

async function create(branchId, employeeId, paymentMethod, executor = pool) {
  const [result] = await executor.query(
    `INSERT INTO orders (branch_id, employee_id, payment_method, created_at)
     VALUES (?, ?, ?, NOW())`, [branchId, employeeId, paymentMethod]);
  return result.insertId;
}

async function addItem(orderId, menuId, quantity, unitPrice, executor = pool) {
  const [result] = await executor.query(
    `INSERT INTO order_item (order_id, menu_id, quantity, unit_price)
     VALUES (?, ?, ?, ?)`, [orderId, menuId, quantity, unitPrice]);
  return result.insertId;
}

async function findAllByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT order_id, branch_id, employee_id, payment_method, created_at
     FROM orders WHERE branch_id = ? ORDER BY order_id DESC`, [branchId]);
  return rows;
}

async function findQueue(branchId = null) {
  const params = [];
  let where = "WHERE o.status IN ('pending', 'preparing', 'ready')";
  if (branchId !== null) { where += " AND o.branch_id = ?"; params.push(branchId); }
  const [rows] = await pool.query(
    `SELECT o.order_id, o.branch_id, o.employee_id, o.payment_method, o.status, o.created_at,
            oi.order_item_id, oi.menu_id, oi.quantity, oi.unit_price, mi.name AS menu_name
     FROM orders o JOIN order_item oi ON oi.order_id = o.order_id
     JOIN menu_item mi ON mi.menu_id = oi.menu_id
     ${where} ORDER BY o.created_at ASC, o.order_id ASC, oi.order_item_id ASC`, params);
  const queue = new Map();
  for (const row of rows) {
    if (!queue.has(row.order_id)) queue.set(row.order_id, {
      orderId: Number(row.order_id), branchId: Number(row.branch_id), employeeId: Number(row.employee_id),
      paymentMethod: row.payment_method, status: row.status, createdAt: row.created_at, items: [],
    });
    queue.get(row.order_id).items.push({ menuId: Number(row.menu_id), name: row.menu_name,
      quantity: Number(row.quantity), unitPrice: Number(row.unit_price) });
  }
  return [...queue.values()];
}

async function getStatus(orderId) {
  const [rows] = await pool.query("SELECT order_id, branch_id, status FROM orders WHERE order_id = ?", [orderId]);
  return rows[0];
}

async function changeStatus(orderId, branchId, currentStatus, nextStatus) {
  const [result] = await pool.query(
    "UPDATE orders SET status = ? WHERE order_id = ? AND branch_id = ? AND status = ?",
    [nextStatus, orderId, branchId, currentStatus]);
  return result.affectedRows;
}

async function employeeBelongsToBranch(employeeId, branchId, executor = pool) {
  const [rows] = await executor.query(
    `SELECT employee_id FROM employee WHERE employee_id = ? AND branch_id = ?`,
    [employeeId, branchId]);
  return rows.length > 0;
}

module.exports = { create, addItem, findAllByBranch, findQueue, getStatus, changeStatus, employeeBelongsToBranch };
