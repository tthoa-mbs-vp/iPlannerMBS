import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useActiveApp } from "../../hooks/useActiveApp";
import { appOwnsPath } from "../../config/apps";

/**
 * Giữ người dùng trong đúng app của họ.
 *
 * Ô chuyển app giới hạn phần lớn đường đi hợp lệ, nhưng ai cũng có thể gõ tay URL hoặc
 * bấm vào link cũ đã lưu trong trình duyệt. Khi URL thuộc app khác, ta đưa về trang
 * chủ app đang mở thay vì render trang của nghiệp vụ không thuộc về mình.
 *
 * ĐÂY KHÔNG PHẢI LỚP BẢO MẬT. Đổi URL không vượt được rule của PocketBase hay guard
 * trên server — dữ liệu vẫn được chặn ở tầng API. Lớp này chỉ để UI không bị lệch:
 * mở app Nhân sự thì không nên thấy khung của app Kế hoạch.
 */
export default function AppBoundary({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.expand?.role_id;
  const { app } = useActiveApp(role);
  const location = useLocation();

  if (!app) return <>{children}</>;
  // `/` và các route không thuộc app nào (ví dụ /login) do router xử lý riêng.
  if (!location.pathname.startsWith("/") || location.pathname === "/") {
    return <>{children}</>;
  }
  if (!appOwnsPath(app, location.pathname)) {
    return <Navigate to={app.home} replace />;
  }
  return <>{children}</>;
}
