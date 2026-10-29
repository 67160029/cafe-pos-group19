# WK13 Integration และ End-to-End Testing — Cafe POS กลุ่ม 19

## ขอบเขตและแหล่งอ้างอิง

เอกสารนี้บันทึก API contract ที่รวมแล้ว, test case สำหรับ flow order → report, ผลตรวจ API แบบไม่เขียนข้อมูล และผล E2E ที่ผู้ใช้รายงานว่าได้รันทดสอบผ่าน เอกสาร `wk03-requirements.md` และ `wk04-user-stories.md` ไม่พบใน repo ที่ให้มา จึงอ้างอิง business rule ใน `wk09-business-rules.md`, schema ใน `wk07-schema.sql`, code ปัจจุบัน และข้อกำหนดสัปดาห์ 13 แทน ไม่ได้แต่ง FR หรือ Acceptance Criteria ที่ไม่มีหลักฐาน

ระบบใน repo มีหน้า POS, API เมนูและออเดอร์ และเพิ่มหน้า/API รายงานยอดขายใน Sprint นี้ ขอบเขตนี้ยังไม่มี payment gateway; `paymentMethod` บันทึกวิธีชำระที่เลือกเป็น `cash`, `credit` หรือ `qr` เท่านั้น

หลังเพิ่ม WK14 authentication การเรียก API เมนู, order และรายงานต้องมี session จาก `POST /api/auth/login`; branch scope ถูกผูกกับพนักงานใน session ผู้ใช้ใหม่ต้องตั้ง password และสร้างตาราง auth ตาม [wk14-authentication.md](wk14-authentication.md) ก่อนใช้งาน

## 1. API Contract หลังรวม module

| Endpoint | Request | Success response | หมายเหตุ |
|---|---|---|---|
| `GET /api/menu?branchId=1` | query `branchId` จำนวนเต็มบวก | array ของ `{ menuId, branchId, categoryId, name, price, stockQuantity }` | JSON ใช้ camelCase; `price` เป็น number |
| `POST /api/orders` | `{ branchId, employeeId, paymentMethod, items: [{ menuId, quantity }] }` | `{ orderId, totalAmount, lowStockMenuIds }` | 201; ราคาใช้ค่าจาก DB; สต็อกไม่พอตอบ 400 |
| `GET /api/orders?branchId=1` | query `branchId` จำนวนเต็มบวก | array ของ `{ orderId, branchId, employeeId, paymentMethod, createdAt }` | JSON ใช้ camelCase และคืนเฉพาะ order ของสาขาที่ขอ |
| `PATCH /api/menu/:id` | `{ branchId, name?, price?, stockQuantity? }` | `{ updated: true }` | partial update ใช้ HTTP method PATCH |
| `POST /api/auth/login` | `{ employeeId, password }` | `{ employeeId, branchId, role }` และตั้ง session cookie | ตาราง auth ต้องถูกสร้างและ employee ต้องมี password |
| `GET /api/auth/session` | session cookie | `{ employeeId, branchId, role }` | ไม่มี session ตอบ 401 |
| `POST /api/auth/logout` | session cookie | 204 | ลบ session ปัจจุบัน |

ทุก API เมนู/order/report ต้องแนบ session cookie; ถ้าขอ branchId ที่ไม่ใช่ branch ของพนักงานจะตอบ 403 และ API order จะปฏิเสธ employeeId ที่ไม่ตรง session
| `GET /api/reports/sales?branchId=1` | query `branchId` จำนวนเต็มบวก | array ของ `{ menuId, name, totalQuantity, totalSales }` | JSON ใช้ camelCase; ค่ารวมแปลงเป็น number; กรองสาขาจาก `orders.branch_id` |

### จุดรวม API contract ที่แก้

ก่อน Sprint นี้ `GET /api/menu` ส่งคีย์ฐานข้อมูล `menu_id`, `branch_id`, `category_id`, `stock_quantity` ออกไปตรง ๆ และหน้า POS อ่านชื่อคีย์แบบ snake_case ทำให้สอง module ผูกกันด้วยรูปแบบที่ไม่ตรงข้อตกลง camelCase ในเอกสารสัปดาห์ 13 แม้หน้าเว็บจะแสดงผลได้ หลังแก้ `menuController` แปลง response เป็น camelCase และหน้า POS อ่าน contract เดียวกันแล้ว โดยคงชื่อ snake_case ไว้เฉพาะใน data-access/database layer; `GET /api/orders` ก็ serialize field เป็น camelCase เพื่อให้ API ฝั่ง order สอดคล้องกัน

## 2. Test Case แบบ E2E

