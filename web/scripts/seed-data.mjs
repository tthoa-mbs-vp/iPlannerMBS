import PocketBase from "pocketbase";
import { PB_URL, getAdminCreds, getSeedPassword, assertLocalTarget } from "./creds.mjs";

assertLocalTarget(); // tạo tài khoản mật khẩu đã biết → chỉ chạy trên máy local

const pb = new PocketBase(PB_URL);
const { email: adminEmail, password: adminPassword } = getAdminCreds();
const seedPassword = getSeedPassword();

// Authenticate as superuser
await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);

const log = (msg) => console.log(`  ${msg}`);

// 1. Create departments
log("Creating departments...");
const depts = [
  { code: "PKHTC", name: "Phòng Kế hoạch Tổng hợp", is_counted: true },
  { code: "PKT", name: "Phòng Kế toán", is_counted: true },
  { code: "PKD", name: "Phòng Kinh doanh", is_counted: true },
  { code: "PNS", name: "Phòng Nhân sự", is_counted: true },
  { code: "PIT", name: "Phòng Công nghệ thông tin", is_counted: true },
];
const deptIds = {};
for (const d of depts) {
  try {
    const existing = await pb.collection("departments").getFirstListItem(`code="${d.code}"`).catch(() => null);
    if (existing) { deptIds[d.code] = existing.id; log(`  ${d.code} exists`); continue; }
    const created = await pb.collection("departments").create(d);
    deptIds[d.code] = created.id;
    log(`  ${d.code} created`);
  } catch (e) { log(`  ${d.code} FAIL: ${e.message}`); }
}

// 2. Create roles
// `rank` = cấp bậc chức vụ, số nhỏ hơn là cấp cao hơn (1 = Giám đốc).
// `level` vẫn là nhóm thô dùng cho phân quyền.
log("\nCreating roles...");
const roles = [
  {
    code: "ADMIN", name: "Quản trị viên", level: "leadership", rank: 1, view_scope: "all",
    can_add_plans: true, can_edit_plans: true, can_delete_plans: true,
    can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: true,
    can_manage: true,
  },
  {
    code: "TRUONGPHONG", name: "Trưởng phòng", level: "management", rank: 3, view_scope: "department",
    can_add_plans: true, can_edit_plans: true, can_delete_plans: false,
    can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: false,
    can_manage: false,
  },
  {
    code: "NV", name: "Nhân viên", level: "employee", rank: 4, view_scope: "personal",
    can_add_plans: false, can_edit_plans: false, can_delete_plans: false,
    can_add_tasks: false, can_edit_tasks: false, can_delete_tasks: false,
    can_manage: false,
  },
  {
    // Nhân sự: giữ can_view_salary + can_approve_leave nhưng KHÔNG có can_manage.
    // Đây là tài khoản dùng để kiểm chứng các nhánh phân quyền mà role khác không với tới:
    // xem hồ sơ / lương (can_view_salary), duyệt nghỉ phép (can_approve_leave), và đồng thời
    // là người KHÔNG được đọc bảng phân quyền `roles` sau khi S1 siết listRule.
    // Nhờ vậy role này cũng là phép thử cho các đường đọc nhạy cảm: nếu guard/scope đúng,
    // nhân sự nhìn thấy đúng phòng ban mình phụ trách chứ không toàn công ty.
    code: "HR", name: "Nhân sự", level: "management", rank: 3, view_scope: "department",
    can_add_plans: false, can_edit_plans: false, can_delete_plans: false,
    can_add_tasks: false, can_edit_tasks: false, can_delete_tasks: false,
    can_manage: false,
    can_view_salary: true,
    can_approve_leave: true, approval_scope: "department",
  },
];
const roleIds = {};
for (const r of roles) {
  try {
    const existing = await pb.collection("roles").getFirstListItem(`code="${r.code}"`).catch(() => null);
    if (existing) { roleIds[r.code] = existing.id; log(`  ${r.code} exists`); continue; }
    const created = await pb.collection("roles").create(r);
    roleIds[r.code] = created.id;
    log(`  ${r.code} created`);
  } catch (e) { log(`  ${r.code} FAIL: ${e.message}`); }
}

