/**
 * Export documents are built here rather than inside the components, so the
 * same text can be downloaded, previewed on screen, or copied to the clipboard.
 *
 * That matters because embedded browsers (the ChatGPT in-app browser among
 * them) silently block blob downloads. An export the reviewer cannot see is an
 * export they cannot trust, so the on-screen preview is the primary path and
 * the download is a convenience.
 */

export function buildDisclosureMarkdown(entries, reviewTitle) {
  return [
    '# AI assistance disclosure',
    '',
    `Manuscript: ${reviewTitle ?? 'unknown'}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Tool: ReviewGate. The manuscript was processed entirely in the reviewer\'s',
    'browser and was not transmitted to any server. Every passage below was',
    'explicitly released by the reviewer; withheld passages were never sent.',
    '',
    '| Time | Tool | Requested | Released | Withheld | Scope |',
    '|---|---|---|---|---|---|',
    ...entries.map((e) =>
      `| ${new Date(e.at).toISOString()} | ${e.tool} | ${e.requested} | ${e.released} | ${e.withheld} | ${e.scope ?? 'once'} |`),
    '',
    `Totals: ${entries.length} requests, ` +
    `${entries.reduce((n, e) => n + (e.released ?? 0), 0)} passages released, ` +
    `${entries.reduce((n, e) => n + (e.withheld ?? 0), 0)} withheld.`,
  ].join('\n');
}

export function buildReviewMarkdown(notes, reviewTitle) {
  return [
    '# Reviewer report',
    '',
    `Manuscript: ${reviewTitle ?? 'unknown'}`,
    '',
    ...notes.map((n) =>
      n.text.startsWith('##')
        ? `\n${n.text}\n`
        : `- ${n.sectionId ? `**${n.sectionId}** — ` : ''}${n.text}`),
    '',
    '---',
    '_Drafted with ReviewGate. The manuscript was processed locally in the',
    'reviewer\'s browser and was not transmitted to any server._',
  ].join('\n');
}

/** Best-effort download. Returns false where the browser blocks blob saves. */
export function downloadText(filename, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
