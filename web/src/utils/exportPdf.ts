// Real PDF export that renders an HTML table into a .pdf file.
// Uses an offscreen iframe (own <style>, hex colors only — no Tailwind/oklch)
// + html2canvas + jsPDF, so Vietnamese text renders correctly.

import { escapeHtml } from "./reportPrint";

export interface PdfColumn {
  label: string;
  align?: "left" | "center";
}

export interface PdfSummaryItem {
  label: string;
  value: string | number;
}

export interface PdfInfoField {
  label: string;
  value: string;
}

export interface PdfInfoBlock {
  title: string;
  fields: PdfInfoField[];
}

export interface PdfDiscussionItem {
  author: string;
  time: string;
  content: string;
  files?: string[];
}

export interface PdfSignatureRole {
  label: string;
  name?: string;
}

export interface PdfOptions {
  title: string;
  meta?: string;
  summary?: PdfSummaryItem[];
  columns?: PdfColumn[];
  rows?: (string | number)[][];
  rowGroups?: string[];
  infoBlocks?: PdfInfoBlock[];
  discussionTitle?: string;
  discussionItems?: PdfDiscussionItem[];
  signatureTitle?: string;
  signatureRoles?: PdfSignatureRole[];
  filename: string;
  landscape?: boolean;
}

/** Sinh HTML báo cáo hoàn chỉnh. Export ra để test: đây là nơi escape diễn ra,
 *  sai ở đây là lỗ hổng XSS trong file PDF tải về chứ không chỉ là lỗi hiển thị. */
