import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import type { Task } from "@shared/types";
import {
  WORKFLOW_ACTOR_LABELS,
  WORKFLOW_NODE_HEIGHT,
  WORKFLOW_NODE_WIDTH,
  WORKFLOW_PADDING,
  buildWorkflow,
  findBottleneck,
  nodePosition,
  workflowCanvas,
  workflowEdgeGeometry,
  type WorkflowEdgeKind,
  type WorkflowNode,
} from "../../utils/taskWorkflow";

interface TaskWorkflowFlowProps {
  /** Danh sách nhiệm vụ của kế hoạch (đã lọc theo quyền xem). */
  tasks: Task[];
}

const EDGE_STYLES: Record<WorkflowEdgeKind, { stroke: string; dash?: string; marker: string }> = {
  forward: { stroke: "#94a3b8", marker: "wf-arrow-forward" },
  back: { stroke: "#f43f5e", dash: "5 4", marker: "wf-arrow-back" },
  branch: { stroke: "#a78bfa", dash: "6 4", marker: "wf-arrow-branch" },
};

/** Bước có nhiệm vụ đang tắc sẽ được viền đậm để lọt ra khỏi đồng đều. */
function isHot(node: WorkflowNode, bottleneckId: string | null): boolean {
  return node.count > 0 && node.id === bottleneckId;
}

export default function TaskWorkflowFlow({ tasks }: TaskWorkflowFlowProps) {
  const { nodes, total, missing } = useMemo(() => buildWorkflow(tasks), [tasks]);
  const geometry = useMemo(() => workflowEdgeGeometry(nodes), [nodes]);
  const canvas = useMemo(() => workflowCanvas(nodes), [nodes]);
  const bottleneck = useMemo(() => findBottleneck(nodes), [nodes]);

  const viewWidth = canvas.width + WORKFLOW_PADDING.left + WORKFLOW_PADDING.right;
  const viewHeight = canvas.height + WORKFLOW_PADDING.top + WORKFLOW_PADDING.bottom;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-2 shadow-lg shadow-indigo-500/20">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Luồng giao việc</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Số trên mỗi bước là số nhiệm vụ đang ở đó
              {total > 0 && ` · tổng ${total}`}
              {missing > 0 && ` · ${missing} ở trạng thái lạ, chưa vẽ`}
            </p>
          </div>
        </div>
        {bottleneck && (
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Đang tắc: {bottleneck.title} ({bottleneck.count})
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có nhiệm vụ nào để vẽ luồng.</p>
      ) : (
        <>
          <div className="overflow-x-auto pb-2">
            <svg
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              className="h-auto w-full min-w-[640px]"
              role="img"
              aria-label="Sơ đồ luồng giao việc từ giao việc đến hoàn thành"
            >
              <defs>
                {(["forward", "back", "branch"] as WorkflowEdgeKind[]).map((kind) => (
                  <marker
                    key={kind}
                    id={EDGE_STYLES[kind].marker}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLES[kind].stroke} />
                  </marker>
                ))}
              </defs>

              <g transform={`translate(${WORKFLOW_PADDING.left}, ${WORKFLOW_PADDING.top})`}>
                {/* Nét nối vẽ trước để hộp node nằm đè lên, không bị nét cắt qua. */}
                {geometry.map((edge) => {
                  if (!edge.path) return null;
                  const style = EDGE_STYLES[edge.kind];
                  return (
                    <g key={`${edge.from}-${edge.to}`} data-edge={`${edge.from}-${edge.to}`}>
                      <path
                        d={edge.path}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={1.75}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        markerEnd={`url(#${style.marker})`}
                      />
                      <text
                        x={edge.labelX}
                        y={edge.labelY}
                        textAnchor={edge.labelAnchorEnd ? "end" : "middle"}
                        className="fill-slate-400 dark:fill-slate-500"
                        style={{ fontSize: 10 }}
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}

                {nodes.map((node) => {
                  const { x, y } = nodePosition(node);
                  const hot = isHot(node, bottleneck?.id ?? null);
                  return (
                    <g key={node.id} data-node={node.id} transform={`translate(${x}, ${y})`}>
                      <rect
                        width={WORKFLOW_NODE_WIDTH}
                        height={WORKFLOW_NODE_HEIGHT}
                        rx={12}
                        fill="none"
                        stroke={node.hex}
                        strokeWidth={hot ? 2.5 : 1.5}
                        opacity={node.count > 0 || hot ? 1 : 0.45}
                      />
                      {/* Dải màu bên trái lấy theo trạng thái của bước. */}
                      <path d={`M 0 12 A 12 12 0 0 1 12 0 L 12 ${WORKFLOW_NODE_HEIGHT} L 0 ${WORKFLOW_NODE_HEIGHT} Z`} fill={node.hex} opacity={0.9} />
                      <text x={20} y={22} className="fill-slate-700 dark:fill-slate-200" style={{ fontSize: 12, fontWeight: 600 }}>
                        {node.title}
                      </text>
                      <text x={20} y={38} className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 10 }}>
                        {WORKFLOW_ACTOR_LABELS[node.actor]}
                      </text>
                      <text x={20} y={52} className="fill-slate-400 dark:fill-slate-500" style={{ fontSize: 10 }}>
                        {node.action}
                      </text>
                      <text
                        x={WORKFLOW_NODE_WIDTH - 12}
                        y={26}
                        textAnchor="end"
                        fill={node.count > 0 ? node.hex : "#cbd5e1"}
                        style={{ fontSize: 18, fontWeight: 700 }}
                      >
                        {node.count}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {nodes
              .filter((n) => n.count > 0)
              .map((n) => (
                <li key={n.id} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: n.hex }} />
                  {n.title}: <span className="font-semibold text-slate-700 dark:text-slate-200">{n.count}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}