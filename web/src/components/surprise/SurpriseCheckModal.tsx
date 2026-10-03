import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ShieldCheck,
  Fingerprint,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import {
  useActiveSurpriseCheck,
  useRespondToCheck,
  useSurpriseCheckRealtime,
} from "../../hooks/useSurpriseCheck";
import { formatDateTimeShort } from "../../utils/format";

// ── Haptic feedback (vibrate on supported mobile devices) ───────────────────
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported — silent fail
  }
}

// ── Countdown timer hook ────────────────────────────────────────────────────
function useCountdown(startedAt: string, windowMinutes: number) {
  const deadline = useMemo(
    () => new Date(startedAt).getTime() + windowMinutes * 60_000,
    [startedAt, windowMinutes],
  );

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now()),
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      const r = Math.max(0, deadline - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, remaining]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const isUrgent = remaining > 0 && remaining < 60_000; // < 1 min
  const isExpired = remaining <= 0;

  return { minutes, seconds, remaining, isUrgent, isExpired };
}

// ── Main component ──────────────────────────────────────────────────────────
export default function SurpriseCheckModal() {
  const { data: activeCheck, isLoading } = useActiveSurpriseCheck();
  const respondMutation = useRespondToCheck();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ── Detect biometric support ─────────────────────────────────────────────
  useEffect(() => {
    if (window.PublicKeyCredential) {
      setBiometricSupported(true);
    }
  }, []);

  // ── Show modal when there's an active unresponded check ──────────────────
  useEffect(() => {
    if (activeCheck && !activeCheck.responded && !respondMutation.isSuccess) {
      setShowModal(true);
      setSuccess(false);
      setPassword("");
      setError("");
      // Haptic alert — strong vibration pattern
      vibrate([200, 100, 200]);
      // Auto-focus with longer delay for mobile keyboard
      setTimeout(() => inputRef.current?.focus(), 300);
    } else if (activeCheck?.responded || respondMutation.isSuccess) {
      setSuccess(true);
      // Success haptic
      vibrate([100, 50, 100]);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 2500);
    }
  }, [activeCheck, respondMutation.isSuccess]);

  // ── Subscribe to realtime updates ────────────────────────────────────────
  useSurpriseCheckRealtime();

  // ── Countdown timer ──────────────────────────────────────────────────────
  const { minutes, seconds, isUrgent, isExpired } = useCountdown(
    activeCheck?.started_at || new Date().toISOString(),
    activeCheck?.response_window_minutes || 15,
  );

  // ── Handle password submit ───────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeCheck || isExpired) return;
      if (!password.trim()) {
        setError("Vui lòng nhập mật khẩu");
        vibrate(100); // error haptic
        return;
      }
      setError("");
      try {
        await respondMutation.mutateAsync({
          campaignId: activeCheck.id,
          password,
          method: "password",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Xác nhận thất bại";
        setError(msg);
        vibrate([100, 50, 100]); // error pattern
        // Clear password on wrong password
        setPassword("");
        inputRef.current?.focus();
      }
    },
    [activeCheck, password, respondMutation, isExpired],
  );

  // ── Handle biometric auth ────────────────────────────────────────────────
  const handleBiometric = useCallback(async () => {
    if (!activeCheck || isExpired) return;
    setError("");
    vibrate(50);
    try {
      if (window.PublicKeyCredential) {
        await respondMutation.mutateAsync({
          campaignId: activeCheck.id,
          method: "biometric",
        });
      } else {
        setError("Trình duyệt không hỗ trợ sinh trắc học");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Xác nhận sinh trắc học thất bại";
      setError(msg);
      vibrate([100, 50, 100]);
    }
  }, [activeCheck, respondMutation, isExpired]);

  // ── Auto-submit when password reaches expected length (8 chars) ──────────
  const handlePasswordChange = useCallback(
    (value: string) => {
      setPassword(value);
      setError("");
      // Auto-submit at 8+ chars for quick mobile entry
      if (value.length >= 8 && activeCheck && !isExpired) {
        // Small delay so user sees the last keystroke
        setTimeout(() => {
          formRef.current?.requestSubmit();
        }, 150);
      }
    },
    [activeCheck, isExpired],
  );

  if (!showModal || isLoading) return null;

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="mx-4 w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            Xác nhận thành công!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bạn đã xác nhận đang làm việc
          </p>
        </div>
      </div>
    );
  }

  if (!activeCheck) return null;

  // ── Expired state ────────────────────────────────────────────────────────
  if (isExpired && !activeCheck.responded) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl dark:border-red-800 dark:bg-slate-900 animate-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 px-6 pt-6 pb-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/30">
              <AlertTriangle className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
              Hết thời gian xác nhận
            </h2>
            <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
              Bạn chưa xác nhận trong thời gian quy định
            </p>
          </div>
          <div className="border-t border-slate-200/50 bg-slate-50/50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-800/50">
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Liên hệ quản trị viên để biết thêm chi tiết
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal ───────────────────────────────────────────────────────────
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      // Prevent accidental backdrop dismiss on mobile
      onClick={(e) => {
        if (e.target === e.currentTarget) vibrate(50);
      }}
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white/80 shadow-2xl shadow-red-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 animate-in zoom-in-95 duration-300">
        {/* Warning header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 px-6 pt-6 pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-red-500 shadow-lg shadow-red-500/30 animate-pulse">
            <AlertTriangle className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-center text-lg font-bold text-slate-800 dark:text-slate-100">
            Kiểm tra đột xuất
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            {activeCheck.name}
          </p>
        </div>

        {/* Countdown timer */}
        <div className="flex items-center justify-center gap-2 px-6 py-3">
          <Clock
            className={`h-4 w-4 ${
              isUrgent
                ? "text-red-500 animate-pulse"
                : "text-slate-400 dark:text-slate-500"
            }`}
          />
          <span
            className={`text-lg font-mono font-bold tracking-wider ${
              isUrgent
                ? "text-red-600 dark:text-red-400"
                : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {pad(minutes)}:{pad(seconds)}
          </span>
          {isUrgent && (
            <span className="text-[10px] font-semibold uppercase text-red-500 animate-pulse">
              Sắp hết giờ!
            </span>
          )}
        </div>

        {/* Info */}
        <div className="px-6 pb-2">
          <div className="mb-4 rounded-xl border border-amber-200/50 bg-amber-50/50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
              🕐 Bắt đầu: {formatDateTimeShort(activeCheck.started_at)}
            </p>
            {activeCheck.notes && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                📝 {activeCheck.notes}
              </p>
            )}
          </div>

          <p className="mb-4 text-center text-sm text-slate-600 dark:text-slate-300">
            Vui lòng xác nhận bạn đang làm việc:
          </p>

          {/* Password form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                inputMode="text"
                // Mobile-optimized: large text, no zoom on focus
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3.5 pr-12 text-base text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setShowPassword(!showPassword);
                  vibrate(30);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {error && (
              <p className="text-center text-sm font-medium text-red-500">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={respondMutation.isPending || !password.trim() || isExpired}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
            >
              {respondMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              Xác nhận bằng mật khẩu
            </button>
          </form>

          {/* Biometric option */}
          {biometricSupported && (
            <>
              <div className="my-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Hoặc
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <button
                onClick={handleBiometric}
                disabled={respondMutation.isPending || isExpired}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-3.5 text-base font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800 min-h-[48px]"
              >
                <Fingerprint className="h-5 w-5" />
                Xác nhận bằng sinh trắc học
              </button>
            </>
          )}
        </div>

        {/* Footer note */}
        <div className="border-t border-slate-200/50 bg-slate-50/50 px-6 py-3 dark:border-slate-700/50 dark:bg-slate-800/50">
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
            ⚠️ Nếu không xác nhận trong{" "}
            {activeCheck.response_window_minutes} phút, bạn sẽ được đánh giá
            vắng mặt
          </p>
        </div>
      </div>
    </div>
  );
}
