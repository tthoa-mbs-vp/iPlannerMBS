import { describe, it, expect } from "vitest";
import { validatePassword } from "@shared/validators";

describe("validatePassword", () => {
  it("rejects password shorter than 8 characters", () => {
    expect(validatePassword("Ab1")).not.toBeNull();
  });

  it("rejects password without uppercase", () => {
    expect(validatePassword("abcdefgh1")).not.toBeNull();
  });

  it("rejects password without lowercase", () => {
    expect(validatePassword("ABCDEFGH1")).not.toBeNull();
  });

  it("rejects password without number", () => {
    expect(validatePassword("Abcdefgh")).not.toBeNull();
  });

  it("accepts valid password", () => {
    expect(validatePassword("Admin@123")).toBeNull();
  });
});
