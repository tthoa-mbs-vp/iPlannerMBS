export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  }
  if (!/[a-z]/.test(password)) {
    return "Mật khẩu phải có chữ thường";
  }
  if (!/[A-Z]/.test(password)) {
    return "Mật khẩu phải có chữ hoa";
  }
  if (!/\d/.test(password)) {
    return "Mật khẩu phải có số";
  }
  return null;
}


