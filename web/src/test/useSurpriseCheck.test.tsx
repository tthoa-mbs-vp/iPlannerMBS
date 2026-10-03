import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mock PocketBase ───────────────────────────────────────────────────────
const mockSend = vi.fn();
const mockGetFullList = vi.fn();

vi.mock("../api/client", () => ({
  pb: {
    send: mockSend,
    collection: vi.fn(() => ({
      getFullList: mockGetFullList,
    })),
    authStore: { record: { id: "admin1" }, isValid: true },
    realtime: {
      subscribe: vi.fn(() => Promise.resolve(() => {})),
    },
  },
}));

// Mock auth store
vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector: (s: { user?: { id: string } }) => unknown) =>
    selector({ user: { id: "user1" } })
  ),
}));

// Mock useMutationWithToast for mutation hooks
vi.mock("../hooks/useMutationWithToast", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useMutationWithToast: (fn: (...args: unknown[]) => Promise<unknown>) =>
      useMutation({ mutationFn: fn }),
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("useActiveSurpriseCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("returns null when no active check", async () => {
    mockSend.mockResolvedValue({ active: null });

    const { useActiveSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useActiveSurpriseCheck(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("returns active check data", async () => {
    const mockActive = {
      id: "campaign1",
      name: "Kiểm tra đột xuất",
      started_at: "2026-01-15T10:00:00Z",
      response_window_minutes: 15,
      responded: false,
    };
    mockSend.mockResolvedValue({ active: mockActive });

    const { useActiveSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useActiveSurpriseCheck(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockActive);
  });

  it("returns null on error", async () => {
    mockSend.mockRejectedValue(new Error("Network error"));

    const { useActiveSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useActiveSurpriseCheck(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("useRespondToCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("sends password response", async () => {
    mockSend.mockResolvedValue({ ok: true, message: "Xác nhận thành công" });

    const { useRespondToCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useRespondToCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      campaignId: "campaign1",
      password: "Test@123",
      method: "password",
    });

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/respond", {
      method: "POST",
      body: expect.objectContaining({
        campaign_id: "campaign1",
        password: "Test@123",
        method: "password",
      }),
    });
  });

  it("sends biometric response", async () => {
    mockSend.mockResolvedValue({ ok: true, message: "Xác nhận thành công" });

    const { useRespondToCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useRespondToCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      campaignId: "campaign1",
      method: "biometric",
    });

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/respond", {
      method: "POST",
      body: expect.objectContaining({
        campaign_id: "campaign1",
        method: "biometric",
      }),
    });
  });

  it("includes device_info in request", async () => {
    mockSend.mockResolvedValue({ ok: true });

    const { useRespondToCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useRespondToCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      campaignId: "campaign1",
      password: "pass",
      method: "password",
    });

    const body = mockSend.mock.calls[0][1].body;
    expect(body.device_info).toBeDefined();
    expect(typeof body.device_info).toBe("string");
  });
});

describe("useStartSurpriseCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("starts a campaign with default values", async () => {
    mockSend.mockResolvedValue({
      ok: true,
      campaign_id: "c1",
      total_users: 10,
      window_minutes: 15,
    });

    const { useStartSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useStartSurpriseCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync({});

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/start", {
      method: "POST",
      body: expect.objectContaining({
        name: "Kiểm tra đột xuất",
        response_window_minutes: 15,
      }),
    });
  });

  it("starts a campaign with custom values", async () => {
    mockSend.mockResolvedValue({
      ok: true,
      campaign_id: "c2",
      total_users: 5,
      window_minutes: 30,
    });

    const { useStartSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useStartSurpriseCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync({
      name: "Check teams",
      notes: "Testing",
      targetUserIds: ["u1", "u2"],
      windowMinutes: 30,
    });

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/start", {
      method: "POST",
      body: expect.objectContaining({
        name: "Check teams",
        notes: "Testing",
        target_user_ids: ["u1", "u2"],
        response_window_minutes: 30,
      }),
    });
  });
});

describe("useCloseSurpriseCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("closes a specific campaign", async () => {
    mockSend.mockResolvedValue({ ok: true, closed: 1 });

    const { useCloseSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useCloseSurpriseCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync("campaign1");

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/close", {
      method: "POST",
      body: { campaign_id: "campaign1" },
    });
  });

  it("closes all active campaigns when no id", async () => {
    mockSend.mockResolvedValue({ ok: true, closed: 3 });

    const { useCloseSurpriseCheck } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useCloseSurpriseCheck(), { wrapper: Wrapper });

    await result.current.mutateAsync(undefined);

    expect(mockSend).toHaveBeenCalledWith("/api/surprise-check/close", {
      method: "POST",
      body: { campaign_id: "" },
    });
  });
});

describe("useSurpriseCheckResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches results for a campaign", async () => {
    const mockResults = {
      campaign: { id: "c1", name: "Test", status: "closed", started_at: "2026-01-15T10:00:00Z" },
      total: 10,
      responded: 8,
      not_responded: 2,
      details: [],
    };
    mockSend.mockResolvedValue(mockResults);

    const { useSurpriseCheckResults } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useSurpriseCheckResults("c1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(10);
    expect(result.current.data?.responded).toBe(8);
    expect(result.current.data?.not_responded).toBe(2);
  });

  it("does not fetch when campaignId is empty", async () => {
    const { useSurpriseCheckResults } = await import("../hooks/useSurpriseCheck");
    const { result } = renderHook(() => useSurpriseCheckResults(""), { wrapper: Wrapper });

    // Wait a tick to ensure query doesn't fire
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.isFetching).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
