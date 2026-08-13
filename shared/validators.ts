export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const FILE_MAX_SIZE = 20 * 1024 * 1024; // 20MB
export const ALLOWED_FILE_TYPES = [
  "png", "jpg", "gif", "pdf", "doc", "docx", "xlsx", "csv",
];

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

export function validateFileType(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? ALLOWED_FILE_TYPES.includes(ext) : false;
}

export function validateFileSize(size: number): boolean {
  return size <= FILE_MAX_SIZE;
}
