/**
 * Minimal document.modelContext for local development ONLY.
 *
 * Lets you build and test the whole app — including the consent gate and the
 * disclosure log — without Chrome 149 and without the flag. It implements just
 * enough of the surface that lib/modelContext.js talks to: registerTool with an
 * AbortSignal, getTools, executeTool.
 *
 * It does NOT make tools visible to a real agent. Imported only when
 * import.meta.env.DEV is true, so it never reaches your deployed build.
 */
function installDevPolyfill() {
  if (document.modelContext || navigator.modelContext) return false;

  const tools = new Map();
  const target = new EventTarget();

  document.modelContext = {
    __polyfill: true,

    async registerTool(def, options) {
      if (tools.has(def.name)) throw new DOMException(`duplicate tool ${def.name}`, 'InvalidStateError');
      tools.set(def.name, def);
      options?.signal?.addEventListener('abort', () => {
        tools.delete(def.name);
        target.dispatchEvent(new Event('toolchange'));
      });
      target.dispatchEvent(new Event('toolchange'));
    },

    unregisterTool(name) {
      tools.delete(name);
      target.dispatchEvent(new Event('toolchange'));
    },

    async getTools() {
      return [...tools.values()].map(({ name, description, inputSchema }) =>
        ({ name, description, inputSchema }));
    },

    async executeTool(tool, jsonString) {
      const name = typeof tool === 'string' ? tool : tool?.name;
      const def = tools.get(name);
      if (!def) throw new Error(`no such tool: ${name}`);
      const args = jsonString ? JSON.parse(jsonString) : {};
      return def.execute(args, { signal: new AbortController().signal });
    },

    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };

  console.info('[reviewgate] dev polyfill installed — not a real agent surface');
  return true;
}


// Self-installs on import, before any module reads the global.
if (import.meta.env.DEV) {
  // Never let a dev-only convenience white-screen the app.
  try { installDevPolyfill(); } catch (err) {
    console.warn('[reviewgate] dev polyfill could not install:', err);
  }
}
