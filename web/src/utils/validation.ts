/**
 * Shared form validation utilities
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, error: "Email không được để trống" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Email không hợp lệ" };
  }
  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "Mật khẩu không được để trống" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Mật khẩu phải có ít nhất 8 ký tự" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Mật khẩu phải có ít nhất 1 chữ hoa" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Mật khẩu phải có ít nhất 1 chữ thường" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Mật khẩu phải có ít nhất 1 chữ số" };
  }
  return { valid: true };
}

/**
 * Validate phone number format (Vietnamese)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) {
    return { valid: true }; // Phone is optional
  }
  // Vietnamese phone: 10-11 digits, starts with 0
  const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
  if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
    return { valid: false, error: "Số điện thoại không hợp lệ" };
  }
  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: `${fieldName} không được để trống` };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { valid: false, error: `${fieldName} không được để trống` };
  }
  return { valid: true };
}

/**
 * Validate date range (end >= start)
 */
export function validateDateRange(startDate: string, endDate: string): ValidationResult {
  if (!startDate || !endDate) {
    return { valid: true };
  }
  if (new Date(endDate) < new Date(startDate)) {
    return { valid: false, error: "Ngày kết thúc phải sau ngày bắt đầu" };
  }
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeMB: number = 20): ValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File phải nhỏ hơn ${maxSizeMB}MB` };
  }
  return { valid: true };
}

/**
 * Validate file type
 */
export function validateFileType(file: File, allowedTypes: string[]): ValidationResult {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !allowedTypes.includes(extension)) {
    return { valid: false, error: `File phải có định dạng: ${allowedTypes.join(", ")}` };
  }
  return { valid: true };
}
