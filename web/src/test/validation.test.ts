import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired,
  validateDateRange,
  validateFileSize,
  validateFileType,
} from "../utils/validation";

describe("validateEmail", () => {
  it("rejects empty email", () => {
    const result = validateEmail("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("trống");
  });

  it("rejects invalid email format", () => {
    expect(validateEmail("invalid").valid).toBe(false);
    expect(validateEmail("invalid@").valid).toBe(false);
    expect(validateEmail("@invalid.com").valid).toBe(false);
    expect(validateEmail("invalid@.com").valid).toBe(false);
  });

  it("accepts valid email", () => {
    expect(validateEmail("test@example.com").valid).toBe(true);
    expect(validateEmail("user.name@domain.co.uk").valid).toBe(true);
  });
});

describe("validatePassword", () => {
  it("rejects empty password", () => {
    const result = validatePassword("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("trống");
  });

  it("rejects short password", () => {
    expect(validatePassword("Ab1").valid).toBe(false);
  });

  it("rejects password without uppercase", () => {
    expect(validatePassword("abcdefgh1").valid).toBe(false);
  });

  it("rejects password without lowercase", () => {
    expect(validatePassword("ABCDEFGH1").valid).toBe(false);
  });

  it("rejects password without number", () => {
    expect(validatePassword("Abcdefgh").valid).toBe(false);
  });

  it("accepts valid password", () => {
    expect(validatePassword("Password1").valid).toBe(true);
    expect(validatePassword("MyP@ssw0rd").valid).toBe(true);
  });
});

describe("validatePhone", () => {
  it("accepts empty phone (optional)", () => {
    expect(validatePhone("").valid).toBe(true);
  });

  it("rejects invalid phone format", () => {
    expect(validatePhone("123").valid).toBe(false);
    expect(validatePhone("1234567890").valid).toBe(false);
  });

  it("accepts valid Vietnamese phone", () => {
    expect(validatePhone("0912345678").valid).toBe(true);
    expect(validatePhone("0398765432").valid).toBe(true);
  });
});

describe("validateRequired", () => {
  it("rejects null", () => {
    expect(validateRequired(null, "Name").valid).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateRequired(undefined, "Name").valid).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateRequired("", "Name").valid).toBe(false);
    expect(validateRequired("  ", "Name").valid).toBe(false);
  });

  it("accepts valid value", () => {
    expect(validateRequired("hello", "Name").valid).toBe(true);
    expect(validateRequired(0, "Count").valid).toBe(true);
  });
});

describe("validateDateRange", () => {
  it("accepts valid range", () => {
    expect(validateDateRange("2024-01-01", "2024-12-31").valid).toBe(true);
  });

  it("rejects end before start", () => {
    expect(validateDateRange("2024-12-31", "2024-01-01").valid).toBe(false);
  });

  it("accepts same date", () => {
    expect(validateDateRange("2024-01-01", "2024-01-01").valid).toBe(true);
  });
});

describe("validateFileSize", () => {
  it("rejects large file", () => {
    const largeFile = new File(["x".repeat(21 * 1024 * 1024)], "large.txt", { type: "text/plain" });
    expect(validateFileSize(largeFile).valid).toBe(false);
  });

  it("accepts small file", () => {
    const smallFile = new File(["x"], "small.txt", { type: "text/plain" });
    expect(validateFileSize(smallFile).valid).toBe(true);
  });
});

describe("validateFileType", () => {
  it("rejects invalid type", () => {
    const file = new File(["x"], "test.exe", { type: "application/octet-stream" });
    expect(validateFileType(file, ["txt", "pdf"]).valid).toBe(false);
  });

  it("accepts valid type", () => {
    const file = new File(["x"], "test.pdf", { type: "application/pdf" });
    expect(validateFileType(file, ["pdf", "txt"]).valid).toBe(true);
  });
});
