/**
 * The only file in this project that touches the WebMCP global.
 *
 * Two things are unsettled in the spec and both are absorbed here:
 *   1. Location. It moved from navigator.modelContext to document.modelContext
 *      on 2026-07-21. Most tutorials still show the old one.
 *   2. Return shape. Chrome's imperative API documents a bare string; the MCP
 *      convention is { content: [{ type: 'text', text }] }. Accept either.
 *
 * If the spec moves again, it moves here and nowhere else.
 */

/**
 * Resolved lazily on every call, never bound at import time. An extension, a
 * polyfill or a late origin-trial token can install the API after this module
 * evaluates, and binding once would miss it permanently.
 */
export const getMc = () =>
  (typeof document !== 'undefined' && document.modelContext) ||
  (typeof navigator !== 'undefined' && navigator.modelContext) ||
  null;

export const getApiLocation = () =>
  (typeof document !== 'undefined' && document.modelContext)
    ? (document.modelContext.__polyfill ? 'dev polyfill' : 'document.modelContext')
    : (typeof navigator !== 'undefined' && navigator.modelContext)
      ? 'navigator.modelContext (legacy)'
      : null;

export const isSupported = () => Boolean(getMc()?.registerTool);

/** Normalise whatever a tool returned into plain text. */
export const asText = (r) =>
  typeof r === 'string' ? r
  : r && Array.isArray(r.content) ? r.content.map((c) => c.text ?? '').join('')
  : r == null ? ''
  : JSON.stringify(r);

/**
 * Register a set of tools against a caller-owned AbortController.
 *
 * The controller must be created synchronously by the caller (in the effect
 * body, not after an await). React StrictMode mounts, unmounts and remounts
 * effects back to back; without a synchronous abort the first run's pending
 * registrations land after the second run's and collide with
 * InvalidStateError: duplicate tool.
 *
 * Chrome unregisters by aborting the signal. Older builds expose
 * unregisterTool(name). Support both, prefer the signal.
 */
export async function registerTools(defs, controller) {
  const mc = getMc();
  if (!mc?.registerTool) return [];
  const registered = [];

  for (const def of defs) {
    if (controller.signal.aborted) break;
    try {
      await mc.registerTool(def, { signal: controller.signal });
      registered.push(def.name);
    } catch (err) {
      // A stale registration from a previous mount can still hold the name.
      if (err?.name === 'InvalidStateError' && mc.unregisterTool) {
        try {
          mc.unregisterTool(def.name);
          await mc.registerTool(def, { signal: controller.signal });
          registered.push(def.name);
          continue;
        } catch { /* fall through to the log below */ }
      }
      console.error(`[webmcp] failed to register ${def.name}:`, err);
    }
  }

  if (mc.unregisterTool) {
    controller.signal.addEventListener('abort', () => {
      for (const name of registered) {
        try { mc.unregisterTool(name); } catch { /* already gone via signal */ }
      }
    });
  }

  return registered;
}

/**
 * Resolve once the API exists, or false on timeout.
 *
 * Registering only at mount is wrong: an embedding browser (ChatGPT's in-app
 * browser, an extension bridge) may install document.modelContext *after* the
 * page's first paint. A single check at mount silently registers nothing and
 * never recovers, which looks exactly like "the site doesn't support WebMCP".
 */
export async function waitForApi({ signal, timeoutMs = 20000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (signal?.aborted) return false;
    if (getMc()?.registerTool) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Invoke a tool locally, with no agent. Your fallback demo path. */
export async function executeLocally(name, args) {
  const mc = getMc();
  if (!mc?.executeTool) throw new Error('executeTool() unavailable in this build');
  const tools = await mc.getTools?.();
  const tool = tools?.find?.((t) => t.name === name) ?? name;
  return asText(await mc.executeTool(tool, JSON.stringify(args)));
}

export async function listTools() {
  try { return (await getMc()?.getTools?.()) ?? []; } catch { return []; }
}
