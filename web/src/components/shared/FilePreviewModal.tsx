import { X, Download } from "lucide-react";

interface Props {
  url: string;
  filename: string;
  isImage: boolean;
  onClose: () => void;
}

export default function FilePreviewModal({ url, filename, isImage, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={filename}>{filename}</p>
          <div className="flex items-center gap-1">
            <a href={url} target="_blank" rel="noopener noreferrer" download={filename}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Tải xuống" aria-label="Tải xuống">
              <Download className="h-4 w-4" />
            </a>
            <button onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200" title="Đóng" aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          {isImage ? (
            <img src={url} alt={filename} className="max-h-[75vh] w-auto rounded-lg object-contain" />
          ) : (
            <iframe src={url} title={filename} className="h-[75vh] w-[80vw] rounded-lg border border-slate-200 dark:border-slate-700" />
          )}
        </div>
      </div>
    </div>
  );
}
