import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TaskDetailPage from "../pages/TaskDetailPage";
import { usePageTitleStore } from "../stores/pageTitleStore";
import { RATING_DEFAULT, RATING_MAX, RATING_MIN, TASK_STATUS_LABELS } from "../utils/constants";
import type { Task } from "@shared/types";

/**
 * Test tầng UI cho TaskDetailPage — trước đây file 766 dòng này không có
 * test render nào, chỉ được phủ qua hook/util.
 *
 * Trọng tâm là luồng nghiệp vụ trên trang: nhận việc → hoàn thành (kèm
 * minh chứng) → người duyệt phê duyệt kèm chấm điểm, và việc quyền
 * canViewTask có đúng không.
 */

const mockNavigate = vi.fn();
const mockUpdateMutate = vi.fn(async () => ({}));
const mockDeleteMutate = vi.fn(async () => ({}));
const mockCommentMutate = vi.fn(async () => ({}));

let currentTask: Task | null = null;
let currentError: { message?: string } | null = null;

type AuthShape = {
  user: {
    id: string;
    name: string;
    email: string;
    expand: {
      department_id?: { id: string; name: string };
      role_id: {
        can_edit_tasks?: boolean;
        can_delete_tasks?: boolean;
        can_manage?: boolean;
        view_scope: string;
        level?: string;
      };
      group_ids?: string[];
    };
  };
};

const authUser = {
  id: "u-exec",
  name: "Nguyễn Thực Hiện",
  email: "exec@mbs.com",
  expand: {
    department_id: { id: "d1", name: "Phòng CNTT" },
    role_id: { can_edit_tasks: true, can_delete_tasks: false, can_manage: false, view_scope: "personal" },
  },
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "t1" }),
  };
});

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((sel?: (s: AuthShape) => unknown) => {
    const store = { user: authUser };
    return sel ? sel(store as unknown as AuthShape) : store;
  }),
}));

vi.mock("../hooks/useTasks", () => ({
  useTask: () => ({ data: currentTask ?? undefined, isLoading: false, error: currentError }),
  useUpdateTask: () => ({ mutateAsync: mockUpdateMutate, isPending: false }),
  useSoftDeleteTask: () => ({ mutateAsync: mockDeleteMutate, isPending: false }),
}));

vi.mock("../hooks/useComments", () => ({
  useComments: () => ({ data: [], isLoading: false }),
  useCreateComment: () => ({ mutateAsync: mockCommentMutate, isPending: false }),
}));

vi.mock("../hooks/useDepartments", () => ({
  useUsers: () => ({ data: [] }),
}));

// pb dùng cho tab Điểm KPI và export; không cần mạng trong test.
vi.mock("../api/client", () => ({
  pb: { collection: () => ({ getFullList: async () => [] }) },
  getFileUrl: (f: unknown) => String(f ?? ""),
}));

// Các section con đã có test riêng / cần DOM phức tạp.
vi.mock("../components/proposals/ProposalSection", () => ({ default: () => <div>proposals</div> }));
vi.mock("../components/tasks/CommentSection", () => ({ default: () => <div>comments</div> }));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tasks/t1"]}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/tasks" element={<div>task list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    name: "Lập báo cáo tổng kết tháng 8",
    description: "Tổng hợp số liệu 3 phòng",
    status: "not_started",
    executor_id: "u-exec",
    supervisor_id: "u-super",
    collaborator_ids: [],
    host_dept_id: "d1",
    start_date: "2026-08-01",
    deadline: "2026-09-30",
    rating: RATING_DEFAULT,
    is_ad_hoc: false,
    is_high_impact: false,
    is_recurring: false,
    ...over,
  } as Task;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockUpdateMutate.mockClear();
  mockDeleteMutate.mockClear();
  mockCommentMutate.mockClear();
  currentTask = null;
  currentError = null;
  localStorage.clear();
  usePageTitleStore.setState({ title: "", backTo: null, badge: null });
});

