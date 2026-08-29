export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openReportPreview(opts: {
  title: string;
  meta: string;
  summary: { label: string; value: string | number }[];
  columns: { label: string; align?: "left" | "center" }[];
  rows: (string | number)[][];
}) {
  const { title, meta, summary, columns, rows } = opts;
  const now = new Date().toLocaleString("vi-VN");
  const head = columns.map((c) =>
    `<th class="${c.align === "center" ? "c" : ""}">${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map((r) =>
    `<tr>${r.map((cell, i) => {
      const cls = columns[i]?.align === "center" ? "c" : "";
      return `<td class="${cls}">${escapeHtml(cell)}</td>`;
    }).join("")}</tr>`).join("");
  const stats = summary.map((s) =>
    `<div class="stat"><div class="label">${escapeHtml(s.label)}</div><div class="value">${escapeHtml(s.value)}</div></div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 32px; color: #1e293b; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; padding: 4px 0 16px; display: flex; gap: 8px; align-items: center; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px; }
  .toolbar button { padding: 8px 18px; border-radius: 8px; border: 1px solid #4338ca; background: #4f46e5; color: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
  .toolbar .close { background: #fff; color: #475569; border-color: #cbd5e1; }
  .doc-title { font-size: 20px; font-weight: 800; margin: 8px 0 2px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .summary .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 18px; min-width: 130px; }
  .summary .stat .label { font-size: 11px; color: #64748b; }
  .summary .stat .value { font-size: 20px; font-weight: 800; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #1e293b; color: #fff; text-align: left; padding: 9px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  thead th.c, td.c { text-align: center; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  @media print {
    .toolbar { display: none; }
    body { padding: 12px; }
    .doc-title { margin-top: 0; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">In / Lưu PDF</button>
    <button class="close" onclick="window.close()">Đóng</button>
  </div>
  <div class="doc-title">${escapeHtml(title)}</div>
  <div class="meta">${escapeHtml(meta)} · Xuất lúc ${escapeHtml(now)}</div>
  <div class="summary">${stats}</div>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;

  const w = window.open("", "_blank", "width=1000,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}
