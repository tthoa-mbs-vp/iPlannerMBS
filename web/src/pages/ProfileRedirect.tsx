import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function ProfileRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/hr/${user.id}`} replace />;
}
