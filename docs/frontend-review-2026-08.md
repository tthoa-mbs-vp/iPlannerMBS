# Rà soát chi tiết Frontend — Đồng bộ & Tối ưu (iPlannerMBS)

> Ngày: 2026-08-17 · Phạm vi: `web/src` (+ đối chiếu `shared/types.ts`, `web/scripts/pb-schema.json`, `backend/pb_hooks/*`)
> Phương pháp: đối chiếu tự động schema ↔ types ↔ select-lists ↔ constants, quét dead code, phân tích bundle Vite, rà React Query patterns. Mọi phát hiện kèm file/dòng dẫn chứng.
>
> **Vị trí:** tài liệu nội bộ, nằm trong `docs/` ở gốc repo — cố tình KHÔNG đặt trong `web/public/` để không bị đóng gói và phát hành công khai cùng bản build.

---

## 1. Tóm tắt điều hành

Frontend đã ở trạng thái tốt: **đồng bộ backend ổn định** (status/category/leave/attendance/notification constants khớp 100% select values của schema — đối chiếu tự động toàn bộ 27 collection), **bundle được code-split kỹ** (3 thư viện nặng xlsx/recharts/jspdf+html2canvas đều lazy-load theo trang, main entry chỉ ~65 kB gzip), **React Query nhất quán** (staleTime/retry/toast chuẩn hoá qua `useMutationWithToast`).

Không có lỗi P0. Có **2 lỗi đồng bộ nhỏ ảnh hưởng tính năng admin export/import** (A1, A2 — sửa 5 phút, an toàn) và một loạt cải thiện P2/quick-win.

---

## 2. Đồng bộ Frontend ↔ Backend (types / schema / hooks)

### 2.1 Lỗi thật (nên sửa)

**A1 — P1 · `COLLECTION_FIELDS.departments` lệch schema → export "Phòng ban" sai**
- `web/src/services/dataService.ts:5` khai `departments: ["id","name","description","created","updated"]`.
- Schema thật (`pb-schema.json`): `code, name, is_counted, leader_id` — **không có `description`**.
- Hậu quả: export JSON/Excel phòng ban ở trang Admin (`DataImportExport`) xuất cột chết `description` (luôn trống) và **thiếu `code`, `is_counted`, `leader_id`** — 3 cột chính của nghiệp vụ.
- Lưu ý: `DEPT_EXPORT_COLUMNS` trong `importExport.ts:174` đã đúng (code/name/is_counted) — chỉ riêng SELECT list của `dataService.ts` sai.

**A2 — P1 · `COLLECTION_PASTE_HINTS.tasks` còn "Trọng số (%)"**
- `web/src/services/dataService.ts:35` — hint nhập paste cho tasks vẫn chứa `"Trọng số (%)"`, sót sót từ đợt bỏ field `weight` (đã bỏ khỏi mọi nơi khác). Người dùng paste theo template cũ sẽ bị lệch cột.

### 2.2 Lệch nhẹ (bổ sung cho đủ)

**A3 — P2 · `AttendanceLog` type thiếu `ip_address`**
- Schema `attendance_logs` có `ip_address` (`pb-schema.json`), backend hook tự stamp IP thật của request khi tạo (`guards.pb.js:475-507`) nên luồng chấm công không bị ảnh hưởng — frontend cố tình bỏ qua và ghi IP vào `notes` (`useAttendance.ts:119`).
- Nên khai báo `ip_address?: string` trong `shared/types.ts` để đọc/export đầy đủ, và bỏ luôn việc nhồi IP vào notes cho sạch.

**A4 — P2 · SELECT list export còn thiếu field mới**
- `plans` thiếu `group_id`; `roles` thiếu `can_approve_leave`/`approval_scope`/`can_view_salary`; `comments` thiếu `files`/`quote_id`; `users` thiếu `group_ids`/`avatar`. Export admin chưa trọn vẹn so với schema (không gây lỗi, chỉ thiếu dữ liệu).

**A5 — P2 · `User.username` là field chết**
- `shared/types.ts:92` khai `username` nhưng PocketBase 0.39 dùng `email` làm định danh; toàn repo **không code nào đọc/ghi** `username` (đã grep). Nên xoá khỏi type.

**A6 — P2 · `recurring_type`/`recurring_value` chưa có UI**
- Schema `tasks.recurring_type` (select monthly/weekly) + `recurring_value` tồn tại, nhưng UI chỉ có checkbox `Lặp lại` (`TaskInlineForm.tsx:213`), không nơi nào set 2 field này (chỉ xuất hiện trong SELECT list của `dataService.ts`). Nếu backend chưa có logic sinh task lặp thì đây là field chết; nếu có thì UI thiếu cấu hình chu kỳ.

### 2.3 Đã đồng bộ TỐT (giữ nguyên)

