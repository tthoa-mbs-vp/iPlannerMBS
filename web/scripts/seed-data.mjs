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
log("\nCreating roles...");
const roles = [
  {
    code: "ADMIN", name: "Quản trị viên", level: "leadership", view_scope: "all",
    can_add_plans: true, can_edit_plans: true, can_delete_plans: true,
    can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: true,
    can_manage: true,
  },
  {
    code: "TRUONGPHONG", name: "Trưởng phòng", level: "management", view_scope: "department",
    can_add_plans: true, can_edit_plans: true, can_delete_plans: false,
    can_add_tasks: true, can_edit_tasks: true, can_delete_tasks: false,
    can_manage: false,
  },
  {
    code: "NV", name: "Nhân viên", level: "employee", view_scope: "personal",
    can_add_plans: false, can_edit_plans: false, can_delete_plans: false,
    can_add_tasks: false, can_edit_tasks: false, can_delete_tasks: false,
    can_manage: false,
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
console.log("  truongphong@mbs.com — Trưởng phòng");
console.log("  nhanvien@mbs.com — Nhân viên");
console.log("\nKhông in mật khẩu ra log. Xem giá trị trong .env.local của bạn.");
