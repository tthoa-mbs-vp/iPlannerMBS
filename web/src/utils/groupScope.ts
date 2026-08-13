import type { Plan, Task } from "@shared/types";

export function planInUserGroups(plan: Plan | null | undefined, groupIds: string[] | undefined): boolean {
  if (!plan || !groupIds || groupIds.length === 0) return false;
  return !!plan.group_id && groupIds.includes(plan.group_id);
}

export function taskInUserGroups(task: Task, groupIds: string[] | undefined): boolean {
  if (!groupIds || groupIds.length === 0) return false;
  const plan = task.expand?.plan_id;
  if (plan) return planInUserGroups(plan, groupIds);
  return false;
}

export function userGroupIds(user?: { group_ids?: string[] } | null): string[] {
  return (user?.group_ids || []).filter(Boolean) as string[];
}
