# Siết phân quyền đọc dữ liệu — đã làm & phần còn lại

> Ngày: 2026-10-04 · Nhánh: `main` · Bắt nguồn: yêu cầu "tách frontend thành khối nghiệp vụ, không để người dùng khác vào được dữ liệu nhạy cảm (dữ liệu nhân sự)".
>
> **Vị trí:** tài liệu nội bộ trong `docs/` — cố tình KHÔNG đặt trong `web/public/` vì Vite copy toàn bộ `web/public/` vào `dist/` và phát hành công khai cùng bản build (xem `docs/README.md`).

---

## 0. Kết luận quan trọng nhất: tách frontend KHÔNG tạo ra bảo mật

Việc rà soát phát hiện điều này trước khi động vào code:

**Dữ liệu nhân sự nhạy cảm đã được chặn đúng ở tầng server từ trước.** Đọc collection rules trong `web/scripts/pb-schema.json`:

| Collection | listRule / viewRule |
|---|---|
| `salary_records` | `can_view_salary \|\| can_manage \|\| _superusers` |
| `qualifications` | `can_view_salary \|\| can_manage \|\| _superusers` |
| `work_experiences` | `can_view_salary \|\| can_manage \|\| _superusers` |
| `employee_profiles` | `id = user_id \|\| can_view_salary \|\| can_manage \|\| _superusers` |
| `leave_balances` | `id = user_id \|\| can_manage \|\| _superusers` |

Một nhân viên thường gõ thẳng `/api/collections/salary_records/records` cũng không lấy được gì. Ngoài ra còn 2 lớp nữa: `guards.pb.js` (field-level guard) và `scope.pb.js` (lọc theo `roles.view_scope`, fail-closed).

⇒ Yêu cầu "không cho người khác vào dữ liệu mật" **đã được đáp ứng ở đúng tầng đúng chỗ**. Tách frontend không thêm được gì cho phần này.

**Tách frontend chỉ có 3 lợi ích thật**, không phải bảo mật:
1. User thường không tải phần code của khối HR.
2. Ít route hơn để đoán.
3. Dễ audit, dễ onboarding.

Lưu ý thực tế: bundle hiện tại **đã** lazy 33 route, `manualChunks` tách vendor, và workbox loại `excel-*` / `charts-*` khỏi precache — nên code HR vốn đã **không** nằm trong main bundle. Lợi ích (1) vì vậy phần lớn đã đạt sẵn.

---

## 1. ĐÃ LÀM — S1: khóa collection `roles`

### Vấn đề đã tái hiện được

`roles` là **bảng tra cứu phân quyền**: mỗi record chứa toàn bộ bit quyền của cả tổ chức — `can_view_salary`, `can_manage`, `view_scope`, `approval_scope`. Rule cũ là `@request.auth.id != ""`.

Đo trên PocketBase 0.39.10 thật (fresh boot), **trước khi sửa**:

```
employee GET /api/collections/roles/records  -> HTTP 200, 3 records
  ADMIN: can_manage=true  can_view_salary=false
  HR:    can_manage=false can_view_salary=true
  EMP:   can_manage=false can_view_salary=false
```

Tức là **mọi tài khoản đã đăng nhập đều biết chính xác role nào được xem lương** — đúng thông tin cần loại bỏ.

### Thay đổi

Migration `backend/pb_migrations/1799300000_lock_roles_read_rules.js`:

| Rule | Sau |
|---|---|
| `listRule` | `@request.auth.role_id.can_manage = true \|\| @request.auth.collectionName = "_superusers"` |
| `viewRule` | `@request.auth.role_id.id = id \|\| @request.auth.role_id.can_manage = true \|\| @request.auth.collectionName = "_superusers"` |

Migration idempotent, có `down` chỉ đảo rule (không đụng dữ liệu), theo đúng khuôn của `1792200000_close_archived_read_rules.js`.

### ⚠️ Bẫy đã vấp — đáng đọc để tránh lặp lại

**`viewRule` KHÔNG thể siết thành `can_manage` thuần.**

Toàn bộ phân quyền client-side đến từ **một lệnh duy nhất**:

```ts
// web/src/stores/authStore.ts:24 và :59
pb.collection("users").getOne(ownId, { expand: "department_id,role_id,group_ids" })
```

rồi đọc `user.expand.role_id.can_view_salary` / `.can_manage` — ở `Sidebar.tsx`, `HRPage`, `HRDetailPage`, `LeavePage`, `AdminPage`, `DataPage`, `LogsPage`, `TrashPage`, `DiscussionPage`, `DashboardPage`, `mobile/*`.

PocketBase **có** áp `viewRule` của collection liên quan cho bản ghi được `expand`. Thiết kế đầu tiên (khóa cả `listRule` lẫn `viewRule`) đã được test bắt ngay:

```
FAILED: expand.role_id missing on own users record — frontend permissions would break
```

Nếu không có test này, hậu quả sẽ là: **mọi nhân viên mất sạch quyền trong UI, trong khi toàn bộ unit test phía web vẫn xanh** — kiểu hỏng im lặng nguy hiểm nhất.

Đó là lý do `viewRule` giữ nhánh `@request.auth.role_id.id = id`: mỗi người đọc được **đúng một** role là của chính mình (không nhạy cảm hơn thứ UI vốn phải biết), vẫn không đọc/list được role của người khác.

### Regression thứ 2 — đã xử lý

Khóa `roles` làm **dropdown "lọc theo chức vụ"** ở `HRPage.tsx:220` chết: HR officer có `can_view_salary` nhưng **không** có `can_manage`, vẫn vào được `/hr` (gate `isAdmin || canViewSalary`), nên mất danh sách role.

Đã thêm `backend/pb_hooks/role_directory.pb.js` → `GET /api/custom/role-directory`:
- Cho phép `can_view_salary` hoặc `can_manage` (+ superuser), `ensureEnabled` chặn tài khoản disabled (H3).
- Trả **chỉ** `id`, `code`, `name`, `level` — allow-list tường minh, không spread record, nên không có bit quyền nào lọt kể cả khi sau này thêm field mới.
- `HRPage` dùng endpoint này; `RoleManager` (chỉ admin) vẫn dùng `useRoles()`.

### Kiểm chứng

`backend/test/roles_rule.test.js` — 10 assertion, chạy PocketBase 0.39.10 thật, fresh boot từ migration chain:

| # | Khẳng định |
|---|---|
| R1 | Nhân viên vẫn đọc được cờ quyền của mình qua `users.expand.role_id` |
| R2 | HR officer vẫn đọc được `can_view_salary` qua expand |
| R3 | Nhân viên không lấy được bản ghi role nào khi list |
| R4 | HR officer không lấy được bản ghi role nào khi list |
| R5 | `can_manage` admin vẫn đọc đủ 3 role |
| R6 | Superuser vẫn đọc được |
| R7 | Đọc được role **của mình**, **không** đọc được role người khác (employee + HR) |
| R8 | HR đọc được directory, và **không field nào** ngoài `id/code/name/level` |
| R9 | Nhân viên thường bị chặn directory (403) |
| R10 | Admin + superuser đọc được directory |

Đã thêm file này vào `.github/workflows/ci.yml`.

**Lưu ý khi đọc test:** PocketBase trả **HTTP 200 + 0 bản ghi** (không phải 403) cho `listRule` so sánh qua relation. Assertion phải kiểm thuộc tính bảo mật thật — "không có record nào tới tay caller" + `totalItems` — chứ không kiểm status code, vì bản kiểm status sẽ **pass trên một 200 rò rỉ** và fail trên một 200 đã khóa đúng.

### File đã đổi

| File | Nội dung |
|---|---|
| `backend/pb_migrations/1799300000_lock_roles_read_rules.js` | mới — siết rule `roles` |
| `backend/pb_hooks/role_directory.pb.js` | mới — endpoint chỉ `id/code/name/level` |
| `backend/test/roles_rule.test.js` | mới — 10 assertion |
| `.github/workflows/ci.yml` | +1 dòng — chạy test mới trong CI |
| `web/scripts/pb-schema.json` | snapshot `roles` khớp migration |
| `DATA_DICTIONARY.md` | cập nhật rule + giải thích bẫy `expand` |
| `shared/types.ts` | +`RoleDirectoryItem` |
| `web/src/hooks/useDepartments.ts` | +`useRoleDirectory()` |
| `web/src/pages/HRPage.tsx` | dùng directory thay `useRoles()` |