ผู้ใช้ยืนยันว่ารันทดสอบครบทุกกรณีบนฐานข้อมูลทดสอบและผ่านทั้งหมดเมื่อ 29/10/2569 การยืนยัน order เพิ่มข้อมูลใน `orders`/`order_item` และหักสต็อก จึงควรทำบนฐานข้อมูลทดสอบแยกจากข้อมูลใช้งานจริง รายละเอียดต่อไปนี้บันทึกตามผล Pass ที่ผู้ใช้รายงาน

| TC ID | Precondition | ขั้นตอนทดสอบ | ผลลัพธ์ที่คาดหวัง | ผลจริง | Pass/Fail |
|---|---|---|---|---|---|
| TC-13-01 | API และ DB ทำงาน; Branch 1 มีเมนู | 1. เรียก `GET /api/menu?branchId=1` 2. ตรวจชื่อคีย์และชนิดข้อมูล | 200; รายการมี `menuId`, `branchId`, `categoryId`, `price` (number), `stockQuantity`; ไม่มีคีย์ snake_case ใน public response | ผ่าน: 200; keys เป็น camelCase และ `price`/`stockQuantity` เป็น number | Pass |
| TC-13-02 | ฐานข้อมูลทดสอบ: พนักงานและเมนู 2 รายการใน Branch A; สต็อกพอ; บันทึกยอด/สต็อกเริ่มต้น | 1. เปิด POS 2. เพิ่มเมนู A จำนวน 2 และเมนู B จำนวน 1 3. เลือกเงินสด 4. ยืนยันออเดอร์ 5. ตรวจ order/item, branch_id, unit_price และสต็อก 6. เปิดรายงาน Branch A | UI แสดงยอดรวมที่คำนวณจากราคา DB; order ผูกกับ Branch A; stock ลดตามจำนวน; รายงานแสดงยอดขาย/จำนวนที่ตรงกับ order | ผ่านตามที่ผู้ใช้ยืนยัน: order, stock และ report ตรงกับ expected result ของเคส | Pass |
| TC-13-03 | Branch 1 มี Americano stock 19; บันทึกจำนวน order และ stock ก่อนเริ่ม | 1. ส่ง `POST /api/orders` สำหรับ `menuId=1`, quantity 100000 2. ตรวจ order count และ stock ซ้ำ | 400 พร้อม error; ไม่มี order/order_item ใหม่; stock คงเดิม | ผ่าน: 400 “สต็อกไม่เพียงพอ”; order count และ stock ไม่เปลี่ยน | Pass |
| TC-13-04 | มี Branch A/B; มีเมนูชื่อเดียวกันคนละ `menu_id`; สต็อกเริ่มต้นของทั้งคู่ถูกบันทึก | 1. ทำ order ใน Branch A และยืนยัน 2. ทำ order ใน Branch B 3. ตรวจ stock ทั้งคู่ 4. เรียกรายงานทีละ branch | แต่ละ order ใช้ menu และ stock ของ branch นั้น; รายงาน A/B แสดงเฉพาะยอดของสาขาตัวเอง; การขาย A ไม่ทำให้ stock หรือยอดขาย B เปลี่ยน | ผ่านตามที่ผู้ใช้ยืนยัน: stock และ report ของสองสาขาแยกกันตาม expected result | Pass |
| TC-13-05 | API ทำงาน | 1. เรียก `GET /api/reports/sales` โดยไม่ส่ง branchId 2. เรียกด้วย `branchId=abc` และ `branchId=0` 3. เรียกด้วย branch ที่ไม่มีอยู่ | กรณีไม่ถูกต้องตอบ 400; branch ที่ไม่มีข้อมูลตอบ 200 และ array ว่าง | ผ่าน: ไม่มี branchId / abc / 0 ตอบ 400; 99999 ตอบ 200 `[]` | Pass |

## 3. ผลการตรวจและ E2E

