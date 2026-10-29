# WK14 รายงานตรวจสอบคุณภาพและความปลอดภัย

โครงงาน: Cafe POS & Smart Inventory System (กลุ่ม 19)  
วันที่ตรวจ: 29/10/2569  
ขอบเขต: routes, controllers, models และหน้า POS/report ที่มีใน repo ณ วันที่ตรวจ

## สรุปผล

ตรวจครบ 8 endpoint ที่ผูกอยู่ใน routes พบการขาด transaction ในการสร้างออเดอร์, รายการ order ที่ไม่ได้กรองสาขา, การตรวจชนิดข้อมูล ID ที่ไม่ครบ และใช้ `PUT` กับพฤติกรรม partial update แก้แล้วใน Sprint นี้ เพิ่มระบบ Employee ID + password, session cookie และผูก branch scope กับ employee ที่ยืนยันตัวตนแล้ว

## 1. Endpoint Inventory และ Checklist

สัญลักษณ์: ✓ ผ่านหลังแก้, △ ผ่านบางส่วน/มีข้อจำกัด, — ไม่เกี่ยวข้องกับ checklist ข้อนั้น

| Endpoint | Validation | IDOR/Branch scope | Parameterized SQL | Error handling | Race condition |
|---|---:|---:|---:|---:|---:|
| `POST /api/orders` | ✓ ตรวจ body, id, method และรายการสินค้า | ✓ session ผูก employee/branch และตรวจ employeeId ตรง session | ✓ | ✓ | ✓ transaction + row lock |
| `GET /api/orders?branchId` | ✓ ตรวจ branchId | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `GET /api/menu?branchId` | ✓ ตรวจ branchId เป็นจำนวนเต็มบวก | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `GET /api/menu/:id?branchId` | ✓ ตรวจ menuId/branchId | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `POST /api/menu` | ✓ ตรวจ branch/category/name/price/stock | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `PATCH /api/menu/:id` | ✓ ตรวจ id, branch และ fields | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `DELETE /api/menu/:id?branchId` | ✓ ตรวจ id/branch | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |
| `GET /api/reports/sales?branchId` | ✓ ตรวจ branchId เป็นจำนวนเต็มบวก | ✓ ต้อง login และ branchId ต้องตรง session | ✓ | ✓ | — |

## 2. จุดเสี่ยงและการแก้ไข

### Q-01 Race condition และ partial order — High — แก้แล้ว

ก่อนแก้ `createOrder` อ่านสต็อก, เพิ่ม order/item และตัดสต็อกด้วย query แยกกันโดยไม่มี transaction หากสอง request อ่านสต็อก 1 พร้อมกัน ทั้งคู่มีโอกาสผ่านการตรวจแล้วตัดสต็อกจนค่าติดลบ หรือเกิด order ค้างหาก query กลางทางล้มเหลว ตาราง `menu_item`, `orders` และ `order_item` ในฐานข้อมูลที่ตรวจเป็น InnoDB รองรับ row lock และ transaction

**การแก้:** ย้าย flow ไปอยู่ใน transaction เดียว ล็อก menu rows ด้วย `SELECT ... FOR UPDATE` ในลำดับ menu_id ที่แน่นอน ตรวจ stock ภายใต้ lock แล้ว insert order/items และตัดสต็อกด้วยเงื่อนไข `stock_quantity >= quantity` ก่อน commit หาก query ใดล้มเหลวให้ rollback ทั้งชุด

### Q-02 Order list เปิดเผยข้อมูลข้ามสาขา — High — แก้แล้ว

ก่อนแก้ `GET /api/orders` คืน order ทุกสาขาโดยไม่มี filter ตอนนี้ API ต้องผ่าน session และตรวจ branchId จาก request ให้ตรงกับ branch ใน session ก่อน query

### Q-03 Branch ID เป็นข้อมูลที่ caller เลือกเอง — High — แก้แล้วบางส่วน

Menu CRUD, order และ report ต้องผ่าน session ที่ค้นจาก token hash ในฐานข้อมูล; API เปรียบเทียบ branchId กับ branch ของ employee จาก session และปฏิเสธสาขาอื่นด้วย 403 ออเดอร์ยังตรวจ employeeId ให้ตรงกับ session ด้วย ขอบเขตที่ยังต้องพิจารณาก่อน production คือ role ยังไม่แยกสิทธิ์ cashier/manager และต้องตั้ง password ให้ employee ที่จะใช้งาน

### Q-04 Validation ของ ID และ body ไม่ครบ — Medium — แก้แล้ว

