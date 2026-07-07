export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeJsString(value: unknown): string {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\x27")
    .replaceAll('"', "\\x22")
    .replaceAll("<", "\\x3C")
    .replaceAll(">", "\\x3E")
    .replaceAll("&", "\\x26")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

const ALLOWED_URL_PROTOCOLS = ["http:", "https:"];

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(url: string, fallback = "#"): string {
  return isSafeUrl(url) ? url : fallback;
}