export function buildHtml(opts: PdfOptions): string {
  const {
    title,
    meta = "",
    summary = [],
    columns = [],
    rows = [],
    rowGroups = [],
    infoBlocks = [],
    discussionTitle = "Nội dung trao đổi, thảo luận",
    discussionItems = [],
    signatureTitle = "KÝ XÁC NHẬN",
    signatureRoles = [],
  } = opts;
  const now = new Date().toLocaleString("vi-VN");
  const head = columns.map((c) =>
    `<th class="${c.align === "center" ? "c" : ""}">${escapeHtml(c.label)}</th>`).join("");
  let lastGroup = "";
  const body = rows.map((r, idx) => {
    const group = rowGroups[idx];
    const groupHeader = group !== undefined && group !== lastGroup
      ? `<tr class="group"><td colspan="${columns.length}">${escapeHtml(group)}</td></tr>`
      : "";
    lastGroup = group;
    return `${groupHeader}<tr>${r.map((cell, i) => {
      const cls = columns[i]?.align === "center" ? "c" : "";
      return `<td class="${cls}">${escapeHtml(cell)}</td>`;
    }).join("")}</tr>`;
  }).join("");
  const stats = summary.map((s) =>
    `<div class="stat"><div class="label">${escapeHtml(s.label)}</div><div class="value">${escapeHtml(s.value)}</div></div>`).join("");

  const table = columns.length
    ? `<table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>`
    : "";

  const infoBlocksHtml = infoBlocks.map((b) => {
    const rowsHtml = b.fields.map((f) =>
      `<div class="kv-row"><span class="kv-label">${escapeHtml(f.label)}</span><span class="kv-value">${escapeHtml(f.value)}</span></div>`).join("");
    return `<div class="info-block">
    <div class="block-title">${escapeHtml(b.title)}</div>
    <div class="kv">${rowsHtml}</div>
  </div>`;
  }).join("");

  const discussionHtml = discussionItems.length ? `<div class="discussion">
    <div class="block-title">${escapeHtml(discussionTitle)}</div>
    ${discussionItems.map((it) => `
    <div class="disc-item">
      <div class="disc-head"><span class="disc-author">${escapeHtml(it.author)}</span><span class="disc-time">${escapeHtml(it.time)}</span></div>
      <div class="disc-content">${escapeHtml(it.content)}</div>
      ${it.files && it.files.length ? `<div class="disc-files">Đính kèm: ${it.files.map((f) => escapeHtml(f.split("_").pop() || f)).join(", ")}</div>` : ""}
    </div>`).join("")}
  </div>` : "";

  const signatureHtml = signatureRoles.length ? `<div class="signature">
    <div class="block-title">${escapeHtml(signatureTitle)}</div>
    <div class="sig-row">
      ${signatureRoles.map((r) => `
      <div class="sig-col">
        <div class="sig-label">${escapeHtml(r.label)}</div>
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        ${r.name ? `<div class="sig-name">${escapeHtml(r.name)}</div>` : ""}
      </div>`).join("")}
    </div>
  </div>` : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 28px; color: #1e293b; background: #fff; }
  .doc-title { font-size: 20px; font-weight: 800; margin: 0 0 2px; color: #0f172a; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  .summary { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .summary .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; min-width: 110px; }
  .summary .stat .label { font-size: 11px; color: #64748b; }
  .summary .stat .value { font-size: 18px; font-weight: 800; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  thead th { background: #1e293b; color: #ffffff; text-align: left; padding: 9px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
  thead th.c, td.c { text-align: center; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tr.group td { background: #eef2ff; color: #3730a3; font-weight: 700; padding: 8px 10px; border-top: 2px solid #e2e8f0; }
  tbody tr:nth-child(even):not(.group) { background: #f8fafc; }
  .info-block { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
  .block-title { background: #1e293b; color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 9px 14px; }
  .kv { padding: 4px 14px; }
  .kv-row { display: flex; gap: 16px; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12px; }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { width: 34%; color: #64748b; flex-shrink: 0; }
  .kv-value { font-weight: 600; color: #0f172a; }
  .discussion { margin-top: 16px; }
  .disc-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
  .disc-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
  .disc-author { font-size: 12px; font-weight: 700; color: #3730a3; }
  .disc-time { font-size: 11px; color: #94a3b8; }
  .disc-content { font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
  .disc-files { font-size: 11px; color: #64748b; margin-top: 4px; }
  .signature { margin-top: 40px; page-break-inside: avoid; }
  .sig-row { display: flex; gap: 40px; margin-top: 14px; }
  .sig-col { flex: 1; text-align: center; }
  .sig-label { font-size: 12px; font-weight: 700; color: #0f172a; }
  .sig-space { height: 46px; }
  .sig-line { border-top: 1px solid #0f172a; }
  .sig-name { font-size: 12px; color: #475569; margin-top: 4px; }
</style>
</head>
<body>
  <div class="doc-title">${escapeHtml(title)}</div>
  <div class="meta">${escapeHtml(meta)} · Xuất lúc ${escapeHtml(now)}</div>
  <div class="summary">${stats}</div>
  ${infoBlocksHtml}
  ${table}
  ${discussionHtml}
  ${signatureHtml}
</body>
</html>`;
}

export async function exportHtmlToPdf(opts: PdfOptions): Promise<void> {
  const { filename, landscape } = opts;
  const jsPDF = (await import("jspdf")).default;
  const html2canvas = (await import("html2canvas")).default;

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-10000px";
  iframe.style.width = landscape ? "1200px" : "900px";
  iframe.style.height = "0px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(buildHtml(opts));
    doc.close();

    // wait for font/image loading inside the iframe
    await Promise.race([
      new Promise<void>((resolve) => iframe.onload = () => resolve()),
      new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ]);
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    const target = doc.body;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    const imgW = pageW - 2 * margin;
    const pxPerMm = canvas.width / imgW;
    const pagePx = Math.floor((pageH - 2 * margin) * pxPerMm);

    let offsetPx = 0;
    let pageIdx = 0;
    while (offsetPx < canvas.height) {
      const slicePx = Math.min(pagePx, canvas.height - offsetPx);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = slicePx;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, offsetPx, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (pageIdx > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, margin, imgW, slicePx / pxPerMm);
      offsetPx += slicePx;
      pageIdx++;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
