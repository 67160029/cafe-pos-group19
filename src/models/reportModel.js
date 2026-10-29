const pool = require("../config/db");

async function getSalesByBranch(branchId, fromDate = null, toDate = null) {
  const conditions = ["o.branch_id = ?"];
  const params = [branchId];
  if (fromDate) { conditions.push("o.created_at >= ?"); params.push(`${fromDate} 00:00:00`); }
  if (toDate) { conditions.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(`${toDate} 00:00:00`); }
  const [rows] = await pool.query(
    `SELECT m.menu_id AS menuId,
            m.name AS name,
            SUM(oi.quantity) AS totalQuantity,
            SUM(oi.quantity * oi.unit_price) AS totalSales
     FROM order_item oi
     JOIN orders o ON oi.order_id = o.order_id
     JOIN menu_item m ON oi.menu_id = m.menu_id AND m.branch_id = o.branch_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY m.menu_id, m.name
     ORDER BY totalSales DESC, m.menu_id ASC`,
    params,
  );
  return rows;
}

module.exports = { getSalesByBranch };
