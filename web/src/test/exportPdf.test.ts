import { describe, it, expect } from "vitest";
import { buildHtml, type PdfOptions } from "../utils/exportPdf";
import { escapeHtml } from "../utils/reportPrint";

/**
 * buildHtml là nơi mọi dữ liệu người dùng (tên nhiệm vụ, nội dung bình luận)
 * được đưa vào HTML trước khi render thành PDF. Nếu escape hỏng thì đây là
 * XSS trong file tải về — nên test tập trung vào escape và các nhánh tuỳ chọn.
 */

const base: PdfOptions = { title: "Báo cáo", filename: "bao-cao.pdf" };

describe("escapeHtml", () => {
  it("escape đủ 5 ký tự nguy hiểm", () => {
    expect(escapeHtml(`<script>alert('x') & "y"</script>`)).toBe(
      "&lt;script&gt;alert(&#39;x&#39;) &amp; &quot;y&quot;&lt;/script&gt;",
    );
  });

  it("null/undefined thành chuỗi rỗng, số và boolean giữ nguyên", () => {
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(false)).toBe("false");
  });
});

describe("buildHtml — cấu trúc", () => {
  it("luôn có doctype, lang vi và tiêu đề đã escape", () => {
    const html = buildHtml({ ...base, title: "Báo <b>cao</b>" });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain("<title>Báo &lt;b&gt;cao&lt;/b&gt;</title>");
    expect(html).toContain('<div class="doc-title">Báo &lt;b&gt;cao&lt;/b&gt;</div>');
  });

  it("không có columns thì không render bảng", () => {
    expect(buildHtml(base)).not.toContain("<table>");
  });

  it("render bảng khi có columns và rows", () => {
    const html = buildHtml({
      ...base,
      columns: [{ label: "Tên" }, { label: "SL", align: "center" }],
      rows: [["A", 1], ["B", 2]],
    });
    expect(html).toContain('<th class="">Tên</th>');
    expect(html).toContain('<th class="c">SL</th>');
    expect(html).toContain("<td class=\"c\">1</td>");
    expect(html).toContain('<td class="">A</td>');
  });

  it("dùng colspan theo số cột cho hàng nhóm", () => {
    const html = buildHtml({
      ...base,
      columns: [{ label: "A" }, { label: "B" }, { label: "C" }],
      rows: [["x", "y", "z"]],
      rowGroups: ["Nhóm 1"],
    });
    expect(html).toContain('colspan="3"');
    expect(html).toContain("Nhóm 1");
  });

  it("chỉ mở hàng nhóm khi nhóm đổi, không lặp lại", () => {
    const html = buildHtml({
      ...base,
      columns: [{ label: "A" }],
      rows: [["1"], ["2"], ["3"]],
      rowGroups: ["G", "G", "H"],
    });
    expect(html.match(/class="group"/g) || []).toHaveLength(2);
  });
});

describe("buildHtml — escape dữ liệu người dùng", () => {
  it("escape ô bảng, summary, info block, thảo luận và chữ ký", () => {
    const html = buildHtml({
      ...base,
      title: "<img src=x onerror=alert(1)>",
      meta: "<script>",
      columns: [{ label: "<th>" }],
      rows: [["<td>"]],
      summary: [{ label: "<l>", value: "<v>" }],
      infoBlocks: [{ title: "<t>", fields: [{ label: "<fl>", value: "<fv>" }] }],
      discussionItems: [{ author: "<a>", time: "<tm>", content: "<c>" }],
      signatureRoles: [{ label: "<sl>", name: "<sn>" }],
    });

    // Không được còn payload thô nào — đó là điều kiện để chèn HTML.
    // escapeHtml chỉ thay 5 ký tự (& < > " '), nên "onerror=" vẫn nằm trong
    // text; nó vô hại vì không có ký tự nào tạo được thẻ quanh nó.
    // So cả dấu ">" để không đụng các thẻ hợp lệ của template (<th class="">, <td class="">).
    for (const raw of ["<script>", "<img src=x onerror=alert(1)>", "<th>", "<td>", "<l>", "<v>", "<fl>", "<fv>", "<a>", "<tm>", "<c>", "<sl>", "<sn>"]) {
      expect(html, `còn sót payload thô: ${raw}`).not.toContain(raw);
    }
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;td&gt;");
    // Dấu nháy bên trong thuộc tính cũng phải bị escape.
    expect(html).not.toContain('=" onmouseover');
  });
});

describe("buildHtml — phần tuỳ chọn", () => {
  it("bỏ trống khối thảo luận khi không có bình luận", () => {
    expect(buildHtml(base)).not.toContain('class="discussion"');
  });

  it("lấy tên file đính kèm sau dấu gạch dưới (bỏ tiền tố rác)", () => {
    const html = buildHtml({
      ...base,
      discussionItems: [{ author: "An", time: "10:00", content: "x", files: ["abc123_anh.pdf", "def456_anh.png"] }],
    });
    expect(html).toContain("Đính kèm: anh.pdf, anh.png");
    expect(html).not.toContain("abc123");
  });

  it("bỏ trống phần ký khi không có vai trò nào", () => {
    expect(buildHtml(base)).not.toContain('class="signature"');
  });

  it("render chữ ký, bỏ dòng tên khi vai trò không có tên", () => {
    const html = buildHtml({ ...base, signatureRoles: [{ label: "Giám sát" }, { label: "Thực hiện", name: "Bình" }] });
    expect(html).toContain("KÝ XÁC NHẬN");
    expect(html.match(/class="sig-label"/g) || []).toHaveLength(2);
    expect(html.match(/class="sig-name"/g) || []).toHaveLength(1);
  });

  it("đổi được tiêu đề phần thảo luận", () => {
    const html = buildHtml({
      ...base,
      discussionTitle: "Trao đổi riêng",
      discussionItems: [{ author: "An", time: "10:00", content: "x" }],
    });
    expect(html).toContain("Trao đổi riêng");
  });
});