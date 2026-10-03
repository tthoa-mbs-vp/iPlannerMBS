import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TaskWorkflowFlow from "../components/plans/TaskWorkflowFlow";
import { WORKFLOW_EDGES } from "../utils/taskWorkflow";
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

describe("TaskWorkflowFlow", () => {
  it("vẽ tiêu đề và thông báo rỗng khi chưa có nhiệm vụ", () => {
    render(<TaskWorkflowFlow tasks={[]} />);
    expect(screen.getByText("Luồng giao việc")).toBeInTheDocument();
    expect(screen.getByText("Chưa có nhiệm vụ nào để vẽ luồng.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("vẽ đủ node và nét nối của sơ đồ", () => {
    const { container } = render(
      <TaskWorkflowFlow tasks={[makeTask("in_progress")]} />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();

    const nodeIds = ["start", "doing", "review", "done", "extend", "cancel", "cancelled"];
    for (const id of nodeIds) {
      expect(container.querySelector(`[data-node="${id}"]`)).not.toBeNull();
    }
    // Mỗi nét trong WORKFLOW_EDGES phải có đúng một path trong SVG.
    const edgePaths = container.querySelectorAll("[data-edge]");
    expect(edgePaths).toHaveLength(WORKFLOW_EDGES.length);
  });

  it("hiện nhãn các bước và số nhiệm vụ tương ứng", () => {
    render(
      <TaskWorkflowFlow
        tasks={[makeTask("in_progress"), makeTask("in_progress"), makeTask("completed")]}
      />,
    );
    expect(screen.getByText("Giao việc")).toBeInTheDocument();
    expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("Hoàn thành")).toBeInTheDocument();
    // Danh sách chú giải liệt kê số theo từng bước đang có nhiệm vụ.
    expect(screen.getByText("Đang làm")).toBeInTheDocument();
    expect(screen.getByText(/tổng 3/)).toBeInTheDocument();
  });

  it("chỉ ra bước đang tắc nhiều nhiệm vụ nhất", () => {
    render(
      <TaskWorkflowFlow
        tasks={[makeTask("not_started"), makeTask("pending_approval"), makeTask("pending_approval")]}
      />,
    );
    expect(screen.getByText(/Đang tắc: Chờ duyệt \(2\)/)).toBeInTheDocument();
  });

  it("bỏ qua nhiệm vụ đã xoá mềm", () => {
    render(<TaskWorkflowFlow tasks={[makeTask("in_progress", { is_deleted: true })]} />);
    expect(screen.getByText("Chưa có nhiệm vụ nào để vẽ luồng.")).toBeInTheDocument();
  });
});