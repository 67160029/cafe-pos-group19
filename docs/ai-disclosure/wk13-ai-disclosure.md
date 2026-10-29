# AI Disclosure — Coding Sprint 3 / WK13

## เครื่องมือ AI ที่ใช้

- OpenAI Codex

## งานที่ AI ช่วย

- ตรวจ repo และเทียบ API contract ระหว่าง menu controller กับหน้า POS
- ปรับ menu API และหน้า POS ให้ใช้ JSON field แบบ camelCase
- แก้ข้อความสถานะในตะกร้าที่ค้างหลังนำสินค้าออกหรือเปลี่ยนสาขา
- เพิ่ม `GET /api/reports/sales`, report model/controller/route และหน้า report
- ร่าง test case สำหรับ integration/E2E จาก schema, business rules และข้อกำหนด WK13
- จัดทำเอกสารบันทึกการรวมระบบและแผนทดสอบ
- ร่างคำตอบ `wk13-quiz.md` จากเอกสารประกอบที่มีใน repo และระบุจุดที่ต้องตรวจ Use Case Diagram ของกลุ่มซึ่งไม่มีใน repo

## สิ่งที่ AI ไม่ได้ทำ

- ไม่ได้สร้าง order ทดสอบหรือหักสต็อกจากฐานข้อมูลที่ใช้อยู่
- ไม่ได้บันทึกผล Pass/Fail ของ E2E ที่ต้องเขียนข้อมูลลงฐานข้อมูล
- ไม่ได้แต่ง requirement, acceptance criteria หรือ feedback จากผู้ใช้ที่ไม่มีใน repo/session

## สิ่งที่สมาชิกกลุ่มต้องตรวจสอบ

- ตรวจ API contract และ query SQL กับ schema/diagram และข้อกำหนดของกลุ่ม
- ตรวจคำตอบ quiz ให้ตรงกับเนื้อหาที่เรียนและเติมชื่อผู้ส่ง; ตรวจข้อ Use Case Diagram กับไฟล์ wk04 ฉบับจริงก่อนส่ง
- รัน test case บนฐานข้อมูลทดสอบที่มีอย่างน้อย 2 สาขาและข้อมูลสต็อกตาม precondition
- ตรวจผลจริงของออเดอร์ สต็อก และรายงานก่อนกรอก Pass/Fail
- ถ้ามีการเปลี่ยน requirement หลังทดสอบ ให้แก้เอกสาร requirements ของกลุ่มและบันทึกวันที่/เหตุผลจากหลักฐานจริง
