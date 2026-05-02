export type DownloadStatus = 'ok' | 'empty' | 'popup-blocked';

export function downloadCSV(filename: string, rows: Record<string, unknown>[]): DownloadStatus {
  if (!rows || rows.length === 0) return 'empty';
  const headers = Array.from(rows.reduce((acc, r) => { Object.keys(r).forEach(k => acc.add(k)); return acc; }, new Set<string>()));
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(','));
  // Prepend UTF-8 BOM so Excel detects encoding correctly
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  return triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): DownloadStatus {
  const url = URL.createObjectURL(blob);
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

  // Standard <a download> path. Works directly when not sandboxed.
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  if (inIframe) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  let status: DownloadStatus = 'ok';

  // Sandboxed iframes (Lovable preview) usually block <a download>.
  // Open the blob in a new tab so the browser surfaces the file.
  if (inIframe) {
    try {
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) {
        // Last resort: navigate the top frame.
        try { (window.top ?? window).location.href = url; }
        catch { status = 'popup-blocked'; }
      }
    } catch {
      status = 'popup-blocked';
    }
  }

  // Some browsers revoke the URL too eagerly when the click opens a new tab.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return status;
}