// 3. Create admin user
log("\nCreating admin user...");
if (roleIds["ADMIN"] && deptIds["PIT"]) {
  try {
    const existing = await pb.collection("users").getFirstListItem(`email="${adminEmail}"`).catch(() => null);
    if (!existing) {
      await pb.collection("users").create({
        email: adminEmail,
        password: adminPassword,
        passwordConfirm: adminPassword,
        username: adminEmail.split("@")[0],
        name: "Admin",
        department_id: deptIds["PIT"],
        role_id: roleIds["ADMIN"],
        reminder_days: 2,
        emailVisibility: true,
        verified: true,
      });
      log("  admin user created");
    } else {
      log("  admin user exists, updating role...");
      await pb.collection("users").update(existing.id, {
        name: "Admin",
        department_id: deptIds["PIT"],
        role_id: roleIds["ADMIN"],
        emailVisibility: true,
        verified: true,
      });
      log("  admin user updated");
    }
  } catch (e) { log(`  admin user FAIL: ${e.message}`); }
}

// 4. Create sample users
log("\nCreating sample users...");
const sampleUsers = [
  { email: "truongphong@mbs.com", name: "Trưởng phòng", dept: "PKHTC", role: "TRUONGPHONG" },
  { email: "nhanvien@mbs.com", name: "Nhân viên", dept: "PKHTC", role: "NV" },
  // Nhân sự phòng Nhân sự: có can_view_salary nhưng không can_manage — dùng để test
  // luồng /hr với đúng điều kiện nhân sự thật (xem hồ sơ, xem lương, duyệt nghỉ).
  { email: "nhansu@mbs.com", name: "Nhân sự", dept: "PNS", role: "HR" },
  // Cần ít nhất một nhân viên CÙNG phòng với tài khoản nhân sự: scope.pb.js lọc các
  // collection HR theo roles.view_scope, và role HR dùng view_scope "department" —
  // nhân sự PNS chỉ thấy hồ sơ trong PNS. Nếu seed chỉ có nhân viên ở PKHTC thì màn
  // hình /hr của nhân sự ra rỗng, dễ tưởng là mất quyền.
  { email: "nhanvien.pns@mbs.com", name: "Nhân viên Phòng Nhân sự", dept: "PNS", role: "NV" },
];
for (const u of sampleUsers) {
  try {
    const existing = await pb.collection("users").getFirstListItem(`email="${u.email}"`).catch(() => null);
    if (existing) { log(`  ${u.email} exists`); continue; }
    await pb.collection("users").create({
      email: u.email,
      password: seedPassword,
      passwordConfirm: seedPassword,
      username: u.email.split("@")[0],
      name: u.name,
      department_id: deptIds[u.dept],
      role_id: roleIds[u.role],
      reminder_days: 2,
      emailVisibility: true,
      verified: true,
    });
    log(`  ${u.email} created`);
  } catch (e) { log(`  ${u.email} FAIL: ${e.message}`); }
}

