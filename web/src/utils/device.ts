export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini|BlackBerry|webOS/i.test(ua)) {
    return true;
  }
  return window.matchMedia("(max-width: 767px)").matches;
}
