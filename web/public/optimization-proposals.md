# Đề xuất tối ưu ứng dụng — iPlanner (chưa thực hiện)

---

## Mức độ ưu tiên: 🔴 CRITICAL

### 1. Silent error handling (frontend)
- **7+ instance** `catch { /* ignore */ }` — ProposalSection (create/approve/reject), CommentSection (create/update/delete), KpiPage (recalculate), InteractiveGanttChart, KanbanBoard
- **Instance** `catch {}` không có log — ProposalSection, DataImportExport
- → Gây khó debug, user không biết action thất bại

### 2. Race conditions
- **useCalculateAndSaveKpi**: read-then-create pattern → duplicate KPI scores nếu click nhanh
- **useUpsertEmployeeProfile**: read-then-create/update → duplicate profiles
- **verifyUser (adminService.ts)**: module-level `oldToken`/`oldModel` bị ghi đè nếu gọi concurrent
- **PlansPage**: click plan nhanh → nhiều query chồng chéo, kết quả cuối có thể sai filter
- **PlansPage**: debounced search + useTasks → có thể fetch với filter cũ

### 3. Inconsistent error handling pattern
- `useNotifications.ts`: `useMarkAsRead`, `useMarkAllAsRead` dùng raw `useMutation` (không toast)
- `useComments.ts`: `useCreateComment`, `useUpdateComment`, `useDeleteComment` dùng raw `useMutation`
- `useDepartments.ts`: `useDeleteDepartment`, `useDeleteRole` không có `successMessage`
- → Đa số mutation khác dùng `useMutationWithToast`, các exception này gây UX không nhất quán

### 4. Query key collision
- `useSystemLogs.ts`: `["system_logs", page]` không include `perPage` → 2 component dùng page khác nhau nhưng share cache
- `useNotifications.ts`: invalidation `["notifications", userId]` không chạm tới `["notifications", "unread-count", userId]` → unread count không refresh

### 5. Missing backend API rules
- Hầu hết collections có `listRule: ""` (cho phép tất cả authenticated users list)
- `createRule: ""`, `updateRule: ""` trên plans/tasks/notifications — bất kỳ ai authenticated cũng có thể CRUD
- Thiếu rule kiểm tra `@request.auth.id` phù hợp với role/permissions

### 6. PlansPage & TasksPage không có error state
- `PlansPage.tsx`: không hiển thị error khi fetch plans/tasks thất bại → infinite spinner hoặc trang trắng

---

## Mức độ ưu tiên: 🟠 HIGH

### 7. Memoization & performance
- **DashboardPage**: 7 useMemo riêng lẻ đều iterate tasks/plans → có thể gộp thành 1 pass
- **KpiPage**: chartData, ratingDist, trendData recompute riêng rẽ trên mỗi lần userKpi thay đổi
- **ReportsPage**: taskPieData, planPieData, taskTrendData, planTrendData iterate full dataset 4 lần
- **WorkloadHeatmap**: fetch ALL tasks (không filter) + iterate users × tasks × weeks (120k iterations)

### 8. Missing retry / staleTime inconsistency
- `useTasks.ts`, `usePlans.ts`, `useLeaveRequests.ts`, `useAttendance.ts`: **không có staleTime** (default 0) → refetch mỗi lần mount/focus
- `useLeaveRequests`, `useLeaveBalance`, `useAttendanceLogs`, `useAttendanceConfigs`, `useEmployeeProfile`, `useUnreadCount`, `useNotifications`: **không có retry** (không nhất quán với các hook khác)

### 9. Accessibility gaps
- ~20+ icon-only buttons thiếu `aria-label` (tab buttons, period type buttons, filter buttons)
- Task table rows (`PlansPage.tsx`, `HRPage.tsx`) dùng `onClick` nhưng không `tabIndex`/`onKeyDown`
- Modals (`Modal.tsx`, `ImportModal.tsx`, `WifiConfigModal.tsx`) không focus trap
- KanbanBoard, InteractiveGanttChart mouse-only (Drag & Drop) — không keyboard alternative

### 10. Mobile responsive
- `DashboardPage`: `grid grid-cols-6` → trên mobile 375px mỗi card ~55px, overflow
- `PlansPage`: `flex h-[calc(100vh-7rem)]` two-panel — không stack trên mobile
- `PlanDetailPage`, `TaskDetailPage`: `w-1/3` + `flex-1` → không responsive
- `KpiPage`: `grid grid-cols-4` → nên `grid-cols-2 sm:grid-cols-4`
- `ReportsPage`: `grid grid-cols-2` → nên `grid-cols-1 lg:grid-cols-2`

