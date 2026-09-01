/**
 * PDF text extraction.
 *
 * Lazily imported so pdfjs never enters the main bundle and a failure here can
 * never break the .txt/.md path, which is the one the demo depends on.
 *
 * The worker is bundled locally via Vite's ?url import rather than loaded from
 * a CDN. That is not a preference — a CDN fetch would be an outbound request,
 * and the network counter would show it during the demo.
 */
export async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Rebuild lines from item positions: pdfjs emits fragments, and joining them
    // blindly turns a manuscript into one unreadable paragraph.
    let lastY = null;
    let line = [];
    const lines = [];
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.join('').trim());
        line = [];
      }
      line.push(item.str);
      lastY = y;
    }
    if (line.length) lines.push(line.join('').trim());
    pages.push(lines.filter(Boolean).join('\n'));
  }

  // pdfjs v6 exposes destroy() on the loading task, not the document. Guard both
  // so a version bump can't turn cleanup into a thrown error mid-import.
  await (loadingTask.destroy?.() ?? doc.destroy?.() ?? Promise.resolve());

  return pages.join('\n\n');
}
