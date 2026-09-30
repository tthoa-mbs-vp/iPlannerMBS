// Type declarations for the shared KPI formula module (_kpi-formula.cjs).
// PocketBase loads it via require(); the web app imports it and Rollup's CJS
// interop exposes module.exports as the default export.

export interface KpiFormulaInput {
  category?: string;
  is_ad_hoc?: boolean;
  is_high_impact?: boolean;
  hasPartnerDept?: boolean;
  status?: string;
  completed_at?: string | null;
  updated?: string;
  deadline?: string | null;
  rating?: number;
}

export interface KpiFormulaResult {
  base_score: number;
  difficulty_coeff: number;
  max_converted_score: number;
  progress_score: number;
  result_rating: number;
  final_score: number;
}

declare const kpiFormula: {
  computeKpiScore(input: KpiFormulaInput): KpiFormulaResult;
};

export default kpiFormula;
