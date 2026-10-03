import type { Task, TaskStatus } from "@shared/types";
import { TASK_STATUS_HEX, TASK_STATUS_LABELS } from "./constants";

/**
 * Mô hình luồng giao việc của một nhiệm vụ.
 *
 * Mỗi node là **một bước nghiệp vụ** kèm người thực hiện; số trên node là số
 * nhiệm vụ hiện đang đứng ở bước đó. Nhờ vậy biểu đồ trả lời được ba câu hỏi:
 * luồng đi đâu, ai làm, đang tắc ở bước nào.
 *
 * Luồng chính (nguồn sự thật lấy từ `TaskDetailPage`):
 *   Giao việc → Executor nhận việc → Executor gửi minh chứng → Người duyệt
 *   duyệt + xếp loại 1–10 → Hoàn thành.
 *
 * Nhánh phụ (từ `ProposalSection`): gia hạn / hủy đề xuất do người thực hiện gửi,
 * người duyệt duyệt thì hủy (cancelled) hoặc gia hạn (về lại đang làm); từ chối
 * thì quay về đang làm.
 */

/** Vai trò chịu trách nhiệm cho một bước. */
export type WorkflowActor = "planner" | "executor" | "approver" | "system";

/** Nhóm bước — dùng để tô màu và để người đọc quét nhanh. */
export type WorkflowPhase = "start" | "doing" | "review" | "done" | "exception";

export interface WorkflowNode {
  /** Khóa node, dùng làm id ổn định cho test và cho React key. */
  id: string;
  /** Trạng thái `TaskStatus` mà node này đại diện (null = bước quyết định). */
  status: TaskStatus | null;
  /** Tên bước, hiển thị trên node. */
  title: string;
  /** Ai thực hiện bước này. */
  actor: WorkflowActor;
  /** Mô tả ngắn hành động, hiển thị dưới tên bước. */
  action: string;
  phase: WorkflowPhase;
  /** Hàng (0 = luồng chính, 1 = nhánh phụ). */
  row: number;
  /** Cột trong hàng. */
  col: number;
  /** Số nhiệm vụ đang ở bước này. */
  count: number;
  /** Màu viền/nền lấy từ màu trạng thái tương ứng. */
  hex: string;
}

/** Kiểu nét nối: chính = tiến trình, back = quay lại trạng thái trước. */
export type WorkflowEdgeKind = "forward" | "back" | "branch";

export interface WorkflowEdge {
  from: string;
  to: string;
  /** Nhãn trên nét, ví dụ "Từ chối". */
  label: string;
  kind: WorkflowEdgeKind;
}

/** Nhãn tiếng Việt của từng vai trò. */
export const WORKFLOW_ACTOR_LABELS: Record<WorkflowActor, string> = {
  planner: "Người lập kế hoạch",
  executor: "Người thực hiện",
  approver: "Người duyệt",
  system: "Hệ thống",
};

/**
 * Khung cạnh (box) của node, tính bằng đơn vị ảo. Component nhân với tỉ lệ
 * hiển thị nên flowchart co giãn được ở mọi bề rộng màn hình.
 */
export const WORKFLOW_NODE_WIDTH = 176;
export const WORKFLOW_NODE_HEIGHT = 74;
/** Khoảng cách ngang giữa hai node cùng hàng. */
export const WORKFLOW_COL_GAP = 56;
/** Khoảng cách dọc giữa luồng chính và nhánh phụ. */
export const WORKFLOW_ROW_GAP = 62;

