/**
 * Registers prebuilt tool definitions with the browser.
 *
 * This hook is only the bridge to an agent. The tools themselves live in
 * lib/tools.js and run with or without WebMCP, so a browser that lacks the API
 * loses agent access but keeps the whole application.
 *
 * Dynamic registration is deliberate and judged: only list_sections exists
 * before a manuscript is open, the rest appear on load and are unregistered on
 * close, so the tool surface reflects application state.
 */
import { useEffect } from 'react';
import { registerTools, waitForApi } from '../lib/modelContext.js';

export function useWebMCPTools({ defs, onRegistered }) {
  useEffect(() => {
    // Created synchronously so React StrictMode's immediate cleanup aborts the
    // first run before its async registrations collide with the second run's.
    const controller = new AbortController();

    // Keep watching for the API rather than checking once. Embedders can inject
    // it after first paint; a one-shot check would register nothing and never
    // retry, which is indistinguishable from the site not supporting WebMCP.
    (async () => {
      const available = await waitForApi({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!available) { onRegistered?.([], false); return; }
      const names = await registerTools(defs, controller);
      if (!controller.signal.aborted) onRegistered?.(names, true);
    })();

    return () => controller.abort();
  }, [defs, onRegistered]);
}
