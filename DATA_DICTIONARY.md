# Từ điển dữ liệu — MBS Planner (iPlanner)

> Danh mục **27 collection nghiệp vụ** của PocketBase: từng field, kiểu dữ liệu và quy tắc truy cập (API rules).
> Schema lấy từ cơ sở dữ liệu thực tế **sau khi chạy toàn bộ `pb_migrations/`** (boot `pocketbase serve`), đồng bộ với `ARCHITECTURE.md`.
> Các collection hệ thống nội bộ của PB (`_superusers`, `_externalAuths`, `_otps`, `_mfas`, `_authOrigins`) không liệt kê.

---

## Quy ước

- **API rules** — biểu thức PB đánh giá trên từng request (superuser luôn vượt qua). `null` = chặn mọi request thường.
- **Relation (một)** = trả về id; **Relation (nhiều)** = mảng id. `cascadeDelete` = xóa bản ghi con khi bản ghi cha bị xóa.
- **Autodate**: `created`/`updated` do PB tự quản lý.
- **Ghi chú** ở mỗi collection nói rõ tầng guard/scope/hook bổ sung ngoài rule — đọc kèm `ARCHITECTURE.md` §6 (3 lớp bảo mật).

## Tổng quan

| Collection | Loại | #Field | Ghi (create/update/delete) | Ghi chú chính |
|---|---|---|---|---|
| **announcements** | base | 9 | create · update · delete | Đọc: mọi user đã đăng nhập |
| **archived_comments** | base | 5 | create · update · delete | Như archived_tasks. |
| **archived_plans** | base | 15 | create · update · delete | Như archived_tasks. |
| **archived_tasks** | base | 16 | create · update · delete | Snapshot archive |
| **attendance_configs** | base | 9 | create · update · delete | `allowed_ips` là field JSON — đọc qua H.jsonArr (PB trả raw []byte) |
| **attendance_logs** | base | 12 | create · update · delete | Guard create (`guards.pb.js`): ép user_id = actor, **check_in = giờ server (M1)**, chặn check-in trùng ngày, status tính server-side từ attendance_configs, kiểm tra IP (allowed_ips hoặc private range) → ghi ip_address thật |
| **chat_messages** | base | 9 | create · update · delete | Read theo kênh: org = mọi người; department = cùng dept; group = chung group_ids |
| **comments** | base | 8 | create · update · delete | create/update/delete owner-bound (user_id) |
| **departments** | base | 7 | create · update · delete | Đọc mọi user; ghi can_manage. |
| **employee_profiles** | base | 13 | create · update · delete | owner tự xem/sửa; HR có can_view_salary xem; ghi chỉ can_manage. |
| **kpi_scores** | base | 10 | ✗create · ✗update · ✗delete | **Server-computed**: mọi quyền ghi đóng (create/update/delete = null), chỉ hook server tạo |
| **leave_balances** | base | 8 | create · update · delete | Server tính: recomputeLeaveBalance (mặc định 12 ngày/năm) |
| **leave_requests** | base | 13 | create · update · delete | Rule duyệt theo approval_scope (all/department/group) + total_days < 3 (dept/group) |
| **notifications** | base | 7 | create · update · ✗delete | Owner-bound |
| **plans** | base | 16 | create · update · delete | `scope.pb.js` enforce view_scope (all/department/group/personal) khi list/view — fail-closed nếu user không có role hoặc role không load được (H2) |
| **presence_campaigns** | base | 9 | ✗create · ✗update · ✗delete | Custom endpoint start/stop ghi; manager đọc. |
| **presence_check_logs** | base | 8 | ✗create · ✗update · ✗delete | Manager-only đọc; custom endpoint run-check ghi. |
| **presence_heartbeats** | base | 6 | ✗create · ✗update · ✗delete | Chỉ custom endpoint /presence/heartbeat ghi (createRule null) |
| **professional_groups** | base | 7 | create · update · delete | Đọc mọi user; ghi can_manage |
| **proposals** | base | 10 | create · update · delete | createRule owner-bound (requester_id) |
| **qualifications** | base | 8 | create · update · delete | Như salary_records (HR-view), ghi can_manage. |
| **roles** | base | 19 | create · update · delete | Chứa cờ quyền (can_*) + view_scope + approval_scope — nguồn quyết định rule/guard/scope |
| **salary_records** | base | 6 | create · update · delete | `hr.pb.js` enforce view_scope theo can_view_salary (department/all). |
| **system_logs** | base | 7 | ✗create · ✗update · ✗delete | Audit server-side: create/update/delete đều null — chỉ server `$app.save()` ghi (chống giả mạo log) |
| **tasks** | base | 26 | create · update · delete | Guard `guards.pb.js` (update): executor chỉ được đổi status (in_progress/pending_approval); supervisor chỉ đổi status/rating/rated_*/completed_at/description/name; cấm tự rate (A10); **completed_at do server stamp = now() khi chuyển sang completed (M8)**, không sửa được khi đã completed, xóa khi rời completed |
| **users** | auth | 15 | create · update · delete | Auth collection |
| **work_experiences** | base | 7 | create · update · delete | Như qualifications. |

