import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConsentGate } from '../hooks/useConsentGate.jsx';

/**
 * The screen judges will remember. Three things must be legible at a glance:
 * what the agent asked for, what it will get, and what it will not get.
 *
 * Withheld rows stay visible and struck through rather than disappearing —
 * the reviewer should see the shape of what they are refusing.
 */
export default function ConsentDialog() {
  const { request, settle } = useConsentGate();
  const [checked, setChecked] = useState({});

  useEffect(() => {
    if (request) setChecked(Object.fromEntries(request.items.map((i) => [i.id, true])));
  }, [request]);

  const approved = useMemo(
    () => (request?.items ?? []).filter((i) => checked[i.id]),
    [request, checked],
  );

  const onKey = useCallback((e) => {
    if (e.key === 'Escape') settle([]);
  }, [settle]);

  useEffect(() => {
    if (!request) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, onKey]);

  if (!request) return null;

  const withheld = request.items.length - approved.length;
  const standing = request.standing ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Consent required"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-raised shadow-2xl shadow-black/60">
        <div className="border-b border-line p-5">
          <div className="text-xs uppercase tracking-wider text-dim">
            {request.tool} is requesting manuscript text
          </div>
          <div className="mt-1 text-base">{request.reason}</div>
          <div className="mt-3 text-xs text-dim">
            Nothing below has left this browser. Only what you check will be sent to the agent.
            {standing > 0 && (
              <> <span className="text-accent">
                {standing} further passage{standing === 1 ? '' : 's'} already released earlier
                in this session will be included.
              </span></>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {request.items.map((item) => (
            <label
              key={item.id}
              className={`mb-2 flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition
                ${checked[item.id]
                  ? 'border-line bg-ink/50'
                  : 'border-transparent bg-ink/60 text-dim line-through decoration-bad/60'}`}
            >
              <input
                type="checkbox"
                className="mt-1 accent-accent"
                checked={!!checked[item.id]}
                onChange={(e) => setChecked((c) => ({ ...c, [item.id]: e.target.checked }))}
              />
              <span>
                {item.section && (
                  <span className="mr-2 text-xs text-dim">[{item.section}]</span>
                )}
                {item.text}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
          <div className="text-xs text-dim">
            <span className="text-good">{approved.length} released</span>
            {withheld > 0 && <> · <span className="text-bad">{withheld} withheld</span></>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => settle([])}
              className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-raised"
            >
              Deny everything
            </button>
            <button
              onClick={() => settle(approved, 'session')}
              disabled={approved.length === 0}
              className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-raised disabled:opacity-40"
              title="Do not ask again for these passages while this manuscript is open"
            >
              Release for session
            </button>
            <button
              onClick={() => settle(approved, 'once')}
              disabled={approved.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Release once ({approved.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
