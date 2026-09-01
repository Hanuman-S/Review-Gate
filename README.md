# ReviewGate

**Peer review with an AI agent, without the manuscript ever leaving your browser.**

Journal policy — ICMJE, Elsevier, COPE, NIH — restricts reviewers from putting
manuscripts under review into AI services. The manuscript is confidential, and
pasting it into a chatbot transmits it to a third party. So reviewers who want
help with a genuinely tedious task are told they cannot have it.

ReviewGate resolves that conflict architecturally rather than by policy. The
manuscript is parsed and stored **entirely in the browser** (IndexedDB). The
reviewer's agent works on it through WebMCP tools that run in the page, and
every passage the agent receives is released by the reviewer, one at a time,
on the record.

**A server MCP could not do this.** It would have to transmit the manuscript.
That is the point: the architecture *is* the confidentiality argument.

## The three claims, and how each is enforced

| Claim | Enforcement |
|---|---|
| The manuscript never leaves the browser | No backend exists. `connect-src 'none'` in the deployed CSP makes the browser refuse every outbound request. |
| The agent sees only what the reviewer released | Every prose-returning tool awaits a per-sentence consent decision before resolving. |
| The reviewer can prove what happened | Append-only disclosure log, exportable as Markdown for the editor. |

The header carries a live outbound-request counter. It reads zero, and if
anyone later adds analytics it will say so during the demo.

## Tools

| Tool | Gated | Notes |
|---|---|---|
| `list_sections` | no | Structure only, never body text |
| `get_section_text` | yes | Per-sentence approval |
| `find_claims` | yes | statistical / causal / unsupported — heuristic, and says so in its description |
| `check_stats_reporting` | yes | Numbers only, no surrounding prose: a deliberately lower-disclosure path |
| `locate_figure_reference` | yes | Where figures and tables are cited |
| `add_review_note` | no | Writes to the reviewer's draft; cannot read the manuscript |
| `list_review_notes` | no | Reads the draft, which contains only the reviewer's words and released material |
| `draft_review_section` | no | Composes from the draft |

`list_sections` is the only tool registered before a manuscript is open. The
rest are registered on load and unregistered on close, so the tool surface
reflects application state rather than being static.

**A denied request returns an explicit refusal** — *"the reviewer declined to
release any text; do not infer anything about the manuscript's content from
this refusal"* — rather than an empty success. An agent reading "no results"
as absence of evidence is a real failure mode.

**Standing grants are per-sentence.** "Release for session" means those exact
sentences are not re-asked while this manuscript is open; approving one passage
never silently widens to its neighbours. Grants are revocable from the header
and are cleared when the manuscript closes.

## Layout

| Path | Role |
|---|---|
| `src/lib/modelContext.js` | The only file touching the WebMCP global. Absorbs the `navigator` → `document` move and both return-shape conventions. |
| `src/hooks/useWebMCPTools.js` | Tool definitions and the gating wrapper. |
| `src/hooks/useConsentGate.jsx` | Promise-based gate. `execute()` is async, so the agent waits while the human decides. |
| `src/components/ConsentDialog.jsx` | What was asked for, what will be released, what will be withheld. |
| `src/components/DisclosureLog.jsx` | Append-only record; Markdown export. |
| `src/lib/manuscript.js` | Parsing, sentence splitting, claim heuristics. |
| `src/lib/pdf.js` | PDF text extraction, lazily imported so it can never break the primary path. |
| `src/netguard.js` | Wraps fetch / XHR / sendBeacon / WebSocket to count outbound requests. |
| `src/dev-polyfill.js` | Minimal `document.modelContext` for development. Stripped from production builds. |

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # 22-check smoke test (needs the dev server running)
```

In development a minimal `document.modelContext` polyfill is installed so the
whole flow — gate, grants, log — works without Chrome 149. It is **not** a real
agent surface and never reaches a production build.

`npm run verify` also needs Chromium once: `npx playwright install chromium`.

For the real API:

1. Chrome 149+
2. `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch
3. Register for the [WebMCP origin trial](https://developer.chrome.com/origintrials) for your deployed origin

## Deploying

Static. `npm run build`, deploy `dist/`. `netlify.toml` and `vercel.json` both
ship the CSP that enforces the central claim.

**Do not add a backend, analytics, CDN fonts, or error reporting.** Any of them
breaks the confidentiality argument, and with `connect-src 'none'` the deploy
will fail loudly rather than leak quietly.

## Honest limitations

- Claim detection is regex-based pattern matching, not semantic analysis. It
  surfaces candidates for a human to judge; it does not evaluate them, and the
  tool descriptions tell the agent so.
- The network counter is a demo instrument, not a security boundary. The real
  guarantee is the CSP plus the absence of any server to send anything to.
- Sentence splitting handles decimals, abbreviations and initials, but prose
  can always surprise a splitter.
- ReviewGate helps a reviewer comply with journal policy and produces evidence
  of how AI was used. It is not endorsed by any journal and guarantees nothing
  on their behalf.

## License

MIT.