/** Các node của luồng, cố định theo thứ tự nghiệp vụ. */
export const WORKFLOW_NODES: Omit<WorkflowNode, "count">[] = [
  {
    id: "start",
    status: "not_started",
    title: "Giao việc",
    actor: "planner",
    action: "Giao cho người thực hiện",
    phase: "start",
    row: 0,
    col: 0,
    hex: TASK_STATUS_HEX.not_started,
  },
  {
    id: "doing",
    status: "in_progress",
    title: "Đang làm",
    actor: "executor",
    action: "Nhận việc và xử lý",
    phase: "doing",
    row: 0,
    col: 1,
    hex: TASK_STATUS_HEX.in_progress,
  },
  {
    id: "review",
    status: "pending_approval",
    title: "Chờ duyệt",
    actor: "approver",
    action: "Kiểm tra minh chứng",
    phase: "review",
    row: 0,
    col: 2,
    hex: TASK_STATUS_HEX.pending_approval,
  },
  {
    id: "done",
    status: "completed",
    title: "Hoàn thành",
    actor: "approver",
    action: "Duyệt & xếp loại 1–10",
    phase: "done",
    row: 0,
    col: 3,
    hex: TASK_STATUS_HEX.completed,
  },
  {
    id: "extend",
    status: "proposed_extension",
    title: "Đề xuất gia hạn",
    actor: "executor",
    action: "Xin nới thời hạn",
    phase: "exception",
    row: 1,
    col: 1,
    hex: TASK_STATUS_HEX.proposed_extension,
  },
  {
    id: "cancel",
    status: "proposed_cancellation",
    title: "Đề xuất hủy",
    actor: "executor",
    action: "Xin dừng nhiệm vụ",
    phase: "exception",
    row: 1,
    col: 2,
    hex: TASK_STATUS_HEX.proposed_cancellation,
  },
  {
    id: "cancelled",
    status: "cancelled",
    title: "Đã hủy",
    actor: "system",
    action: "Kết thúc không hoàn thành",
    phase: "exception",
    row: 1,
    col: 3,
    hex: TASK_STATUS_HEX.cancelled,
  },
];

/** Các nét nối giữa các node. */
export const WORKFLOW_EDGES: WorkflowEdge[] = [
  { from: "start", to: "doing", label: "Nhận việc", kind: "forward" },
  { from: "doing", to: "review", label: "Gửi minh chứng", kind: "forward" },
  { from: "review", to: "done", label: "Duyệt", kind: "forward" },
  { from: "review", to: "doing", label: "Từ chối", kind: "back" },
  { from: "doing", to: "extend", label: "Gia hạn", kind: "branch" },
  { from: "extend", to: "doing", label: "Duyệt", kind: "back" },
  { from: "doing", to: "cancel", label: "Hủy", kind: "branch" },
  { from: "cancel", to: "cancelled", label: "Duyệt", kind: "forward" },
  { from: "cancel", to: "doing", label: "Từ chối", kind: "back" },
];

/**
 * Đếm số nhiệm vụ theo từng bước của luồng.
 *
 * Nhiệm vụ đã xoá mềm bị loại để số trên node khớp với danh sách nhiệm vụ mà
 * người dùng nhìn thấy. Trạng thái lạ (không khớp node nào) bị bỏ qua — đồng
 * thời người gọi có thể dùng `buildWorkflow` để biết tổng số nhiệm vụ thực.
 */
export function buildWorkflow(tasks: Task[]): { nodes: WorkflowNode[]; total: number; missing: number } {
  const counts = new Map<TaskStatus, number>();
  let total = 0;
  for (const task of tasks) {
    if (!task || task.is_deleted) continue;
    total += 1;
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  }

  const nodes = WORKFLOW_NODES.map((node) => ({
    ...node,
    count: node.status ? (counts.get(node.status) ?? 0) : 0,
  }));

  // Chỉ những trạng thái khớp một node mới được tính là đã vẽ lên sơ đồ.
  const mappedStatuses = new Set(
    WORKFLOW_NODES.map((n) => n.status).filter((s): s is TaskStatus => s !== null),
  );
  let mapped = 0;
  for (const [status, count] of counts) {
    if (mappedStatuses.has(status)) mapped += count;
  }

  return { nodes, total, missing: total - mapped };
}

/** Bước đang tắc nhiều nhiệm vụ nhất — dùng để nhấn mạnh trên header. */
export function findBottleneck(nodes: WorkflowNode[]): WorkflowNode | null {
  // Không tính "Giao việc"/"Hoàn thành" là tắc: đó là hai đầu của luồng, người
  // dùng cần biết giữa chừng đang kẹt ở đâu.
  const mid = nodes.filter((n) => n.phase !== "done" && n.phase !== "start");
  let worst: WorkflowNode | null = null;
  for (const node of mid) {
    if (node.count > 0 && (!worst || node.count > worst.count)) worst = node;
  }
  return worst;
}

