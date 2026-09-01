import { useEffect, useRef, useState } from 'react';
import { downloadText } from '../lib/export.js';

/**
 * Shows an export on screen before it goes anywhere.
 *
 * Embedded browsers block blob downloads without telling anyone, so a download
 * button alone can fail silently. Here the reviewer always sees the document,
 * can copy it, and can select it by hand if even the clipboard is restricted.
 */
export default function ExportPreview({ open, title, filename, text, onClose }) {
  const [status, setStatus] = useState(null);
  const preRef = useRef(null);

  useEffect(() => { if (open) setStatus(null); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard.');
    } catch {
      // Clipboard can be blocked too. Select it so a manual copy still works.
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setStatus('Clipboard blocked — the text is selected, press Ctrl+C.');
    }
  };

  const save = () => setStatus(
    downloadText(filename, text)
      ? `Saved as ${filename}. Some embedded browsers block downloads — if it did not arrive, copy the text above.`
      : 'This browser blocked the download. Copy the text above instead.',
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-line bg-raised shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <div className="text-sm font-medium">{title}</div>
          <code className="text-xs text-dim">{filename}</code>
          <button onClick={onClose} className="ml-auto text-xs text-dim hover:text-fg">close</button>
        </div>

        <pre
          ref={preRef}
          className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed text-dim selection:bg-accent selection:text-ink"
        >{text}</pre>

        <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
          <span className="text-xs text-dim">{status}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={save}
              className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-raised">Download</button>
            <button onClick={copy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink">Copy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
