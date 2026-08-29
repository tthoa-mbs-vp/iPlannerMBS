import { describe, it, expect } from "vitest";
import { planInUserGroups, taskInUserGroups, userGroupIds } from "../utils/groupScope";

describe("planInUserGroups", () => {
  it("returns false for null plan", () => {
    expect(planInUserGroups(null, ["g1"])).toBe(false);
  });

  it("returns false for undefined plan", () => {
    expect(planInUserGroups(undefined, ["g1"])).toBe(false);
  });

  it("returns false for empty groupIds", () => {
    expect(planInUserGroups({ group_id: "g1" } as any, [])).toBe(false);
  });

  it("returns false for undefined groupIds", () => {
    expect(planInUserGroups({ group_id: "g1" } as any, undefined)).toBe(false);
  });

  it("returns true when plan group matches user groups", () => {
    expect(planInUserGroups({ group_id: "g1" } as any, ["g1", "g2"])).toBe(true);
  });

  it("returns false when plan group doesn't match", () => {
    expect(planInUserGroups({ group_id: "g3" } as any, ["g1", "g2"])).toBe(false);
  });

  it("returns false when plan has no group_id", () => {
    expect(planInUserGroups({ group_id: null } as any, ["g1"])).toBe(false);
  });

  it("returns false when plan has no group_id (undefined)", () => {
    expect(planInUserGroups({} as any, ["g1"])).toBe(false);
  });
});

describe("taskInUserGroups", () => {
  it("returns false for empty groupIds", () => {
    const task = { expand: { plan_id: { group_id: "g1" } } } as any;
    expect(taskInUserGroups(task, [])).toBe(false);
  });

  it("returns false for undefined groupIds", () => {
    const task = { expand: { plan_id: { group_id: "g1" } } } as any;
    expect(taskInUserGroups(task, undefined)).toBe(false);
  });

  it("returns true when task's plan group matches", () => {
    const task = { expand: { plan_id: { group_id: "g1" } } } as any;
    expect(taskInUserGroups(task, ["g1"])).toBe(true);
  });

  it("returns false when task's plan group doesn't match", () => {
    const task = { expand: { plan_id: { group_id: "g3" } } } as any;
    expect(taskInUserGroups(task, ["g1"])).toBe(false);
  });

  it("returns false when task has no plan", () => {
    const task = { expand: {} } as any;
    expect(taskInUserGroups(task, ["g1"])).toBe(false);
  });

  it("returns false when task expand is undefined", () => {
    const task = { expand: undefined } as any;
    expect(taskInUserGroups(task, ["g1"])).toBe(false);
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
    expect(userGroupIds({ group_ids: ["g1", null as any, "g2", undefined as any, ""] })).toEqual(["g1", "g2"]);
  });

  it("returns valid group IDs", () => {
    expect(userGroupIds({ group_ids: ["g1", "g2", "g3"] })).toEqual(["g1", "g2", "g3"]);
  });
});
