import type { KpiScore, Task } from "@shared/types";

export function calculateKpi(task: Task): Partial<KpiScore> {
  const isAdHoc = task.category === "sudden" || task.is_ad_hoc === true;
  const isHighImpact = task.category === "important" || task.is_high_impact === true;

  const baseScore = isAdHoc ? 12 : 10;

  let difficultyCoeff = 1.0;
  if (isHighImpact) {
    difficultyCoeff = 1.2;
  } else if (
    task.coordinating_dept_id ||
    task.expand?.plan_id?.partner_dept_ids?.length
  ) {
    difficultyCoeff = 1.1;
  }

  let scheduleLevel = 0;
  if (task.status === "completed") {
    const completedAt = task.completed_at
      ? new Date(task.completed_at)
      : new Date(task.updated);
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const daysLate = (completedAt.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLate <= 0) scheduleLevel = 1.0;
      else if (daysLate <= 3) scheduleLevel = 0.8;
      else if (daysLate <= 5) scheduleLevel = 0.6;
      else scheduleLevel = 0.0;
    } else {
      scheduleLevel = 1.0;
    }
  }

  const rating = task.rating || 0;
  const resultLevel = rating / 10.0;

  const performanceScore = Math.round(baseScore * (0.3 * scheduleLevel + 0.7 * resultLevel) * 10) / 10;

  const actualScore = Math.round(performanceScore * difficultyCoeff * 10) / 10;

  const maxConvertedScore = Math.round(baseScore * difficultyCoeff * 10) / 10;

  return {
    task_id: task.id,
    base_score: baseScore,
    difficulty_coeff: difficultyCoeff,
    max_converted_score: maxConvertedScore,
    progress_score: Math.round(scheduleLevel * 100),
    result_rating: rating,
    final_score: actualScore,
  };
}
