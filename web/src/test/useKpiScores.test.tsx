import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mock PocketBase ───────────────────────────────────────────────────────
const mockGetFullList = vi.fn();

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn(() => ({
      getFullList: mockGetFullList,
      getList: vi.fn(),
      getOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    send: vi.fn(),
    authStore: { record: { id: "user1" }, isValid: true },
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("useKpiScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches all KPI scores", async () => {
    const mockScores = [
      { id: "k1", task_id: "t1", base_score: 80, final_score: 75 },
      { id: "k2", task_id: "t2", base_score: 90, final_score: 85 },
    ];
    mockGetFullList.mockResolvedValue(mockScores);

    const { useKpiScores } = await import("../hooks/useKpiScores");
    const { result } = renderHook(() => useKpiScores(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockScores);
    expect(mockGetFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.stringContaining("id,task_id,base_score"),
        expand: "task_id",
      }),
    );
  });

  it("returns empty array when no scores", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useKpiScores } = await import("../hooks/useKpiScores");
    const { result } = renderHook(() => useKpiScores(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("uses requestKey for deduplication", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useKpiScores } = await import("../hooks/useKpiScores");
    renderHook(() => useKpiScores(), { wrapper: Wrapper });
    renderHook(() => useKpiScores(), { wrapper: Wrapper });

    await waitFor(() => {
      // Should only be called once due to requestKey deduplication
      expect(mockGetFullList).toHaveBeenCalledTimes(1);
    });
  });
});
