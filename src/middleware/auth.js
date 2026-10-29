const crypto = require("node:crypto");
const authModel = require("../models/authModel");

const COOKIE_NAME = "cafe_pos_session";
const ROLE_ALIASES = new Map([
  ["admin", "admin"], ["administrator", "admin"],
  ["manager", "manager"], ["ผู้จัดการ", "manager"],
  ["cashier", "cashier"], ["แคชเชียร์", "cashier"],
  ["barista", "barista"], ["บาริสต้า", "barista"],
]);

function normalizeRole(role) {
  return ROLE_ALIASES.get(String(role || "").trim().toLowerCase()) || "cashier";
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      try { return decodeURIComponent(value.join("=")); } catch { return ""; }
    }
  }
  return "";
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function serializeCookie(token, maxAgeSeconds) {
  const pieces = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`];
  if (process.env.NODE_ENV === "production") pieces.push("Secure");
  return pieces.join("; ");
}

function setSessionCookie(res, token, maxAgeSeconds = 8 * 60 * 60) {
  res.setHeader("Set-Cookie", serializeCookie(token, maxAgeSeconds));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie("", 0));
}

async function authenticate(req, res, next) {
  const token = readCookie(req);
  if (!/^[0-9a-f]{64}$/i.test(token))
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  try {
    const user = await authModel.findActiveSession(tokenHash(token));
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    }
    req.user = {
      employeeId: Number(user.employee_id),
      branchId: Number(user.branch_id),
      role: normalizeRole(user.role),
    };
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "ไม่สามารถตรวจสอบ session ได้" });
  }
}

function requireBranch(req, res, branchId) {
  if (req.user.role === "admin") return true;
  if (Number(branchId) !== req.user.branchId) {
    res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึงสาขานี้" });
    return false;
  }
  return true;
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งานส่วนนี้" });
    return next();
  };
}

module.exports = { authenticate, requireBranch, requireRole, normalizeRole, readCookie, tokenHash, setSessionCookie, clearSessionCookie };
