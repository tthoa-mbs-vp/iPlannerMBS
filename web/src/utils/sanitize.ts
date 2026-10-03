import DOMPurify from "dompurify";

// Form controls and media embeds are not part of rich text: allowing them lets
// anyone who can post a comment render a convincing fake login box (<form
// action="…">) or an arbitrary <video> inside our own UI. KEEP_CONTENT is off
// so the label text of a stripped <button>/<option> does not survive either.
const FORBIDDEN_TAGS = [
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "optgroup",
  "fieldset",
  "legend",
  "label",
  "video",
  "audio",
  "source",
  "track",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
];

// Sanitize untrusted HTML (comments, announcements, chat) before rendering.
// DOMPurify removes script/style/on* attributes, javascript: URLs, <svg> payloads,
// etc. — a hardened, well-audited alternative to the previous hand-rolled
// DOMParser-based filter (which could miss edge cases like mXSS).
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html || "", {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    KEEP_CONTENT: false,
    FORBID_ATTR: ["formaction", "action", "target"],
  });
}

export function stripTags(html: string): string {
  return sanitizeHtml(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
