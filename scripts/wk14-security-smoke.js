require("dotenv").config();

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const SAFE_DATABASE = "cafe_pos_wk13_test";
if (process.env.DB_NAME !== SAFE_DATABASE) {
  console.error(`Safety stop: set DB_NAME=${SAFE_DATABASE} before running this test.`);
  process.exit(2);
}

const pool = require("../src/config/db");
const port = Number(process.env.WK14_TEST_PORT || 3187);
const baseUrl = `http://127.0.0.1:${port}`;
const marker = `WK14-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const branchIds = [];
let createdCategoryId = null;
let server;
let serverOutput = "";

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

async function ensureAuthSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS employee_auth (
    employee_id INT PRIMARY KEY,
    password_hash VARCHAR(200) NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS employee_session (
    session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee_session_employee_expiry (employee_id, expires_at),
    FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
  )`);
}

async function ensureOrderStatus() {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'status'`);
  if (!columns.length) await pool.query(
    `ALTER TABLE orders ADD COLUMN status ENUM('pending','preparing','ready','completed','cancelled') NOT NULL DEFAULT 'pending' AFTER payment_method`);
}

function makePasswordHash(password) {
  const crypto = require("node:crypto");
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function login(employeeId, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId, password }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Login should succeed: ${JSON.stringify(body)}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("cafe_pos_session="), "Login should set an HttpOnly session cookie");
  return cookie;
}

async function authenticatedRequest(path, cookie, options = {}) {
  const headers = { ...(options.headers || {}), Cookie: cookie };
  return request(path, { ...options, headers });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`API process exited early. ${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/login.html`);
      if (response.status === 200) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`API did not become ready. ${serverOutput}`);
}

async function createFixture() {
  const connection = await pool.getConnection();
  try {
    const [categories] = await connection.query("SELECT category_id FROM category ORDER BY category_id LIMIT 1");
    let categoryId = categories[0]?.category_id;
    if (!categoryId) {
      const [category] = await connection.query("INSERT INTO category (name) VALUES (?)", [`${marker} category`]);
      categoryId = category.insertId;
      createdCategoryId = categoryId;
    }

    for (const suffix of ["A", "B"]) {
      const [branch] = await connection.query(
        "INSERT INTO branch (name, address) VALUES (?, ?)",
        [`${marker} Branch ${suffix}`, "TEST ONLY"],
      );
      branchIds.push(branch.insertId);
    }

    const employeeIds = [];
    for (const [index, branchId] of branchIds.entries()) {
      const [employee] = await connection.query(
        "INSERT INTO employee (branch_id, name, role) VALUES (?, ?, ?)",
        [branchId, `${marker} Manager ${index + 1}`, "Manager"],
      );
      employeeIds.push(employee.insertId);
    }

    for (const [index, employeeId] of employeeIds.entries()) {
      const password = `${marker}-Secret-${index + 1}!`;
      await connection.query(
        `INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
        [employeeId, makePasswordHash(password)],
      );
    }

    const [barista] = await connection.query(
      "INSERT INTO employee (branch_id, name, role) VALUES (?, ?, ?)",
      [branchIds[0], `${marker} Barista`, "Barista"]);
    employeeIds.push(barista.insertId);
    const baristaPassword = `${marker}-Barista-Secret!`;
    await connection.query("INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)",
      [barista.insertId, makePasswordHash(baristaPassword)]);
    const [admin] = await connection.query("INSERT INTO employee (branch_id, name, role) VALUES (?, ?, ?)",
      [branchIds[0], `${marker} Admin`, "Admin"]);
    employeeIds.push(admin.insertId);
    const adminPassword = `${marker}-Admin-Secret!`;
    await connection.query("INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)",
      [admin.insertId, makePasswordHash(adminPassword)]);

    const menuIds = [];
    for (const [index, branchId] of branchIds.entries()) {
      const [menu] = await connection.query(
        `INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [branchId, categoryId, `${marker} Latte`, index === 0 ? 70 : 75, index === 0 ? 1 : 3],
      );
      menuIds.push(menu.insertId);
    }
    return { employeeIds, menuIds, passwords: [`${marker}-Secret-1!`, `${marker}-Secret-2!`, baristaPassword, adminPassword] };
  } finally {
    connection.release();
  }
}

async function cleanup() {
  if (branchIds.length === 0 && !createdCategoryId) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (branchIds.length) {
      const [orders] = await connection.query(
        "SELECT order_id FROM orders WHERE branch_id IN (?)", [branchIds]);
      const orderIds = orders.map(row => row.order_id);
      if (orderIds.length) {
        await connection.query("DELETE FROM order_item WHERE order_id IN (?)", [orderIds]);
        await connection.query("DELETE FROM orders WHERE order_id IN (?)", [orderIds]);
      }
      await connection.query("DELETE FROM employee_session WHERE employee_id IN (SELECT employee_id FROM employee WHERE branch_id IN (?))", [branchIds]);
      await connection.query("DELETE FROM employee_auth WHERE employee_id IN (SELECT employee_id FROM employee WHERE branch_id IN (?))", [branchIds]);
      await connection.query("DELETE FROM menu_item WHERE branch_id IN (?)", [branchIds]);
      await connection.query("DELETE FROM employee WHERE branch_id IN (?)", [branchIds]);
      await connection.query("DELETE FROM branch WHERE branch_id IN (?)", [branchIds]);
    }
    if (createdCategoryId) {
      await connection.query("DELETE FROM category WHERE category_id = ?", [createdCategoryId]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function run() {
  await ensureAuthSchema();
  await ensureOrderStatus();
  const fixture = await createFixture();
  server = spawn(process.execPath, ["src/app.js"], {
    cwd: process.cwd(),
    env: { ...process.env, DB_NAME: SAFE_DATABASE, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
  server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
  await waitForServer();

  const [branchA, branchB] = branchIds;
  const [employeeA, employeeB, baristaId, adminId] = fixture.employeeIds;
  const [menuA, menuB] = fixture.menuIds;
  const cookieA = await login(employeeA, fixture.passwords[0]);
  const cookieB = await login(employeeB, fixture.passwords[1]);
  const baristaCookie = await login(baristaId, fixture.passwords[2]);
  const adminCookie = await login(adminId, fixture.passwords[3]);
  const unauthenticated = await request(`/api/menu?branchId=${branchA}`);
  assert.equal(unauthenticated.status, 401);
  const sessionA = await authenticatedRequest("/api/auth/session", cookieA);
  assert.equal(sessionA.body.branchId, branchA);
  const staffDenied = await authenticatedRequest("/api/admin/staff", cookieA);
  assert.equal(staffDenied.status, 403, "Managers cannot access HQ staff management");
  const staffCreated = await authenticatedRequest("/api/admin/staff", adminCookie, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchId: branchA, name: `${marker} New Cashier`, role: "cashier", password: `${marker}-New-Password!` }),
  });
  assert.equal(staffCreated.status, 201);
  const staffLogin = await login(staffCreated.body.employeeId, `${marker}-New-Password!`);
  const cashierReport = await authenticatedRequest(`/api/reports/sales?branchId=${branchA}`, staffLogin);
  assert.equal(cashierReport.status, 403, "Cashiers cannot view manager reports");
  const orderBody = (branchId, employeeId, menuId, quantity = 1) => ({
    branchId, employeeId, paymentMethod: "cash", items: [{ menuId, quantity }],
  });

  const concurrent = await Promise.all([
    authenticatedRequest("/api/orders", cookieA, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderBody(branchA, employeeA, menuA)) }),
    authenticatedRequest("/api/orders", cookieA, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderBody(branchA, employeeA, menuA)) }),
  ]);
  assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 400]);

  let [stockRows] = await pool.query("SELECT stock_quantity FROM menu_item WHERE menu_id = ?", [menuA]);
  assert.equal(stockRows[0].stock_quantity, 0, "Branch A stock must stop at zero after concurrent orders");
  let result = await authenticatedRequest(`/api/reports/sales?branchId=${branchA}`, cookieA);
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 1);
  assert.equal(result.body[0].totalQuantity, 1);
  assert.equal(result.body[0].totalSales, 70);
  const invalidDate = await authenticatedRequest(`/api/reports/sales?branchId=${branchA}&fromDate=2026-13-40&toDate=2026-13-41`, cookieA);
  assert.equal(invalidDate.status, 400, "Invalid dates are rejected");

  const outOfStock = await authenticatedRequest("/api/orders", cookieA, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody(branchA, employeeA, menuA)),
  });
  assert.equal(outOfStock.status, 400);

  const wrongEmployee = await authenticatedRequest("/api/orders", cookieA, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody(branchA, employeeB, menuA)),
  });
  assert.equal(wrongEmployee.status, 403, "An employee cannot create an order as another employee");
  const baristaCannotSell = await authenticatedRequest("/api/orders", baristaCookie, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody(branchA, baristaId, menuA)),
  });
  assert.equal(baristaCannotSell.status, 403, "Baristas cannot create cashier orders");

  const crossBranchRead = await authenticatedRequest(`/api/menu?branchId=${branchB}`, cookieA);
  assert.equal(crossBranchRead.status, 403, "Branch A session cannot read Branch B menu");
  const crossBranchReport = await authenticatedRequest(`/api/reports/sales?branchId=${branchB}`, cookieA);
  assert.equal(crossBranchReport.status, 403, "Branch A session cannot read Branch B sales");

  const branchBOrder = await authenticatedRequest("/api/orders", cookieB, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody(branchB, employeeB, menuB)),
  });
  assert.equal(branchBOrder.status, 201);

  const queue = await authenticatedRequest("/api/orders/queue", baristaCookie);
  assert.equal(queue.status, 200);
  assert.equal(queue.body.length, 1);
  const branchAOrderId = concurrent.find(result => result.status === 201).body.orderId;
  assert.equal(queue.body[0].orderId, branchAOrderId);
  for (const status of ["preparing", "ready", "completed"]) {
    const changed = await authenticatedRequest(`/api/orders/${branchAOrderId}/status`, baristaCookie, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    assert.equal(changed.status, 200);
  }

  const reportA = await authenticatedRequest(`/api/reports/sales?branchId=${branchA}`, cookieA);
  const reportB = await authenticatedRequest(`/api/reports/sales?branchId=${branchB}`, cookieB);
  assert.deepEqual(reportA.body.map(row => [row.menuId, row.totalQuantity, row.totalSales]), [[menuA, 1, 70]]);
  assert.deepEqual(reportB.body.map(row => [row.menuId, row.totalQuantity, row.totalSales]), [[menuB, 1, 75]]);

  const ordersA = await authenticatedRequest(`/api/orders?branchId=${branchA}`, cookieA);
  const ordersB = await authenticatedRequest(`/api/orders?branchId=${branchB}`, cookieB);
  assert.equal(ordersA.status, 200);
  assert.equal(ordersA.body.length, 1);
  assert.equal(ordersB.status, 200);
  assert.equal(ordersB.body.length, 1);

  const wrongBranchMenu = await authenticatedRequest(`/api/menu/${menuB}?branchId=${branchA}`, cookieA);
  assert.equal(wrongBranchMenu.status, 404);
  const noBranchOrders = await authenticatedRequest("/api/orders", cookieA);
  assert.equal(noBranchOrders.status, 400);

  const deleteReferencedMenu = await authenticatedRequest(`/api/menu/${menuA}?branchId=${branchA}`, cookieA, { method: "DELETE" });
  assert.equal(deleteReferencedMenu.status, 409);

  const logout = await authenticatedRequest("/api/auth/logout", cookieA, { method: "POST" });
  assert.equal(logout.status, 204);
  const afterLogout = await authenticatedRequest(`/api/menu?branchId=${branchA}`, cookieA);
  assert.equal(afterLogout.status, 401);

  console.log(JSON.stringify({
    result: "PASS",
    checks: [
      "concurrent last-item orders allow exactly one success",
      "stock never drops below zero",
      "login session is required and logout revokes it",
      "branch sessions cannot read another branch's menu or sales",
      "a user cannot create an order as another employee",
      "admin can add a cashier with a password; non-admin staff access is denied",
      "cashiers cannot read sales reports",
      "baristas cannot submit cashier orders and can advance their branch queue",
      "failed stock orders do not create an order",
      "sales reports support validated dates and order lists remain isolated by branch",
      "menu lookup is branch-scoped",
      "referenced menu deletion returns 409",
    ],
    cleanup: "temporary branches, employees, menu items, auth rows, orders, and order items are removed in finally",
  }, null, 2));
}

(async () => {
  let failure;
  try {
    await run();
  } catch (error) {
    failure = error;
    console.error(error.stack || error);
    if (serverOutput) console.error(serverOutput);
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await Promise.race([new Promise(resolve => server.once("exit", resolve)), delay(3000)]);
    }
    try { await cleanup(); } catch (error) { failure ||= error; console.error(`Fixture cleanup failed: ${error.message}`); }
    await pool.end();
  }
  if (failure) process.exitCode = 1;
})();