**Kiểm chứng kỹ thuật:** `tsc -b` 0 · `vitest` 504/504 (53 file) · lint 0 error (3 warning có sẵn, đã đối chiếu bằng `git stash`) · build 0 · 7/7 suite backend exit 0 · migration idempotent (boot 2 lần) · rule trong `data.db` khớp tuyệt đối snapshot.

---

## 2. CÒN LẠI — `attendance_configs` (chưa làm, cần bạn quyết)

### Vấn đề

`listRule` = `@request.auth.id != ""` ⇒ **mọi nhân viên đọc được**: `wifi_ssid`, `wifi_bssid`, `allowed_ips` (danh sách IP văn phòng được phép chấm công), `work_start_time` / `work_end_time`.

Đáng chú ý nhất là **`allowed_ips`** — nó tiết lộ chính xác dải IP mạng công ty mà server dùng để kiểm tra check-in.

### Vì sao KHÔNG siết thẳng bằng rule

Không phải vì khó kỹ thuật, mà vì **sẽ làm hỏng UI ở 4 nơi**:

| Nơi dùng `useAttendanceConfigs()` | Vai trò |
|---|---|
| `pages/MyDayPage.tsx:59` | **mọi người dùng** — gửi `ssid` khi check-in |
| `pages/AttendancePage.tsx:32` | trang chấm công |
| `pages/mobile/MDashboardPage.tsx:47` | dashboard mobile |
| `pages/mobile/MAttendancePage.tsx:19` | chấm công mobile |
| `components/attendance/WifiConfigModal.tsx:29` | modal cấu hình (admin) |

### Phát hiện then chốt khi khảo sát: **server đã tự validate, client không cần config để check-in**

`backend/pb_hooks/guards.pb.js:455–500`:
- Tự đọc `attendance_configs` (`is_active=true`), tự tính `status` (đi trễ/thiếu) từ `work_start_time` + `late_tolerance_minutes`.
- Tự kiểm tra mạng bằng **IP server quan sát được** (`e.realIP()`) so với `allowed_ips`, fallback về dải private.
- Có comment tường minh: *"a browser cannot read the real WiFi SSID"* và `ip_address` do client gửi **không bao giờ được tin**.

Grep toàn bộ `pb_hooks` cho `ssid` / `wifi_ssid`: **không có hook nào đọc hoặc ghi** — SSID client gửi lên là thông tin trang trí, không ảnh hưởng quyết định nào.

⇒ **Khóa `attendance_configs` sẽ KHÔNG hỏng chấm công.** Cái mất đi chỉ là phần *hiển thị*: tên văn phòng / tên WiFi trên UI.

### Ba phương án

| | Cách làm | Đánh giá |
|---|---|---|
| **A1** ⭐ | Siết `listRule` = `can_manage`; thêm endpoint chỉ trả `office_name` + `work_start_time` / `work_end_time` (giống hệt `role-directory` vừa làm) cho mọi user hiển thị; **giấu `wifi_ssid`/`wifi_bssid`/`allowed_ips` khỏi endpoint công khai**. Đóng lỗ hổng IP, giữ UI. | Rủi ro thấp, đúng pattern đã dùng. Cần 1 endpoint + sửa 4 chỗ hook. |
| **A2** | Siết `listRule` = `can_manage` luôn, không có endpoint công khai. UI chỉ còn giờ làm/ca làm việc nếu đọc được config… | Phải xem lại: nếu UI cần `work_start_time` thì phải nhét vào chỗ khác (settings), tốn công hơn A1. |
| **A3** | Bỏ `wifi_ssid` / `wifi_bssid` khỏi bản ghi trả về bằng cách đánh dấu field `hidden` (PocketBase 0.23+). | `hidden` chặn **mọi** user thường, kể cả admin không phải superuser ⇒ `WifiConfigModal` sẽ hỏng. **Không khuyến nghị.** |

