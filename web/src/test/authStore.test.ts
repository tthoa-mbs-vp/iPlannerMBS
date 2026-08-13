import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pocketbase before importing authStore
const mockGetOne = vi.fn();
const mockAuthWithPassword = vi.fn();
const mockClear = vi.fn();
const mockAuthStore = { isValid: false, model: null, clear: mockClear };

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn(() => ({
      authWithPassword: mockAuthWithPassword,
      getOne: mockGetOne,
    })),
    authStore: mockAuthStore,
  },
  setRememberMe: vi.fn(),
}));

describe("authStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.isValid = false;
    mockAuthStore.model = null;
  });

  it("exports useAuthStore hook", async () => {
    const mod = await import("../stores/authStore");
    expect(mod.useAuthStore).toBeDefined();
  });

  it("has default state", async () => {
    const mod = await import("../stores/authStore");
    const state = mod.useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it("calls authWithPassword on login and fetches expanded user", async () => {
    const mockRecord = { id: "user1", email: "a@b.com" };
    mockAuthWithPassword.mockResolvedValue({ record: mockRecord });
    mockGetOne.mockResolvedValue({
      id: "user1",
      email: "a@b.com",
      expand: { role_id: { can_manage: true }, department_id: {} },
    });

    const mod = await import("../stores/authStore");
    await mod.useAuthStore.getState().login("a@b.com", "pwd");

    expect(mockAuthWithPassword).toHaveBeenCalledWith("a@b.com", "pwd");
    expect(mockGetOne).toHaveBeenCalledWith("user1", {
      expand: "department_id,role_id,group_ids",
    });

    const state = mod.useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.expand?.role_id?.can_manage).toBe(true);
  });

  it("clears auth on logout", async () => {
    const mod = await import("../stores/authStore");
    mod.useAuthStore.getState().logout();
    expect(mockClear).toHaveBeenCalled();
    const state = mod.useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
