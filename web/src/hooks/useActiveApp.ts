import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ACTIVE_APP_STORAGE_KEY,
  appById,
  appsForRole,
  defaultAppIdFor,
  resolveAppId,
  type AppDef,
  type RoleFlags,
} from "../config/apps";

/**
 * App đang hoạt động phải là MỘT nguồn sự thật dùng chung, không phải state cục bộ của
 * từng component.
 *
 * Lý do: Sidebar, ô chuyển app và AppBoundary đều cần biết app hiện tại. Nếu mỗi chỗ
 * tự `useState(readStored)` thì khi người dùng đổi app, AppBoundary đã mount từ trước
 * vẫn giữ giá trị cũ và ép URL về app cũ — chuyển app trông như không có tác dụng.
 * Vì vậy trạng thái nằm ở module, mọi nơi subscribe qua useSyncExternalStore.
 */
let currentAppId: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Đọc localStorage một lần rồi giữ trong bộ nhớ, để server/client render khớp nhau. */
function getSnapshot(): string | null {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      currentAppId = window.localStorage.getItem(ACTIVE_APP_STORAGE_KEY);
    } catch {
      // Safari private mode / chặn storage — coi như chưa lưu lựa chọn nào.
      currentAppId = null;
    }
  }
  return currentAppId;
}

export function setActiveAppId(next: string) {
  currentAppId = next;
  emit();
  try {
    window.localStorage.setItem(ACTIVE_APP_STORAGE_KEY, next);
  } catch {
    // Không lưu được thì vẫn chuyển app được trong phiên hiện tại.
  }
}

/** Chỉ dùng trong test: đưa store về trạng thái ban đầu. */
export function __resetActiveAppForTests() {
  currentAppId = null;
  hydrated = false;
  emit();
}

/**
 * App đang hoạt động của người dùng hiện tại.
 *
 * - `apps` là các app role được vào — dùng cho ô chuyển app (1 app thì không hiện ô).
 * - `app` đã tính cả việc lựa chọn đã lưu không còn hợp lệ (đổi role chẳng hạn) thì
 *   lùi về app mặc định.
 *
 * `setAppId` chỉ lưu lựa chọn, không điều hướng: chuyển app là hành động chủ động của
 * người dùng nên nơi gọi (Sidebar) quyết định có đưa về trang chủ app mới hay không.
 */
export function useActiveApp(role: RoleFlags | undefined) {
  const preferred = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const apps = useMemo(() => appsForRole(role), [role]);
  const appId = resolveAppId(role, preferred);
  const app: AppDef | undefined = appById(appId) ?? apps[0];

  const setAppId = useCallback((next: string) => setActiveAppId(next), []);

  return { apps, app, appId, setAppId, defaultAppId: defaultAppIdFor(role) };
}
