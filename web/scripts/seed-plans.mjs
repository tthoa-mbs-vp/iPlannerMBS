// Seed mẫu: kế hoạch + nhiệm vụ (idempotent — chạy lại không nhân đôi dữ liệu).
// Dùng chung creds với seed-data.mjs:
//   PB_URL            (default http://localhost:8090)
//   PB_ADMIN_EMAIL    (superuser, bắt buộc)
//   PB_ADMIN_PASSWORD (bắt buộc)
import PocketBase from "pocketbase";
import { PB_URL, getAdminCreds } from "./creds.mjs";

const pb = new PocketBase(PB_URL);
const { email, password } = getAdminCreds();

await pb.collection("_superusers").authWithPassword(email, password);
const log = (msg) => console.log(msg);

// --clean: xoá toàn bộ plan + task mẫu (kèm kpi_scores liên quan) rồi seed lại.
const CLEAN = process.argv.includes("--clean");

// ---- tra cứu tham chiếu (departments / users theo email) ----
const depts = {};
for (const d of await pb.collection("departments").getFullList()) depts[d.code] = d.id;

const users = {};
for (const u of await pb.collection("users").getFullList()) users[u.email] = u.id;

const uid = (emailAddr) => users[emailAddr] ?? (() => { throw new Error(`User ${emailAddr} chưa tồn tại — chạy seed-data.mjs trước`) })();
const did = (code) => depts[code] ?? (() => { throw new Error(`Department ${code} chưa tồn tại`) })();

