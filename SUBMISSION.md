# Submission notes

## One-line
Peer review with an AI agent, without the manuscript ever leaving the reviewer's browser.

## The problem
Reviewers are bound by confidentiality. ICMJE, Elsevier, COPE and NIH guidance
restrict putting manuscripts under review into AI services, because doing so
transmits a confidential document to a third party. Reviewing is slow, detailed,
unpaid work that AI is genuinely good at assisting — and reviewers are told they
cannot use it. That conflict is unresolved today.

## Why WebMCP is the answer, and not an implementation detail
Every other way of giving an agent access to the manuscript involves sending the
manuscript somewhere. A server MCP has to transmit it. An API integration has to
transmit it. Copy-paste transmits it.

WebMCP tools execute **in the page**, in the reviewer's session, on data that is
already in the browser. So the agent can operate on a document that never moves.
Rebuilt as a server MCP, this project doesn't get worse — it stops being possible.

## What we did with the primitive
- **Consent as the return path.** Every prose-returning tool awaits a per-sentence
  human decision before it resolves. `execute()` being async is the whole
  mechanism; no browser-provided confirmation API is needed, which also means
  nothing breaks when the spec moves.
- **Refusal that reads as refusal.** A denied request returns an explicit
  statement, not an empty success, so the agent cannot mistake withheld text for
  absent text.
- **Graduated disclosure.** `check_stats_reporting` returns numbers without the
  sentences around them — a lower-disclosure path for a common review task.
- **Dynamic tool surface.** One tool before a manuscript is open, eight after,
  one again on close.
- **Standing grants, scoped to the sentence.** Approving one passage never
  silently widens to its neighbours; grants are revocable and die with the
  manuscript.
- **An audit trail the reviewer can hand to an editor.** This is what turns "I
  used AI" from a confession into a defensible, evidenced statement.

## Enforcement, not promises
The deployed CSP sets `connect-src 'none'`. The browser refuses every outbound
request the page could make. A live counter in the header shows the count, and it
reads zero.

## Honest about limits
Claim detection is heuristic pattern matching and the tool descriptions say so.
The counter is an instrument, not a boundary. ReviewGate helps a reviewer comply
with journal policy and documents how AI was used; it is not endorsed by any
journal.

## Demo video structure (under 3 minutes)
1. 0:00–0:20 — the policy problem, quoted.
2. 0:20–0:45 — pasting a manuscript into a chatbot. This is the violation.
3. 0:45–2:15 — the same task in ReviewGate: agent asks, gate appears, reviewer
   withholds two passages, agent works with what it was given and says what it
   was denied. Show the highlighted sentences and the network counter at zero.
4. 2:15–2:45 — export the disclosure log. This is what goes to the editor.