- เชื่อมต่อฐานข้อมูลที่ repo ตั้งค่าไว้ได้ พบข้อมูลจริงมี Branch 1 สาขาเดียว และเมนู Americano (stock 19), Latte (stock 15)
- การตรวจหน้า POS ก่อนแก้ contract พบ UI ใช้ snake_case ตาม response เดิม; contract naming ถูกปรับให้เป็น camelCase ทั้ง controller และ frontend ใน Sprint นี้
- ผู้ใช้ยืนยันภายหลังว่าเตรียมข้อมูลทดสอบและรันครบทุกเคส รวมถึงข้ามสองสาขาแล้วผ่าน
- เรียก `GET /api/reports/sales?branchId=1` ได้ 200; รายงานแสดง Americano จำนวน 3 ยอดขาย 180 และหน้า `reports.html` แสดงยอดรวม 3 / ฿180.00
- ส่ง `POST /api/orders` ปริมาณ 100000 ของ Americano เพื่อทดสอบกรณีสต็อกไม่พอ; ได้ 400 และตรวจยืนยันว่า order count กับ stock ไม่เปลี่ยน
- เปิดหน้า POS หลังแก้ API contract เพิ่ม Latte ได้ ยอดแสดง ฿70.00 และเมื่อนำออกตะกร้ากลับเป็นว่าง; ไม่ได้ยืนยันออเดอร์
- `GET /api/orders` ตอบ field camelCase ตาม contract ที่ปรับเพิ่ม
- ไม่ได้ยิง `POST /api/orders` ที่สร้างยอดขายกับฐานข้อมูลเดิม เพื่อไม่เพิ่ม order หรือหัก stock จากข้อมูลที่มีอยู่
- ผู้ใช้รายงานว่า TC-13-02 และ TC-13-04 ผ่านบนฐานข้อมูลทดสอบ; ไม่บันทึก order ID หรือ snapshot เชิงตัวเลขเพราะไม่ได้รับรายละเอียดดังกล่าว
- การตรวจหน้า POS หลังแก้สถานะตะกร้าผ่าน: เมื่อนำ Latte ออก ตะกร้าว่างและข้อความเปลี่ยนเป็น “นำเมนูออกจากออเดอร์แล้ว”

## 4. Bug Fixing และ Refactoring

| หัวข้อ | รายละเอียด |
|---|---|
| Reproduce | ตรวจ `GET /api/menu` แล้วเปรียบเทียบ response snake_case กับข้อตกลง API camelCase และโค้ด frontend |
| Isolate | ความไม่ตรงกันอยู่ที่ชั้น response ของ `menuController` และการอ่าน field ของ frontend; SQL/data-access ใช้ชื่อคอลัมน์ตาม schema ได้ถูกต้อง |
| Fix | เพิ่มการแปลง response เป็น `menuId`, `branchId`, `categoryId`, `price`, `stockQuantity`; ปรับหน้า POS ให้อ่านชื่อตาม API contract |
| Verify | ผ่าน: `GET /api/menu?branchId=1` คืน camelCase และ number; หน้า POS เพิ่ม Latte แสดง ฿70.00 และลบรายการแล้วตะกร้าว่าง |
| Refactoring เพิ่มเติม | แยก query รายงานไว้ใน `reportModel`, จัดการ validation/แปลงชนิดข้อมูลใน `reportController`, route แยกเป็น `reportRoutes` |

ระหว่างตรวจหน้า POS พบข้อความสถานะ “เพิ่มเมนูในออเดอร์แล้ว” ค้างอยู่แม้นำรายการออกจนตะกร้าว่าง (Reproduce: เพิ่มเมนูแล้วกด “นำออก”; Isolate: handler ของปุ่มนำออกลบรายการแต่ไม่ได้อัปเดต `orderStatus`; Fix: แสดง “นำเมนูออกจากออเดอร์แล้ว” และล้างข้อความเก่าเมื่อเปลี่ยนสาขา; Verify: ผ่าน ตรวจซ้ำแล้วตะกร้าว่างและข้อความเปลี่ยนเป็น “นำเมนูออกจากออเดอร์แล้ว”)

## 5. การปรับปรุง Requirement

จากการตรวจทางเทคนิคครั้งนี้ยังไม่มี feedback จากผู้ใช้จริงที่ยืนยันว่าต้องเพิ่ม/แก้ requirement จึงยังไม่สร้าง FR ใหม่หรือเขียนประวัติการเปลี่ยนแปลงแทนเอกสาร `wk03-requirements.md` ซึ่งไม่อยู่ใน repo รอบนี้ หลังรัน E2E หรือได้ usability feedback จริง ให้ระบุ FR หมายเลขถัดไป, วันที่พบ, ข้อความ requirement ที่แก้ และเหตุผลที่มาจากหลักฐานในไฟล์ requirement ของกลุ่ม

## 6. สรุปสำหรับทีม

Sprint นี้เพิ่ม API `GET /api/reports/sales` ที่กรองตามสาขา คืนชื่อ field แบบ camelCase และแปลงผลรวมเป็น number พร้อมหน้า report สำหรับเปิดดูยอดขาย รวมทั้งแก้ contract ของเมนูให้ backend กับหน้า POS ใช้ชื่อ field ตรงกัน ผู้ใช้ยืนยันว่าทดสอบครบทุก TC บนฐานข้อมูลทดสอบและผ่านทั้งหมด ส่วนการตรวจ API แบบอ่านข้อมูลและ error path ที่ไม่เขียนฐานข้อมูลก็ผ่านตามที่บันทึกไว้ข้างต้น

หมายเหตุ: TC-13-02 และ TC-13-04 อ้างอิงการยืนยันผลจากผู้ใช้ในแชต; ผู้ช่วยไม่ได้สังเกตการรัน E2E ที่สร้าง order โดยตรง
