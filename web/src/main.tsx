import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { pb } from "./api/client";
import { useAuthStore } from "./stores/authStore";
import "./index.css";

const queryClient = new QueryClient({
  // Session-expiry handling: an expired/invalid JWT surfaces as 401 on queries.
  // Clear auth so ProtectedRoute bounces the user back to /login instead of leaving
  // them stuck on a permanent error state. (Mutations have their own onError toasts;
  // the next query after expiry triggers this redirect.)
  queryCache: new QueryCache({
    onError: (error) => {
      // Session-expiry handling: an expired/invalid JWT surfaces as 401 on queries.
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        pb.authStore.clear();
        useAuthStore.setState({ user: null, isAuthenticated: false });
        return;
      }
      // H3: a disabled account is rejected server-side on every request (ensureEnabled in
      // backend/pb_hooks). Bounce the user to login instead of leaving them on error pages.
      const message = (error as { data?: { message?: string } })?.data?.message;
      if (status === 403 && message === "Tài khoản đã bị vô hiệu hóa") {
        pb.authStore.clear();
        useAuthStore.setState({ user: null, isAuthenticated: false });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
