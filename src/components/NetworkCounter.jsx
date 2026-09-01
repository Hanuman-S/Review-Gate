import { useEffect, useState } from 'react';

/**
 * The kill shot in the demo video: a live count of outbound requests, which
 * stays at zero while the agent works.
 */
export default function NetworkCounter() {
  const [counts, setCounts] = useState(() => window.__netguard?.counts ?? { total: 0 });

  useEffect(() => window.__netguard?.subscribe(setCounts), []);

  const clean = counts.total === 0;
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs
        ${clean ? 'border-good/30 text-good' : 'border-bad/40 text-bad'}`}
      title="Outbound network requests made by this page since load"
    >
      <span className={`h-2 w-2 rounded-full ${clean ? 'bg-good' : 'bg-bad'}`} />
      network requests: {counts.total}
      {clean && <span className="text-dim">· manuscript has not left this browser</span>}
    </div>
  );
}
