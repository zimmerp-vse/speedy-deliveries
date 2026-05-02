## What's happening

The toast says "Exported 4 rows" so the CSV is being generated correctly — but no file appears on disk. The Lovable preview runs your app inside a sandboxed iframe, and sandboxed iframes silently block the `<a download>` attribute used by `triggerDownload`. The click fires, the browser ignores it, no error is thrown.

This applies equally to Sessions and Feedback exports (both go through the same `downloadCSV` helper).

## Plan

### `src/lib/csv.ts` — make downloads work inside the preview iframe

Update `triggerDownload` to:

1. Detect whether the page is running inside an iframe (`window.self !== window.top`).
2. When inside an iframe, set `a.target = '_blank'` so the click escapes the sandbox into a new tab where the browser will offer to save the file.
3. As a belt-and-suspenders fallback, also call `window.open(url, '_blank')` so the file is surfaced even if the anchor click is suppressed.
4. If `window.open` is blocked by a popup blocker, navigate the top frame to the blob URL as a last resort.
5. Add a UTF-8 BOM (`\ufeff`) to the CSV so Excel opens it with correct encoding.
6. Keep the blob URL alive for 60 s before revoking it (some browsers revoke too early when the navigation is into a new tab).

### `src/pages/Admin.tsx` — friendlier toast

Change both export success toasts to mention the new tab so users know where to look:

```
toast.success(`Exported ${n} rows — opening in a new tab`);
```

Also add a one-time popup-blocked notice: if `window.open` returns null inside the iframe, show `toast.error("Your browser blocked the download popup. Allow popups for this site and try again, or open the app in a new tab.")` from `csv.ts` via a callback or returned status.

## Files to edit

- `src/lib/csv.ts` — iframe-aware download with new-tab fallback and BOM
- `src/pages/Admin.tsx` — clearer toast wording for both Sessions and Feedback exports

## Note for the user

After this change, if your browser asks whether to allow popups from the Lovable preview, allow them — that's the new tab carrying the CSV. Alternatively, opening your app in its own tab (the "Open in new tab" button at the top of the preview) makes downloads work normally with no popup involved.
