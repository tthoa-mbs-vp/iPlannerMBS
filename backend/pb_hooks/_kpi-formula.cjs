// KPI formula — SINGLE SOURCE OF TRUTH for both runtimes.
//
//   - Backend:  required by helpers.js via require(__hooks + "/_kpi-formula.cjs")
//               (PocketBase's require() only resolves absolute paths inside the
//               pb_hooks dir — the PB_39 requirement). Kept free of PB globals
//               so the same file also loads in plain Node for unit tests.
//   - Web app:  imported by web/src/utils/kpi.ts and bundled by Vite.
//
// The function takes PLAIN data (no PocketBase Record, no React state) — each
// caller adapts its own task representation to the input contract:
//
//   computeKpiScore({
//     category,        // "normal" | "sudden" | "important"
//     is_ad_hoc,       // boolean
//     is_high_impact,  // boolean
//     hasPartnerDept,  // boolean — coordinated with another department/group
//     status,          // task status ("completed" drives the schedule level)
//     completed_at,    // ISO string | null
//     updated,         // ISO string (fallback completion stamp)
//     deadline,        // ISO string | null
//     rating,          // number 0..5
//   })
//
// Returns the same shape that kpi_scores records store:
//   { base_score, difficulty_coeff, max_converted_score, progress_score,
//     result_rating, final_score }
//
// If you change the formula, update BOTH callers' expectations AND the test
// vectors in backend/test/helpers_logic.test.js + web/src/test/kpi.test.ts.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory()
  } else {
    root.KpiFormula = factory()
  }
})(typeof self !== "undefined" ? self : this, function () {
  function computeKpiScore(input) {
    input = input || {}
    var isAdHoc = input.category === "sudden" || !!input.is_ad_hoc
    var isHighImpact = input.category === "important" || !!input.is_high_impact

    var baseScore = isAdHoc ? 12 : 10

    var difficultyCoeff = 1.0
    if (isHighImpact) {
      difficultyCoeff = 1.2
    } else if (input.hasPartnerDept) {
      difficultyCoeff = 1.1
    }

    var scheduleLevel = 0
    if (input.status === "completed") {
      var completedAt = input.completed_at || input.updated
      var deadline = input.deadline
      if (completedAt && deadline) {
        var daysLate =
          (new Date(completedAt).getTime() - new Date(deadline).getTime()) /
          (1000 * 60 * 60 * 24)
        if (daysLate <= 0) scheduleLevel = 1.0
        else if (daysLate <= 3) scheduleLevel = 0.8
        else if (daysLate <= 5) scheduleLevel = 0.6
        else scheduleLevel = 0.0
      } else {
        // missing deadline or completion stamp -> no lateness evidence, treat as on-time
        scheduleLevel = 1.0
      }
    }

    var rating = Number(input.rating) || 0
    var resultLevel = rating / 5.0

    var round1 = function (v) { return Math.round(v * 10) / 10 }

    var performanceScore = round1(baseScore * (0.3 * scheduleLevel + 0.7 * resultLevel))
    var actualScore = round1(performanceScore * difficultyCoeff)
    var maxConvertedScore = round1(baseScore * difficultyCoeff)

    return {
      base_score: baseScore,
      difficulty_coeff: difficultyCoeff,
      max_converted_score: maxConvertedScore,
      progress_score: Math.round(scheduleLevel * 100),
      result_rating: rating,
      final_score: actualScore,
    }
  }

  return { computeKpiScore: computeKpiScore }
})
