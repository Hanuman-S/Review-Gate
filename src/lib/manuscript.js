/**
 * Plain-text manuscript parsing. Deliberately dumb and deliberately synchronous.
 *
 * PDF.js is the day-2 stretch, not the day-1 dependency: a v1 that only accepts
 * .txt/.md cannot fail in front of a judge.
 *
 * Convention: a line in ALL CAPS, or prefixed with #, starts a new section.
 */

const isHeading = (line) => {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('#')) return true;
  return t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t);
};


const DOT = '\u0001';

/**
 * Sentence splitting that survives scientific prose.
 *
 * A naive /[^.!?]+[.!?]+/ splits "p<0.05" into "(p<0" and "05).", which then
 * shows the reviewer meaningless fragments in the consent dialog and hands the
 * agent broken text. Decimals, abbreviations and figure references are masked
 * before splitting and restored after.
 */
const ABBREVIATIONS = [
  'e.g.', 'i.e.', 'et al.', 'cf.', 'vs.', 'approx.', 'Fig.', 'Figs.', 'Tab.',
  'No.', 'no.', 'Dr.', 'Prof.', 'St.', 'Eq.', 'Ref.', 'Refs.', 'ca.',
];

export function splitSentences(text) {
  if (!text.trim()) return [];

  let masked = text.replace(/(\d)\.(\d)/g, `$1${DOT}$2`);   // decimals
  for (const abbr of ABBREVIATIONS) {
    masked = masked.split(abbr).join(abbr.replace(/\./g, DOT));
  }
  masked = masked.replace(/\b([A-Z])\.(?=\s*[A-Z]\.)/g, `$1${DOT}`); // initials

  const parts = masked.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [masked];

  return parts
    .map((t) => t.split(DOT).join('.').trim())
    .filter(Boolean);
}

export function parseManuscript(raw, title = 'Untitled manuscript') {
  const sections = [];
  let current = null;

  for (const line of raw.split('\n')) {
    if (isHeading(line)) {
      current = { id: `s${sections.length}`, heading: line.replace(/^#+\s*/, '').trim(), body: [] };
      sections.push(current);
    } else if (line.trim()) {
      if (!current) {
        current = { id: 's0', heading: 'Preamble', body: [] };
        sections.push(current);
      }
      current.body.push(line.trim());
    }
  }

  // Split into sentences so consent can be per-sentence, not per-section.
  for (const s of sections) {
    const text = s.body.join(' ');
    s.sentences = splitSentences(text)
      .map((t, i) => ({ id: `${s.id}.${i}`, text: t }));
    delete s.body;
  }

  const wordCount = sections.reduce(
    (n, s) => n + s.sentences.reduce((m, x) => m + x.text.split(/\s+/).length, 0), 0);

  return { title, sections, wordCount, loadedAt: Date.now() };
}

/* --- claim detection: crude on purpose, and honest about it --------------- */

const PATTERNS = {
  statistical: /\b(p\s*[<=>]\s*0?\.\d+|95%\s*CI|n\s*=\s*\d+|significant(ly)?|correlat|regress|odds ratio|effect size)\b/i,
  causal:      /\b(causes?|caused|leads? to|results? in|due to|because of|drives?)\b/i,
  unsupported: /\b(clearly|obviously|it is well known|undoubtedly|self-evident|widely accepted)\b/i,
};

export function findClaims(manuscript, kind) {
  const re = PATTERNS[kind];
  if (!re) return [];
  const hits = [];
  for (const s of manuscript.sections)
    for (const sent of s.sentences)
      if (re.test(sent.text)) hits.push({ ...sent, section: s.heading, sectionId: s.id });
  return hits;
}

export const claimKinds = Object.keys(PATTERNS);

/** Numbers only — lets a low-friction gate release stats without prose. */
export function extractStats(manuscript) {
  const out = [];
  for (const s of manuscript.sections)
    for (const sent of s.sentences) {
      const nums = sent.text.match(/\b(p\s*[<=>]\s*0?\.\d+|n\s*=\s*\d+|\d+(\.\d+)?%|95%\s*CI[^.;]*)/gi);
      if (nums) out.push({ id: sent.id, section: s.heading, values: nums.map((n) => n.trim()) });
    }
  return out;
}

/** Find where figures and tables are referenced in the prose. */
export function findFigureMentions(manuscript, label) {
  const re = label
    ? new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : /\b(figure|fig\.?|table)\s*\d+/i;
  const hits = [];
  for (const s of manuscript.sections)
    for (const sent of s.sentences)
      if (re.test(sent.text)) hits.push({ ...sent, section: s.heading, sectionId: s.id });
  return hits;
}
