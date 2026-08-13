import { AlertTriangle, RotateCw } from "lucide-react";

interface Props {
  message?: string;
  subMessage?: string;
  className?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = "Không thể tải dữ liệu", subMessage = "Vui lòng thử lại sau", className = "", onRetry }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-red-500 ${className}`}>
      <AlertTriangle className="mb-3 h-10 w-10" />
      <p className="text-sm font-medium">{message}</p>
      {subMessage && <p className="mt-1 text-xs text-red-400">{subMessage}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Thử lại
        </button>
      )}
    </div>
  );
}