// 4b. Create HR records (hồ sơ + lương) — dữ liệu giả lập để kiểm chứng đường đọc nhạy cảm
// Đây là hai collection mà rule CHỈ cho phép `can_view_salary || can_manage` đọc. Cần có
// dữ liệu thật thì kiểm tra mới có ý nghĩa: nếu bảng rỗng thì "không lấy được" và "lấy
// được nhưng rỗng" trông giống nhau. Script seed chỉ chạy local nên dữ liệu này là dữ liệu giả.
log("\nCreating HR records (hồ sơ + lương)...");
const hrFixtures = [
  {
    email: "nhanvien@mbs.com",
    profile: {
      phone: "0900000002", dob: "1995-04-12", identity_card: "079099000002",
      tax_code: "079099000002", bank_account: "0123456789", bank_name: "VietinBank",
      join_date: "2021-09-01", contract_type: "Chính thức", emergency_contact: "0900000099",
    },
    salary: { start_date: "2024-01-01 00:00:00.000Z", salary_coefficient: 2.0, allowance_coefficient: 0.5, decision_number: "QD-2024-001" },
  },
  {
    email: "nhanvien.pns@mbs.com",
    profile: {
      phone: "0900000003", dob: "1998-07-25", identity_card: "079098000003",
      tax_code: "079098000003", bank_account: "0123456787", bank_name: "Techcombank",
      join_date: "2023-02-20", contract_type: "Chính thức", emergency_contact: "0900000097",
    },
    salary: { start_date: "2024-07-01 00:00:00.000Z", salary_coefficient: 1.7, allowance_coefficient: 0.4, decision_number: "QD-2024-018" },
  },
  {
    email: "truongphong@mbs.com",
    profile: {
      phone: "0900000001", dob: "1988-11-03", identity_card: "079088000001",
      tax_code: "079088000001", bank_account: "0123456788", bank_name: "Vietcombank",
      join_date: "2018-03-15", contract_type: "Chính thức", emergency_contact: "0900000098",
    },
    salary: { start_date: "2023-01-01 00:00:00.000Z", salary_coefficient: 2.6, allowance_coefficient: 0.7, decision_number: "QD-2023-007" },
  },
];
for (const fx of hrFixtures) {
  try {
    const u = await pb.collection("users").getFirstListItem(`email="${fx.email}"`).catch(() => null);
    if (!u) { log(`  ${fx.email} chưa có user — bỏ qua`); continue; }
    // employee_profiles.user_id là UNIQUE nên phải check trước để seed chạy lại không lỗi
    const hasProfile = await pb.collection("employee_profiles").getFirstListItem(`user_id="${u.id}"`).catch(() => null);
    if (hasProfile) log(`  hồ sơ ${fx.email} đã có`); else {
      await pb.collection("employee_profiles").create({ user_id: u.id, ...fx.profile });
      log(`  hồ sơ ${fx.email} created`);
    }
    const hasSalary = await pb.collection("salary_records").getFirstListItem(`user_id="${u.id}"`).catch(() => null);
    if (hasSalary) log(`  lương ${fx.email} đã có`); else {
      await pb.collection("salary_records").create({ user_id: u.id, ...fx.salary });
      log(`  lương ${fx.email} created`);
    }
  } catch (e) { log(`  HR record ${fx.email} FAIL: ${e.message}`); }
}

// 5. Assign department leaders
log("\nAssigning department leaders...");
try {
  const allUsers = await pb.collection("users").getFullList({ filter: `email="truongphong@mbs.com" || email="${adminEmail}"` });
  const tpUser = allUsers.find(u => u.email === "truongphong@mbs.com");
  const adminUser = allUsers.find(u => u.email === adminEmail);
  if (tpUser && deptIds["PKHTC"]) {
    await pb.collection("departments").update(deptIds["PKHTC"], { leader_id: tpUser.id });
    log("  PKHTC leader = truongphong@mbs.com");
  }
  if (adminUser && deptIds["PIT"]) {
    await pb.collection("departments").update(deptIds["PIT"], { leader_id: adminUser.id });
    log(`  PIT leader = ${adminEmail}`);
  }
} catch (e) { log(`  FAIL: ${e.message}`); }

console.log("\n✅ Seed complete!");
console.log("\nTài khoản đã tạo (mật khẩu lấy từ PB_ADMIN_PASSWORD / PB_SEED_PASSWORD):");
console.log(`  ${adminEmail} — Quản trị viên`);
for (const u of sampleUsers) {
  const role = roles.find((r) => r.code === u.role);
  console.log(`  ${u.email} — ${role ? role.name : u.role}`);
}
console.log("\nKhông in mật khẩu ra log. Xem giá trị trong .env.local của bạn.");
