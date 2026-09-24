/**
 * Browser file helpers: downloading generated artefacts and reading user
 * supplied files (settings import). All of it is local — nothing is uploaded.
 *
 * @module utils/file
 */

/** Trigger a client-side download of a string payload. */
export function downloadFile(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Give Safari a tick to start the download before the object URL dies.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Serialise + download JSON with a stable, diff-friendly shape. */
export function downloadJSON(filename, data) {
  downloadFile(filename, `${JSON.stringify(data, null, 2)}\n`, 'application/json');
}

/** Read a File/Blob as UTF-8 text. */
export function readFileAsText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

/**
 * Open the native file picker without keeping an <input type="file"> in the DOM.
 *
 * @param {{ accept?: string, multiple?: boolean }} [options]
 * @returns {Promise<FileList|null>} resolves with `null` when the user cancels
 */
export function pickFiles({ accept = '*/*', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      input.remove();
      window.removeEventListener('focus', onFocus);
      resolve(value);
    };

    // `cancel` is well supported in modern browsers; the focus fallback covers the rest.
    const onFocus = () => setTimeout(() => finish(input.files?.length ? input.files : null), 300);
    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => finish(input.files));
    window.addEventListener('focus', onFocus);

    document.body.append(input);
    input.click();
  });
}

/** `gitbooklet-settings-2026-09-24.json` */
export function timestampedFilename(prefix, extension = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}
