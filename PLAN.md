# KẾ HOẠCH XÂY DỰNG MBS PLANNER

## 1. CẤU TRÚC PROJECT (MONOREPO)

```
MBS-Planner/
├── backend/                    # PocketBase (custom Go hooks + JS)
│   ├── pb_hooks/              # JS hooks cho business logic
│   │   ├── tasks.pb.js        # Task hooks (progress, KPI, recurring)
│   │   ├── plans.pb.js        # Plan hooks (auto-calc progress)
│   │   ├── proposals.pb.js    # Proposal hooks (notifications)
│   │   ├── notifications.pb.js
│   │   └── cron.pb.js         # Daily deadline checker
│   ├── pb_migrations/         # Auto-generated migrations
│   ├── pb_data/               # SQLite DB, storage (gitignored)
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── web/                        # React (Vite + TypeScript)
│   ├── src/
│   │   ├── api/               # PocketBase SDK client instance
│   │   ├── stores/            # Zustand stores (auth, ui)
│   │   ├── hooks/             # React Query hooks (todos, plans, etc.)
│   │   ├── components/
│   │   │   ├── ui/            # Shared: Button, Modal, Table, Badge, ...
│   │   │   ├── layout/        # Sidebar, Header, ProtectedRoute
│   │   │   ├── plans/         # PlanList, PlanDetail, GanttChart
│   │   │   ├── tasks/         # TaskList, TaskForm, TaskDetail
│   │   │   ├── comments/      # CommentList, MentionTextarea
│   │   │   ├── proposals/     # ProposalTimeline, ApproveButton
│   │   │   ├── excel/         # ImportModal, ExportButton
│   │   │   ├── kpi/           # KpiTable, KpiChart
│   │   │   ├── admin/         # DeptManager, RoleManager, UserManager
│   │   │   └── reports/       # ReportFilters, ReportChart
│   │   ├── pages/             # Route pages
│   │   ├── types/             # TypeScript interfaces
│   │   └── utils/             # Helpers (dates, validators)
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── mobile/                     # React Native (Expo)
│   ├── src/
│   │   ├── api/               # PocketBase SDK (shared logic)
│   │   ├── stores/            # Zustand
│   │   ├── screens/           # Login, Dashboard, Tasks, Profile
│   │   ├── components/        # TaskCard, SwipeAction, CommentBubble
│   │   ├── navigation/        # Stack + Tab navigators
│   │   └── utils/
│   ├── app.json
│   └── package.json
│
└── shared/                     # Shared types & validators
    ├── types.ts
    └── validators.ts
```

---

## 2. KẾ HOẠCH TRIỂN KHAI CHI TIẾT

### GIAI ĐOẠN 1: NỀN TẢNG & CORE (Tuần 1-3)

#### Tuần 1: Setup & Database

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 1 | Tạo monorepo, setup backend PocketBase (docker-compose) | Container PB chạy port 8090 |
| 2 | Tạo collections qua PB Admin UI: `departments`, `roles`, `users` (mở rộng auth) | 3 collections + API rules cơ bản |
| 3 | Tạo collections nghiệp vụ: `plans`, `tasks`, `proposals` | Schema hoàn chỉnh |
| 4 | Tạo collections hệ thống: `comments`, `notifications`, `system_logs`, `kpi_scores` | Full 10 collections |
| 5 | Setup React (Vite + TS + Tailwind + Zustand + React Query) | Web app chạy dev |
| 6 | Setup React Native (Expo) với React Navigation | Mobile app chạy trên simulator |
| 7 | Tích hợp PocketBase SDK cho cả Web & Mobile | Gọi API thành công từ 2 clients |

#### Tuần 2: Auth & Role-based Access

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 8 | Login page (Web) + Remember me (localStorage JWT) | Form login + auto-redirect |
| 9 | Auth store (Zustand) + ProtectedRoute component | Flow login/logout hoàn chỉnh |
| 10 | Layout: Sidebar (collapsible) + Header (avatar, notification bell) | UI Layout |
| 11 | Role-based routing (ẩn menu Admin nếu `can_manage=false`) | Permission gating |
| 12 | API Rules trên PocketBase cho từng collection (view_scope) | Backend security |
| 13 | CRUD Departments (Admin page) | Form + Table |
| 14 | CRUD Roles (Admin page) + gắn permission bits | Form + Table |
| 15 | CRUD Users (Admin page) + chọn Dept/Role từ dropdown | Form + Table + upload avatar |

