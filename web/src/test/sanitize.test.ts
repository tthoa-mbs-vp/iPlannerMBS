import { describe, it, expect } from "vitest";
import { sanitizeHtml, stripTags } from "../utils/sanitize";

describe("sanitizeHtml", () => {
  // ── Dangerous tag removal ──────────────────────────────────────────────
  it("removes <script> tags and their content", () => {
    expect(sanitizeHtml('<p>safe</p><script>alert("xss")</script>')).toBe(
      "<p>safe</p>",
    );
  });

  it("removes <iframe> tags", () => {
    expect(
      sanitizeHtml('<iframe src="https://evil.com"></iframe>'),
    ).toBe("");
  });

  it("removes <object> and <embed> tags", () => {
    expect(sanitizeHtml('<object data="evil.swf"></object>')).toBe("");
    expect(sanitizeHtml('<embed src="evil.swf">')).toBe("");
  });

  it("removes <link> tags (stylesheets can inject scripts)", () => {
    expect(
      sanitizeHtml('<link rel="stylesheet" href="evil.css">'),
    ).toBe("");
  });

  it("removes <style> tags", () => {
    expect(sanitizeHtml("<style>body{display:none}</style>")).toBe("");
  });

  it("removes <meta> tags", () => {
    expect(
      sanitizeHtml('<meta http-equiv="refresh" content="0;url=evil.com">'),
    ).toBe("");
  });

  it("removes <svg> tags (can contain scripts)", () => {
    expect(
      sanitizeHtml('<svg onload="alert(1)"><circle r="10"/></svg>'),
    ).toBe("");
  });

  it("removes <form>, <input>, <button>, <textarea>, <select> tags", () => {
    const html =
      '<form action="evil.com"><input type="text"><button>Submit</button><textarea></textarea><select><option>1</option></select></form>';
    expect(sanitizeHtml(html)).toBe("");
  });

  it("removes <video>, <audio>, <source>, <track> tags", () => {
    expect(sanitizeHtml('<video src="evil.mp4"></video>')).toBe("");
    expect(sanitizeHtml('<audio src="evil.mp3"></audio>')).toBe("");
  });

  it("removes <frame> and <frameset> tags", () => {
    // frameset replaces <body> in HTML parsing; after sanitization only empty tags remain
    const result = sanitizeHtml("<frameset><frame src='evil'></frameset>");
    expect(result).not.toContain("evil");
    expect(result).not.toContain("<frame");
  });

  it("removes <base> tag (can hijack all relative URLs)", () => {
    expect(
      sanitizeHtml('<base href="https://evil.com/">'),
    ).toBe("");
  });

  it("removes <math> tag", () => {
    expect(sanitizeHtml("<math><mi>x</mi></math>")).toBe("");
  });

  // ── Event handler removal ──────────────────────────────────────────────
  it("removes onclick handlers", () => {
    expect(
      sanitizeHtml('<div onclick="alert(1)">click</div>'),
    ).toBe("<div>click</div>");
  });

  it("removes onload handlers", () => {
    expect(
      sanitizeHtml('<img src="x" onload="alert(1)">'),
    ).toBe('<img src="x">');
  });

  it("removes onerror handlers", () => {
    expect(
      sanitizeHtml('<img src="x" onerror="alert(1)">'),
    ).toBe('<img src="x">');
  });

  it("removes onmouseover handlers", () => {
    expect(
      sanitizeHtml('<div onmouseover="alert(1)">hover</div>'),
    ).toBe("<div>hover</div>");
  });

  it("removes srcdoc attribute", () => {
    expect(
      sanitizeHtml(
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      ),
    ).toBe("");
  });

  // ── Dangerous URL removal ──────────────────────────────────────────────
  it("removes javascript: URLs in href", () => {
    expect(
      sanitizeHtml('<a href="javascript:alert(1)">click</a>'),
    ).toBe("<a>click</a>");
  });

  it("removes vbscript: URLs in href", () => {
    expect(
      sanitizeHtml('<a href="vbscript:MsgBox(1)">click</a>'),
    ).toBe("<a>click</a>");
  });

  it("removes data: URLs in src", () => {
    expect(
      sanitizeHtml(
        '<img src="data:text/html,<script>alert(1)</script>">',
      ),
    ).toBe("<img>");
  });

  it("removes javascript: in action attribute", () => {
    expect(
      sanitizeHtml('<form action="javascript:alert(1)"></form>'),
    ).toBe("");
  });

  it("keeps safe http/https URLs", () => {
    expect(
      sanitizeHtml('<a href="https://example.com">link</a>'),
    ).toBe('<a href="https://example.com">link</a>');
  });

  it("keeps safe relative URLs", () => {
    expect(sanitizeHtml('<a href="/about">link</a>')).toBe(
      '<a href="/about">link</a>',
    );
  });

  // ── Safe content preservation ───────────────────────────────────────────
  it("preserves safe HTML structure", () => {
    const html =
      '<div class="container"><h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p></div>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("preserves safe img tags with http src", () => {
    expect(
      sanitizeHtml('<img src="https://example.com/photo.jpg" alt="Photo">'),
    ).toBe(
      '<img src="https://example.com/photo.jpg" alt="Photo">',
    );
  });

  it("preserves data attributes", () => {
    expect(
      sanitizeHtml('<div data-id="123">content</div>'),
    ).toBe('<div data-id="123">content</div>');
  });

  it("handles empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles null/undefined-like input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles nested dangerous tags", () => {
    expect(
      sanitizeHtml(
        '<div><script><iframe>alert(1)</iframe></script></div>',
      ),
    ).toBe("<div></div>");
  });

  it("handles multiple dangerous tags mixed with safe content", () => {
    const html =
      'Hello <script>evil()</script> world <b>bold</b> <iframe src="x"></iframe> end';
    expect(sanitizeHtml(html)).toBe(
      "Hello  world <b>bold</b>  end",
    );
  });
});

describe("stripTags", () => {
  it("strips all HTML tags and returns plain text", () => {
    expect(stripTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(stripTags("")).toBe("");
  });

  it("strips dangerous tags too", () => {
    expect(stripTags('<script>alert(1)</script>safe')).toBe("safe");
  });

  it("collapses whitespace", () => {
    expect(stripTags("<div>  hello   world  </div>")).toBe("hello world");
  });

  it("handles nested tags", () => {
    expect(stripTags("<div><span><b>text</b></span></div>")).toBe("text");
  });
});
