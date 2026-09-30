import { describe, it, expect } from "vitest";
import { errorMessage } from "@/utils/errors";

describe("errorMessage", () => {
  it("uses an Error's message", () => {
    expect(errorMessage(new Error("Boom"))).toBe("Boom");
  });

  it("uses a thrown string", () => {
    expect(errorMessage("Đã xảy ra lỗi")).toBe("Đã xảy ra lỗi");
  });

  it("prefers PocketBase's response.message", () => {
    const err = { status: 400, response: { message: "Email đã tồn tại" } };
    expect(errorMessage(err)).toBe("Email đã tồn tại");
  });

  it("falls back to a plain object message", () => {
    expect(errorMessage({ message: "Không đủ quyền" })).toBe("Không đủ quyền");
  });

  it("reads data.message when there is no response", () => {
    expect(errorMessage({ data: { message: "Thiếu trường" } })).toBe("Thiếu trường");
  });

  it("prefers response.message over message", () => {
    const err = { message: "generic", response: { message: "specific" } };
    expect(errorMessage(err)).toBe("specific");
  });

  it("returns the fallback for null, undefined and unusable values", () => {
    expect(errorMessage(null)).toBe("Có lỗi xảy ra");
    expect(errorMessage(undefined)).toBe("Có lỗi xảy ra");
    expect(errorMessage(42)).toBe("Có lỗi xảy ra");
    expect(errorMessage({})).toBe("Có lỗi xảy ra");
    expect(errorMessage(new Error(""))).toBe("Có lỗi xảy ra");
    expect(errorMessage("   ")).toBe("Có lỗi xảy ra");
  });

  it("honours a custom fallback", () => {
    expect(errorMessage({}, "Vui lòng thử lại")).toBe("Vui lòng thử lại");
  });
});
