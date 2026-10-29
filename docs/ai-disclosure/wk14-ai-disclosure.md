# AI Disclosure — WK14 Quality Review

## เครื่องมือ AI ที่ใช้

- OpenAI Codex

## งานที่ AI ช่วย

- ไล่ตรวจทุก route/controller/model เทียบ Code Review Checklist สัปดาห์ 14
- แก้ race condition ด้วย transaction, `SELECT ... FOR UPDATE` และการหักสต็อกแบบมีเงื่อนไข
- เพิ่ม input validation และการตรวจ employee/branch
- แปลง foreign-key conflict ตอนลบเมนูเป็น HTTP 409 โดยไม่ส่งรายละเอียดฐานข้อมูลให้ client
- จำกัดรายการ `GET /api/orders` ตาม branchId และเปลี่ยน partial update จาก PUT เป็น PATCH
- เพิ่ม Employee ID + password login ด้วย scrypt, HttpOnly session cookie, endpoint ตรวจ session/logout และตรวจ branch scope ฝั่ง server
- เพิ่ม migration สำหรับตาราง auth และเครื่องมือตั้งรหัสผ่านพนักงานแบบซ่อนการพิมพ์
- ปรับหน้า POS/รายงานให้ตรวจ session ก่อนโหลดข้อมูลและแสดง branch ของพนักงานที่ login
- ขยายชุด smoke test ให้ตรวจ login, session, logout, การปฏิเสธผู้ใช้ที่ไม่ login และการปฏิเสธ cross-branch access
- ร่างรายงานตรวจสอบคุณภาพและความเสี่ยงคงเหลือ
- รัน API smoke checks ที่ไม่สร้าง order สำเร็จ และตรวจยืนยันว่าสต็อก/จำนวน order ไม่เปลี่ยน
- เพิ่มและรัน `npm run test:wk14` บนฐานข้อมูลทดสอบ โดยสคริปต์สร้างและล้าง fixture ของตัวเอง

## การตรวจสอบโดยสมาชิกกลุ่ม

- ตรวจผลกับ schema และ business rules จริง
- ตรวจผล concurrency test และยืนยัน fixture ถูกล้างจากฐานข้อมูลทดสอบ
- ทบทวนรายงานความเสี่ยงคงเหลือ โดย role-based permission และการตั้งรหัสผ่านบนฐานข้อมูลใช้งานยังต้องจัดการก่อน deploy
