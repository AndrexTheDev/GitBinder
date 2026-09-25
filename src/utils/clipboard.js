/**
 * Clipboard helper with a graceful fallback.
 *
 * `navigator.clipboard` requires a secure context; the legacy
 * `document.execCommand('copy')` path keeps the "copy wallet address" button
 * working when the app is opened from a plain http origin during development.
 *
 * @module utils/clipboard
 */

/** @returns {Promise<boolean>} true when the text reached the clipboard */
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