#### Tuần 3: Dashboard & Core UI

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 16 | Dashboard page: 4 summary cards (React Query fetch) | Cards động |
| 17 | Dashboard alerts: pending approval, overdue (đỏ), sắp hạn (vàng) | Alert list |
| 18 | Doughnut chart theo phòng ban (recharts) | Chart |
| 19 | Plans List page: table + filter (status, dept, date range) | Data table |
| 20 | Plan Detail page: Tab 1 (info + task list) | Detail page |
| 21 | Task List page: table + filter (status, executor, plan) | Data table |
| 22 | Task Detail modal/page: full info + status | Detail view |

---

### GIAI ĐOẠN 2: NGHIỆP VỤ KẾ HOẠCH & NHIỆM VỤ (Tuần 4-6)

#### Tuần 4: CRUD Plans & Tasks

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 23 | Plan Create/Edit form (leader, dept, partner depts, dates) | Form validation |
| 24 | Task Create/Edit form (executor, supervisor, collaborators) | Form + multi-select users |
| 25 | Status transition logic (frontend validate + backend hook) | State machine |
| 26 | Plan progress auto-calc hook (PB: calculate plan.progress) | Backend hook |
| 27 | Plan.status auto-update hook (in_progress khi có task đầu tiên) | Backend hook |
| 28 | TaskDetail: cập nhật progress %, chuyển status | UI + API |

#### Tuần 5: Proposals (Extension/Cancellation)

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 29 | Proposal Create form (reason, new_deadline nếu extension) | Form + validation |
| 30 | Proposal Timeline UI (step-progress: Pending -> Approved/Rejected) | Timeline component |
| 31 | Approve/Reject flow (Supervisor buttons) + Withdraw (Requester) | Action buttons |
| 32 | Backend proposal hooks: validate + tạo notification | Backend logic |
| 33 | Gán proposal vào task detail UI (tab hoặc section) | Integration |
| 34 | System Logs: ghi log mọi action create/update/delete | system_logs collection |

#### Tuần 6: Import/Export Excel

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 35 | Excel Import: parse file với xlsx, validate dữ liệu dòng | Parse + validate |
| 36 | Import Modal: preview lỗi inline, progress bar nếu > 1000 dòng | UI modal |
| 37 | Import background job: chunking + async processing | UX không block |
| 38 | Export Excel: plans + tasks theo filter hiện tại | Export button |
| 39 | Export Reports: dashboard data ra Excel/CSV | Report export |

---

### GIAI ĐOẠN 3: NÂNG CAO & KPI (Tuần 7-8)

#### Tuần 7: Gantt Chart & Comments

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 40 | Plan Detail Tab 2: Gantt Chart (dùng frappe-gantt wrapper React) | Gantt render |
| 41 | Gantt: trục tung tasks, trục hoành timeline, vạch "Hôm nay" đỏ | Timeline |
| 42 | Gantt: thanh task 2 màu (mờ/vân chéo phần đã qua, màu gốc phần còn lại) | Thanh task |
| 43 | Gantt: click task -> navigate TaskDetail | Interaction |
| 44 | @Mention Component: Textarea + fetch users + dropdown | Mention UI |
| 45 | Comment List: chat-like UI, hiển thị @mention dạng chip | Comment UI |
| 46 | File upload trong comment (20MB, accept png/jpg/gif/pdf/doc/xlsx) | Upload + preview |

#### Tuần 8: KPI & Reports

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 47 | Backend: KPI calculation hook (khi task -> completed) | Công thức KPI |
| 48 | Backend: lưu kpi_scores records | Lưu lịch sử |
| 49 | KPI page: bảng điểm, filter user/dept | KPI table |
| 50 | KPI chart: biểu đồ cột/line theo thời gian | Chart |
| 51 | Reports page: bộ lọc nâng cao (dept, date range, status) | Filter form |
| 52 | Reports: biểu đồ thống kê + export CSV/Excel | Report page |
| 53 | Nhiệm vụ định kỳ (recurring): backend tạo task con `i/n` | Recurring logic |

---

### GIAI ĐOẠN 4: MOBILE APP (Tuần 9-11)

#### Tuần 9: Mobile Core

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 54 | Login screen (Expo) + Auth store + token persistence | Auth flow |
| 55 | Bottom Tab Navigator (Dashboard, Tasks, Notifications, Profile) | Navigation |
| 56 | Dashboard screen: summary cards + alerts | Mobile dashboard |
| 57 | Task List screen: filter tabs (Đang làm, Chờ duyệt, Trễ hạn) | Task list |
| 58 | Task Detail screen: info, description, file preview (PDF/Image) | Detail screen |

