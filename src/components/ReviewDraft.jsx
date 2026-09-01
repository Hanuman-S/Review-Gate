import { useState } from 'react';
import ExportPreview from './ExportPreview.jsx';
import { buildReviewMarkdown } from '../lib/export.js';

/**
 * The reviewer's own draft. The agent can write here (add_review_note,
 * draft_review_section) and read it back, but the notes are the reviewer's
 * words and released material only — never unreleased manuscript text.
 */
export default function ReviewDraft({ notes, onAdd, onDelete, reviewTitle }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="text-sm font-medium">Review draft</div>
        <button
          onClick={() => setPreview(true)}
          disabled={!notes.length}
          className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-raised disabled:opacity-40"
        >
          Export report
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 text-xs">
        {!notes.length && (
          <div className="p-4 text-dim">
            Empty. Your notes and anything the agent drafts will appear here.
          </div>
        )}
        {notes.map((n) => (
          <div key={n.id} className="group mb-2 rounded-lg border border-line bg-ink/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wide ${
                n.source === 'reviewer' ? 'text-good' : 'text-accent'}`}>
                {n.source}
              </span>
              {n.sectionId && <span className="text-dim">{n.sectionId}</span>}
              <button
                onClick={() => onDelete(n.id)}
                className="ml-auto opacity-0 transition group-hover:opacity-100 hover:text-bad"
                aria-label="Delete note"
              >×</button>
            </div>
            <div className="whitespace-pre-wrap">{n.text}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add your own note…"
          rows={2}
          className="w-full resize-none rounded-md border border-line bg-ink/80 p-2 text-xs outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="mt-2 w-full rounded-md border border-line px-3 py-1.5 text-xs hover:bg-raised disabled:opacity-40"
        >
          Add note
        </button>
      </form>

      <ExportPreview
        open={preview}
        title="Reviewer report"
        filename="review-draft.md"
        text={buildReviewMarkdown(notes, reviewTitle)}
        onClose={() => setPreview(false)}
      />
    </div>
  );
}
