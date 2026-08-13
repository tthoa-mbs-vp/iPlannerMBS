import PocketBase from "pocketbase";

// Relative "/" base URL → same-origin requests, forwarded to PocketBase by the
// Vite dev proxy. Override with VITE_PB_URL only when the API is served elsewhere.
const PB_URL = import.meta.env.VITE_PB_URL || "/";

export const pb = new PocketBase(PB_URL);

/**
 * Persist remember-me choice and a sessionStorage marker.
 *
 * On checkAuth:
 *  - `pb_remember` = "0" + no `pb_session_only` marker → new browser session → clear auth
 *  - `pb_remember` = "0" + marker present → within same session → keep auth
 *  - `pb_remember` = "1" (or missing for backward compat) → keep auth
 */
export function setRememberMe(remember: boolean) {
  localStorage.setItem("pb_remember", remember ? "1" : "0");
  if (remember) {
    sessionStorage.removeItem("pb_session_only");
  } else {
    sessionStorage.setItem("pb_session_only", "1");
  }
}

export function getFileUrl(
  collection: string,
  recordId: string,
  filename: string
): string {
  return `${PB_URL}/api/files/${collection}/${recordId}/${filename}`;
}

export function getUserAvatar(user: {
  id: string;
  avatar?: string;
}): string | undefined {
  if (user.avatar) {
    return getFileUrl("users", user.id, user.avatar);
  }
  return undefined;
}