---

## announcements — base

**Mô tả:** Đọc: mọi user đã đăng nhập. Ghi: can_manage. Hook afterCreate: fan-out notification cho mọi user active.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != "" || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id != "" || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `title` | Text | ✅ | max 200 ký tự |
| `content` | Editor (rich text) | ✅ | — |
| `author_id` | Relation | ✅ | → users; một |
| `is_pinned` | Bool | — | — |
| `is_active` | Bool | — | — |
| `published_at` | Date | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## archived_comments — base

**Mô tả:** Như archived_tasks.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `archived_task_id` | Relation | ✅ | → archived_tasks; một |
| `user_id` | Relation | — | → users; một |
| `content` | Text | ✅ | — |
| `original_created` | Date | — | — |

---

## archived_plans — base

**Mô tả:** Như archived_tasks.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `original_id` | Text | ✅ | — |
| `name` | Text | ✅ | — |
| `description` | Text | — | — |
| `leader_id` | Relation | — | → users; một |
| `host_dept_id` | Relation | — | → departments; một |
| `partner_dept_ids` | Relation | — | → departments; nhiều (max 50) |
| `group_id` | Relation | — | → professional_groups; một |
| `start_date` | Date | — | — |
| `end_date` | Date | — | — |
| `status` | Select | ✅ | giá trị: not_started · in_progress · completed · paused · cancelled |
| `is_sudden` | Bool | — | — |
| `is_high_impact` | Bool | — | — |
| `progress` | Number | — | — |
| `archived_at` | Date | ✅ | — |

---

## archived_tasks — base

**Mô tả:** Snapshot archive. Đọc mở (đã đăng nhập); ghi manager-only (cron/restore).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `original_id` | Text | ✅ | — |
| `name` | Text | ✅ | — |
| `description` | Text | — | — |
| `plan_id` | Relation | — | → plans; một |
| `executor_id` | Relation | — | → users; một |
| `supervisor_id` | Relation | — | → users; một |
| `approver_id` | Relation | — | → users; một |
| `status` | Select | ✅ | giá trị: not_started · in_progress · pending_approval · completed · proposed_extension · proposed_cancellation · cancelled |
| `priority` | Select | — | giá trị: low · medium · high · urgent |
| `start_date` | Date | — | — |
| `due_date` | Date | — | — |
| `completion_date` | Date | — | — |
| `progress` | Number | — | — |
| `archived_at` | Date | ✅ | — |

---

## attendance_configs — base

**Mô tả:** `allowed_ips` là field JSON — đọc qua H.jsonArr (PB trả raw []byte). Guard đọc config `is_active=true` (ưu tiên office_name) để tính status + kiểm tra IP.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `office_name` | Text | ✅ | — |
| `wifi_ssid` | Text | ✅ | — |
| `wifi_bssid` | Text | — | — |
| `allowed_ips` | JSON | — | — |
| `work_start_time` | Text | ✅ | — |
| `work_end_time` | Text | ✅ | — |
| `late_tolerance_minutes` | Number | — | — |
| `is_active` | Bool | — | — |

---

## attendance_logs — base