/** Nhãn trạng thái hiển thị (fallback về chính khoá nếu chưa có nhãn). */
export function workflowStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

/**
 * Vị trí node trong hệ toạ độ ảo, tính từ (row, col) + khoảng cách cố định.
 * Tách riêng khỏi component để test được bằng phép tính thuần.
 */
export function nodePosition(node: Pick<WorkflowNode, "row" | "col">): { x: number; y: number } {
  return {
    x: node.col * (WORKFLOW_NODE_WIDTH + WORKFLOW_COL_GAP),
    y: node.row * (WORKFLOW_NODE_HEIGHT + WORKFLOW_ROW_GAP),
  };
}

/** Kích thước khung vẽ bao trọn mọi node (chưa gồm lề). */
export function workflowCanvas(nodes: WorkflowNode[]): { width: number; height: number } {
  const maxCol = Math.max(...nodes.map((n) => n.col));
  const maxRow = Math.max(...nodes.map((n) => n.row));
  return {
    width: maxCol * (WORKFLOW_NODE_WIDTH + WORKFLOW_COL_GAP) + WORKFLOW_NODE_WIDTH,
    // Cộng thêm làn cho nét quay lại vòng dưới hàng cuối.
    height:
      maxRow * (WORKFLOW_NODE_HEIGHT + WORKFLOW_ROW_GAP) +
      WORKFLOW_NODE_HEIGHT +
      BACK_LANE_GAP +
      BACK_LANE_BOTTOM,
  };
}

/** Lề khung vẽ, chừa chỗ cho nhãn của nét quay lại vòng lên trên. */
export const WORKFLOW_PADDING = { top: 46, left: 24, right: 24, bottom: 24 };

/** Độ vồng của nét quay lại cùng hàng (nét vẽ vòng lên trên hộp). */
const BACK_ARC = 34;

/** Lệch ngang của nét nhánh, để không dính đúng cạnh hộp. */
const BRANCH_OFFSET = 26;

/**
 * Độ sâu của làn nét quay lại vòng dưới hàng cuối, tính từ đáy node thấp nhất.
 * Nét này chạy ngang giữa mọi cột nên phải nằm dưới hàng để không cắt qua hộp.
 */
const BACK_LANE_GAP = 32;
/** Khoảng cách từ làn nét tới đáy khung, để nhãn nằm vừa trong viewBox. */
const BACK_LANE_BOTTOM = 20;
/**
 * Lề an toàn bên trái node đích, là nơi nét quay lại vòng xuống dọc lên.
 * Phải nằm ngoài mọi cột để không cắt qua hộp của node khác.
 */
const BACK_SIDE_MARGIN = 24;

/** Một nét nối đã quy đổi sang toạ độ ảo, sẵn sàng đưa vào `<path d="...">`. */
export interface WorkflowEdgeGeometry {
  from: string;
  to: string;
  kind: WorkflowEdgeKind;
  /** Nhãn của nét, copy nguyên vẹn từ `WORKFLOW_EDGES`. */
  label: string;
  path: string;
  /** Vị trí nhãn, đã tính sẵn để component không phải tự tính lại. */
  labelX: number;
  labelY: number;
  /** `true` khi nhãn nên neo bằng `text-anchor: end` để không tràn ra ngoài. */
  labelAnchorEnd: boolean;
}

/**
 * Quy đổi danh sách nét nối sang hình học vẽ được.
 *
 * Ba kiểu nét đi theo ba cách khác nhau để không đè lên nhau:
 * - `forward` cùng hàng: nằm ngang giữa hai hộp;
 * - `back` cùng hàng: vòng lên trên, tránh đè nằm ngang của nét chính;
 * - `branch` xuống hàng: đi xuống, lệch vài pixel khỏi cạnh hộp.
 *
 * `back` đi chéo giữa hai hàng vẽ thẳng — ở góc đó không có nằm ngang nào để đè.
 */
