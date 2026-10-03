import { describe, it, expect } from "vitest";
import { compareRoleRank, isHigherRank } from "@shared/types";

describe("compareRoleRank", () => {
  it("puts the lower number (higher position) first", () => {
    expect(compareRoleRank(1, 2)).toBeLessThan(0);
    expect(compareRoleRank(2, 1)).toBeGreaterThan(0);
    expect(compareRoleRank(3, 3)).toBe(0);
  });

  it("pushes roles without a rank to the end", () => {
    expect(compareRoleRank(undefined, 5)).toBeGreaterThan(0);
    expect(compareRoleRank(5, undefined)).toBeLessThan(0);
    expect(compareRoleRank(undefined, undefined)).toBe(0);
    expect(compareRoleRank(0, 1)).toBeGreaterThan(0);
  });
});

describe("isHigherRank", () => {
  it("models the real org order: Giám đốc > Phó > Trưởng phòng", () => {
    expect(isHigherRank(1, 2)).toBe(true); // Giám đốc trên Phó
    expect(isHigherRank(2, 3)).toBe(true); // Phó trên Trưởng phòng
    expect(isHigherRank(3, 1)).toBe(false);
  });

  it("treats two unranked roles as equal, never claiming one outranks the other", () => {
    expect(isHigherRank(undefined, undefined)).toBe(false);
    expect(isHigherRank(0, 0)).toBe(false);
  });
});