**Mô tả:** Guard create (`guards.pb.js`): ép user_id = actor, **check_in = giờ server (M1)**, chặn check-in trùng ngày, status tính server-side từ attendance_configs, kiểm tra IP (allowed_ips hoặc private range) → ghi ip_address thật. Update: owner chỉ được set check_out (cũng do server stamp), check_in bất biến; can_manage/superuser bỏ qua guard.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | ✅ | → users; một |
| `check_in` | Date | ✅ | — |
| `check_out` | Date | — | — |
| `method` | Select | ✅ | giá trị: gps · wifi · face_id · manual |
| `location_gps` | Text | — | — |
| `device_info` | Text | — | — |
| `status` | Select | ✅ | giá trị: on_time · late · early_leave · absent |
| `notes` | Text | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `ip_address` | Text | — | — |

---

## chat_messages — base

**Mô tả:** Read theo kênh: org = mọi người; department = cùng dept; group = chung group_ids. Create: ép user_id = actor + kiểm tra quyền kênh. Update/delete: author (hoặc can_manage).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.collectionName = "_superusers" || @request.auth.role_id.can_manage = true || channel_type = "org" || (channel_type = "department" && channel_dept_id = @request.auth.department_id) || (channel_type = "group" && @request.auth.group_ids ~ channel_group_id)` |
| **VIEW** | `@request.auth.collectionName = "_superusers" || @request.auth.role_id.can_manage = true || channel_type = "org" || (channel_type = "department" && channel_dept_id = @request.auth.department_id) || (channel_type = "group" && @request.auth.group_ids ~ channel_group_id)` |
| **CREATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `channel_type` | Select | ✅ | giá trị: org · department · group |
| `channel_dept_id` | Relation | — | → departments; một |
| `channel_group_id` | Relation | — | → professional_groups; một |
| `user_id` | Relation | — | → users; một |
| `content` | Text | — | — |
| `files` | File | — | nhiều file; MIME: image/png, image/jpeg, image/gif, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv; max 20MB |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## comments — base

**Mô tả:** create/update/delete owner-bound (user_id). Hook afterCreate: notify mention (@Tên) + reply (participants). quote_id tự tham chiếu.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id` |
| **DELETE** | `@request.auth.id = user_id` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `task_id` | Relation | — | → tasks; một; cascadeDelete |
| `user_id` | Relation | — | → users; một |
| `content` | Text | — | — |
| `files` | File | — | MIME: image/png, image/jpeg, image/gif, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv; max 20MB |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `quote_id` | Relation | — | → comments; một |

---

## departments — base

**Mô tả:** Đọc mọi user; ghi can_manage.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `code` | Text | ✅ | — |
| `name` | Text | ✅ | — |
| `is_counted` | Bool | — | — |
| `leader_id` | Relation | — | → users; một |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## employee_profiles — base

**Mô tả:** owner tự xem/sửa; HR có can_view_salary xem; ghi chỉ can_manage.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | ✅ | → users; một |
| `phone` | Text | — | — |
| `dob` | Date | — | — |
| `identity_card` | Text | — | — |
| `tax_code` | Text | — | — |
| `bank_account` | Text | — | — |
| `bank_name` | Text | — | — |
| `join_date` | Date | — | — |
| `contract_type` | Text | — | — |
| `emergency_contact` | Text | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## kpi_scores — base

**Mô tả:** **Server-computed**: mọi quyền ghi đóng (create/update/delete = null), chỉ hook server tạo. Scope lọc theo task thuộc phạm vi của user.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `null — chặn` |
| **UPDATE** | `null — chặn` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `task_id` | Relation | — | → tasks; một; cascadeDelete |
| `base_score` | Number | — | — |
| `difficulty_coeff` | Number | — | — |
| `progress_score` | Number | — | — |
| `result_rating` | Number | — | copy nguyên vẹn từ `tasks.rating` (thang 1–10) |
| `final_score` | Number | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `max_converted_score` | Number | — | — |

---

## leave_balances — base

**Mô tả:** Server tính: recomputeLeaveBalance (mặc định 12 ngày/năm). Ghi chỉ can_manage (nhưng hook server $app.save).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | ✅ | → users; một |
| `year` | Number | ✅ | — |
| `total_days` | Number | — | — |
| `used_days` | Number | — | — |
| `remaining_days` | Number | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## leave_requests — base