**Khuyến nghị: A1.** Cần xác nhận thêm một câu hỏi nghiệp vụ: *có muốn nhân viên thấy tên WiFi văn phòng không?* Nếu không quan trọng thì A2 gọn hơn.

---

## 3. CÒN LẠI — `users` (chưa làm, rủi ro thấp hơn nhiều)

### Vấn đề

`listRule` = `@request.auth.id != ""` ⇒ mọi nhân viên đọc được `email`, `avatar`, **`disabled`**, `department_id`, `role_id`, `group_ids`, `reminder_days` của **toàn bộ công ty**.

Trường đáng bàn: `disabled` (ai đang bị vô hiệu hóa) và `email` (danh bạ công ty). Không có mật khẩu, không có `identity_card`/`tax_code`/`bank_account` — những cái đó nằm ở `employee_profiles` và đã chặn.

### Vì sao KHÔNG siết thẳng

14 call site (`grep 'collection("users")'`), trong đó **không phải** call site nào là admin-only:

| Call site | Ai dùng |
|---|---|
| `hooks/useDepartments.ts:137` (`useUsers`) | **mọi người** — dùng để tìm tên người trong task/plan |
| `components/admin/UserManager.tsx` (5 chỗ) | admin |
| `stores/authStore.ts:22,24,59` | **mọi người** — chính là nguồn quyền (xem S1) |
| `pages/HRDetailPage.tsx:101,152,171` | HR/admin |
| `components/surprise/SurpriseCheckAdmin.tsx:45` | admin |

Khóa `listRule` ⇒ `@mention`, bộ chọn executor/supervisor, và mọi màn hình tìm người đều hỏng.

### Phương án

| | Cách làm | Đánh giá |
|---|---|---|
| **B1** ⭐ | Tạo collection projection ví dụ `user_directory` (chỉ `id`, `name`, `avatar`, `department_id`) + endpoint giống `role-directory`. Chuyển @mention và bộ chọn người sang nguồn này. Đóng được lỗ hổng email/`disabled`. | Đúng, nhưng **1 collection mới + migration + sửa nhiều chỗ**. Cần cân nhắc collection mới ảnh hưởng gì tới `scope.pb.js`/guard. |
| **B2** | Giữ `listRule` mở nhưng dùng cơ chế `fields` của PocketBase để chỉ yêu cầu `id,name,avatar,department_id`. | **Không có tác dụng** — `fields` chỉ lọc output, không chặn đọc chỗ khác. Không phải giải pháp. |
| **B3** | Chấp nhận hiện trạng: danh bạ email nội bộ không nhạy cảm, còn `disabled` thì chấp nhận lộ. | **Khuyến nghị nếu muốn dừng.** Chi phí 0, rủi ro thấp. |

**Khuyến nghị: B3 trừ khi bạn thực sự cần giấu `disabled`.** Đây là thứ ít giá trị bảo mật nhất trong ba collection, tốn công nhiều nhất.

---

## 4. ĐÃ LÀM — hệ thống 3 app sau một cổng vào chung

Yêu cầu gốc không phải “tách file cho gọn” mà là: **một cổng vào chung, mỗi người tùy nghiệp vụ sẽ đến app tương ứng; các app giao diện giống nhau nhưng khác tên và menu chỉ thể hiện đúng nghiệp vụ app đó.**

Đã chọn phương án **(a)** — một SPA, một sổ app. Nhắc lại: làm vậy **không** tăng bảo mật (xem §0), nó là vấn đề trải nghiệm và tổ chức.

### Ba app

| App | Ai vào được | Trang chủ | Menu |
|---|---|---|---|
| **Kế hoạch** | ai cũng (kể cả NV) | `/dashboard` | Tổng quan · Quản lý Công việc · Trao đổi |
| **Nhân sự** | `can_view_salary` hoặc `can_manage` | `/hr` | Quản lý Nhân sự |
| **Quản trị** | `can_manage` | `/admin` | Quản trị hệ thống |

