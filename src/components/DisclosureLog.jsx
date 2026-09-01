/**
 * Append-only record of every gate decision.
 *
 * This is what turns "I used AI" from a confession into an auditable statement,
 * and it is the reason a reviewer could defend using this tool to an editor.
 * Build it early; it is not a nice-to-have.
 */
export default function DisclosureLog({ entries, reviewTitle, manuscriptOpen }) {
  const exportMd = () => {
    const lines = [
      '# AI assistance disclosure',
      '',
      `Manuscript: ${reviewTitle ?? 'unknown'}`,
      '',
      'Tool: ReviewGate. The manuscript was processed entirely in the reviewer\'s',
      'browser and was not transmitted to any server. Every passage below was',
      'explicitly released by the reviewer.',
      '',
      '| Time | Tool | Requested | Released | Withheld | Scope |',
      '|---|---|---|---|---|---|',
      ...entries.map((e) =>
        `| ${new Date(e.at).toISOString()} | ${e.tool} | ${e.requested} | ${e.released} | ${e.withheld} | ${e.scope ?? 'once'} |`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ai-disclosure.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-sm font-medium">Disclosure log</div>
        <button
          onClick={exportMd}
          disabled={!entries.length}
          className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised disabled:opacity-40"
        >
          Export for editor
        </button>
      </div>

      {reviewTitle && !manuscriptOpen && entries.length > 0 && (
        <div className="border-b border-line bg-ink/40 px-4 py-2 text-xs text-dim">
          Kept from your review of <span className="text-fg">“{reviewTitle}”</span>.
          The manuscript is closed; this record is not.
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 text-xs">
        {!entries.length && (
          <div className="p-4 text-dim">
            Empty. Every request the agent makes will be recorded here, including
            what you withheld.
          </div>
        )}
        {entries.slice().reverse().map((e) => (
          <div key={e.id} className="mb-2 rounded-lg border border-line bg-ink/60 p-3">
            <div className="flex justify-between">
              <span className="font-medium text-accent">{e.tool}</span>
              <span className="text-dim">{new Date(e.at).toLocaleTimeString()}</span>
            </div>
            {e.reason && <div className="mt-1 text-dim">“{e.reason}”</div>}
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="text-good">{e.released} released</span>
              {e.withheld > 0 && <span className="text-bad">{e.withheld} withheld</span>}
              {e.scope && e.scope !== 'once' && (
                <span className="text-dim">· {e.scope}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
