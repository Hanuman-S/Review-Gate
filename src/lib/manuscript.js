/**
 * Plain-text manuscript parsing. Deliberately dumb and deliberately synchronous.
 *
 * PDF.js is the day-2 stretch, not the day-1 dependency: a v1 that only accepts
 * .txt/.md cannot fail in front of a judge.
 *
 * Convention: a line in ALL CAPS, or prefixed with #, starts a new section.
 */

/**
 * Heading detection.
 *
 * Two conventions in the wild, and they must not be mixed:
 *
 *   Numbered — "Chapter 3 : Problem Statement", "3.1 Memory Leaks",
 *              "IV. SYSTEM WORKFLOW". Common in reports and theses.
 *   Shouted  — an ALL-CAPS line, as in many manuscript templates.
 *
 * Applying the shouted rule to a numbered document turns the title page into
 * sections ("BACHELOR OF TECHNOLOGY", "APRIL 2026") while the real chapter
 * headings, being mixed case, are missed entirely. So: if the document has a
 * usable set of numbered headings, trust only those and let the front matter
 * collapse into the preamble.
 */
const NUMBERED = [
  /^chapter\s+\d+\s*[:.\-–]?\s*\S/i,       // Chapter 3 : Problem Statement
  /^\d+(\.\d+)*\s*[.:)\-–]?\s+[A-Za-z]/,   // 3.1 Memory Leaks
  /^[IVXLCDM]+\s*[.:)]\s+[A-Za-z]/,          // IV. System Workflow
];

const isNumberedHeading = (line) => {
  const t = line.trim();
  return t.length > 0 && t.length < 90 && NUMBERED.some((re) => re.test(t));
};

const isShoutedHeading = (line) => {
  const t = line.trim();
  if (!t) return false;
  return t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t);
};

const makeIsHeading = (raw) => {
  const lines = raw.split('\n');
  const firstNumbered = lines.findIndex(isNumberedHeading);
  const numberedCount = lines.filter(isNumberedHeading).length;

  // Running headers and footers repeat on every page ("NATIONAL INSTITUTE OF
  // TECHNOLOGY KARNATAKA"). Identical text appearing three or more times is
  // page furniture, not structure.
  const tally = new Map();
  for (const l of lines) {
    const t = l.trim();
    if (t) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  const isFurniture = (t) => (tally.get(t) ?? 0) >= 3;
  // Three or more is a convention; one or two is a coincidence.
  const useNumbered = numberedCount >= 3;

  return (line, index) => {
    const t = line.trim();
    if (!t) return false;
    if (t.startsWith('#')) return true;
    if (isFurniture(t)) return false;
    if (!useNumbered) return isShoutedHeading(t);
    if (isNumberedHeading(t)) return true;
    // A shouted line still counts (ACKNOWLEDGMENT, REFERENCES) but only after
    // the numbering starts — before that it is title-page furniture.
    return index > firstNumbered && isShoutedHeading(t);
  };
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
  const isHeading = makeIsHeading(raw);

  const allLines = raw.split('\n');
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (isHeading(line, i)) {
      current = { id: `s${sections.length}`, heading: line.replace(/^#+\s*/, '').trim().slice(0, 80), body: [] };
      sections.push(current);
    } else if (line.trim()) {
      if (!current) {
        current = { id: 's0', heading: 'Preamble', body: [] };
        sections.push(current);
      }
      current.body.push(line.trim());
    }
  }

  // A table of contents is itself a list of numbered headings, so it produces a
  // run of sections with no body. Drop empty sections rather than showing the
  // reviewer a contents page rendered as structure.
  const kept = sections.filter((s) => s.body.length > 0);
  const finalSections = kept.length ? kept : sections;
  finalSections.forEach((s, i) => { s.id = `s${i}`; });
  sections.length = 0;
  sections.push(...finalSections);

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

  /**
   * Performance and capability claims asserted without a measurement beside
   * them. Empirical papers overclaim with hedging words; engineering reports
   * overclaim with adjectives — "smooth", "stable", "responsive", "effective" —
   * and the other three patterns miss those entirely.
   */
  unevidenced: /\b(demonstrat\w+|achiev\w+|ensur\w+|guarantee\w+|outperform\w+|effective|efficient|robust|seamless|smooth|stable|responsive|reliable|lightweight|real-?time performance|no (?:lag|latency|distortion|freezing|issues))\b/i,
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
