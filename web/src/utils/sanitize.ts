const DANGEROUS_TAGS = [
  "script", "iframe", "object", "embed", "link", "style", "meta",
  "svg", "math", "form", "input", "button", "textarea", "select", "option",
  "video", "audio", "source", "track", "frame", "frameset", "base",
];

// Attributes that carry a URL and can execute on click/load.
const URL_ATTRIBUTES = ["href", "src", "xlink:href", "action", "formaction", "poster", "background"];

const DANGEROUS_URL_PREFIX = /^(javascript|vbscript|data):/i;

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  doc.querySelectorAll(DANGEROUS_TAGS.join(",")).forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value;
      if (name.startsWith("on") || name === "srcdoc") {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRIBUTES.includes(name) && DANGEROUS_URL_PREFIX.test(val)) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return (doc.body || doc.documentElement).innerHTML;
}

export function stripTags(html: string): string {
  return sanitizeHtml(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
