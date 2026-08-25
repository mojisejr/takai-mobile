# TAKAI Chemical V2 — Expo Go Operator Card

Status: `passed_operator` · `Expo Go Device Eye Closed`

คุณนนท์ทดลองใช้งานแล้วและยืนยันให้ปิด device eye สำหรับ Chemical V2
history/capture flow เมื่อ 2026-08-25 14:40 +0700. ไม่ได้บันทึกรุ่นอุปกรณ์หรือ
เวอร์ชัน Expo Go จึงไม่อ้างรายละเอียดระดับนั้น และยังไม่ปิด Native Eye.

1. Run `npm run start`, scan with Expo Go Android on the same network, and
   record the device/client/open result before testing data that matters.
2. In `จัดการ > คลังยา / เคมี`, open an empty or archived item. Confirm the
   last-used date and use history remain readable; it must not be selectable
   for a new task.
3. Open the saved task detail. Confirm `น้ำที่ใช้ร่วมกัน`, saved reference
   dose, and calculated dose are readable after catalog edit/status changes.
4. In `บันทึกงาน`, test an ordinary free-form task with no chemical, then a
   mix with selected/quick-added chemical and one water amount. Check Thai
   labels, touch targets, scrolling, and keyboard avoidance.

Record a future repair or follow-up in `operator-evidence.json`. Expo Go Device
Eye is closed for this observed flow; Native Eye remains Pending until an
internal build is installed and observed separately.
