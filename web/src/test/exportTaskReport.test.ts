import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  userName,
  buildTaskReportRow,
  collectTaskAttachments,
  buildTaskInfoBlock,
  buildDiscussionItems,
  defaultSignatureRoles,
  safeFilename,
} from "../utils/exportTaskReport";
import type { Task, Comment } from "@shared/types";

// getFileUrl chỉ cần trả về chuỗi ổn định để assert URL dựng đúng.
vi.mock("../api/client", () => ({
  getFileUrl: (collection: string, id: string, filename: string) =>
    `http://pb.test/api/files/${collection}/${id}/${filename}`,
}));

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    name: "Lập báo cáo Q3",
    description: "",
    status: "completed",
    category: "normal",
    executor_id: "u1",
    supervisor_id: "u2",
    collaborator_ids: [],
    start_date: "2026-07-01",
    deadline: "2026-09-30",
    rating: 8,
    is_high_impact: true,
    ...over,
  } as unknown as Task;
}

function makeComment(over: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    task_id: "t1",
    user_id: "u1",
    content: "Đã xong",
    files: [],
    created: "2026-08-01T10:00:00.000Z",
    ...over,
  } as unknown as Comment;
}

beforeEach(() => vi.clearAllMocks());

describe("userName", () => {
  it("ưu tiên tên, fallback sang email, cuối cùng là gạch dài", () => {
    expect(userName({ name: "An", email: "an@mbs.com" })).toBe("An");
    expect(userName({ email: "an@mbs.com" })).toBe("an@mbs.com");
    expect(userName({})).toBe("—");
    expect(userName(undefined)).toBe("—");
  });
});

describe("buildTaskReportRow", () => {
  it("map đầy đủ khi task có expand", () => {
    const task = makeTask({
      expand: {
        plan_id: { name: "KH Q3" },
        host_dept_id: { name: "Phòng CNTT" },
        executor_id: { name: "Bình" },
        supervisor_id: { name: "Cường" },
        collaborator_ids: [{ name: "Dũng" }, { email: "e@mbs.com" }],
      },
    } as Partial<Task>);

    const row = buildTaskReportRow(task);
    expect(row).toMatchObject({
      name: "Lập báo cáo Q3",
      plan: "KH Q3",
      host_dept: "Phòng CNTT",
      executor: "Bình",
      supervisor: "Cường",
      collaborators: "Dũng, e@mbs.com",
      category: "Thường xuyên",
      status: "Hoàn thành",
      is_high_impact: "Có",
      rating: "8",
    });
  });

  it("fallback khi thiếu dữ liệu mở rộng", () => {
    const row = buildTaskReportRow(makeTask({ rating: 0 } as Partial<Task>));
    expect(row.plan).toBe("Nhiệm vụ độc lập");
    expect(row.host_dept).toBe("—");
    expect(row.executor).toBe("—");
    expect(row.collaborators).toBe("—");
    expect(row.rating).toBe("—");
  });

  it("giữ nguyên category/status lạ thay vì mất", () => {
    const row = buildTaskReportRow(makeTask({ category: "khong-ro" as never, status: "la_gi" as never }));
    expect(row.category).toBe("khong-ro");
    expect(row.status).toBe("la_gi");
  });

  it("chấm điểm trọng điểm = Không khi is_high_impact false", () => {
    expect(buildTaskReportRow(makeTask({ is_high_impact: false })).is_high_impact).toBe("Không");
  });

  it("file_count mặc định 0, ngày thiếu hiển thị dấu gạch", () => {
    const row = buildTaskReportRow(makeTask({ start_date: "", deadline: "" }));
    expect(row.file_count).toBe(0);
    expect(row.start_date).toBe("—");
    expect(row.deadline).toBe("—");
  });
});

describe("collectTaskAttachments", () => {
  it("chỉ lấy file của đúng task, dựng URL qua getFileUrl", () => {
    const out = collectTaskAttachments(makeTask(), [
      makeComment({ files: ["a.png", "b.pdf"] }),
      makeComment({ id: "c2", task_id: "task-khac", files: ["x.png"] }),
    ]);
    expect(out).toEqual([
      { taskId: "t1", taskName: "Lập báo cáo Q3", commentId: "c1", filename: "a.png", url: "http://pb.test/api/files/comments/c1/a.png" },
      { taskId: "t1", taskName: "Lập báo cáo Q3", commentId: "c1", filename: "b.pdf", url: "http://pb.test/api/files/comments/c1/b.pdf" },
    ]);
  });

  it("bỏ qua comment không có file", () => {
    expect(collectTaskAttachments(makeTask(), [makeComment({ files: [] }), makeComment({ id: "c2" })])).toEqual([]);
  });
});

describe("buildTaskInfoBlock", () => {
  it("sinh đủ khối thông tin theo thứ tự nhãn", () => {
    const block = buildTaskInfoBlock(makeTask());
    expect(block.title).toBe("Lập báo cáo Q3");
    expect(block.fields.map((f) => f.label)).toEqual([
      "Kế hoạch", "Phòng chủ trì", "Người thực hiện", "Người giám sát",
      "Phối hợp", "Phân loại", "Ngày bắt đầu", "Hạn hoàn thành",
      "Trạng thái", "Trọng điểm", "Xếp loại",
    ]);
  });
});

describe("buildDiscussionItems", () => {
  it("map tên tác giả, thời gian, nội dung và file", () => {
    const items = buildDiscussionItems([
      makeComment({ expand: { user_id: { name: "Bình" } } } as Partial<Comment>),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].author).toBe("Bình");
    expect(items[0].content).toBe("Đã xong");
    expect(items[0].files).toEqual([]);
    expect(items[0].time).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("defaultSignatureRoles", () => {
  it("luôn giám sát trước, người thực hiện sau", () => {
    const roles = defaultSignatureRoles(
      makeTask({ expand: { supervisor_id: { name: "Cường" }, executor_id: { name: "Bình" } } } as Partial<Task>),
    );
    expect(roles).toEqual([
      { label: "Người giám sát", name: "Cường" },
      { label: "Người thực hiện", name: "Bình" },
    ]);
  });

  it("thiếu người thì hiện gạch dài thay vì bỏ trống", () => {
    expect(defaultSignatureRoles(makeTask())[0].name).toBe("—");
  });
});

describe("safeFilename", () => {
  it("thay ký tự cấm trong tên file và cắt còn 60 ký tự", () => {
    expect(safeFilename('Báo cáo: Q3/2026?')).toBe("Báo cáo_ Q3_2026_");
    expect(safeFilename("x".repeat(100))).toHaveLength(60);
  });

  it("rơi về tên mặc định khi rỗng hoặc toàn ký tự cấm", () => {
    expect(safeFilename("")).toBe("bao-cao");
    expect(safeFilename("///")).toBe("bao-cao");
  });
});