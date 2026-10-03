# iPlannerMBS

Ứng dụng quản lý kế hoạch & nhiệm vụ cho MBS — theo dõi tiến độ plan, giao việc theo executor/supervisor, chấm điểm KPI, chấm công với kiểm tra IP/SSID, quản lý nghỉ phép và nhân sự.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · TanStack Query · Zustand · React Router 7 · PocketBase 0.39.10

---

## Yêu cầu

| Công cụ | Phiên bản | Bắt buộc |
|---|---|---|
| Node.js | 22+ | ✅ |
| npm | 10+ | ✅ |
| Docker **hoặc** Podman | — | Chỉ khi chạy bằng container |
| PocketBase | 0.39.10 | Tự tải, không cần cài sẵn |

Không cần database riêng — PocketBase dùng SQLite.

---

## Chạy ứng dụng

### Cách nhanh nhất (không cần Docker)

```bash
cd web
npm ci
npm run dev:all
```

`dev:all` gọi `scripts/dev.sh`, tự tải PocketBase 0.39.10 về `backend/bin/` nếu thiếu, khởi động server nếu chưa healthy, chờ `/api/health` rồi mới chạy Vite.

- Web: <http://localhost:5173> · API: <http://localhost:8090>

Chạy riêng từng phần nếu cần:

```bash
sh scripts/dev.sh          # từ gốc repo — PocketBase + Vite
cd web && npm run dev      # chỉ Vite (cần PocketBase chạy sẵn ở :8090)
```

### Bằng container

```bash
make up        # docker compose up -d --build
make logs      # docker compose logs -f
make down      # docker compose down
```

Podman: `make podman-up` / `make podman-logs` / `make podman-down`.
Thêm `PB_HOOKS_WATCH=true` để container tự reload `pb_hooks/` khi sửa.

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_PB_UPSTREAM` | `http://localhost:8090` | Địa chỉ backend mà Vite dev proxy `/api` tới |
| `VITE_USE_POLLING` | `false` | Bật polling cho watcher (cần trên Docker Desktop/WSL) |
| `PB_TRUST_PROXY` | `false` | **Chỉ** bật khi sau reverse proxy mà proxy ghi đè `X-Forwarded-For` **và** port 8090 không reachable trực tiếp — nếu không, ai cũng giả mạo được IP check-in |
| `TZ` | `Asia/Ho_Chi_Minh` | Server đóng dấu giờ check-in/out; sai TZ làm hỏng logic đi trễ |
| `PB_HOOKS_WATCH` | `false` | Container có reload hooks khi sửa |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | — | Superuser cho script seed/sync (bắt buộc) |
| `PB_SEED_PASSWORD` | `Test@123456` (chỉ localhost) | Mật khẩu các tài khoản demo |
| `PB_ALLOW_REMOTE_SEED` | `0` | Đặt `1` để cho phép seed vào server không phải localhost |

Các biến trên đều có giá trị mặc định hợp lý — chạy được ngay mà không cần file env. Nếu cần chỉnh, tạo `web/.env.local`. File `.env` và `.env.local` **không** được commit.

---

## Tài khoản demo

Sau khi seed dữ liệu:

| Email | Mật khẩu lấy từ | Vai trò |
|---|---|---|
| `admin@mbs.com` | `PB_ADMIN_PASSWORD` | ADMIN — trưởng phòng PIT |
| `truongphong@mbs.com` | `PB_SEED_PASSWORD` | TRUONGPHONG — phòng PKHTC |
| `nhanvien@mbs.com` | `PB_SEED_PASSWORD` | NV |

> ⚠️ Tài khoản demo chỉ dành cho **môi trường phát triển**. Mặc định `PB_SEED_PASSWORD` là `Test@123456`, nhưng giá trị này **chỉ được dùng khi `PB_URL` trỏ về localhost** — chạy seed trên server thật mà không đặt `PB_SEED_PASSWORD` sẽ bị chặn, và phải bật `PB_ALLOW_REMOTE_SEED=1` mới chạy được.

```bash
cd web
node scripts/seed-data.mjs                 # tài khoản demo + collection nền
node scripts/seed-plans.mjs                 # 5 plan / 14 task / 5 KPI
node scripts/seed-plans.mjs --clean         # xoá dữ liệu plan đã seed rồi seed lại
```

