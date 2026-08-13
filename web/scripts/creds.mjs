// Shared admin credentials loader for dev/migration scripts.
// Credentials are read from environment variables:
//   PB_URL            (default http://localhost:8090)
//   PB_ADMIN_EMAIL    (required)
//   PB_ADMIN_PASSWORD (required)

export const PB_URL = process.env.PB_URL || "http://localhost:8090";

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
