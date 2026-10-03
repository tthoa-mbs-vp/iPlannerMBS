import { describe, it, expect } from "vitest";
import {
  clampRating,
  getRatingBadgeStyle,
  getRatingLabel,
  ratingFromAvgScore,
  RATING_COLORS,
  RATING_DEFAULT,
  RATING_LABELS,
  RATING_MAX,
  RATING_MIN,
  RATING_SCALE,
  TASK_STATUS_LABELS,
  PLAN_STATUS_LABELS,
  LEAVE_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  TASK_STATUS_HEX,
  PLAN_STATUS_HEX,
} from "../utils/constants";

describe("thang KPI 1–10", () => {
  it("covers every integer from 1 to 10", () => {
    expect(RATING_MIN).toBe(1);
    expect(RATING_MAX).toBe(10);
    expect(RATING_SCALE).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has a label and a chart colour for every step of the scale", () => {
    for (const r of RATING_SCALE) {
      expect(RATING_LABELS[r], `label for ${r}`).toBeTruthy();
    }
    expect(RATING_COLORS).toHaveLength(RATING_SCALE.length);
    expect(new Set(RATING_COLORS).size).toBe(RATING_COLORS.length);
  });

  it("keys RATING_COLORS by offset so RATING_COLORS[r - 1] lines up", () => {
    expect(RATING_COLORS[0]).toBe(RATING_COLORS[RATING_MIN - 1]);
    expect(RATING_COLORS[9]).toBe(RATING_COLORS[RATING_MAX - 1]);
  });

  it("getRatingLabel falls back to the raw score outside the scale", () => {
    expect(getRatingLabel(7)).toBe(RATING_LABELS[7]);
    expect(getRatingLabel(7.4)).toBe(RATING_LABELS[7]);
    expect(getRatingLabel(42)).toBe("42");
  });

  it("clampRating keeps values inside 1–10 and rounds", () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(-5)).toBe(1);
    expect(clampRating(11)).toBe(10);
    expect(clampRating(7.6)).toBe(8);
    expect(clampRating(Number.NaN)).toBe(1);
  });

  it("keeps the default rating inside the scale", () => {
    expect(RATING_DEFAULT).toBeGreaterThanOrEqual(RATING_MIN);
    expect(RATING_DEFAULT).toBeLessThanOrEqual(RATING_MAX);
  });
});

describe("ratingFromAvgScore", () => {
  it("passes a full 10/10 score straight through", () => {
    expect(ratingFromAvgScore(10)).toBe(10);
  });

  it("rounds mid scores instead of dumping them into 1–4 (old 1–5 scale)", () => {
    expect(ratingFromAvgScore(7)).toBe(7);
    expect(ratingFromAvgScore(8.2)).toBe(8);
    expect(ratingFromAvgScore(9.6)).toBe(10);
  });

  it("never leaves the 1–10 scale", () => {
    expect(ratingFromAvgScore(0)).toBe(1);
    expect(ratingFromAvgScore(-3)).toBe(1);
    expect(ratingFromAvgScore(12)).toBe(10);
    expect(ratingFromAvgScore(Number.NaN)).toBe(1);
  });
});

describe("getRatingBadgeStyle (thang 1–10)", () => {
  it("returns emerald for the top band (>= 8)", () => {
    expect(getRatingBadgeStyle(10)).toContain("emerald");
    expect(getRatingBadgeStyle(8)).toContain("emerald");
    expect(getRatingBadgeStyle(8.5)).toContain("emerald");
  });

  it("returns blue for the upper-mid band (>= 6)", () => {
    expect(getRatingBadgeStyle(7)).toContain("blue");
    expect(getRatingBadgeStyle(6)).toContain("blue");
  });

  it("returns amber for the lower-mid band (>= 4)", () => {
    expect(getRatingBadgeStyle(5)).toContain("amber");
    expect(getRatingBadgeStyle(4)).toContain("amber");
  });

  it("returns red for the bottom band (< 4)", () => {
    expect(getRatingBadgeStyle(3)).toContain("red");
    expect(getRatingBadgeStyle(1)).toContain("red");
    expect(getRatingBadgeStyle(0)).toContain("red"); // clamped to 1
  });

  it("clamps out-of-range ratings instead of falling through", () => {
    expect(getRatingBadgeStyle(99)).toContain("emerald");
    expect(getRatingBadgeStyle(-99)).toContain("red");
  });

  it("rounds rating before checking thresholds", () => {
    expect(getRatingBadgeStyle(7.7)).toContain("emerald"); // rounds to 8
    expect(getRatingBadgeStyle(5.6)).toContain("blue"); // rounds to 6
    expect(getRatingBadgeStyle(4.5)).toContain("amber"); // rounds to 5
    expect(getRatingBadgeStyle(3.5)).toContain("amber"); // rounds to 4 -> amber band
    expect(getRatingBadgeStyle(3.4)).toContain("red"); // rounds to 3 -> red band
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
