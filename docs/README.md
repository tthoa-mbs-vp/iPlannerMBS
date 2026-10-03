# Tài liệu nội bộ — iPlannerMBS

Thư mục này chứa tài liệu kỹ thuật **không dành cho người dùng cuối**.

## ⚠️ Quy tắc đặt tài liệu

Tài liệu review/gap-analysis **không được** đặt trong `web/public/`.

Lý do: Vite copy **toàn bộ** `web/public/` vào `dist/` khi build, và mọi file tĩnh trong `dist/` đều được phát hành công khai. Các file `.md` nằm ở đó sẽ chứa chi tiết về kiến trúc nội bộ, điểm yếu đã biết và các phát hiện rà soát — những thứ không nên công khai.

Phân biệt rõ hai loại:

| Loại | Vị trí đúng | Phát hành? |
|---|---|---|
| Tài liệu người dùng (hướng dẫn, mô tả tính năng) | `web/public/` | ✅ Có — ví dụ `huong-dan-su-dung.html` |
| Tài liệu kỹ thuật nội bộ (review, gap, proposal) | `docs/` (thư mục này) | ❌ Không |
| Tài liệu kiến trúc đặt ở gốc repo | `ARCHITECTURE.md`, `DATA_DICTIONARY.md`, `PLAN.md` | ❌ Không |

## Danh mục

### Tài liệu tham chiếu (cập cao)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — kiến trúc hệ thống, luồng dữ liệu, quyết định thiết kế.
- [`../DATA_DICTIONARY.md`](../DATA_DICTIONARY.md) — định nghĩa collection, trường, ý nghĩa nghiệp vụ.
- [`../PLAN.md`](../PLAN.md) — kế hoạch phát triển.
- [`../backend/CHANGELOG.md`](../backend/CHANGELOG.md) — lịch sử thay đổi backend.

### Rà soát & phân tích
- [`review-2026-08.md`](./review-2026-08.md) — **rà soát toàn diện** (backend + frontend + deploy). Đây là tài liệu chính, thay thế hai file bên dưới.
- [`frontend-review-2026-08.md`](./frontend-review-2026-08.md) — rà soát chi tiết frontend: schema ↔ types ↔ select-lists ↔ constants, bundle, React Query.

### Lưu trữ (đã lỗi thời, giữ làm tham chiếu lịch sử)
- [`gap-analysis.md`](./gap-analysis.md) — ⚠️ nhiều phát hiện đã được sửa. Xem `review-2026-08.md` §6.
- [`optimization-proposals.md`](./optimization-proposals.md) — ⚠️ phần lớn đề xuất đã triển khai. Xem `review-2026-08.md`.