Script cần PocketBase đang chạy ở `http://localhost:8090` và biết thông tin superuser qua `PB_URL` / biến môi trường tương ứng (xem `web/scripts/creds.mjs`).

---

## Kiểm thử & chất lượng

```bash
cd web
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (react-hooks + TanStack Query)
npm run test         # vitest — 395 test / 44 file
npm run test:coverage # vitest + coverage, fail nếu dưới ngưỡng trong vite.config.ts
npm run build        # tsc -b && vite build
npm run ci           # typecheck + lint + test + build
```

ESLint chạy `@typescript-eslint/no-explicit-any` ở mức `error` — codebase hiện **không còn `any` nào**. Đừng thêm lại.

CI (`.github/workflows/ci.yml`) chạy web + backend trên mỗi push/PR, kèm:
- cổng coverage (ngưỡng khai báo trong `web/vite.config.ts`),
- cổng `npm audit` với danh sách allow cho dependency của toolchain dev,
- syntax check + unit + integration test cho backend.

Test backend (không cần server):

```bash
node backend/test/helpers_logic.test.js
node backend/test/guards_logic.test.js
node backend/test/guard_proxy.test.js
```

Test tích hợp — **boot PocketBase sạch**, migration chain tự dựng lại toàn bộ schema nên không cần `pb_data`:

```bash
node backend/test/harden_integration.test.js
node backend/test/scope_integration.test.js
node backend/test/audit_integration.test.js
```

Có sẵn trong `make pb-test` / `make pb-test-container`. CI (`.github/workflows/ci.yml`) chạy đủ web + backend trên mỗi push và pull request.

---

## Cấu trúc repo

```
├── ARCHITECTURE.md          Kiến trúc hệ thống & quyết định thiết kế
├── DATA_DICTIONARY.md       Định nghĩa collection / trường / nghiệp vụ
├── backend/
│   ├── pb_hooks/            Logic nghiệp vụ chạy server-side (authz, KPI, chấm công…)
│   ├── pb_migrations/       90 migration — tự bootstrap 27 collection
│   └── test/                Unit + integration test
├── web/
│   ├── src/pages/           Route-level, lazy-loaded
│   ├── src/components/      Chia theo domain
│   ├── src/hooks/           React Query hooks
│   ├── src/utils/           Hàm thuần, dễ test
│   └── scripts/             Seed + đồng bộ schema
├── shared/                  Kiểu dữ liệu dùng chung web ↔ backend
├── scripts/                 dev.sh, watch-pb.js
└── docs/                    Tài liệu kỹ thuật nội bộ (KHÔNG phát hành)
```

### Vài điều đáng biết

- **Migrations tự bootstrap.** `backend/pb_migrations/` gồm 9 migration `created_*` sinh từ schema thật, cộng các migration `updated_*` idempotent. Clone repo rồi boot là có schema, không cần import file.
- **Công thức KPI có một nguồn duy nhất:** `backend/pb_hooks/_kpi-formula.cjs`. Backend `require()` thẳng; web nạp qua `?raw` + sandbox CJS. Sửa công thức ở đúng một chỗ.
- **Phân quyền hai lớp.** Collection rules của PocketBase chặn *ai* được sửa record; `backend/pb_hooks/guards.pb.js` chặn *được sửa những gì* (role, verified, disabled…), cộng chống tự đánh giá task và chống backdate `completed_at`.
- **`web/public/` chỉ dành cho tài liệu người dùng.** File trong đó được phát hành công khai cùng bản build — tài liệu kỹ thuật nội bộ phải để ở `docs/`. Xem [`docs/README.md`](./docs/README.md).

---

## Tài liệu

| Muốn đọc | Mở |
|---|---|
| Hướng dẫn sử dụng | `web/public/huong-dan-su-dung.html` (phát hành cùng app) |
| Kiến trúc | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Từ điển dữ liệu | [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) |
| Lịch sử thay đổi backend | [`backend/CHANGELOG.md`](./backend/CHANGELOG.md) |
| Tài liệu kỹ thuật nội bộ | [`docs/`](./docs/) |
