import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WifiConfigModal from "../components/attendance/WifiConfigModal";

const createMock = vi.fn();

vi.mock("../hooks/useAttendance", () => ({
  useAttendanceConfigs: () => ({ data: [], isLoading: false }),
  useCreateAttendanceConfig: () => ({ isPending: false, mutateAsync: createMock }),
  useUpdateAttendanceConfig: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteAttendanceConfig: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

function openForm() {
  render(<WifiConfigModal onClose={() => {}} />);
  fireEvent.click(screen.getByText("Thêm điểm WiFi mới"));
  fireEvent.change(screen.getByPlaceholderText("VD: Văn phòng chính - Tầng 5"), {
    target: { value: "VP Hà Nội" },
  });
  fireEvent.change(screen.getByPlaceholderText("VD: Office WiFi"), {
    target: { value: "MBS_Office" },
  });
}

describe("WifiConfigModal — allowed_ips", () => {
  beforeEach(() => {
    createMock.mockClear();
  });

  it("blocks save and shows an error for malformed IP/CIDR entries", () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText("VD: 192.168.1.0/24, 192.168.1.5"), {
      target: { value: "192.168.1.0/33, not-an-ip" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(screen.getByText(/Định dạng không hợp lệ/)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("saves valid IP, CIDR and wildcard entries as an array", async () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText("VD: 192.168.1.0/24, 192.168.1.5"), {
      target: { value: "192.168.1.0/24, 192.168.1.5, *" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(await vi.waitFor(() => createMock.mock.calls.length)).toBe(1);
    const payload = createMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.allowed_ips).toEqual(["192.168.1.0/24", "192.168.1.5", "*"]);
  });

  it("treats an empty field as an empty list (server falls back to private-range check)", async () => {
    openForm();
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));

    expect(await vi.waitFor(() => createMock.mock.calls.length)).toBe(1);
    expect((createMock.mock.calls[0][0] as Record<string, unknown>).allowed_ips).toEqual([]);
  });
});
