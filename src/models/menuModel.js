const pool = require("../config/db");

async function getAllMenuItems() {
  const [rows] = await pool.query(`
    SELECT 
      menu_id,
      branch_id,
      category_id,
      name,
      price,
      stock_quantity
    FROM menu_item
  `);

  return rows;
}

async function getMenuItemById(menuId) {
  const [rows] = await pool.query(
    `SELECT * FROM menu_item WHERE menu_id = ?`,
    [menuId]
  );

  return rows[0];
}

module.exports = {
  getAllMenuItems,
  getMenuItemById
};