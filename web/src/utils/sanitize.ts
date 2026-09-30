import DOMPurify from "dompurify";

// Sanitize untrusted HTML (comments, announcements, chat) before rendering.
// DOMPurify removes script/style/on* attributes, javascript: URLs, <svg> payloads,
// etc. — a hardened, well-audited alternative to the previous hand-rolled
// DOMParser-based filter (which could miss edge cases like mXSS).
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html || "", { USE_PROFILES: { html: true } });
}

export function stripTags(html: string): string {
  return sanitizeHtml(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
