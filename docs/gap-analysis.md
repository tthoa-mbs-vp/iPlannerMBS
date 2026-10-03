# Báo cáo phân tích Gap — iPlanner vs Tài liệu tham chiếu

> ⚠️ **Tài liệu lỗi thời** — nhiều khẳng định ở đây đã được sửa trong code (thiếu eslint.config, thiếu typecheck, adminService chạy client-side, hardcode IP/SSID…). Xem [`review-2026-08.md`](./review-2026-08.md) §6 để biết trạng thái hiện tại. Giữ lại làm tham chiếu lịch sử.
>
> **Vị trí:** tài liệu nội bộ trong `docs/` — KHÔNG đặt trong `web/public/` để tránh phát hành công khai.

## 1. Dashboard (Trang chủ)

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Thống kê nhanh (tổng KH, NV, %HT) | ✅ Có | 6 card: Chưa làm, Đang làm, Hoàn thành, Trễ hạn + pending/nearDeadline |
| Biểu đồ trạng thái kế hoạch/nhiệm vụ | ✅ Có | Pie chart theo phòng ban (donut) |
| Kế hoạch gần đây (top 5) | ✅ Có | Slice(0,5) plans |
| Cảnh báo (sắp hạn, quá hạn, chờ duyệt) | ✅ Có | Warning panel |
| **"Xem tất cả" links → trang chi tiết** | ❌ **Thiếu** | Không có link dẫn đến PlansPage / TasksPage |
| Thống kê KPI tổng quan trên Dashboard | ✅ Có | KPI overview section cuối trang |
| **Biểu đồ đường (line chart) xu hướng theo thời gian** | ❌ **Thiếu** | Không có line chart trên Dashboard |

## 2. KPI Page (Điểm KPI & Đánh giá)

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Hiển thị điểm KPI theo người dùng | ✅ Có | Bảng KPI + biểu đồ cột |
| Biểu đồ phân bố xếp loại (Pie) | ✅ Có | Pie chart rating distribution |
| Bảng chi tiết điểm KPI | ✅ Có | Chi tiết base_score, difficulty, v.v. |
| Nút tính KPI cho NV chưa chấm | ✅ Có | Recalculate All |
| **Bộ lọc thời gian (tháng/quý/năm)** | ❌ **Thiếu** | Không có filter theo kỳ |
| **Xuất báo cáo KPI (Excel/PDF)** | ❌ **Thiếu** | Không có nút export trên KPI page |

## 3. Đề xuất (Proposals)

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Tạo đề xuất gia hạn | ✅ Có | ProposalSection: extension |
| Tạo đề xuất hủy bỏ | ✅ Có | ProposalSection: cancellation |
| Duyệt / Từ chối đề xuất | ✅ Có | Approve / Reject buttons |
| **Rút lại đề xuất (withdraw) khi đang chờ** | ❌ **Thiếu** | Không có nút "Rút lại" khi status pending |
| Thông báo khi có đề xuất mới | ✅ Có | `notifyProposalUpdate()` |
| **Xem lịch sử đề xuất đã duyệt/từ chối** | ✅ Có | `resolvedProposals` section |

## 4. Báo cáo & Thống kê (ReportsPage)

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Thống kê theo trạng thái nhiệm vụ | ✅ Có | Thanh progress + % |
| Thống kê theo phòng ban | ✅ Có | Thanh progress + % |
| Bộ lọc phòng ban + trạng thái | ✅ Có | 2 dropdown filters |
| Xuất Excel báo cáo | ✅ Có | Export filtered tasks |
| **Báo cáo kế hoạch** | ❌ **Thiếu** | Chỉ có task report, không có plan report |
| **Biểu đồ tròn (Pie chart)** | ❌ **Thiếu** | So với tài liệu gốc mô tả có Pie chart, chỉ có DepartmentStatsCharts riêng |
| **Báo cáo biểu đồ đường xu hướng theo thời gian** | ❌ **Thiếu** | Không có line chart |
| **In ấn / Xuất PDF** | ❌ **Thiếu** | Không có nút in hoặc export PDF |

## 5. Thông báo (Notifications)

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Dropdown thông báo trên Header | ✅ Có | NotificationDropdown |
| Hiển thị số lượng chưa đọc | ✅ Có | Badge trên bell icon |
| Đánh dấu đã đọc | ✅ Có | Mark as read / Mark all as read |
| **Trang thông báo riêng** | ❌ **Thiếu** | Chỉ có dropdown, không có `/notifications` page |
| **Lọc thông báo theo loại** | ❌ **Thiếu** | Trang riêng có filter theo type |
| **Đánh dấu tất cả là đã đọc** | ✅ Có | Nút "Đã đọc tất cả" |

## 6. Tính năng khác

| Chức năng trong tài liệu gốc | Trạng thái | Ghi chú |
|---|---|---|
| Phân trang danh sách (kế hoạch, nhiệm vụ) | ✅ Có | PocketBase pagination (tasks 50/page) |
| **Import dữ liệu từ Excel** | ✅ Có | ImportModal (plans + tasks) |
| **Export dữ liệu (Excel/CSV/JSON)** | ✅ Có | PlansPage + ReportsPage |
| **@mention trong comment** | ✅ Có | CommentSection có mention support |
| **Gantt chart trong PlanDetail** | ✅ Có | PlanDetailPage có gantt |
| **Responsive / Mobile** | ❌ **Thiếu** | Layout dạng desktop fixed (`h-[calc(100vh-7rem)]`) |
| **Hướng dẫn sử dụng (file riêng)** | ✅ Có | `huong-dan-su-dung.html` |

## Tổng hợp các Gap cần xử lý

### Critical (ảnh hưởng UX)
1. **Dashboard** — thiếu "Xem tất cả" link đến PlansPage/TasksPage
2. **Dashboard** — thiếu biểu đồ xu hướng line chart
3. **KpiPage** — thiếu bộ lọc thời gian (tháng/quý/năm)
4. **ProposalSection** — thiếu nút "Rút lại đề xuất" (withdraw)
5. **ReportsPage** — thiếu báo cáo kế hoạch (plan report)
6. **ReportsPage** — thiếu Pie chart
7. **Notifications** — thiếu trang thông báo riêng (`/notifications`)

### Medium
8. **Responsive** — layout hiện tại không hỗ trợ mobile
9. **KpiPage** — thiếu export báo cáo KPI
10. **ReportsPage** — thiếu line chart xu hướng, thiếu export PDF/in ấn
