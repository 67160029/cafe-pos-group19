require("dotenv").config();

const crypto = require("node:crypto");
const { StringDecoder } = require("node:string_decoder");
const pool = require("../src/config/db");

function promptHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function")
    return Promise.reject(new Error("เปิดคำสั่งนี้ใน terminal แบบ interactive เพื่อซ่อนรหัสผ่าน"));
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const decoder = new StringDecoder("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error, result) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(result);
    };
    const onData = buffer => {
      for (const char of decoder.write(buffer)) {
        if (char === "\u0003") return finish(new Error("ยกเลิกแล้ว"));
        if (char === "\r" || char === "\n") return finish(null, value);
        if (char === "\u007f" || char === "\b") value = [...value].slice(0, -1).join("");
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

(async () => {
  const employeeId = Number(process.argv[2]);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || employeeId > 2147483647)
    throw new Error("วิธีใช้: node scripts/set-employee-password.js <employeeId>");

  const password = await promptHidden("รหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร): ");
  const confirmation = await promptHidden("ยืนยันรหัสผ่าน: ");
  if (password.length < 12 || password.length > 256) throw new Error("รหัสผ่านต้องมี 12–256 ตัวอักษร");
  if (password !== confirmation) throw new Error("รหัสผ่านทั้งสองครั้งไม่ตรงกัน");

  const [employees] = await pool.query("SELECT employee_id FROM employee WHERE employee_id = ?", [employeeId]);
  if (!employees.length) throw new Error("ไม่พบรหัสพนักงานนี้");

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  await pool.query(
    `INSERT INTO employee_auth (employee_id, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [employeeId, passwordHash],
  );
  await pool.query("DELETE FROM employee_session WHERE employee_id = ?", [employeeId]);
  process.stdout.write(`ตั้งรหัสผ่านให้พนักงาน ${employeeId} แล้ว และยกเลิก session เดิม\n`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
