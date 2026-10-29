const crypto = require("node:crypto");
const { promisify } = require("node:util");
const authModel = require("../models/authModel");
const { readCookie, tokenHash, setSessionCookie, clearSessionCookie, normalizeRole } = require("../middleware/auth");

const scrypt = promisify(crypto.scrypt);
const HASH_BYTES = 64;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const failures = new Map();
const dummySalt = crypto.randomBytes(16);
const dummyHash = crypto.scryptSync(crypto.randomBytes(32), dummySalt, HASH_BYTES);
const DUMMY_PASSWORD_HASH = `scrypt$${dummySalt.toString("hex")}$${dummyHash.toString("hex")}`;

async function verifyPassword(password, encoded) {
  const [scheme, saltHex, hashHex] = String(encoded || "").split("$");
  if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), HASH_BYTES);
  return crypto.timingSafeEqual(expected, actual);
}

function rateKey(req, employeeId) { return `${req.ip || "unknown"}:${employeeId}`; }

function isRateLimited(key) {
  const state = failures.get(key);
  if (!state) return false;
  if (Date.now() - state.startedAt >= 15 * 60 * 1000) {
    failures.delete(key);
    return false;
  }
  return state.count >= 5;
}

function recordFailure(key) {
  const now = Date.now();
  if (failures.size > 10000) {
    for (const [candidate, state] of failures) {
      if (now - state.startedAt >= 15 * 60 * 1000) failures.delete(candidate);
    }
  }
  const state = failures.get(key);
  if (!state || now - state.startedAt >= 15 * 60 * 1000) failures.set(key, { startedAt: now, count: 1 });
  else state.count += 1;
}

exports.login = async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Number.isSafeInteger(body.employeeId) || body.employeeId < 1 || body.employeeId > 2147483647 ||
      typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
    return res.status(400).json({ error: "กรอกรหัสพนักงานและรหัสผ่านให้ถูกต้อง" });
  }

  const key = rateKey(req, body.employeeId);
  if (isRateLimited(key)) return res.status(429).json({ error: "ลองเข้าสู่ระบบใหม่ภายหลัง" });

  try {
    const record = await authModel.findLoginRecord(body.employeeId);
    const validPassword = await verifyPassword(body.password, record?.password_hash || DUMMY_PASSWORD_HASH);
    if (!record || !validPassword) {
      recordFailure(key);
      return res.status(401).json({ error: "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง" });
    }

    failures.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    await authModel.deleteExpiredSessions();
    await authModel.createSession(body.employeeId, tokenHash(token));
    setSessionCookie(res, token, SESSION_TTL_SECONDS);
    return res.json({ employeeId: Number(record.employee_id), branchId: Number(record.branch_id), role: normalizeRole(record.role) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "เข้าสู่ระบบไม่สำเร็จ" });
  }
};

exports.session = (req, res) => res.json(req.user);

exports.logout = async (req, res) => {
  try {
    const token = readCookie(req);
    if (/^[0-9a-f]{64}$/i.test(token)) await authModel.deleteSession(tokenHash(token));
    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    clearSessionCookie(res);
    return res.status(500).json({ error: "ออกจากระบบไม่สำเร็จ" });
  }
};