Mọi app đều có mục “Hướng dẫn” chung — đó là phần **giao diện dùng chung**.

### Cách hiện thực

| File | Vai trò |
|---|---|
| `web/src/config/apps.ts` | **Sổ app** — nguồn sự thật duy nhất: tên, tagline, menu, điều kiện `canAccess`, tiền tố route. Cùng logic thuần: `defaultAppIdFor`, `appsForRole`, `resolveAppId`, `appOwnsPath`. |
| `web/src/hooks/useActiveApp.ts` | App đang mở, dùng **store dùng chung** (`useSyncExternalStore`). |
| `web/src/components/layout/AppBoundary.tsx` | URL thuộc app khác thì đưa về trang chủ app đang mở. |
| `Sidebar.tsx` | Hiện tên app, ô chuyển app, menu theo app. |
| `LoginPage.tsx` | Đăng nhập xong thì mở thẳng app của nghiệp vụ. |

### Bẫy đã vấp — đáng đọc để tránh lặp lại

**Không được để mỗi component tự `useState(readStored)`.** Bản đầu tiên làm vậy: `Sidebar` đổi app thì `AppBoundary` (đã mount từ trước) vẫn giữ giá trị cũ và ép URL về app cũ — chuyển app trông như **không có tác dụng**. Vì vậy trạng thái phải nằm ở module và mọi nơi subscribe chung. Lỗi này chỉ lộ ra khi chạy E2E, unit test không bắt được.

### Ranh giới: AppBoundary KHÔNG phải lớp bảo mật

Gõ tay URL hoặc đổi `localStorage` không vượt được collection rules của PocketBase hay `guards.pb.js`/`scope.pb.js`. Lớp này chỉ giữ UI không bị lệch — mở app Nhân sự thì không nên thấy khung của app Kế hoạch. Dữ liệu vẫn được chặn ở tầng API như §1.

### Đã kiểm chứng

`web/src/test/apps.test.ts` (15 test, hàm thuần) · `tsc -b` 0 · `vitest` 519/519 · lint 0 error · build 0 · **Playwright 13/13** (11 test cũ + 2 test `/hr` mới).

### Hạn chế đã biết

- **Layout mobile `/m/*` chưa đổi** — vẫn 6 tab như cũ, không giới hạn theo app.
- **`/profile` vẫn trỏ tới `/hr/:id`** (`ProfileRedirect.tsx`). Với nhân viên thường ở app Kế hoạch, URL này không thuộc app nên `AppBoundary` đưa về `/dashboard` — hành vi chấp nhận được nhưng chưa chuẩn hoá.
- **Đăng nhập luôn mở app mặc định theo role**, không nhớ app người dùng chọn lần trước (dù `useActiveApp` có ưu tiên lựa chọn đã lưu). Chọn để landing luôn có thể đoán trước.
- **Header vẫn hiện `APP_NAME` ("iPlanner")** khi trang không có tiêu đề — tên tổ chức, khác tên app trên sidebar.

---

## 5. Bảng tổng hợp — quyết định còn lại

| # | Hạng mục | Trạng thái | Khuyến nghị | Công sức |
|---|---|---|---|---|
| S1 | `roles` | ✅ **Xong, đã push** | — | — |
| S4 | Hệ thống 3 app sau cổng vào chung | ✅ **Xong** (xem §4) | — | — |
| S2 | `attendance_configs` (`allowed_ips`) | ⏸ Chờ quyết | **A1** | ~1 endpoint + 4 hook |
| S3 | `users` (`disabled`, `email`) | ⏸ Chờ quyết | **B3** (chấp nhận) | 0 nếu B3 · lớn nếu B1 |

### Câu hỏi còn cần bạn trả lời trước khi làm tiếp

1. **S2:** nhân viên có cần thấy tên văn phòng / tên WiFi trên màn hình chấm công không? (quyết định A1 hay A2)
2. **S3:** có thực sự cần giấu cờ `disabled` và email của đồng nghiệp không? (quyết định B1 hay B3)
