const pool = require("../config/db");

async function create(branchId, employeeId, paymentMethod) {
  const [result] = await pool.query(
    `INSERT INTO orders (branch_id, employee_id, payment_method, created_at)
     VALUES (?, ?, ?, NOW())`, [branchId, employeeId, paymentMethod]);
  return result.insertId;
}

async function addItem(orderId, menuId, quantity, unitPrice) {
  const [result] = await pool.query(
    `INSERT INTO order_item (order_id, menu_id, quantity, unit_price)
     VALUES (?, ?, ?, ?)`, [orderId, menuId, quantity, unitPrice]);
  return result.insertId;
}

async function findAll() {
  const [rows] = await pool.query(`SELECT * FROM orders ORDER BY order_id DESC`);
  return rows;
}

module.exports = { create, addItem, findAll };
