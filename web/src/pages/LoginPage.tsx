import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { APP_NAME, APP_VERSION } from "../config/app";
import { isMobileDevice } from "../utils/device";
import { ClipboardList } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const homePath = isMobileDevice() ? "/m" : "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(homePath, { replace: true });
    }
  }, [isAuthenticated, navigate, homePath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, remember);
      navigate(homePath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
              <ClipboardList className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-indigo-200">
              Hệ thống quản lý kế hoạch & nhiệm vụ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200 backdrop-blur-sm">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-indigo-200">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-indigo-300/50 transition-all duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                placeholder="your@email.com"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-indigo-200">
                Mật khẩu
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-indigo-300/50 transition-all duration-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                placeholder="••••••••"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-indigo-200">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-400 focus:ring-offset-0"
              />
              Ghi nhớ đăng nhập
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-indigo-300/50">
            {APP_NAME} v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
