# AI Usage Declaration — Coding Sprint สัปดาห์ที่ 5

### Diagram/เอกสารต้นทางของ sprint นี้:

จากไฟล์ `wk04-user-stories.md` ซึ่งใช้เป็นข้อมูลอ้างอิงในการพัฒนา Order API ของระบบ Cafe POS

### ส่วนที่ AI ช่วยเขียนโค้ด:

- `src/controllers/orderController.js` — ฟังก์ชัน `createOrder` โดย AI ช่วยแนะนำส่วน validation การตรวจสอบ `paymentMethod`, `items`, `name`, `price` และ `quantity` รวมถึงการคำนวณ `totalAmount` และการบันทึกข้อมูลลง MySQL
- `src/config/db.js` — AI ช่วยอธิบายการเชื่อมต่อ MySQL ด้วย Connection Pool และการกำหนด `connectionLimit`
- `src/routes/orderRoutes.js` — AI ช่วยตรวจสอบการกำหนด Route สำหรับ `POST /api/orders` และ `GET /api/orders`



### โค้ด/schema/สถาปัตยกรรมมีจุดใดต่างจาก diagram เดิมหรือไม่:

- ไม่ต่างจาก diagram เดิมในส่วนหลัก
- Sprint นี้เน้นการพัฒนาและทดสอบ Order API ให้สามารถรับคำสั่งซื้อ คำนวณยอดรวม และบันทึกข้อมูลลงฐานข้อมูลได้
- ส่วนโครงสร้างข้อมูลเพิ่มเติมที่อาจจำเป็นต่อการขยายระบบในอนาคต ยังสามารถปรับปรุงเพิ่มเติมได้ใน Sprint ถัดไป