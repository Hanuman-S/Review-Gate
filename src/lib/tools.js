/**
 * Tool definitions, built as plain objects with no dependency on React or on
 * WebMCP being present.
 *
 * Kept separate from registration on purpose: the app must be fully usable when
 * document.modelContext does not exist. A judge on Chrome 148, or in a browser
 * without the origin trial, can still drive every tool from the page and see the
 * gate, the withholding and the disclosure log. Registration is how an *agent*
 * reaches these; it is not how they run.
 */
import { findClaims, claimKinds, extractStats, findFigureMentions } from './manuscript.js';
import { appendDisclosure, addNote, allNotes, allGrants, grantSentences } from './db.js';

export function buildTools({ manuscript, requestConsent, onChange }) {
  /**
   * Put candidate passages to the reviewer, honour standing grants, record
   * the decision, and return only approved text.
   */
  const gated = async (tool, reason, items) => {
    if (items.length === 0) return 'Nothing in the manuscript matched that request.';

    const grants = await allGrants();
    const standing = items.filter((i) => grants.has(i.id));
    const toAsk = items.filter((i) => !grants.has(i.id));

    let approved = [];
    let scope = 'once';

    if (toAsk.length > 0) {
      ({ approved, scope } = await requestConsent({
        tool, reason, items: toAsk, standing: standing.length,
      }));
      if (scope === 'session' && approved.length) {
        await grantSentences(approved.map((i) => i.id));
      }
    }

    const released = [...standing, ...approved];
    const withheld = items.length - released.length;

    await appendDisclosure({
      tool,
      reason,
      requested: items.length,
      released: released.length,
      withheld,
      scope: toAsk.length === 0 ? 'standing' : scope,
      releasedIds: released.map((i) => i.id),
    });
    onChange?.();

    if (released.length === 0) {
      return 'The reviewer declined to release any text for this request. ' +
             'Do not infer anything about the manuscript\'s content from this refusal.';
    }

    const footer = withheld > 0
      ? `\n\n[${withheld} of ${items.length} matching passages were withheld by the reviewer. ` +
        'Do not speculate about their content.]'
      : '';

    return released
      .map((i) => `${i.section ? `[${i.section}] ` : ''}${i.text}`)
      .join('\n') + footer;
  };

  /* --- tool definitions ------------------------------------------------ */

  const defs = [
    {
      name: 'list_sections',
      description:
        'List section headings and sizes of the manuscript currently open. ' +
        'Returns structure only, never body text. Call this first to orient yourself.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        if (!manuscript) return 'No manuscript is open.';
        return [
          `Title: ${manuscript.title}`,
          `Sections: ${manuscript.sections.length}, words: ${manuscript.wordCount}`,
          '',
          ...manuscript.sections.map(
            (s) => `${s.id}: ${s.heading} (${s.sentences.length} sentences)`),
        ].join('\n');
      },
    },
  ];

  if (manuscript) {
    defs.push(
      {
        name: 'get_section_text',
        description:
          'Request the text of one section. The reviewer approves each passage ' +
          'individually before it is returned; some or all may be withheld.',
        inputSchema: {
          type: 'object',
          properties: {
            section_id: { type: 'string', description: 'id from list_sections, e.g. s2' },
            reason: { type: 'string', description: 'Why you need this section, shown to the reviewer' },
          },
          required: ['section_id', 'reason'],
        },
        annotations: { readOnlyHint: true },
        execute: async ({ section_id, reason }) => {
          const s = manuscript.sections.find((x) => x.id === section_id);
          if (!s) return `No section with id ${section_id}. Call list_sections first.`;
          return gated('get_section_text', reason,
            s.sentences.map((x) => ({ ...x, section: s.heading })));
        },
      },
      {
        name: 'find_claims',
        description:
          `Find candidate claims of a given kind (${claimKinds.join(', ')}). ` +
          'Matching is heuristic pattern matching, not semantic analysis — treat ' +
          'results as candidates for human judgement. The reviewer approves which ' +
          'matches are returned.',
        inputSchema: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: claimKinds },
            reason: { type: 'string', description: 'Shown to the reviewer' },
          },
          required: ['kind', 'reason'],
        },
        annotations: { readOnlyHint: true },
        execute: async ({ kind, reason }) =>
          gated('find_claims', reason || `Looking for ${kind} claims.`,
            findClaims(manuscript, kind)),
      },
      {
        name: 'check_stats_reporting',
        description:
          'Return only the numeric statistical values reported in the manuscript ' +
          '(p-values, sample sizes, percentages, confidence intervals) without the ' +
          'surrounding prose. Lower disclosure than get_section_text.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: async () => gated(
          'check_stats_reporting',
          'Numeric values only — no surrounding sentences.',
          extractStats(manuscript).map((s) => ({
            id: s.id, section: s.section, text: s.values.join(', '),
          })),
        ),
      },
      {
        name: 'locate_figure_reference',
        description:
          'Find where a figure or table is mentioned in the text, e.g. "Figure 2" ' +
          'or "Table 1". Useful for checking that every figure is referenced.',
        inputSchema: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'e.g. "Figure 2", "Table 1", or omit for all' },
          },
        },
        annotations: { readOnlyHint: true },
        execute: async ({ label }) => gated(
          'locate_figure_reference',
          label ? `Locating mentions of ${label}.` : 'Locating all figure and table mentions.',
          findFigureMentions(manuscript, label),
        ),
      },
      {
        name: 'add_review_note',
        description:
          'Write a note into the reviewer\'s private draft. This tool writes only — ' +
          'it cannot read the manuscript, so it needs no approval.',
        inputSchema: {
          type: 'object',
          properties: {
            section_id: { type: 'string', description: 'Optional section this note concerns' },
            text: { type: 'string', description: 'The note' },
          },
          required: ['text'],
        },
        execute: async ({ section_id, text }) => {
          await addNote({ sectionId: section_id ?? null, text, source: 'agent' });
          await appendDisclosure({
            tool: 'add_review_note',
            reason: 'agent wrote to the reviewer\'s draft',
            requested: 0, released: 0, withheld: 0, scope: 'write', releasedIds: [],
          });
          onChange?.();
          return 'Note added to the reviewer\'s draft.';
        },
      },
      {
        name: 'list_review_notes',
        description:
          'Read back the notes currently in the reviewer\'s draft. These are the ' +
          'reviewer\'s own words and your earlier notes, not manuscript text, so no ' +
          'approval is required.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        execute: async () => {
          const notes = await allNotes();
          if (!notes.length) return 'The review draft is empty.';
          return notes
            .map((n) => `- (${n.source}${n.sectionId ? `, ${n.sectionId}` : ''}) ${n.text}`)
            .join('\n');
        },
      },
      {
        name: 'draft_review_section',
        description:
          'Compose a section of the review (e.g. "Major concerns") from notes already ' +
          'in the draft. Works only from released material and existing notes — it ' +
          'cannot reach unreleased manuscript text.',
        inputSchema: {
          type: 'object',
          properties: {
            heading: { type: 'string', description: 'e.g. "Major concerns"' },
            text: { type: 'string', description: 'The composed prose' },
          },
          required: ['heading', 'text'],
        },
        execute: async ({ heading, text }) => {
          await addNote({ sectionId: null, text: `## ${heading}\n${text}`, source: 'agent-draft' });
          await appendDisclosure({
            tool: 'draft_review_section',
            reason: `composed "${heading}"`,
            requested: 0, released: 0, withheld: 0, scope: 'write', releasedIds: [],
          });
          onChange?.();
          return `Added "${heading}" to the review draft.`;
        },
      },
    );
  }

  return defs;
}
