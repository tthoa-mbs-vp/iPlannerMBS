# Phạm vi hai nhánh

Repo được tách theo mục tiêu sản phẩm. Cùng một cơ sở mã, hai phạm vi khác nhau.

| Nhánh | Hướng | Phạm vi |
|---|---|---|
| `main` | HR Platform đầy đủ | Toàn bộ tính năng HR + quản lý Kế hoạch/Nhiệm vụ |
| `plan-only` | Chỉ quản lý Kế hoạch/Nhiệm vụ | Lõi kế hoạch, nhiệm vụ, KPI, báo cáo, thông báo |

---

## `plan-only` — những gì đã gỡ

Gỡ khỏi frontend: route, menu, page, component, hook, test của 6 nhóm nghiệp vụ.
Gỡ khỏi backend: 3 hook tự chứa và 2 nhánh xử lý trong `all.pb.js`.

| Nhóm | Gỡ gì |
|---|---|
| Nhân sự (HR) | `/hr`, `/hr/:id`, `components/hr/`, `useEmployeeProfiles`, `useSalaryRecords`, `useQualifications`, `useWorkExperiences` |
| Chấm công | `/attendance`, `/m/attendance`, `components/attendance/`, `useAttendance`, khối check-in trong `MyDayPage` + `MDashboardPage` |
| Nghỉ phép | `/leave`, `components/leave/`, `useLeaveRequests`, thẻ "Ngày phép còn lại" trong `MProfilePage` |
| Trao đổi & Thảo luận | `/discussion`, `components/chat/ChannelChat.tsx`, `useChatMessages` |
| Bảng tin | `/announcements`, `/announcements/:id`, `/m/announcements`, `useAnnouncements` |
| Kiểm tra đột xuất | `/surprise-check`, tab "Kiểm tra hiện diện" trong Quản trị, `components/surprise/`, `PresenceManager`, `usePresence`, `useSurpriseCheck` |

Backend gỡ: `pb_hooks/leave.pb.js`, `pb_hooks/presence.pb.js`, `pb_hooks/surprisecheck.pb.js`
và nhánh `leave_requests` trong `all.pb.js`.

---

## Những thứ **cố ý giữ lại**

### 1. Collection không bị DROP

Schema giữ nguyên 27 collection. **Không có migration `DROP` trên nhánh này.**

Lý do: migration của PocketBase là **cumulative** — chúng chạy tuần tự và không có bước `down`.
Thêm migration xoá collection trên `plan-only` nghĩa là khi nhánh này được merge ngược lại
`main`, collection đó cũng biến mất khỏi HR Platform và dữ liệu mất không khôi phục được.

Hệ quả: các collection HR vẫn tồn tại trong database nhưng **không còn UI nào truy cập**.
Xoá thật phải là một quyết định riêng, sau khi backup — không thuộc phạm vi tách nhánh.

### 2. `notifications` — trục chung

Không gỡ hệ thống thông báo, vì nó phục vụ trực tiếp cho nhiệm vụ:

- `helpers._notifyTask()` tạo thông báo khi có đề xuất (`proposals`) trên nhiệm vụ
- `all.pb.js` dọn thông báo khi xoá nhiệm vụ
- `NotificationDropdown` (trong layout) đọc `useUnreadCount()` — không phải tính năng HR

Chỉ gỡ **Bảng tin** (`announcements`), là kênh thông báo một chiều độc lập.

### 3. Guard bảo vệ collection

`guards.pb.js` vẫn giữ các nhánh guard cho `attendance_logs`, `leave_requests`,
`chat_messages`, `announcements`. Các nhánh này trở thành **code chết** vì không còn UI gọi,
nhưng chúng **bảo vệ collection còn tồn tại trong DB**. Gỡ đi để mở đường ghi trực tiếp
vào collection mà không qua kiểm tra.

### 4. Hạ tầng dùng chung

- `components/chat/chatShared.tsx` + `useInfiniteChatScroll.ts` — dùng cho bình luận trên
  nhiệm vụ ở `PlanDetailPage` / `TaskDetailPage`.
- `helpers.js` (729 dòng) — vẫn giữ `hrScopeContext` / `hrCollections` vì `scope.pb.js`
  dùng chúng để giới hạn truy cập collection HR.

---

## Những việc **chưa** làm trên nhánh này

| Việc | Vì sao chưa làm |
|---|---|
| Xoá collection HR/attendance/... khỏi schema | Migration cumulative — xoá sẽ mất dữ liệu khi merge ngược. Cần quyết định riêng + backup. |
| Gỡ `LEAVE_*` / `ATTENDANCE_*` khỏi `utils/constants.ts` | Là code chết nhưng vô hại. Xoá kéo theo sửa `constants.test.ts` — việc riêng. |
| Gỡ các cờ `can_approve_leave` / `can_view_salary` | Cần migration sửa schema. |
| Gỡ nhánh guard chết trong `guards.pb.js` | Xem mục 3 ở trên. |

---

## Kiểm chứng

| Check | Kết quả |
|---|---|
| `npx tsc -b --noEmit` | 0 |
| `npm run lint` | 0 error, 1 warning có sẵn |
| `npx vitest run` | 476/476, 48 file |
| `npm run test:coverage` | 47.5% stmts — qua ngưỡng |
| `npm run build` | 0 |
| Backend 6 suite | exit 0 |
| `npx playwright test` | 11/11 |