**Mô tả:** Rule duyệt theo approval_scope (all/department/group) + total_days < 3 (dept/group). Guard: không tự duyệt; approver chỉ đổi status/approver_id/rejection_reason. Hook afterCreate: auto-approve nếu role leadership có can_approve_leave; afterUpdate/Delete: recompute leave_balances.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && user_id.group_ids ~ @request.auth.group_ids) || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && user_id.group_ids ~ @request.auth.group_ids) || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id || @request.auth.id = approver_id || @request.auth.role_id.can_manage = true || @request.auth.role_id.can_approve_leave = true && (@request.auth.role_id.approval_scope = "all" || @request.auth.role_id.approval_scope = "department" && total_days < 3 && user_id.department_id = @request.auth.department_id || @request.auth.role_id.approval_scope = "group" && total_days < 3 && user_id.group_ids ~ @request.auth.group_ids) || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.id = user_id && status = "pending" || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | ✅ | → users; một |
| `leave_type` | Select | ✅ | giá trị: annual · sick · unpaid · maternity · special |
| `start_date` | Date | ✅ | — |
| `end_date` | Date | ✅ | — |
| `total_days` | Number | ✅ | — |
| `reason` | Text | ✅ | — |
| `status` | Select | ✅ | giá trị: pending · approved · rejected · cancelled |
| `approver_id` | Relation | — | → users; một |
| `rejection_reason` | Text | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `period` | Select | — | giá trị: full · morning · afternoon |

---

## notifications — base

**Mô tả:** Owner-bound. Hook fan-out: task/comment/announcement/leave. Realtime subscribe cho toast.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | — | → users; một |
| `type` | Select | ✅ | giá trị: mention · reply · deadline_warning · task_update · proposal_update · announcement |
| `reference_id` | Text | — | — |
| `is_read` | Bool | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## plans — base

**Mô tả:** `scope.pb.js` enforce view_scope (all/department/group/personal) khi list/view — fail-closed nếu user không có role hoặc role không load được (H2). Hook sau khi sửa task recalc progress/status. `is_deleted` phục vụ soft-delete.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_add_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_edit_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_delete_plans = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `name` | Text | ✅ | — |
| `description` | Text | — | — |
| `leader_id` | Relation | — | → users; một |
| `host_dept_id` | Relation | — | → departments; một |
| `partner_dept_ids` | Relation | — | → departments; nhiều (max 10) |
| `start_date` | Date | ✅ | — |
| `end_date` | Date | ✅ | — |
| `status` | Select | ✅ | giá trị: not_started · in_progress · completed · paused · cancelled |
| `is_sudden` | Bool | — | — |
| `is_high_impact` | Bool | — | — |
| `progress` | Number | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `is_deleted` | Bool | — | — |
| `group_id` | Relation | — | → professional_groups; một |

---

## presence_campaigns — base

**Mô tả:** Custom endpoint start/stop ghi; manager đọc.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != "" || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id != "" || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `null — chặn` |
| **UPDATE** | `null — chặn` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `name` | Text | ✅ | max 200 ký tự |
| `status` | Select | ✅ | giá trị: active · closed |
| `started_by` | Relation | — | → users; một; cascadeDelete |
| `started_at` | Date | ✅ | — |
| `ended_at` | Date | — | — |
| `notes` | Text | — | max 2000 ký tự |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## presence_check_logs — base

**Mô tả:** Manager-only đọc; custom endpoint run-check ghi.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `null — chặn` |
| **UPDATE** | `null — chặn` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `campaign_id` | Relation | ✅ | → presence_campaigns; một; cascadeDelete |
| `user_id` | Relation | ✅ | → users; một; cascadeDelete |
| `responded` | Bool | — | — |
| `responded_at` | Date | — | — |
| `device_info` | Text | — | max 255 ký tự |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## presence_heartbeats — base

**Mô tả:** Chỉ custom endpoint /presence/heartbeat ghi (createRule null). Owner đọc bản thân.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.id = user_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `null — chặn` |
| **UPDATE** | `null — chặn` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | ✅ | → users; một; cascadeDelete |
| `last_seen_at` | Date | ✅ | — |
| `device_info` | Text | — | max 255 ký tự |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## professional_groups — base

