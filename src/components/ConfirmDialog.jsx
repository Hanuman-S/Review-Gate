/**
 * Small blocking confirmation. Deliberately not window.confirm(): native dialogs
 * are unstyleable, and in a tool about informed consent the destructive choice
 * should state exactly what it destroys.
 */
export default function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-line bg-raised p-5 shadow-2xl shadow-black/60">
        <div className="text-base">{title}</div>
        <div className="mt-2 text-sm text-dim">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-raised"
          >Cancel</button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              danger ? 'bg-bad text-ink' : 'bg-accent text-ink'}`}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