#### Tuần 10: Mobile Features

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 59 | Swipe action: update task status (hoàn thành, chuyển trạng thái) | Swipe UI |
| 60 | Comment screen: chat-like UI + @mention + upload từ camera/gallery | Mobile comment |
| 61 | Approval screen: proposal list + Swipe Right (Duyệt) / Left (Từ chối) | Approval UI |
| 62 | Push Notifications: FCM (Android) + APNs (iOS) | Push setup |
| 63 | Notification list: realtime subscribe (PocketBase SDK) | Notification screen |
| 64 | Badge số thông báo chưa đọc (tab icon) | Badge |

#### Tuần 11: Mobile Offline & Polish

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 65 | AsyncStorage cache: danh sách task khi offline | Offline cache |
| 66 | Sync khi có mạng: conflict resolution (server wins) | Sync logic |
| 67 | Profile screen: đổi avatar, đổi mật khẩu, cài đặt reminder_days | Profile |
| 68 | Mobile polish: loading skeletons, error screens, empty states | UX hoàn thiện |

---

### GIAI ĐOẠN 5: UAT & DEPLOY (Tuần 12)

| Ngày | Công việc | Đầu ra |
|------|-----------|--------|
| 69 | Kiểm thử phân quyền: 3 roles (Admin, Manager, Employee) | Test cases pass |
| 70 | Kiểm thử Import Excel: dữ liệu lỗi, thiếu trường | Error handling OK |
| 71 | Stress test Gantt: 500 tasks render mượt | Performance OK |
| 72 | System Logs page: filter popup (action, user, date) | Admin logs |
| 73 | Backup/Restore JSON: export all data, import upsert | Admin tools |
| 74 | Deploy PocketBase: Docker lên VPS (reverse proxy + SSL) | Backend live |
| 75 | Deploy Web: Vercel/Netlify (env vars: PB_URL) | Web live |
| 76 | Deploy Mobile: EAS Build -> Store (Android/iOS) | App live |

---

## 3. KIẾN TRÚC CHI TIẾT

### 3.1. Backend Architecture (PocketBase)

```
PocketBase Server (port 8090)
├── Collections (10 tables)
├── Auth (JWT, OAuth2)
├── Realtime API (WebSocket)
├── File Storage (pb_data/storage)
├── Cron Jobs (hàng ngày 00:00)
│   ├── deadline_warning.js
│   └── overdue_checker.js
└── Hooks (pb_hooks/)
    ├── tasks.pb.js
    │   ├── onTaskCreate: update plan.status = in_progress
    │   ├── onTaskCreate: handle recurring (tạo subtask i/n)
    │   ├── onTaskUpdate: validate status transition
    │   └── onTaskUpdateStatus(completed): trigger KPI calc
    ├── plans.pb.js
    │   └── onPlanUpdate: recalc progress from tasks
    ├── proposals.pb.js
    │   └── onProposalUpdate: notify supervisor/requester
    └── notifications.pb.js
        └── onNotificationCreate: send push (FCM/APNs)
```

### 3.2. Frontend Component Tree (Web)

```
App
├── AuthProvider
│   └── Router
│       ├── /login -> LoginPage
│       └── ProtectedRoute
│           └── Layout (Sidebar + Header + Outlet)
│               ├── /dashboard -> DashboardPage
│               │   ├── SummaryCards (4 cards)
│               │   ├── AlertList
│               │   └── DoughnutChart
│               ├── /plans -> PlansPage
│               │   ├── PlanList (table + filter)
│               │   ├── PlanCreateForm (modal)
│               │   └── PlanDetail (tabs)
│               │       ├── TabInfo (description + tasks)
│               │       └── TabGantt (GanttChart)
│               ├── /tasks -> TasksPage
│               │   ├── TaskList (table + filter)
│               │   ├── TaskCreateForm (modal)
│               │   └── TaskDetail (modal)
│               │       ├── TaskInfo
│               │       ├── ProposalTimeline
│               │       └── CommentList + MentionTextarea
│               ├── /reports -> ReportsPage
│               ├── /kpi -> KpiPage
│               └── /admin -> AdminPage
│                   ├── DeptManager
│                   ├── RoleManager
│                   ├── UserManager
│                   ├── SystemLogs
│                   └── BackupRestore
```

### 3.3. Mobile Navigation (React Navigation)

```
RootNavigator (Stack)
├── LoginScreen
└── MainTabs (BottomTabNavigator)
    ├── DashboardTab (Stack)
    │   └── DashboardScreen
    ├── TasksTab (Stack)
    │   ├── TaskListScreen
    │   ├── TaskDetailScreen
    │   └── CommentScreen
    ├── ApprovalsTab (Stack)
    │   ├── ApprovalListScreen
    │   └── ApprovalDetailScreen
    ├── NotificationsTab (Stack)
    │   └── NotificationListScreen
    └── ProfileTab (Stack)
        └── ProfileScreen
```

