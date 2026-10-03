import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ── Mock PocketBase ───────────────────────────────────────────────────────
const mockGetFullList = vi.fn();

vi.mock("../api/client", () => ({
  pb: {
    collection: vi.fn((_name: string) => ({
      getFullList: mockGetFullList,
      getList: vi.fn(),
      getOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
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
describe("useAttendanceLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches attendance logs with default 180 days", async () => {
    const mockLogs = [
      { id: "1", user_id: "user1", check_in: "2026-01-15T08:00:00Z", status: "on_time" },
    ];
    mockGetFullList.mockResolvedValue(mockLogs);

    const { useAttendanceLogs } = await import("../hooks/useAttendance");
    const { result } = renderHook(() => useAttendanceLogs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockLogs);
    expect(mockGetFullList).toHaveBeenCalled();
  });

  it("fetches logs filtered by userId", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useAttendanceLogs } = await import("../hooks/useAttendance");
    const { result } = renderHook(() => useAttendanceLogs("user1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetFullList).toHaveBeenCalled();
  });

  it("fetches logs with custom days param", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useAttendanceLogs } = await import("../hooks/useAttendance");
    const { result } = renderHook(() => useAttendanceLogs("user1", 30), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetFullList).toHaveBeenCalled();
  });
});

describe("useAttendanceConfigs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches attendance configs", async () => {
    const mockConfigs = [
      { id: "1", office_name: "HQ", wifi_ssid: "MBS-WiFi", work_start_time: "08:00", work_end_time: "17:00", late_tolerance_minutes: 15, is_active: true },
    ];
    mockGetFullList.mockResolvedValue(mockConfigs);

    const { useAttendanceConfigs } = await import("../hooks/useAttendance");
    const { result } = renderHook(() => useAttendanceConfigs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConfigs);
  });

  it("returns empty array when no configs", async () => {
    mockGetFullList.mockResolvedValue([]);

    const { useAttendanceConfigs } = await import("../hooks/useAttendance");
    const { result } = renderHook(() => useAttendanceConfigs(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
