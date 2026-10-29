# AI Usage Disclosure — Coding Sprint 2

AI ถูกใช้ช่วยปรับโครงสร้างและตรวจสอบโค้ดให้สอดคล้องกับ Workshop สัปดาห์ที่ 9

## ส่วนที่ AI ช่วย
- ปรับ Order API ให้ตรงกับ schema และ Sequence Diagram
- แยก database access เป็น `menuModel.js` และ `orderModel.js`
- เพิ่ม CRUD เมนู
- เพิ่มการตรวจสอบ stock และ low-stock
- เพิ่ม route `/api/menu`
- จัดทำ Business Rules, Flowchart และ Sequence Diagram

## สิ่งที่กลุ่มต้องตรวจสอบ
- Schema `wk07-schema.sql`
- ชื่อ table/column
- API endpoint
- ความสอดคล้องระหว่าง Diagram กับโค้ดจริง
- ผลการทดสอบ API

## ข้อจำกัด
ยังไม่มี database transaction ครอบการตรวจและตัด stock จึงมีความเสี่ยง race condition ตามขอบเขต Sprint 2
