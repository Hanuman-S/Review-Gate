import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsentGateProvider, useConsentGate } from './hooks/useConsentGate.jsx';
import { useWebMCPTools } from './hooks/useWebMCPTools.js';
import { buildTools } from './lib/tools.js';
import ConsentDialog from './components/ConsentDialog.jsx';
import DisclosureLog from './components/DisclosureLog.jsx';
import ReviewDraft from './components/ReviewDraft.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import NetworkCounter from './components/NetworkCounter.jsx';
import { parseManuscript } from './lib/manuscript.js';
import {
  saveManuscript, loadManuscript, clearManuscript,
  allDisclosure, allNotes, addNote, deleteNote,
  allGrants, revokeGrants, loadReviewTitle, hasReviewWork, eraseAll,
} from './lib/db.js';
import { isSupported, getApiLocation, listTools } from './lib/modelContext.js';
import { SAMPLE_TEXT, SAMPLE_TITLE } from './data/sample.js';

function Workspace() {
  const { requestConsent } = useConsentGate();
  const [manuscript, setManuscript] = useState(null);
  const [disclosure, setDisclosure] = useState([]);
  const [notes, setNotes] = useState([]);
  const [grants, setGrants] = useState(new Set());
  const [tools, setTools] = useState([]);
  const [tab, setTab] = useState('log');
  const [busy, setBusy] = useState(null);
  const [output, setOutput] = useState(null);
  const [reviewTitle, setReviewTitle] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const outputRef = useRef(null);

  const refresh = useCallback(async () => {
    setDisclosure(await allDisclosure());
    setNotes(await allNotes());
    setGrants(await allGrants());
    setReviewTitle(await loadReviewTitle());
  }, []);

  useEffect(() => { loadManuscript().then((m) => m && setManuscript(m)); refresh(); }, [refresh]);

  // Built once per manuscript and shared: the same objects the browser registers
  // are the ones the in-page buttons call, so the demo path and the agent path
  // cannot drift apart.
  const defs = useMemo(
    () => buildTools({ manuscript, requestConsent, onChange: refresh }),
    [manuscript, requestConsent, refresh],
  );
  const onRegistered = useCallback(() => { listTools().then(setTools); }, []);
  useWebMCPTools({ defs, onRegistered });

  /** Every sentence id ever released, for highlighting in the manuscript. */
  const releasedIds = useMemo(() => {
    const s = new Set();
    for (const e of disclosure) for (const id of e.releasedIds ?? []) s.add(id);
    return s;
  }, [disclosure]);

  const openNow = async (text, title) => {
    const m = parseManuscript(text, title);
    await saveManuscript(m);
    await revokeGrants();
    setManuscript(m);
    await refresh();
  };

  /**
   * Starting a review of a different manuscript while a draft and log already
   * exist would merge two reviews into one record. Make that an explicit choice.
   */
  const open = async (text, title) => {
    const prior = await loadReviewTitle();
    if (prior && prior !== title && await hasReviewWork()) {
      setConfirm({
        title: 'Start a new review?',
        body: `Your draft and disclosure log belong to "${prior}". Starting a review
               of a different manuscript erases both, so export anything you need first.`,
        confirmLabel: 'Erase and start new',
        danger: true,
        onConfirm: async () => { await eraseAll(); setConfirm(null); await openNow(text, title); },
      });
      return;
    }
    await openNow(text, title);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setBusy('Reading file…');
      if (f.name.toLowerCase().endsWith('.pdf')) {
        setBusy('Extracting text from PDF…');
        const { extractPdfText } = await import('./lib/pdf.js');
        await open(await extractPdfText(f), f.name);
      } else {
        await open(await f.text(), f.name);
      }
    } catch (err) {
      console.error(err);
      setBusy(null);
      alert(`Could not read that file: ${err.message}`);
      return;
    }
    setBusy(null);
    e.target.value = '';
  };

  /**
   * Run a tool exactly as an agent would, but from the page. Does not touch
   * document.modelContext, so this works in any browser.
   */
  const run = async (tool, args = {}) => {
    const def = defs.find((d) => d.name === tool);
    if (!def) return;
    setOutput({ tool, text: 'Running…' });
    try {
      setOutput({ tool, text: await def.execute(args, { signal: new AbortController().signal }) });
    } catch (err) {
      setOutput({ tool, text: `Error: ${err.message}`, error: true });
    }
    outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-5 py-3">
        <div className="font-semibold">ReviewGate</div>
        <div className="text-xs text-dim">
          {isSupported()
            ? <>WebMCP via <code className="text-accent">{getApiLocation()}</code> · {tools.length} tools exposed</>
            : <span className="text-warn">
                WebMCP unavailable — enable chrome://flags/#enable-webmcp-testing (Chrome 149+)
              </span>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {grants.size > 0 && (
            <button
              onClick={async () => { await revokeGrants(); await refresh(); }}
              className="rounded-lg border border-warn/40 px-3 py-1.5 text-xs text-warn hover:bg-raised"
              title="Standing approvals let the agent re-read those passages without asking again"
            >
              revoke {grants.size} standing grant{grants.size === 1 ? '' : 's'}
            </button>
          )}
          {(notes.length > 0 || disclosure.length > 0) && (
            <button
              onClick={() => setConfirm({
                title: 'Erase all local data?',
                body: 'Deletes the manuscript, your review draft, the disclosure log and every standing grant from this browser. This cannot be undone, and the disclosure log is your record of what the agent was shown.',
                confirmLabel: 'Erase everything',
                danger: true,
                onConfirm: async () => {
                  await eraseAll(); setManuscript(null); setOutput(null);
                  setConfirm(null); await refresh();
                },
              })}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-dim hover:border-bad/50 hover:text-bad"
            >
              erase local data
            </button>
          )}
          <NetworkCounter />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_380px]">
        <main className="min-h-0 overflow-auto p-6">
          {!manuscript ? (
            <div className="mx-auto mt-16 max-w-md text-center">
              <div className="text-lg">Open a manuscript</div>
              <p className="mt-2 text-sm text-dim">
                It is parsed in this browser and stored in IndexedDB. It is never uploaded.
              </p>
              {reviewTitle && (notes.length > 0 || disclosure.length > 0) && (
                <p className="mt-4 rounded-lg border border-line bg-panel p-3 text-xs text-dim">
                  Your draft and disclosure log for
                  <span className="text-fg"> “{reviewTitle}” </span>
                  are still here. Reopen that manuscript to keep working, or export
                  them from the panel on the right.
                </p>
              )}
              <div className="mt-6 flex justify-center gap-3">
                <label className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm hover:bg-raised">
                  {busy ?? 'Choose .txt / .md / .pdf'}
                  <input type="file" accept=".txt,.md,.pdf" className="hidden" onChange={onFile} />
                </label>
                <button
                  onClick={() => open(SAMPLE_TEXT, SAMPLE_TITLE)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
                >
                  Load sample
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h1 className="text-lg">{manuscript.title}</h1>
                <span className="text-xs text-dim">
                  {manuscript.wordCount} words · {releasedIds.size} sentences released
                </span>
                <button
                  onClick={async () => { await clearManuscript(); setManuscript(null); setOutput(null); await refresh(); }}
                  className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised"
                  title="Removes the manuscript text and revokes standing grants. Your draft and disclosure log are kept."
                >
                  Close manuscript
                </button>
              </div>

              {/* Fallback demo path: drive the tools without an agent. */}
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink/60 p-3">
                <span className="text-xs text-dim">
                  Run a tool as an agent would{isSupported() ? '' : ' (works without WebMCP)'}:
                </span>
                <button onClick={() => run('list_sections')}
                  className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised">list_sections</button>
                <button onClick={() => run('check_stats_reporting')}
                  className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised">check_stats_reporting</button>
                <button onClick={() => run('find_claims', { kind: 'unsupported', reason: 'Checking for unsupported assertions.' })}
                  className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised">find_claims</button>
                <button onClick={() => run('get_section_text', { section_id: 's1', reason: 'Reviewing the methods for sample size justification.' })}
                  className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised">get_section_text</button>
                <button onClick={() => run('locate_figure_reference', {})}
                  className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised">locate_figure_reference</button>
              </div>

              {output && (
                <div ref={outputRef} className="mb-5 rounded-lg border border-line bg-panel">
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                    <span className="text-xs text-dim">returned to the agent</span>
                    <code className="text-xs text-accent">{output.tool}</code>
                    <button
                      onClick={() => setOutput(null)}
                      className="ml-auto text-xs text-dim hover:text-fg"
                      aria-label="Dismiss result"
                    >clear</button>
                  </div>
                  <pre className={`max-h-56 overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed ${
                    output.error ? 'text-bad' : 'text-dim'}`}>{output.text}</pre>
                </div>
              )}

              {manuscript.sections.map((s) => (
                <section key={s.id} className="mb-6">
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                    {s.heading} <span className="opacity-50">· {s.id}</span>
                  </h2>
                  <p className="text-sm leading-relaxed">
                    {s.sentences.map((x) => (
                      <span
                        key={x.id}
                        data-released={releasedIds.has(x.id) || undefined}
                        title={releasedIds.has(x.id) ? 'Released to the agent' : undefined}
                        className={releasedIds.has(x.id)
                          ? 'rounded bg-accent/15 decoration-accent/40 underline decoration-dotted underline-offset-4'
                          : ''}
                      >{x.text} </span>
                    ))}
                  </p>
                </section>
              ))}
            </>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-t border-line bg-panel lg:border-l lg:border-t-0">
          <div className="flex border-b border-line">
            {[['log', `Disclosure (${disclosure.length})`], ['draft', `Draft (${notes.length})`]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 px-4 py-2 text-xs transition ${
                  tab === k ? 'bg-raised text-fg' : 'text-dim hover:text-fg'}`}
              >{label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === 'log'
              ? <DisclosureLog entries={disclosure} reviewTitle={reviewTitle} manuscriptOpen={!!manuscript} />
              : <ReviewDraft
                  notes={notes}
                  onAdd={async (text) => { await addNote({ text, sectionId: null, source: 'reviewer' }); await refresh(); }}
                  onDelete={async (id) => { await deleteNote(id); await refresh(); }}
                  reviewTitle={reviewTitle}
                />}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirm}
        {...(confirm ?? {})}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ConsentGateProvider>
      <Workspace />
      <ConsentDialog />
    </ConsentGateProvider>
  );
}
