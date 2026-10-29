const pool = require("../config/db");

async function findLoginRecord(employeeId) {
  const [rows] = await pool.query(
    `SELECT e.employee_id, e.branch_id, e.role, a.password_hash
     FROM employee e JOIN employee_auth a ON a.employee_id = e.employee_id
     WHERE e.employee_id = ?`, [employeeId]);
  return rows[0];
}

async function createSession(employeeId, tokenHash) {
  const [result] = await pool.query(
    `INSERT INTO employee_session (employee_id, token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))`, [employeeId, tokenHash]);
  return result.insertId;
}

async function findActiveSession(tokenHash) {
  const [rows] = await pool.query(
    `SELECT e.employee_id, e.branch_id, e.role
     FROM employee_session s JOIN employee e ON e.employee_id = s.employee_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()`, [tokenHash]);
  return rows[0];
}

async function deleteSession(tokenHash) {
  await pool.query(`DELETE FROM employee_session WHERE token_hash = ?`, [tokenHash]);
}

async function revokeEmployeeSessions(employeeId) {
  await pool.query(`DELETE FROM employee_session WHERE employee_id = ?`, [employeeId]);
}

async function deleteExpiredSessions() {
  await pool.query(`DELETE FROM employee_session WHERE expires_at <= NOW()`);
}

module.exports = { findLoginRecord, createSession, findActiveSession, deleteSession, revokeEmployeeSessions, deleteExpiredSessions };
