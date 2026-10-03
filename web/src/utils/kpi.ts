import type { KpiScore, Task } from "@shared/types";
import formulaSource from "../../../backend/pb_hooks/_kpi-formula.cjs?raw";

// Vite's dev server does NOT apply CJS→ESM interop to `.cjs` SOURCE files — it
// serves them raw, so a plain `import kpiFormula from "...cjs"` yields
// `undefined` in the browser dev preview (crash "Cannot read properties of
// undefined (reading 'computeKpiScore')"). Production build (Rollup) and
// vitest (Node) handle CJS natively, which is why this only broke in dev.
//
// Fix: load the formula source as a raw string (?raw works in dev, build and
// tests) and evaluate it inside a scoped CommonJS sandbox. The formula stays
// SINGLE-SOURCE at backend/pb_hooks/_kpi-formula.cjs — the exact module the
// PocketBase hooks require via require(__hooks + "/_kpi-formula.cjs").
interface KpiFormula {
  computeKpiScore(input: {
    category?: string;
    is_ad_hoc?: boolean;
    is_high_impact?: boolean;
    hasPartnerDept?: boolean;
    status?: string;
    completed_at?: string | null;
    updated?: string;
    deadline?: string | null;
    rating?: number;
  }): {
    base_score: number;
    difficulty_coeff: number;
    max_converted_score: number;
    progress_score: number;
    result_rating: number;
    final_score: number;
  };
}

function loadKpiFormula(): KpiFormula {
  const module = { exports: {} as Record<string, unknown> };
  const localRequire = (id: string): never => {
    throw new Error(`_kpi-formula.cjs phải không phụ thuộc module khác, nhận: ${id}`);
  };
  // The UMD wrapper branches on `typeof module === "object" && module.exports`
  // — provide that shape via the sandboxed Function scope.
  new Function("module", "exports", "require", formulaSource)(module, module.exports, localRequire);
  return module.exports as unknown as KpiFormula;
}

const kpiFormula = loadKpiFormula();

// Adapter over the SINGLE-SOURCE KPI formula (backend/pb_hooks/_kpi-formula.cjs —
// the same module the PocketBase hooks use in helpers.js upsertKpi). Keeping the
// formula in one place means the KPI page preview and the server-minted scores
// can never drift apart.
export function calculateKpi(task: Task): Partial<KpiScore> {
  const result = kpiFormula.computeKpiScore({
    category: task.category,
    is_ad_hoc: task.is_ad_hoc === true,
    is_high_impact: task.is_high_impact === true,
    hasPartnerDept:
      !!task.coordinating_dept_id ||
      !!task.expand?.plan_id?.partner_dept_ids?.length,
    status: task.status,
    completed_at: task.completed_at || null,
    updated: task.updated,
    deadline: task.deadline || null,
    rating: task.rating || 0,
  });

  return {
    task_id: task.id,
    ...result,
  };
}