---

## 4. POCKETBASE API REFERENCES

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/collections/users/records` | Danh sách users (dùng cho @mention) |
| GET | `/api/collections/departments/records` | Danh sách phòng ban |
| GET | `/api/collections/plans/records` | Kế hoạch (filter, sort, expand) |
| POST | `/api/collections/plans/records` | Tạo kế hoạch |
| PATCH | `/api/collections/plans/records/:id` | Sửa kế hoạch |
| GET | `/api/collections/tasks/records` | Nhiệm vụ (filter, expand plan/dept/users) |
| POST | `/api/collections/tasks/records` | Tạo nhiệm vụ |
| PATCH | `/api/collections/tasks/records/:id` | Cập nhật trạng thái |
| POST | `/api/collections/proposals/records` | Tạo đề xuất |
| PATCH | `/api/collections/proposals/records/:id` | Duyệt/từ chối đề xuất |
| GET | `/api/collections/comments/records` | Bình luận theo task_id |
| POST | `/api/collections/comments/records` | Thêm bình luận |
| POST | `/api/admins/backup` | Backup admin |
| POST | `/api/admins/restore` | Restore admin |

---

## 5. CÔNG NGHỆ & THƯ VIỆN

### Web (React)
- **Build**: Vite 6 + TypeScript 5
- **CSS**: TailwindCSS 4
- **State**: Zustand 5
- **Server State**: @tanstack/react-query 5
- **Client**: PocketBase JS SDK
- **Chart**: recharts
- **Gantt**: frappe-gantt (wrapper React component)
- **Excel**: xlsx (SheetJS)
- **Rich Text**: @tiptap/react + @tiptap/extension-mention
- **Form**: react-hook-form + zod
- **Date**: date-fns

### Mobile (React Native)
- **Framework**: Expo SDK 52
- **Navigation**: @react-navigation/native 7
- **State**: zustand
- **Client**: pocketbase-react-native (hoặc fetch wrapper)
- **Push**: expo-notifications (FCM/APNs)
- **File Picker**: expo-image-picker + expo-file-system
- **Offline**: @react-native-async-storage/async-storage
- **Gesture**: react-native-gesture-handler (swipe actions)

---

## 6. RỦI RO & GIẢI PHÁP

| Rủi ro | Giải pháp |
|--------|-----------|
| PB hooks bằng JS giới hạn performance | Tách logic nặng (KPI calc, recurring) ra cron job |
| frappe-gantt không React-friendly | Tạo wrapper component bằng useRef + useEffect |
| Mobile push notifications phức tạp | Dùng expo-notifications + backend gửi push qua Expo Push API |
| Import Excel > 1000 dòng chậm | Xử lý chunk trên Web Worker + progress bar |
| Offline sync conflict | Server wins (luôn lấy data server khi có network) |
| Scale SQLite khi data lớn | Sau này migrate lên PostgreSQL + PB custom build |

---

## 7. CHECKLIST HOÀN THÀNH

### Backend
- [ ] 10 collections được tạo và cấu hình API rules
- [ ] Auth hoạt động (login, logout, refresh token, remember me)
- [ ] Role-based view_scope hoạt động
- [ ] Task hooks: progress, plan status, recurring
- [ ] Proposal hooks: validate, notification
- [ ] KPI calculation hook (khi task completed)
- [ ] Cron job: deadline warning, overdue check
- [ ] System logs cho mọi CRUD action
- [ ] Backup/Restore JSON (admin only)

### Web
- [ ] Login + ProtectedRoute + Role-based routing
- [ ] Dashboard (cards, alerts, chart)
- [ ] Plans CRUD + List + Detail + Gantt
- [ ] Tasks CRUD + List + Detail + Status transitions
- [ ] Proposals (create, approve, reject, withdraw) + Timeline UI
- [ ] Comments + @Mention + File upload
- [ ] Excel Import/Export
- [ ] KPI page (table + chart)
- [ ] Reports (filter + chart + export)
- [ ] Admin: Dept, Role, User management + System Logs + Backup/Restore

### Mobile
- [ ] Login + Auth persistence
- [ ] Dashboard + Task List + Task Detail
- [ ] Swipe actions (status update)
- [ ] Comments + camera/gallery upload
- [ ] Approval screen (Swipe Duyệt/Từ chối)
- [ ] Push Notifications + Badge
- [ ] Offline cache + sync
- [ ] Profile screen