// ---- định nghĩa dữ liệu mẫu ----
const plans = [
  {
    name: "Triển khai hệ thống quản lý kho thông minh",
    description: "Số hoá toàn bộ quy trình nhập - xuất - tồn kho, tích hợp với phần mềm kế toán.",
    leader: "admin@mbs.com",
    hostDept: "PIT",
    partnerDepts: ["PKT", "PKD"],
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-09-30T00:00:00.000Z",
    status: "in_progress",
    is_sudden: false,
    is_high_impact: true,
    tasks: [
      { name: "Khảo sát & phân tích yêu cầu nghiệp vụ kho", desc: "Phỏng vấn các bộ phận kho, xác định quy trình hiện tại.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-07-01", end: "2026-08-20", status: "completed" },
      { name: "Thiết kế kiến trúc & cơ sở dữ liệu", desc: "Thiết kế mô hình dữ liệu và kiến trúc hệ thống.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "important", start: "2026-07-16", end: "2026-08-10", status: "in_progress" },
      { name: "Phát triển module nhập - xuất kho", desc: "Xây dựng các module nghiệp vụ chính.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "important", start: "2026-08-01", end: "2026-09-10", status: "in_progress" },
      { name: "Kiểm thử & nghiệm thu hệ thống", desc: "Chạy thử toàn bộ luồng nghiệp vụ, đào tạo người dùng.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-09-11", end: "2026-09-30", status: "not_started" },
    ],
  },
  {
    name: "Kế hoạch kinh doanh & sản xuất quý 3/2026",
    description: "Kế hoạch tổng hợp sản xuất - kinh doanh quý 3, bao gồm dự báo nhu cầu nguyên vật liệu.",
    leader: "truongphong@mbs.com",
    hostDept: "PKHTC",
    partnerDepts: ["PKD"],
    start: "2026-07-01T00:00:00.000Z",
    end: "2026-09-30T00:00:00.000Z",
    status: "in_progress",
    is_sudden: false,
    is_high_impact: false,
    tasks: [
      { name: "Tổng hợp số liệu sản xuất tháng 7", desc: "Thu thập và tổng hợp số liệu từ các phân xưởng.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-07-25", end: "2026-08-25", status: "completed" },
      { name: "Dự báo nhu cầu nguyên vật liệu Q4/2026", desc: "Xây dựng dự báo theo kế hoạch đơn hàng.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-08-10", end: "2026-08-25", status: "in_progress" },
      { name: "Lập kế hoạch giao hàng tháng 9", desc: "Chốt lịch giao hàng với phòng kinh doanh.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-09-01", end: "2026-09-15", status: "not_started" },
    ],
  },
  {
    name: "Chuẩn hoá quy trình ISO 9001:2015",
    description: "Rà soát và chuẩn hoá quy trình nội bộ theo tiêu chuẩn ISO 9001:2015.",
    leader: "truongphong@mbs.com",
    hostDept: "PKHTC",
    partnerDepts: ["PIT"],
    start: "2026-09-01T00:00:00.000Z",
    end: "2026-11-30T00:00:00.000Z",
    status: "not_started",
    is_sudden: false,
    is_high_impact: false,
    tasks: [
      { name: "Rà soát quy trình hiện trạng", desc: "Lập danh mục quy trình hiện có và khoảng trống.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-09-01", end: "2026-09-20", status: "not_started" },
      { name: "Xây dựng tài liệu quy trình mới", desc: "Soạn thảo quy trình chuẩn theo ISO.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-09-21", end: "2026-10-31", status: "not_started" },
    ],
  },
  {
    name: "Nâng cấp hạ tầng CNTT văn phòng",
    description: "Thay mới hệ thống mạng và di trú máy chủ — tạm hoãn do thiếu kinh phí.",
    leader: "admin@mbs.com",
    hostDept: "PIT",
    partnerDepts: [],
    start: "2026-05-01T00:00:00.000Z",
    end: "2026-08-31T00:00:00.000Z",
    status: "paused",
    is_sudden: true,
    is_high_impact: false,
    tasks: [
      { name: "Khảo sát hạ tầng hiện tại", desc: "Đánh giá thiết bị mạng và máy chủ đang dùng.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-05-01", end: "2026-08-28", status: "completed" },
      { name: "Thay mới thiết bị mạng LAN", desc: "Thay switch, AP và cáp mạng.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "sudden", start: "2026-06-01", end: "2026-06-30", status: "in_progress" },
      { name: "Di trú dữ liệu máy chủ", desc: "Di chuyển dữ liệu sang máy chủ mới.", executor: "admin@mbs.com", supervisor: "truongphong@mbs.com", category: "important", start: "2026-07-01", end: "2026-08-31", status: "not_started" },
    ],
  },
  {
    name: "Báo cáo tổng kết công tác tháng 8/2026",
    description: "Tổng kết hoạt động sản xuất kinh doanh tháng 8, chuẩn bị số liệu cho báo cáo quý.",
    leader: "truongphong@mbs.com",
    hostDept: "PKHTC",
    partnerDepts: ["PKT"],
    start: "2026-08-01T00:00:00.000Z",
    end: "2026-08-31T00:00:00.000Z",
    status: "completed",
    is_sudden: false,
    is_high_impact: true,
    tasks: [
      { name: "Thu thập số liệu sản xuất tháng 8", desc: "Tổng hợp số liệu từ các phòng ban.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "normal", start: "2026-08-01", end: "2026-08-28", status: "completed" },
      { name: "Viết báo cáo tổng kết tháng 8", desc: "Biên soạn báo cáo và trình ban lãnh đạo.", executor: "nhanvien@mbs.com", supervisor: "truongphong@mbs.com", category: "important", start: "2026-08-20", end: "2026-08-31", status: "completed" },
    ],
  },
];

// ---- --clean: xoá dữ liệu seed trước đó (theo đúng tên đã định nghĩa) ----
if (CLEAN) {
  // legacy: tên plan mẫu của phiên bản seed trước (đã đổi tên) vẫn cần được dọn
  const seededNames = [...plans.map((p) => p.name), "Báo cáo tổng kết 6 tháng đầu năm 2026"];
  const allPlans = await pb.collection("plans").getFullList({ filter: seededNames.map((n) => `name="${n}"`).join(" || ") });
  for (const p of allPlans) {
    const tasks = await pb.collection("tasks").getFullList({ filter: `plan_id="${p.id}"` });
    for (const t of tasks) {
      await pb.collection("kpi_scores").getFullList({ filter: `task_id="${t.id}"` }).then(
        (scores) => Promise.all(scores.map((s) => pb.collection("kpi_scores").delete(s.id).catch(() => {})))
      );
      await pb.collection("tasks").delete(t.id);
    }
    await pb.collection("plans").delete(p.id);
    log(`· Xoá plan "${p.name}" (+ ${tasks.length} task)`);
  }
}

// ---- tạo plans + tasks (idempotent theo tên plan) ----
let planCount = 0;
let taskCount = 0;
for (const p of plans) {
  try {
    const existing = await pb.collection("plans").getFirstListItem(`name="${p.name}"`).catch(() => null);
    let planId;
    if (existing) {
      planId = existing.id;
      log(`· Plan "${p.name}" đã tồn tại — bỏ qua`);
    } else {
      const rec = await pb.collection("plans").create({
        name: p.name,
        description: p.description,
        leader_id: uid(p.leader),
        host_dept_id: did(p.hostDept),
        partner_dept_ids: p.partnerDepts.map(did),
        start_date: p.start,
        end_date: p.end,
        status: p.status,
        is_sudden: p.is_sudden,
        is_high_impact: p.is_high_impact,
        is_deleted: false,
      });
      planId = rec.id;
      planCount++;
      log(`· Plan "${p.name}" (${p.status}) ✓`);
    }
    for (const t of p.tasks) {
      const dup = await pb.collection("tasks").getFirstListItem(`name="${t.name}" && plan_id="${planId}"`).catch(() => null);
      if (dup) { log(`   - "${t.name}" đã tồn tại`); continue; }
      await pb.collection("tasks").create({
        name: t.name,
        description: t.desc,
        plan_id: planId,
        category: t.category,
        host_dept_id: did(p.hostDept),
        executor_id: uid(t.executor),
        supervisor_id: uid(t.supervisor),
        start_date: t.start,
        deadline: t.end,
        status: t.status,
        is_deleted: false,
        is_ad_hoc: false,
      });
      taskCount++;
      log(`   - "${t.name}" (${t.status}) ✓`);
    }
  } catch (e) {
    log(`✗ Plan "${p.name}" FAIL: ${e.message}`);
  }
}

console.log(`\n✅ Seed plans hoàn tất: ${planCount} plan mới, ${taskCount} task mới.`);
console.log("Tài khoản test: admin@mbs.com / Admin@123456 · truongphong@mbs.com / Test@123456 · nhanvien@mbs.com / Test@123456");
