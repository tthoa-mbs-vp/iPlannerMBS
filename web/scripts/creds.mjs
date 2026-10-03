// Shared admin credentials loader for dev/migration scripts.
// Credentials are read from environment variables:
//   PB_URL            (default http://localhost:8090)
//   PB_ADMIN_EMAIL    (required)
//   PB_ADMIN_PASSWORD (required)
//
// Seed data (demo users) additionally honours:
//   PB_SEED_PASSWORD  password for the sample accounts
//   PB_ALLOW_REMOTE_SEED=1  required to seed a non-localhost server

export const PB_URL = process.env.PB_URL || "http://localhost:8090";

// Sample accounts are throwaway dev fixtures. Their password must never be a
// well-known literal on a real server, so the built-in default is only usable
// against localhost — anything remote must supply PB_SEED_PASSWORD explicitly.
export const DEFAULT_SEED_PASSWORD = "Test@123456";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"]);

export function isLocalTarget(url = PB_URL) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Refuse to write fixture data into a shared/production database. Seeding
// creates accounts with a known password — that is fine on a dev machine and a
// serious hole anywhere reachable by other people.
export function assertLocalTarget(action = "seed dữ liệu mẫu") {
  if (isLocalTarget()) return;
  if (process.env.PB_ALLOW_REMOTE_SEED === "1") {
    console.warn(`⚠️  ${action}: PB_URL=${PB_URL} không phải localhost, nhưng PB_ALLOW_REMOTE_SEED=1 cho phép tiếp tục.`);
    return;
  }
  console.error(
    `Từ chối ${action} vào ${PB_URL}.\n` +
    "Script này tạo tài khoản với mật khẩu đã biết, nên chỉ an toàn trên máy local.\n" +
    "Nếu bạn thực sự muốn chạy trên server thật, đặt PB_ALLOW_REMOTE_SEED=1 và PB_SEED_PASSWORD=<mật khẩu mạnh>."
  );
  process.exit(1);
}

// Password for the seeded sample accounts. Defaults to the dev fixture value
// only on localhost; a remote target must provide its own.
export function getSeedPassword() {
  const fromEnv = process.env.PB_SEED_PASSWORD;
  if (fromEnv) return fromEnv;
  if (isLocalTarget()) return DEFAULT_SEED_PASSWORD;
  console.error(
    "Thiếu PB_SEED_PASSWORD khi chạy trên server không phải localhost.\n" +
    "Đặt PB_SEED_PASSWORD (không dùng giá trị mặc định) rồi chạy lại."
  );
  process.exit(1);
}

export function getAdminCreds() {
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(
      "Missing PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD env vars.\n" +
      "Run with: $env:PB_ADMIN_EMAIL='admin@mbs.com'; $env:PB_ADMIN_PASSWORD='***' ; node scripts/<script>.mjs"
    );
    process.exit(1);
  }
  return { email, password };
}