- Status/category/priority/leave/attendance/notification/proposal **constants khớp 100% select values** schema (đối chiếu tự động: `TASK_STATUS_LABELS` 7 giá trị, `PLAN_STATUS_LABELS` 5, category 3, leave_type 5, period 3, notification type 6, proposal 2+4, attendance 2+4, channel 3, level/view_scope/approval_scope…).
- KPI đã là single-source (`_kpi-formula.cjs`), export PDF/Excel đã sạch weight.
- View-scope frontend khớp hook backend (fail-closed); `LogsPage` dùng đúng `SystemLog.ip_address`.

---

## 3. Tối ưu

### 3.1 Bundle & hiệu năng — đã tốt ✅

| Chunk | Kích thước | Ghi chú |
|---|---|---|
| `index` (entry) | 215 kB / **~65 kB gzip** | Hợp lý cho app 27 collection |
| `xlsx` (excel) | 500 kB | Lazy — chỉ load trang Import/Export ✅ |
| `recharts` (charts) | 421 kB | Lazy — chỉ load trang Báo cáo/KPI ✅ |
| `jspdf` + `html2canvas` | 592 kB | Lazy — chỉ khi export PDF ✅ |
| `query` (react-query) | 51 kB | Chunk dùng chung, ok |
| `icons` (lucide) | 43 kB | Dùng chung, ok |

- React Query: `staleTime` 10–120s theo tần suất đổi dữ liệu, `retry: 3` + backoff ở hooks, `refetchOnWindowFocus: false`, mutation toast chuẩn hoá — **không cần đổi**.

### 3.2 Điểm cải thiện

**B1 — ĐÃ XONG ✅ · Constants trùng lặp**
- Kiểm tra kỹ: `LEAVE_TYPE_LABELS`/`PERIOD_LABELS` chỉ defined 1 lần ở `utils/constants.ts` và import đúng ở mọi nơi. **Không có duplication thật.** Đã xác nhận tự động.

**B2 — ĐÃ XONG ✅ · `any` types: 83 → 53 (giảm 36%)**
- `dataService.ts`: 12 `Record<string, any>` → `PBRecord` alias (`Record<string, unknown>`) — 0 any.
- `importExport.ts`: 8 `Record<string, any>` + `any[][]` → `RowData` alias + `(string|number|boolean|null)[][]` — 0 any.
- `TaskDetailPage.tsx`: 7 `any` → proper types (`Task`, `UserType[]`, `React.ComponentType`, error handling) — 0 any.
- `PlansPage.tsx`: 6 `any` → proper types (`Plan | null`, `PlanStatus`, typed expand) — 1 remaining (task creation form cast).
- `KpiPage.tsx`: groupBy callbacks fixed (`String(row.executor)`).
- Đã typecheck ✅ · 89/89 test pass ✅ · Build clean ✅ · Lint clean ✅.

**B3 — P2 · PlansPage tự viết query thay vì dùng `useTasks`**
- `PlansPage.tsx:177` khai query `["tasks","personal",user?.id]` chỉ lấy `id,plan_id` để lọc view-scope — hợp lý về hiệu năng nhưng **trùng lặp logic** với `useTasks`. Đề xuất thêm param `fields` (hoặc option override) vào `useTasks` để tái dùng, tránh lệch filter mặc định (soft-delete) về sau.

**B4 — P2 · 8 trang mobile M\* song song desktop**
- `MAnnouncementsPage/MAttendancePage/MDashboardPage/MKpiPage/MLayout/MNotificationsPage/MProfilePage/MTasksPage` — duplication bảo trì lớn (vd MAttendancePage ↔ AttendancePage cùng logic chấm công). Đề xuất responsive thống nhất dần theo lộ trình, không làm một lần.

**B5 — ĐÃ XONG ✅ · PlansPage refactor**
- Tách `fmtPlanDate`/`yesNo`/`exportToPdfPlans`/`exportToPdfTasks` → `utils/pdfExports.ts` (~80 dòng).
- PlansPage: 852 → 776 dòng (giảm 9%). File mới tái dùng được ở nơi khác.
- Import cũ `exportHtmlToPdf` trực tiếp → import adapter `pdfExports.ts`.

**B6 — P3 · Không có dead code**
- Đã quét toàn bộ `src`: không file `.ts/.tsx` nào orphan (ngoài entry `main.tsx` và ambient `vite-env.d.ts`).

---

## 4. Đề xuất thứ tự xử lý

| Ưu tiên | Hạng mục | Trạng thái |
|---|---|---|
| ✅ Đã xong | B2 (giảm `any` 83→53) + B5 (tách PlansPage) | 2026-08-18 |
| ✅ Đã xong | A1 (departments export) + A2 (paste hint trọng số) | 2026-08-17 |
| Đợt 2 | A3 (ip_address type), A5 (bỏ username), B3 (useTasks fields param) | ~30 phút |
| Lộ trình | B4 (unify mobile pages), A6 (UI recurring) | theo roadmap |
