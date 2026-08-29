import { describe, it, expect } from "vitest";
import {
  getRatingBadgeStyle,
  TASK_STATUS_LABELS,
  PLAN_STATUS_LABELS,
  LEAVE_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  TASK_STATUS_HEX,
  PLAN_STATUS_HEX,
} from "../utils/constants";

describe("getRatingBadgeStyle", () => {
  it("returns emerald for rating >= 4", () => {
    expect(getRatingBadgeStyle(5)).toContain("emerald");
    expect(getRatingBadgeStyle(4)).toContain("emerald");
    expect(getRatingBadgeStyle(4.5)).toContain("emerald");
  });

  it("returns blue for rating >= 3", () => {
    expect(getRatingBadgeStyle(3)).toContain("blue");
    expect(getRatingBadgeStyle(3.4)).toContain("blue"); // rounds to 3
  });

  it("returns amber for rating >= 2", () => {
    expect(getRatingBadgeStyle(2)).toContain("amber");
    expect(getRatingBadgeStyle(2.4)).toContain("amber"); // rounds to 2
  });

  it("returns red for rating < 2", () => {
    expect(getRatingBadgeStyle(1)).toContain("red");
    expect(getRatingBadgeStyle(0)).toContain("red");
    expect(getRatingBadgeStyle(1.4)).toContain("red"); // rounds to 1
  });

  it("rounds rating before checking thresholds", () => {
    expect(getRatingBadgeStyle(3.7)).toContain("emerald"); // rounds to 4 -> emerald
    expect(getRatingBadgeStyle(3.4)).toContain("blue"); // rounds to 3 -> blue
    expect(getRatingBadgeStyle(2.5)).toContain("blue"); // rounds to 3 -> blue
    expect(getRatingBadgeStyle(1.5)).toContain("amber"); // rounds to 2 -> amber
  });
});

describe("Status label constants", () => {
  it("has labels for all task statuses", () => {
    expect(TASK_STATUS_LABELS.not_started).toBe("Chưa thực hiện");
    expect(TASK_STATUS_LABELS.in_progress).toBe("Đang làm");
    expect(TASK_STATUS_LABELS.pending_approval).toBe("Chờ duyệt");
    expect(TASK_STATUS_LABELS.completed).toBe("Hoàn thành");
    expect(TASK_STATUS_LABELS.cancelled).toBe("Đã hủy");
  });

  it("has labels for all plan statuses", () => {
    expect(PLAN_STATUS_LABELS.not_started).toBe("Chưa làm");
    expect(PLAN_STATUS_LABELS.in_progress).toBe("Đang làm");
    expect(PLAN_STATUS_LABELS.completed).toBe("Hoàn thành");
    expect(PLAN_STATUS_LABELS.paused).toBe("Tạm dừng");
    expect(PLAN_STATUS_LABELS.cancelled).toBe("Đã hủy");
  });

  it("has labels for all leave statuses", () => {
    expect(LEAVE_STATUS_LABELS.pending).toBe("Chờ duyệt");
    expect(LEAVE_STATUS_LABELS.approved).toBe("Đã duyệt");
    expect(LEAVE_STATUS_LABELS.rejected).toBe("Từ chối");
    expect(LEAVE_STATUS_LABELS.cancelled).toBe("Đã hủy");
  });

  it("has labels for all attendance statuses", () => {
    expect(ATTENDANCE_STATUS_LABELS.on_time).toBe("Đúng giờ");
    expect(ATTENDANCE_STATUS_LABELS.late).toBe("Đi muộn");
    expect(ATTENDANCE_STATUS_LABELS.early_leave).toBe("Về sớm");
    expect(ATTENDANCE_STATUS_LABELS.absent).toBe("Vắng mặt");
  });
});

describe("Status hex color constants", () => {
  it("has hex colors for all task statuses", () => {
    expect(TASK_STATUS_HEX.completed).toMatch(/^#[0-9a-f]{6}$/);
    expect(TASK_STATUS_HEX.in_progress).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("has hex colors for all plan statuses", () => {
    expect(PLAN_STATUS_HEX.completed).toMatch(/^#[0-9a-f]{6}$/);
    expect(PLAN_STATUS_HEX.in_progress).toMatch(/^#[0-9a-f]{6}$/);
  });
});
