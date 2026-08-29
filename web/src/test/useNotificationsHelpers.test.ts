import { describe, it, expect } from "vitest";
import { decodeRef, getNotificationTypeLabel, getNotificationLink } from "../hooks/useNotifications";

describe("decodeRef", () => {
  it("decodes JSON reference_id with taskId", () => {
    const ref = { reference_id: JSON.stringify({ taskId: "t1", taskName: "Test Task" }) };
    const result = decodeRef(ref as any);
    expect(result.taskId).toBe("t1");
    expect(result.taskName).toBe("Test Task");
  });

  it("decodes JSON reference_id with announcementId", () => {
    const ref = { reference_id: JSON.stringify({ announcementId: "a1", title: "Announcement" }) };
    const result = decodeRef(ref as any);
    expect(result.announcementId).toBe("a1");
    expect(result.title).toBe("Announcement");
  });

  it("decodes legacy dash-format reference_id", () => {
    const ref = { reference_id: "task-id-hello-world", type: "mention" };
    const result = decodeRef(ref as any);
    expect(result.taskId).toBe("task");
    expect(result.taskName).toBe("id-hello-world");
  });

  it("falls back to message from type label", () => {
    const ref = { reference_id: JSON.stringify({ taskId: "t1" }), type: "mention" };
    const result = decodeRef(ref as any);
    expect(result.message).toBe("Đề cập");
  });

  it("returns raw reference_id as message for empty ref", () => {
    const ref = { reference_id: "", type: "task_update" };
    const result = decodeRef(ref as any);
    expect(result.message).toBe("");
  });

  it("handles JSON reference with custom message", () => {
    const ref = { reference_id: JSON.stringify({ taskId: "t1", message: "Custom msg" }) };
    const result = decodeRef(ref as any);
    expect(result.message).toBe("Custom msg");
  });
});

describe("getNotificationTypeLabel", () => {
  it("returns correct labels for known types", () => {
    expect(getNotificationTypeLabel("mention")).toBe("Đề cập");
    expect(getNotificationTypeLabel("reply")).toBe("Trả lời");
    expect(getNotificationTypeLabel("deadline_warning")).toBe("Hạn chót");
    expect(getNotificationTypeLabel("task_update")).toBe("Cập nhật");
    expect(getNotificationTypeLabel("proposal_update")).toBe("Đề xuất");
    expect(getNotificationTypeLabel("announcement")).toBe("Thông báo");
  });

  it("returns raw type for unknown types", () => {
    expect(getNotificationTypeLabel("custom_type")).toBe("custom_type");
  });

  it("returns empty string for empty type", () => {
    expect(getNotificationTypeLabel("")).toBe("");
  });
});

describe("getNotificationLink", () => {
  it("returns announcement link when announcementId is present", () => {
    const n = {
      reference_id: JSON.stringify({ announcementId: "a1", taskId: "t1" }),
      type: "announcement",
    } as any;
    expect(getNotificationLink(n)).toBe("/announcements/a1");
  });

  it("returns task link when taskId is present", () => {
    const n = {
      reference_id: JSON.stringify({ taskId: "t1" }),
      type: "mention",
    } as any;
    expect(getNotificationLink(n)).toBe("/tasks/t1");
  });

  it("returns # when no reference", () => {
    const n = { reference_id: "", type: "task_update" } as any;
    expect(getNotificationLink(n)).toBe("#");
  });
});