### 11. Code duplication
- `formatDate()`, `contractLabels`, `contractTypes` định nghĩa lại ở 4+ file (HRPage, HRDetailPage, ProfilePage, EmployeeDetailModal)
- `TASK_STATUS_HEX` redefined trong DashboardPage và ReportsPage (đã có trong constants)
- Inline export dropdown trong PlansPage (XLSX/CSV/JSON) lặp lại 2 lần, trong khi đã có `ExportButton` shared component
- Stat card grid pattern lặp lại ở DashboardPage, KpiPage, ReportsPage, HRPage

### 12. Test flakiness & coverage
- `Date.now()` trong kpi.test.ts, KpiPage.test.tsx, useComments.test.tsx → flaky near midnight
- Shared mutable mock state trong authStore.test.ts, systemLogService.test.ts
- **67% pages chưa có test** (12/18), **100% components chưa có test** (28/28)
- **88% hooks chưa có test** (15/17)

### 13. Missing ESLint & tooling
- Không có `eslint.config.*` → `eslint .` không thực sự lint với rules
- Thiếu `eslint-plugin-react-hooks` → không catch violations
- Thiếu `@tanstack/eslint-plugin-query` → query key stability
- Thiếu `@testing-library/user-event` → test không simulate realistic interaction

---

## Mức độ ưu tiên: 🟡 MEDIUM

### 14. Bundle optimization
- Thiếu `zustand` và `pocketbase` trong `manualChunks` → lẫn vào main bundle
- Thiếu `date-fns` chunk
- Không verify tree-shaking của `lucide-react` (import selective?)

### 15. Auth & security
- `useRoles` không check `pb.authStore.isValid` trước khi gọi API
- `AttendancePage.tsx`: hardcoded IP `"192.168.1.105"` và SSID `"MBS-OFFICE-5G"` — demo data trong production
- Module-level state trong `adminService.ts` (oldToken/oldModel) race condition với concurrent calls

### 16. Form validation gaps
- TaskFormModal: thiếu email format, collaborator uniqueness validation
- PlanFormModal: thiếu hostDeptId không được empty, partnerDeptIds không chứa hostDeptId
- LeavePage: luôn hardcode `total_days = 1`, không check leave balance trước submit
- EmployeeDetailModal: không có error display khi save thất bại

### 17. Hardcoded text
- `"MBS Planner"` hardcoded ở 3 file (LoginPage, Siderbar, Header)
- Tất cả status labels, nav labels, date locale (`"vi-VN"`) đều hardcoded
- Không extract được app name, tagline, version ra config

### 18. Build & CI scripts
- Thiếu `"typecheck": "tsc --noEmit"`
- Thiếu `"lint:fix"`, `"test:coverage"`, `"ci"` script
- `VITE_USE_POLLING` chưa được type trong `vite-env.d.ts`

### 19. UI inconsistency
- Primary buttons: 4+ màu sắc khác nhau (indigo-600, blue-600, emerald-600, gradient)
- `btn` utility class dùng trong admin component nhưng không dùng trong pages
- Card wrappers: lẫn lộn `rounded-xl` vs `rounded-2xl`, `shadow-sm` vs `shadow-md`
- Icon containers: 3 patterns khác nhau (gradient p-2, flex h-8 w-8, bg-color-100 p-2.5)

---

## Mức độ ưu tiên: 🟢 LOW

### 20. Lazy loading tiềm năng
- Có thể dùng `React.lazy()` cho: KanbanBoard, CalendarView, InteractiveGanttChart, các modals (PlanForm, TaskForm, Import), DepartmentManager, RoleManager, UserManager

### 21. Docker & deployment
- Chưa có Dockerfile cho web (chỉ có docker-compose với node:24-alpine chạy `npm run dev`)
- Chưa có `.dockerignore`
- Nên dùng multi-stage build + nginx cho production

### 22. Test setup improvements
- `setup.ts` chỉ import jest-dom — không có global mocks, MSW server, cleanup utilities
- Nên thêm MSW (Mock Service Worker) thay vì mock module-level `vi.mock("../api/client")`
