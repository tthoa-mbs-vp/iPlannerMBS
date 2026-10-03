import { describe, it, expect } from "vitest";
import {
  WORKFLOW_EDGES,
  WORKFLOW_NODE_HEIGHT,
  WORKFLOW_NODE_WIDTH,
  buildWorkflow,
  findBottleneck,
  nodePosition,
  workflowCanvas,
  workflowEdgeGeometry,
  workflowStatusLabel,
} from "../utils/taskWorkflow";
import type { Task, TaskStatus } from "@shared/types";

function makeTask(status: TaskStatus, extra: Partial<Task> = {}): Task {
  return {
    id: "task",
    name: "Task",
    executor_id: "u1",
    supervisor_id: "u2",
    collaborator_ids: [],
    category: "normal",
    host_dept_id: "d1",
    start_date: "2026-01-01",
    deadline: "2026-06-30",
    status,
    is_recurring: false,
    is_deleted: false,
    created: "2026-01-01",
    updated: "2026-01-01",
    ...extra,
  } as Task;
}

describe("buildWorkflow", () => {
  it("đếm nhiệm vụ vào đúng bước tương ứng với trạng thái", () => {
    const { nodes, total } = buildWorkflow([
      makeTask("not_started"),
      makeTask("in_progress"),
      makeTask("in_progress"),
      makeTask("pending_approval"),
    ]);

    expect(total).toBe(4);
    const byId = new Map(nodes.map((n) => [n.id, n.count]));
    expect(byId.get("start")).toBe(1);
    expect(byId.get("doing")).toBe(2);
    expect(byId.get("review")).toBe(1);
    expect(byId.get("done")).toBe(0);
  });

  it("loại nhiệm vụ đã xoá mềm khỏi số liệu", () => {
    const { nodes, total } = buildWorkflow([
      makeTask("completed"),
      makeTask("completed", { is_deleted: true }),
    ]);
    expect(total).toBe(1);
    expect(nodes.find((n) => n.id === "done")?.count).toBe(1);
  });

  it("bỏ qua record null và báo số nhiệm vụ ở trạng thái lạ", () => {
    const bogus = { status: "archived" } as unknown as Task;
    const { total, missing } = buildWorkflow([makeTask("completed"), bogus, null as unknown as Task]);
    expect(total).toBe(2);
    expect(missing).toBe(1);
  });

  it("trả về toàn bộ bước kể cả khi không có nhiệm vụ nào", () => {
    const { nodes, total, missing } = buildWorkflow([]);
    expect(total).toBe(0);
    expect(missing).toBe(0);
    expect(nodes).toHaveLength(7);
    expect(nodes.every((n) => n.count === 0)).toBe(true);
  });
});

describe("findBottleneck", () => {
  it("chọn bước giữa luồng đang đọng nhiều nhất", () => {
    const { nodes } = buildWorkflow([
      makeTask("not_started"),
      makeTask("pending_approval"),
      makeTask("pending_approval"),
      makeTask("completed"),
      makeTask("completed"),
    ]);
    expect(findBottleneck(nodes)?.id).toBe("review");
  });

  it("không coi hai đầu luồng là điểm tắc", () => {
    const { nodes } = buildWorkflow([
      makeTask("not_started"),
      makeTask("not_started"),
      makeTask("completed"),
    ]);
    expect(findBottleneck(nodes)).toBeNull();
  });

  it("trả về null khi không có nhiệm vụ", () => {
    const { nodes } = buildWorkflow([]);
    expect(findBottleneck(nodes)).toBeNull();
  });
});

describe("hình học flowchart", () => {
  /** Toạ độ X đầu tiên trong `d` của một path — dùng để so hai nét cùng cột. */
  function firstX(path: string | undefined): number | undefined {
    return path?.match(/-?\d+(\.\d+)?/g)?.map(Number)[0];
  }
  it("xếp node theo lưới không chồng nhau", () => {
    expect(nodePosition({ row: 0, col: 0 })).toEqual({ x: 0, y: 0 });
    expect(nodePosition({ row: 1, col: 2 })).toEqual({
      x: 2 * (WORKFLOW_NODE_WIDTH + 56),
      y: WORKFLOW_NODE_HEIGHT + 62,
    });
  });

  it("tính khung vẽ bao trọn node xa nhất, kể cả làn nét quay lại", () => {
    const { nodes } = buildWorkflow([]);
    const canvas = workflowCanvas(nodes);
    expect(canvas.width).toBe(3 * (WORKFLOW_NODE_WIDTH + 56) + WORKFLOW_NODE_WIDTH);
    // Cao hơn đúng một hàng node vì còn chỗ cho làn nét quay lại vòng dưới.
    const lowestRowBottom = 1 * (WORKFLOW_NODE_HEIGHT + 62) + WORKFLOW_NODE_HEIGHT;
    expect(canvas.height).toBeGreaterThan(lowestRowBottom);
  });

  it("sinh path hợp lệ cho mọi nét nối trong luồng", () => {
    const { nodes } = buildWorkflow([]);
    const geometry = workflowEdgeGeometry(nodes);
    expect(geometry).toHaveLength(WORKFLOW_EDGES.length);
    for (const edge of geometry) {
      expect(edge.path).toMatch(/^M [\d.-]+ [\d.-]+/);
      expect(Number.isFinite(edge.labelX)).toBe(true);
      expect(Number.isFinite(edge.labelY)).toBe(true);
    }
  });

  it("vẽ nét quay lại cùng hàng vòng lên trên để không đè nét chính", () => {
    const { nodes } = buildWorkflow([]);
    const back = workflowEdgeGeometry(nodes).find((e) => e.from === "review" && e.to === "doing");
    // Nét quay lại là đường cong (không phải thẳng) và đỉnh nằm trên hàng 0.
    expect(back?.path).toContain("C");
    expect(back?.labelY).toBeLessThan(0);
  });

  it("vẽ nét nhánh đi xuống hàng dưới", () => {
    const { nodes } = buildWorkflow([]);
    const branch = workflowEdgeGeometry(nodes).find((e) => e.from === "doing" && e.to === "extend");
    expect(branch?.path).toContain("L");
    expect(branch?.path).not.toContain("C");
    expect(branch?.labelAnchorEnd).toBe(true);
  });

  it("vẽ nét quay lại cùng cột lệch khỏi nét nhánh đi xuống để không trùng nhau", () => {
    const { nodes } = buildWorkflow([]);
    const geo = workflowEdgeGeometry(nodes);
    const down = geo.find((e) => e.from === "doing" && e.to === "extend");
    const up = geo.find((e) => e.from === "extend" && e.to === "doing");
    expect(down?.path).not.toBe(up?.path);
    // Hai nét cùng cột: toạ độ X phải khác nhau.
    expect(firstX(down?.path)).not.toBe(firstX(up?.path));
  });

  it("cho nét quay lại khác cột vòng quanh hàng dưới thay vì cắt qua node", () => {
    const { nodes } = buildWorkflow([]);
    // "Đề xuất hủy" -> "Đang làm" là nét khác cột: kéo thẳng sẽ cắt hộp
    // "Đề xuất gia hạn", nên nó phải có đoạn nằm ngang dưới hàng cuối.
    const edge = workflowEdgeGeometry(nodes).find((e) => e.from === "cancel" && e.to === "doing");
    expect(edge?.path.split(" L ").length).toBeGreaterThanOrEqual(4);
  });
});

describe("workflowStatusLabel", () => {
  it("trả về nhãn tiếng Việt của trạng thái", () => {
    expect(workflowStatusLabel("pending_approval")).toBe("Chờ duyệt");
  });
});