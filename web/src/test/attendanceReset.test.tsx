import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AttendancePage from "../pages/AttendancePage";

const mockUserState = {
  user: {
    id: "1",
    email: "nv@mbs.com",
    department_id: "dept-1",
    expand: {
      department_id: { id: "dept-1", name: "Phòng CNTT" },
      role_id: { can_manage: false, view_scope: "all" },
    },
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockUserState) => unknown) => (selector ? selector(mockUserState) : mockUserState)),
}));  let mockConfigs: Record<string, unknown>[] = [];  let mockLogs: Record<string, unknown>[] = [];
vi.mock("../hooks/useAttendance", () => ({
  useAttendanceLogs: () => ({ data: mockLogs, isLoading: false }),
  useAttendanceConfigs: () => ({ data: mockConfigs }),
  useCheckIn: () => ({ isPending: false, mutate: vi.fn() }),
  useCheckOut: () => ({ isPending: false, mutate: vi.fn() }),
}));

const cfg = (id: string) => ({
  id,
  office_name: `VP ${id}`,
  wifi_ssid: `MBS-${id}`,
  is_active: true,
  work_start_time: "08:00",
  work_end_time: "17:30",
  late_tolerance_minutes: 15,
});

describe("AttendancePage — default config selection (render-time adjustment)", () => {
  it("selects the first active config once configs are available", () => {
    mockConfigs = [cfg("cfg1"), cfg("cfg2")];
    render(<AttendancePage />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("cfg1");
  });

  it("keeps a manual selection across re-renders", () => {
    mockConfigs = [cfg("cfg1"), cfg("cfg2")];
    const { rerender } = render(<AttendancePage />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "cfg2" } });
    rerender(<AttendancePage />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("cfg2");
  });

  it("defaults the selection when configs arrive after mount", () => {
    mockConfigs = [];
    const { rerender } = render(<AttendancePage />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    mockConfigs = [cfg("cfg1"), cfg("cfg2")];
    rerender(<AttendancePage />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("cfg1");
  });

  it("shows 'Hợp lệ' only after a successful check-in today", () => {
    mockConfigs = [cfg("cfg1")];
    mockLogs = [];
    const { rerender } = render(<AttendancePage />);
    // before check-in the card is honest: no "Hợp lệ" claim
    expect(screen.getByText("Chấm công qua mạng nội bộ")).toBeInTheDocument();
    expect(screen.queryByText("Hợp lệ")).not.toBeInTheDocument();

    // a check-in recorded today (server-verified) flips the badge to "Hợp lệ"
    mockLogs = [{ id: "log1", check_in: new Date().toISOString(), method: "wifi", status: "on_time", notes: "" }];
    rerender(<AttendancePage />);
    expect(screen.getByText("Hợp lệ")).toBeInTheDocument();
    expect(screen.queryByText("Chấm công qua mạng nội bộ")).not.toBeInTheDocument();
  });
});