**Mô tả:** Đọc mọi user; ghi can_manage. group_ids trên users nối tới collection này.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `code` | Text | ✅ | max 100 ký tự |
| `name` | Text | ✅ | max 200 ký tự |
| `description` | Text | — | max 500 ký tự |
| `department_id` | Relation | — | → departments; một |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## proposals — base

**Mô tả:** createRule owner-bound (requester_id). Guard: requester chỉ rút khi pending; supervisor của task duyệt/từ chối. Hook: notify supervisor khi tạo.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.id = requester_id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id != ""` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `task_id` | Relation | — | → tasks; một; cascadeDelete |
| `type` | Select | ✅ | giá trị: extension · cancellation |
| `reason` | Text | ✅ | — |
| `new_deadline` | Date | — | — |
| `status` | Select | ✅ | giá trị: pending · approved · rejected · withdrawn |
| `requester_id` | Relation | — | → users; một |
| `approver_id` | Relation | — | → users; một |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## qualifications — base

**Mô tả:** Như salary_records (HR-view), ghi can_manage.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | — | → users; một |
| `name` | Text | ✅ | — |
| `training_place` | Text | ✅ | — |
| `start_date` | Date | — | — |
| `end_date` | Date | — | — |
| `training_type` | Text | — | — |
| `certificate_type` | Text | — | — |

---

## roles — base

**Mô tả:** Chứa cờ quyền (can_*) + view_scope + approval_scope — nguồn quyết định rule/guard/scope. Tạo/sửa/xóa chỉ can_manage. Thêm `rank` để phân cấp chức vụ (1 = cao nhất).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_manage = true` |
| **UPDATE** | `@request.auth.role_id.can_manage = true` |
| **DELETE** | `@request.auth.role_id.can_manage = true` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `code` | Text | ✅ | — |
| `name` | Text | ✅ | — |
| `level` | Select | ✅ | giá trị: leadership · management · employee |
| `rank` | Number | — | **Cấp bậc chức vụ, số nhỏ = cấp cao hơn** (1 = Giám đốc, 2 = Phó, 3 = Trưởng phòng…). min 1; số nguyên; thêm ở migration `1799200000_add_role_rank.js`. Thuần thứ tự/hiển thị — **không tham gia phân quyền**, quyền vẫn do `level` + các cờ `can_*` quyết định |
| `view_scope` | Select | ✅ | giá trị: all · department · group · personal |
| `can_add_plans` | Bool | — | — |
| `can_edit_plans` | Bool | — | — |
| `can_delete_plans` | Bool | — | — |
| `can_add_tasks` | Bool | — | — |
| `can_edit_tasks` | Bool | — | — |
| `can_delete_tasks` | Bool | — | — |
| `can_manage` | Bool | — | — |
| `description` | Text | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `can_approve_leave` | Bool | — | — |
| `approval_scope` | Select | — | giá trị: all · department · group |
| `can_view_salary` | Bool | — | — |

---

## salary_records — base

**Mô tả:** `hr.pb.js` enforce view_scope theo can_view_salary (department/all).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | — | → users; một |
| `start_date` | Date | ✅ | — |
| `salary_coefficient` | Number | ✅ | — |
| `allowance_coefficient` | Number | — | — |
| `decision_number` | Text | — | — |

---

## system_logs — base

**Mô tả:** Audit server-side: create/update/delete đều null — chỉ server `$app.save()` ghi (chống giả mạo log). Nội dung do guards.pb.js/audit.pb.js ghi với actor + IP thật (e.realIP).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `null — chặn` |
| **UPDATE** | `null — chặn` |
| **DELETE** | `null — chặn` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | — | → users; một |
| `action` | Text | ✅ | — |
| `target` | Text | — | — |
| `ip_address` | Text | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## tasks — base

