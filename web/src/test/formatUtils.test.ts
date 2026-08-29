import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateLong,
  formatDateTime,
  formatDateTimeShort,
  timeAgo,
  toInputDate,
  isTaskOverdue,
  contractLabel,
} from "../utils/format";

describe("formatDate", () => {
  it("returns — for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats valid date in vi-VN locale", () => {
    const result = formatDate("2026-03-15");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });
});

describe("formatDateShort", () => {
  it("returns — for undefined", () => {
    expect(formatDateShort(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDateShort("invalid")).toBe("—");
  });

  it("formats date with dd/MM pattern", () => {
    const result = formatDateShort("2026-01-05");
    expect(result).toContain("01");
    expect(result).toContain("05");
  });
});

describe("formatDateLong", () => {
  it("returns — for undefined", () => {
    expect(formatDateLong(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDateLong("xyz")).toBe("—");
  });

  it("formats date with full info", () => {
    const result = formatDateLong("2026-12-25");
    expect(result).toContain("25");
    expect(result).toContain("2026");
  });
});

describe("formatDateTime", () => {
  it("returns — for undefined", () => {
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDateTime("bad")).toBe("—");
  });

  it("formats valid datetime", () => {
    const result = formatDateTime("2026-06-15T10:30:00");
    expect(result).not.toBe("—");
    expect(result).toContain("2026");
  });
});

describe("formatDateTimeShort", () => {
  it("returns — for undefined", () => {
    expect(formatDateTimeShort(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDateTimeShort("!!!")).toBe("—");
  });

  it("formats valid datetime with time", () => {
    const result = formatDateTimeShort("2026-06-15T10:30:00");
    expect(result).not.toBe("—");
    expect(result).toContain("2026");
  });
});

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns — for undefined", () => {
    expect(timeAgo(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(timeAgo("invalid")).toBe("—");
  });

  it("returns 'vừa xong' for very recent time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00"));
    const now = new Date("2026-08-23T11:59:50").toISOString();
    expect(timeAgo(now)).toBe("vừa xong");
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00"));
    const d = new Date("2026-08-23T11:55:00").toISOString();
    expect(timeAgo(d)).toBe("5 phút trước");
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00"));
    const d = new Date("2026-08-23T09:00:00").toISOString();
    expect(timeAgo(d)).toBe("3 giờ trước");
  });

  it("returns days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00"));
    const d = new Date("2026-08-20T12:00:00").toISOString();
    expect(timeAgo(d)).toBe("3 ngày trước");
  });

  it("returns formatted date for old dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00"));
    const d = new Date("2026-08-01T12:00:00").toISOString();
    const result = timeAgo(d);
    expect(result).toContain("2026");
  });
});

describe("toInputDate", () => {
  it("returns empty for undefined", () => {
    expect(toInputDate(undefined)).toBe("");
  });

  it("returns empty for invalid date", () => {
    expect(toInputDate("bad")).toBe("");
  });

  it("formats as YYYY-MM-DD", () => {
    expect(toInputDate("2026-03-15T00:00:00")).toBe("2026-03-15");
  });
});

describe("isTaskOverdue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for completed tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23"));
    expect(isTaskOverdue({ status: "completed", deadline: "2026-08-01" })).toBe(false);
  });

  it("returns false for cancelled tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23"));
    expect(isTaskOverdue({ status: "cancelled", deadline: "2026-08-01" })).toBe(false);
  });

  it("returns true for overdue in_progress tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23"));
    expect(isTaskOverdue({ status: "in_progress", deadline: "2026-08-01" })).toBe(true);
  });

  it("returns true for overdue not_started tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23"));
    expect(isTaskOverdue({ status: "not_started", deadline: "2026-08-01" })).toBe(true);
  });

  it("returns false for future deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01"));
    expect(isTaskOverdue({ status: "in_progress", deadline: "2026-08-23" })).toBe(false);
  });

  it("returns false for invalid deadline", () => {
    expect(isTaskOverdue({ status: "in_progress", deadline: "invalid" })).toBe(false);
  });
});

describe("contractLabel", () => {
  it("returns label for known contract type", () => {
    expect(contractLabel("full_time")).toBe("Toàn thời gian");
    expect(contractLabel("part_time")).toBe("Bán thời gian");
    expect(contractLabel("probation")).toBe("Thử việc");
    expect(contractLabel("internship")).toBe("Thực tập");
    expect(contractLabel("contractor")).toBe("Hợp đồng dịch vụ");
  });

  it("returns value for unknown type", () => {
    expect(contractLabel("unknown")).toBe("unknown");
  });

  it("returns — for undefined", () => {
    expect(contractLabel(undefined)).toBe("—");
  });
});
