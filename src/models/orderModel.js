const pool = require("../config/db");

async function createOrder(order) {
  const [result] = await pool.query(
    `INSERT INTO orders
      (branch_id, employee_id, payment_method)
     VALUES (?, ?, ?)`,
    [
      order.branch_id,
      order.employee_id,
      order.payment_method
    ]
  );

  return result.insertId;
}

async function addOrderItem(item) {
  const [result] = await pool.query(
    `INSERT INTO order_item
      (order_id, menu_id, quantity, unit_price)
     VALUES (?, ?, ?, ?)`,
    [
      item.order_id,
      item.menu_id,
      item.quantity,
      item.unit_price
    ]
  );

  return result.insertId;
}

module.exports = {
  createOrder,
  addOrderItem
};