**Mô tả:** Guard `guards.pb.js` (update): executor chỉ được đổi status (in_progress/pending_approval); supervisor chỉ đổi status/rating/rated_*/completed_at/description/name; cấm tự rate (A10); **completed_at do server stamp = now() khi chuyển sang completed (M8)**, không sửa được khi đã completed, xóa khi rời completed. Create: người không có can_manage bị ép status=not_started, strip rating/rated_*/completed_at (H1). `is_deleted=true` yêu cầu can_delete_tasks. Hook afterCreate/afterUpdate: recalc plan.progress + upsert KPI + notify.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_add_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_edit_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers" || @request.auth.id = executor_id || @request.auth.id = supervisor_id` |
| **DELETE** | `@request.auth.role_id.can_delete_tasks = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `name` | Text | ✅ | — |
| `description` | Text | — | — |
| `plan_id` | Relation | — | → plans; một |
| `category` | Select | ✅ | giá trị: normal · sudden · important |
| `host_dept_id` | Relation | — | → departments; một |
| `executor_id` | Relation | — | → users; một |
| `supervisor_id` | Relation | — | → users; một |
| `collaborator_ids` | Relation | — | → users; nhiều (max 10) |
| `start_date` | Date | ✅ | — |
| `deadline` | Date | ✅ | — |
| `status` | Select | ✅ | giá trị: not_started · in_progress · pending_approval · completed · proposed_extension · proposed_cancellation · cancelled |
| `is_recurring` | Bool | — | — |
| `recurring_type` | Select | — | giá trị: monthly · weekly |
| `recurring_value` | Number | — | — |
| `is_deleted` | Bool | — | — |
| `is_ad_hoc` | Bool | — | — |
| `is_high_impact` | Bool | — | — |
| `coordinating_dept_id` | Relation | — | → departments; một |
| `completed_at` | Date | — | — |
| `rating` | Number | — | min 1; max 10; số nguyên (**thang 1–10**, nâng từ max 5 ở migration `1799100000_widen_task_rating_to_10.js`) |
| `rated_by_id` | Relation | — | → users; một |
| `rated_at` | Date | — | — |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |

---

## users — auth

**Mô tả:** Auth collection. Guard: user không tự sửa role_id/verified/disabled/group_ids/department_id/email (chỉ can_manage/superuser). **disabled=true chặn mọi request** (H3, ensureEnabled trong scope/guards) — vẫn login được nhưng mọi API trả 403. role_id xóa/treo → scope thu hẹp về personal (H2).

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.id != ""` |
| **VIEW** | `@request.auth.id != ""` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.id = id || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `id = @request.auth.id` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `password` | Password | ✅ | min 8 ký tự |
| `tokenKey` | Text | ✅ | max 60 ký tự; tự sinh [a-zA-Z0-9]{50} |
| `email` | Email | ✅ | — |
| `emailVisibility` | Bool | — | — |
| `verified` | Bool | — | — |
| `name` | Text | — | max 255 ký tự |
| `avatar` | File | — | MIME: image/jpeg, image/png, image/gif, image/webp (không chấp nhận SVG — tránh stored-XSS) |
| `created` | Autodate | — | tự set khi tạo |
| `updated` | Autodate | — | tự set khi tạo + tự set khi sửa |
| `department_id` | Relation | — | → departments; một |
| `role_id` | Relation | — | → roles; một |
| `reminder_days` | Number | — | — |
| `disabled` | Bool | — | — |
| `group_ids` | Relation | — | → professional_groups; nhiều (max 50) |

---

## work_experiences — base

**Mô tả:** Như qualifications.

### API rules

| Thao tác | Rule |
|---|---|
| **LIST** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **VIEW** | `@request.auth.role_id.can_view_salary = true || @request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **CREATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **UPDATE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |
| **DELETE** | `@request.auth.role_id.can_manage = true || @request.auth.collectionName = "_superusers"` |

### Fields

| Field | Kiểu | Bắt buộc | Ràng buộc / Ghi chú |
|---|---|---|---|
| `id` | Text | ✅ | max 15 ký tự; pattern ^[a-z0-9]+$; tự sinh [a-z0-9]{15} |
| `user_id` | Relation | — | → users; một |
| `organization` | Text | ✅ | — |
| `position` | Text | ✅ | — |
| `start_date` | Date | ✅ | — |
| `end_date` | Date | — | — |
| `description` | Text | — | — |

---