export function workflowEdgeGeometry(nodes: WorkflowNode[]): WorkflowEdgeGeometry[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return WORKFLOW_EDGES.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      // Nét trỏ tới node không tồn tại: trả về `path` rỗng để component bỏ qua
      // thay vì vẽ ra một đường vô nghĩa.
      return { ...edge, path: "", labelX: 0, labelY: 0, labelAnchorEnd: false };
    }
    const a = nodePosition(from);
    const b = nodePosition(to);
    const midY = a.y + WORKFLOW_NODE_HEIGHT / 2;

    if (from.row === to.row) {
      if (edge.kind === "back") {
        const x1 = a.x + WORKFLOW_NODE_WIDTH / 2;
        const x2 = b.x + WORKFLOW_NODE_WIDTH / 2;
        const top = Math.min(a.y, b.y);
        return {
          ...edge,
          path: `M ${x1} ${a.y} C ${x1} ${a.y - BACK_ARC}, ${x2} ${b.y - BACK_ARC}, ${x2} ${b.y}`,
          labelX: (x1 + x2) / 2,
          labelY: top - 12,
          labelAnchorEnd: false,
        };
      }
      const rightward = b.x > a.x;
      return {
        ...edge,
        path: rightward
          ? `M ${a.x + WORKFLOW_NODE_WIDTH} ${midY} L ${b.x} ${midY}`
          : `M ${a.x} ${midY} L ${b.x + WORKFLOW_NODE_WIDTH} ${midY}`,
        labelX: rightward ? (a.x + WORKFLOW_NODE_WIDTH + b.x) / 2 : (a.x + b.x + WORKFLOW_NODE_WIDTH) / 2,
        labelY: midY - 10,
        labelAnchorEnd: false,
      };
    }

    if (to.row > from.row) {
      const x = a.x + WORKFLOW_NODE_WIDTH / 2 + (from.col === to.col ? 0 : BRANCH_OFFSET);
      return {
        ...edge,
        path: `M ${x} ${a.y + WORKFLOW_NODE_HEIGHT} L ${b.x + WORKFLOW_NODE_WIDTH / 2} ${b.y}`,
        labelX: x + 8,
        labelY: (a.y + WORKFLOW_NODE_HEIGHT + b.y) / 2,
        labelAnchorEnd: true,
      };
    }

    const bottomY = a.y + WORKFLOW_NODE_HEIGHT;
    // Cùng cột: thẳng đứng từ đỉnh hộp dưới lên đáy hộp trên, chạy qua khe
    // trống giữa hai hàng. Lệch trái so với nét nhánh đi xuống cùng cột để
    // hai nét không trùng nhau.
    if (from.col === to.col) {
      const x = a.x + WORKFLOW_NODE_WIDTH / 2 - BRANCH_OFFSET;
      return {
        ...edge,
        path: `M ${x} ${a.y} L ${x} ${b.y + WORKFLOW_NODE_HEIGHT}`,
        labelX: x - 8,
        labelY: (a.y + b.y + WORKFLOW_NODE_HEIGHT) / 2,
        labelAnchorEnd: true,
      };
    }

    // Khác cột: phải vòng dưới hàng cuối rồi đi lên bên trái node đích. Kéo
    // thẳng sẽ cắt qua các node ở giữa (ví dụ "Đề xuất hủy" → "Đang làm" cắt
    // hộp "Đề xuất gia hạn"), còn đi lên giữa cột thì cắt chính node đó.
    const lane = bottomY + BACK_LANE_GAP;
    const exitX = a.x + WORKFLOW_NODE_WIDTH / 2;
    const enterY = b.y + WORKFLOW_NODE_HEIGHT / 2;
    const sideX = b.x - BACK_SIDE_MARGIN;
    return {
      ...edge,
      path: `M ${exitX} ${bottomY} L ${exitX} ${lane} L ${sideX} ${lane} L ${sideX} ${enterY} L ${b.x} ${enterY}`,
      labelX: (exitX + sideX) / 2,
      labelY: lane - 6,
      labelAnchorEnd: false,
    };
  });
}