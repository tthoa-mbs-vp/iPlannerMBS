import { useState } from "react";
import { Upload, Download, FileText, Code, CheckCircle, AlertTriangle, Loader2, ClipboardPaste } from "lucide-react";
import Modal from "../shared/Modal";
import { EXPORT_COLLECTIONS, COLLECTION_PASTE_HINTS, importFromFile, importFromPasteData, downloadTemplate } from "../../services/dataService";
import type { ImportResult } from "../../services/dataService";

interface Props {
  onClose: () => void;
  collection?: string;
}

type Mode = "file" | "paste";

export default function ImportModal({ onClose, collection: presetCollection }: Props) {
  const [collection, setCollection] = useState(presetCollection || EXPORT_COLLECTIONS[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<Mode>(presetCollection ? "paste" : "file");

  const handleImport = async () => {
    setResult(null);
    setImporting(true);
    try {
      const res = mode === "paste"
        ? await importFromPasteData(pasteText, collection)
        : await importFromFile(file!, collection);
      setResult(res);
    } catch (err: unknown) {
      setResult({ collection, total: 0, success: 0, errors: [{ row: 0, message: err instanceof Error ? err.message : "Lỗi" }] });
    }
    setImporting(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setResult(null); setMode("file"); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const canSubmit = (mode === "file" && !!file) || (mode === "paste" && pasteText.trim().length > 0);

  return (
    <Modal title="Nhập dữ liệu" onClose={onClose} maxWidth="lg" accentColor="emerald">
      <div className="space-y-4 p-6">
        {!presetCollection && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Bảng đích</label>
            <select value={collection} onChange={(e) => { setCollection(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
              {EXPORT_COLLECTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button onClick={() => { setMode("paste"); setResult(null); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "paste" ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}>
            <ClipboardPaste className="h-4 w-4" />
            Dán dữ liệu
          </button>
          <button onClick={() => { setMode("file"); setResult(null); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === "file" ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}>
            <Upload className="h-4 w-4" />
            Tải file lên
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => downloadTemplate(collection)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
            <Download className="h-3.5 w-3.5" />
            Tải file mẫu
          </button>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">(CSV với tiêu đề cột)</span>
        </div>

        {mode === "file" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">File dữ liệu</label>
            <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
              className={`relative flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm transition-colors ${
                dragOver ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/40" : file ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-900/30" : "border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
              }`}>
              {file ? (
                <>
                  {ext === "json" ? <Code className="h-5 w-5 text-amber-500 dark:text-amber-400" /> : <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate dark:text-slate-200" title={file.name}>{file.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); setFile(null); setResult(null); }}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Xóa</button>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <div className="flex flex-col">
                    <span className="text-slate-500 dark:text-slate-300">Kéo thả file hoặc nhấp để chọn</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Hỗ trợ .csv, .json</span>
                  </div>
                </>
              )}
              <input type="file" accept=".csv,.json" className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setMode("file"); }} />
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Dán dữ liệu</label>
            <p className="mb-2 text-[10px] text-slate-400 dark:text-slate-500">Dòng đầu là tiêu đề cột, phân tách bằng Tab hoặc | — các cột: {COLLECTION_PASTE_HINTS[collection]?.join(", ") || "—"}</p>
            <textarea value={pasteText} onChange={(e) => { setPasteText(e.target.value); setResult(null); }}
              placeholder={COLLECTION_PASTE_HINTS[collection]?.join("\t") + "\nDữ liệu mẫu\t..." || ""}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none resize-y dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:border-slate-600" />
          </div>
        )}

        <button onClick={handleImport} disabled={!canSubmit || importing}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
            !canSubmit || importing ? "bg-slate-400 cursor-not-allowed dark:bg-slate-600" : "bg-emerald-600 hover:bg-emerald-700"
          }`}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? "Đang nhập..." : "Nhập dữ liệu"}
        </button>

        {result && (
          <div className={`rounded-lg border p-4 ${result.errors.length === 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/40" : "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/40"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.errors.length === 0
                ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                : <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              }
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {result.success}/{result.total} bản ghi thành công
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-white p-2 dark:border-amber-700 dark:bg-slate-900">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 py-0.5 dark:text-red-400">
                    {e.row > 0 ? `Dòng ${e.row}` : ""}: {e.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