describe("TaskDetailPage — hiển thị", () => {
  it("hiện tên, mô tả và trạng thái của nhiệm vụ", () => {
    currentTask = makeTask({ status: "in_progress" });
    renderPage();
    expect(screen.getByText("Lập báo cáo tổng kết tháng 8")).toBeInTheDocument();
    expect(screen.getByText("Tổng hợp số liệu 3 phòng")).toBeInTheDocument();
    // Nhãn lấy từ TASK_STATUS_LABELS, không hardcode ở đây.
    expect(screen.getByText(TASK_STATUS_LABELS.in_progress)).toBeInTheDocument();
  });

  it("đặt tiêu đề trang theo tên nhiệm vụ kèm badge trạng thái", async () => {
    currentTask = makeTask({ status: "not_started" });
    renderPage();
    await waitFor(() => {
      const s = usePageTitleStore.getState();
      expect(s.title).toBe("Lập báo cáo tổng kết tháng 8");
      expect(s.badge?.label).toBe(TASK_STATUS_LABELS.not_started);
      expect(typeof s.backTo).toBe("function");
    });
  });

  it("tiến độ 0% khi chưa bắt đầu, 100% khi hoàn thành", () => {
    currentTask = makeTask({ status: "not_started" });
    const { unmount } = renderPage();
    expect(screen.getByText("0%")).toBeInTheDocument();
    unmount();

    currentTask = makeTask({ status: "completed" });
    renderPage();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("cảnh báo quá hạn khi hạn chót đã qua và chưa hoàn thành", () => {
    currentTask = makeTask({ status: "in_progress", deadline: "2020-01-01" });
    renderPage();
    expect(screen.getByText("(Quá hạn)")).toBeInTheDocument();
  });
});

describe("TaskDetailPage — quyền xem", () => {
  it("chặn khi view_scope=personal và người dùng không liên quan", () => {
    currentTask = makeTask({ executor_id: "u-khac", supervisor_id: "u-khac2" });
    renderPage();
    expect(screen.getByText("Bạn không có quyền xem nhiệm vụ này.")).toBeInTheDocument();
    expect(screen.queryByText("Lập báo cáo tổng kết tháng 8")).not.toBeInTheDocument();
  });

  it("cho xem khi người dùng là người phối hợp", () => {
    currentTask = makeTask({ executor_id: "u-khac", supervisor_id: "u-khac2", collaborator_ids: ["u-exec"] });
    renderPage();
    expect(screen.getByText("Lập báo cáo tổng kết tháng 8")).toBeInTheDocument();
  });

  it("báo lỗi khi không tải được nhiệm vụ", () => {
    currentError = { message: "Không tìm thấy nhiệm vụ" };
    renderPage();
    expect(screen.getByText("Không thể tải nhiệm vụ")).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy nhiệm vụ")).toBeInTheDocument();
  });

  it("hiện spinner khi đang tải", () => {
    currentTask = null;
    const { container } = renderPage();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("Không thể tải nhiệm vụ")).not.toBeInTheDocument();
  });
});

describe("TaskDetailPage — luồng nghiệp vụ", () => {
  it("nút Nhận nhiệm vụ chuyển trạng thái sang đang thực hiện", async () => {
    currentTask = makeTask({ status: "not_started" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Nhận nhiệm vụ" }));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalledWith({ id: "t1", data: { status: "in_progress" } }));
  });

  it("không hiện nút Nhận nhiệm vụ khi không phải người thực hiện", () => {
    currentTask = makeTask({ status: "not_started", executor_id: "u-khac" });
    renderPage();
    expect(screen.queryByRole("button", { name: "Nhận nhiệm vụ" })).not.toBeInTheDocument();
  });

  it("Hoàn thành mở modal minh chứng, không sửa trạng thái ngay", () => {
    currentTask = makeTask({ status: "in_progress" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    // Chưa được gọi API cho tới khi người dùng xác nhận trong modal.
    expect(mockUpdateMutate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Nhập nội dung báo cáo...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi & Hoàn thành" })).toBeInTheDocument();
  });

  it("Gửi & Hoàn thành kèm minh chứng chuyển sang chờ duyệt và ghi comment", async () => {
    currentTask = makeTask({ status: "in_progress" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập nội dung báo cáo..."), {
      target: { value: "Đã nộp báo cáo" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Gửi & Hoàn thành" }));
    await waitFor(() => {
      expect(mockCommentMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ task_id: "t1", content: "Đã nộp báo cáo" }),
        }),
      );
      expect(mockUpdateMutate).toHaveBeenCalledWith({ id: "t1", data: { status: "pending_approval" } });
    });
  });

  it("Hoàn thành không ghi comment khi không có minh chứng nào", async () => {
    currentTask = makeTask({ status: "in_progress" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành" }));
    await fireEvent.click(screen.getByRole("button", { name: "Gửi & Hoàn thành" }));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
    expect(mockCommentMutate).not.toHaveBeenCalled();
  });

  it("người không duyệt được thấy trạng thái chờ duyệt", () => {
    currentTask = makeTask({ status: "pending_approval" });
    renderPage();
    expect(screen.getByText("Đang chờ phê duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();
  });

  it("người duyệt thấy nút Phê duyệt / Từ chối và Từ chối đưa về đang làm", async () => {
    currentTask = makeTask({ status: "pending_approval", supervisor_id: "u-exec" });
    renderPage();
    expect(screen.getByRole("button", { name: "Phê duyệt" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    await waitFor(() =>
      expect(mockUpdateMutate).toHaveBeenCalledWith({ id: "t1", data: { status: "in_progress" } }),
    );
  });

  it("Phê duyệt mở modal đánh giá với thang 1–10", async () => {
    currentTask = makeTask({ status: "pending_approval", supervisor_id: "u-exec" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    expect(screen.getByText("Chọn xếp loại cho nhiệm vụ này")).toBeInTheDocument();
    for (let v = RATING_MIN; v <= RATING_MAX; v++) {
      expect(screen.getByRole("button", { name: String(v) })).toBeInTheDocument();
    }
  });

  it("xác nhận đánh giá đóng nhiệm vụ kèm điểm đã chọn", async () => {
    currentTask = makeTask({ status: "pending_approval", supervisor_id: "u-exec" });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    fireEvent.click(screen.getByRole("button", { name: String(RATING_MAX) }));
    // Nút xác nhận nằm trong modal đánh giá.
    const confirm = screen.getByRole("button", { name: "Xác nhận" });
    await fireEvent.click(confirm);
    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith({
        id: "t1",
        data: expect.objectContaining({
          status: "completed",
          rating: RATING_MAX,
          rated_by_id: "u-exec",
        }),
      });
    });
  });
});