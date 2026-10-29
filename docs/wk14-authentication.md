# การตั้งค่า Employee Login

ระบบใช้รหัสพนักงานกับรหัสผ่านสำหรับเข้าสู่ระบบ และผูกแต่ละ session กับสาขาของ employee จากฐานข้อมูล API จะไม่อนุญาตให้เลือก branchId อื่นผ่านการแก้ request เอง

## เตรียมฐานข้อมูล

รัน `wk14-auth-schema.sql` หนึ่งครั้งกับ schema ของระบบเพื่อสร้าง `employee_auth` และ `employee_session` จากนั้นตั้งรหัสผ่านให้พนักงานแต่ละคนจาก terminal ในโฟลเดอร์โปรเจกต์:

```powershell
node scripts/set-employee-password.js 1
```

พิมพ์รหัสผ่านสองครั้ง ระบบซ่อนตัวอักษรระหว่างพิมพ์ เก็บเฉพาะ scrypt hash และยกเลิก session เดิมเมื่อเปลี่ยนรหัสผ่าน

## เริ่มระบบ

สตาร์ตแอปตามปกติ:

```powershell
npm start
```

เปิด `http://localhost:3000/` แล้วเข้าสู่ระบบด้วย employee ID/password หน้า POS และรายงานจะแสดงเฉพาะ branch ของพนักงานที่เข้าสู่ระบบ ใช้บัญชีจากอีกสาขาเพื่อทดสอบอีก branch

## พฤติกรรมและขอบเขต

- รหัสผ่านเก็บด้วย scrypt; session ใช้ token สุ่ม 256-bit, เก็บ hash ในฐานข้อมูล, หมดอายุใน 8 ชั่วโมง และส่งผ่าน cookie `HttpOnly`, `SameSite=Strict`
- จำกัดความพยายาม login 5 ครั้งต่อพนักงาน/IP ในช่วง 15 นาทีต่อ process
- ใช้ HTTPS และ cookie `Secure` ใน production (`NODE_ENV=production`)
- ปัจจุบัน role ยังไม่แยกสิทธิ์ cashier/manager; ผู้ใช้ที่ login ได้มีสิทธิ์ทุก endpoint ภายในสาขาตนเอง
- rate limit เป็นหน่วยความจำของ process เดียว; ระบบหลาย instance ควรย้ายไป shared store
