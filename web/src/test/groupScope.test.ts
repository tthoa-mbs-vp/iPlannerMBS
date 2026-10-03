import { describe, it, expect } from "vitest";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";
import type { Plan, Task } from "@shared/types";

// Các case dưới chỉ cần vài field, không dựng nguyên record.
const plan = (fields: Partial<Plan>) => fields as Plan;
const task = (fields: Partial<Task>) => fields as Task;

describe("planInUserGroups", () => {
  it("returns false for null plan", () => {
    expect(planInUserGroups(null, ["g1"])).toBe(false);
  });

  it("returns false for undefined plan", () => {
    expect(planInUserGroups(undefined, ["g1"])).toBe(false);
  });

  it("returns false for empty groupIds", () => {
    expect(planInUserGroups(plan({ group_id: "g1" }), [])).toBe(false);
  });

  it("returns false for undefined groupIds", () => {
    expect(planInUserGroups(plan({ group_id: "g1" }), undefined)).toBe(false);
  });

  it("returns true when plan group matches user groups", () => {
    expect(planInUserGroups(plan({ group_id: "g1" }), ["g1", "g2"])).toBe(true);
  });

  it("returns false when plan group doesn't match", () => {
    expect(planInUserGroups(plan({ group_id: "g3" }), ["g1", "g2"])).toBe(false);
  });

  it("returns false when plan has no group_id", () => {
    expect(planInUserGroups(plan({ group_id: null as unknown as string }), ["g1"])).toBe(false);
  });

  it("returns false when plan has no group_id (undefined)", () => {
    expect(planInUserGroups(plan({}), ["g1"])).toBe(false);
  });
});

describe("taskInUserGroups", () => {
  it("returns false for empty groupIds", () => {
    const t = task({ expand: { plan_id: plan({ group_id: "g1" }) } });
    expect(taskInUserGroups(t, [])).toBe(false);
  });

  it("returns false for undefined groupIds", () => {
    const t = task({ expand: { plan_id: plan({ group_id: "g1" }) } });
    expect(taskInUserGroups(t, undefined)).toBe(false);
  });

  it("returns true when task's plan group matches", () => {
    const t = task({ expand: { plan_id: plan({ group_id: "g1" }) } });
    expect(taskInUserGroups(t, ["g1"])).toBe(true);
  });

  it("returns false when task's plan group doesn't match", () => {
    const t = task({ expand: { plan_id: plan({ group_id: "g3" }) } });
    expect(taskInUserGroups(t, ["g1"])).toBe(false);
  });

  it("returns false when task has no plan", () => {
    const t = task({ expand: {} });
    expect(taskInUserGroups(t, ["g1"])).toBe(false);
  });

  it("returns false when task expand is undefined", () => {
    const t = task({ expand: undefined });
    expect(taskInUserGroups(t, ["g1"])).toBe(false);
  });
});

describe("userGroupIds", () => {
  it("returns empty array for undefined user", () => {
    expect(userGroupIds(undefined)).toEqual([]);
  });

  it("returns empty array for null user", () => {
    expect(userGroupIds(null)).toEqual([]);
  });

  it("returns empty array when group_ids is undefined", () => {
    expect(userGroupIds({})).toEqual([]);
  });

  it("returns empty array when group_ids is empty", () => {
    expect(userGroupIds({ group_ids: [] })).toEqual([]);
  });

  it("filters out falsy values", () => {
    const messy = ["g1", null, "g2", undefined, ""] as unknown as string[];
    expect(userGroupIds({ group_ids: messy })).toEqual(["g1", "g2"]);
  });

  it("returns valid group IDs", () => {
    expect(userGroupIds({ group_ids: ["g1", "g2", "g3"] })).toEqual(["g1", "g2", "g3"]);
  });
});
