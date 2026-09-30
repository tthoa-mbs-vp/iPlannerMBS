import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChannelChat from "../components/chat/ChannelChat";

const mockUserState = {
  user: { id: "u1", email: "a@b.com", expand: { role_id: {} } },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
};

vi.mock("../stores/authStore", () => ({
  useAuthStore: vi.fn((selector?: (s: typeof mockUserState) => unknown) => (selector ? selector(mockUserState) : mockUserState)),
}));

vi.mock("../hooks/useDepartments", () => ({
  useUsers: () => ({ data: [{ id: "u2", name: "B", email: "b@b.com" }] }),
}));

// Stub the chat building blocks so the test can observe the search filter state.
vi.mock("../components/chat/chatShared", () => ({
  ChatComposer: () => <div>composer</div>,
  ChatFilters: ({ search, onSearchChange }: { search: string; onSearchChange: (v: string) => void }) => (
    <input aria-label="Tìm kiếm" value={search} onChange={(e) => onSearchChange(e.target.value)} />
  ),
  AttachmentDisplay: () => null,
  formatTime: (s: string) => s,
  highlightMentions: (s: string) => s,
  filterMessages: (msgs: unknown[]) => msgs,
  chatSenders: () => [],
  useFilePreview: () => ({ url: null, open: () => {}, close: () => {} }),
}));

vi.mock("../components/shared/FilePreviewModal", () => ({ default: () => null }));

vi.mock("../hooks/useInfiniteChatScroll", () => ({
  useInfiniteChatScroll: () => ({
    listRef: { current: null },
    items: [],
    onScroll: () => {},
    scrollToBottom: () => {},
  }),
}));

vi.mock("../hooks/useChatMessages", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../hooks/useChatMessages")>();
  return {
    ...mod,
    useChannelMessages: () => ({
      data: undefined,
      isPending: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: () => {},
    }),
    useCreateChatMessage: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useDeleteChatMessage: () => ({ mutateAsync: vi.fn() }),
    useChatRealtime: () => {},
  };
});

describe("ChannelChat — filter reset on channel change (render-time reset)", () => {
  it("clears the search filter when switching channels", () => {
    const { rerender } = render(<ChannelChat channel={{ type: "org" }} />);
    const input = screen.getByRole("textbox", { name: "Tìm kiếm" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input.value).toBe("abc");

    rerender(<ChannelChat channel={{ type: "department", deptId: "dept-1" }} />);
    expect((screen.getByRole("textbox", { name: "Tìm kiếm" }) as HTMLInputElement).value).toBe("");
  });

  it("keeps filters when re-rendering the same channel", () => {
    const { rerender } = render(<ChannelChat channel={{ type: "org" }} />);
    const input = screen.getByRole("textbox", { name: "Tìm kiếm" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });

    rerender(<ChannelChat channel={{ type: "org" }} />);
    expect((screen.getByRole("textbox", { name: "Tìm kiếm" }) as HTMLInputElement).value).toBe("abc");
  });
});