ก่อนแก้ controller บางจุดตรวจเพียงว่ามีค่า ไม่ได้ตรวจว่า id เป็นจำนวนเต็มบวก และ `createOrder` ไม่ตรวจ employee/branch ให้สัมพันธ์กัน เพิ่ม validation ของ body, id ให้อยู่ในช่วง INT บวก, price ให้ตรงช่วง DECIMAL ใน schema, stock/quantity และ employee-to-branch ก่อนเขียนข้อมูล

### Q-05 PUT ทำ partial update — Low — แก้แล้ว

เดิม `PUT /api/menu/:id` รองรับส่งบาง field ผ่าน `COALESCE` ซึ่งเป็น partial update จึงเปลี่ยน route เป็น `PATCH /api/menu/:id` ให้ตรงกับความหมายของ HTTP method

### Q-06 SQL Injection — ผ่าน

Query ใน models ใช้ placeholder `?` และส่งค่าผ่าน parameter array รวมถึง filter `branchId`, `menuId`, `employeeId` และข้อมูลค้นหา ไม่มีการต่อค่าจาก request เข้า SQL string

### Q-07 Error handling — ปรับปรุงแล้วบางส่วน

Controller ครอบ database operations ด้วย `try/catch` และคืนข้อความทั่วไป ไม่ส่ง SQL error เต็มให้ client เพิ่มการแปลง foreign-key conflict ตอนลบเมนูที่มี order item อ้างอิงเป็น 409 Conflict; error อื่นยังคืนข้อความทั่วไป

## 3. ผลตรวจหลังแก้

- `node --check` กับ routes/controllers/models/frontend ผ่าน และ `git diff --check` ผ่าน
- API smoke check บนฐานข้อมูลปัจจุบัน: menu list 200; branch/menu ID ไม่ถูกต้อง 400/404; GET orders ไม่มี branchId ตอบ 400 และระบุ branchId ตอบ 200; PUT เดิมตอบ 404 และ PATCH ที่ไม่มี field ตอบ 400
- ส่ง order ด้วย employee ที่ไม่อยู่สาขาและส่งจำนวนเกิน stock ได้ 400; ตรวจซ้ำแล้ว stock และจำนวน order ไม่เปลี่ยน
- ส่ง price เกินช่วง DECIMAL และ branchId เกินช่วง INT ได้ 400
- ตรวจ code path ของ transaction, scoped queries, validation และ parameterized queries จาก source
- เพิ่ม `npm run test:wk14` ซึ่งหยุดทำงานหาก `DB_NAME` ไม่ใช่ `cafe_pos_wk13_test`; สคริปต์สร้าง fixture ชั่วคราว 2 สาขาและล้าง order/menu/employee/branch/auth ที่สร้างหลังจบ
- ผล `npm run test:wk14` หลังเพิ่ม authentication บน `cafe_pos_wk13_test`: PASS — ผ่าน 9 checks ได้แก่ concurrency/stock, session และ logout, unauthenticated 401, cross-branch 403, employee mismatch, แยกรายงานและ order ตามสาขา, menu lookup และ delete ที่ติด FK ตอบ 409; fixture ถูกล้างใน `finally`
- ไม่ได้ยิงออเดอร์ทดสอบบนฐานข้อมูลใช้งานที่กำหนดใน `.env`; API smoke checks บนฐานนั้นเป็นกรณีปฏิเสธ request และตรวจยืนยันว่า order/stock ไม่เปลี่ยน

## 4. ความเสี่ยงคงเหลือและลำดับงานต่อ

| ลำดับ | ความเสี่ยง | ระดับ | แผน |
|---|---|---|---|
| 1 | ยังไม่มี role-based authorization แยก cashier/manager และยังไม่ตั้งรหัสผ่านพนักงาน production | Medium | กำหนดสิทธิ์ตาม role และตั้งรหัสผ่านเฉพาะบัญชีที่จะใช้งานก่อน deploy |

## 5. API Contract ที่เปลี่ยน

- `GET /api/orders?branchId=1` ต้องส่ง branchId และคืน order ของสาขานั้นเท่านั้น
- partial menu update ใช้ `PATCH /api/menu/:id` แทน `PUT`
- `POST /api/orders` ปฏิเสธ employeeId ที่ไม่ได้อยู่ใน branchId ที่ส่งมา
- API เมนู, order และรายงานต้องมี session; branch scope มาจาก employee ใน session และข้ามสาขาตอบ 403
- `POST /api/auth/login`, `GET /api/auth/session`, `POST /api/auth/logout` ใช้สำหรับ login, ตรวจ session และออกจากระบบ
