/**
 * The consent gate.
 *
 * Deliberately NOT built on requestUserInteraction(): that method appears in
 * third-party cheat sheets but not in Chrome's shipped imperative API. It isn't
 * needed — execute() is async, so the agent waits as long as the human does.
 * Owning the dialog also means we control exactly what it shows, which is the
 * whole product.
 *
 * requestConsent() resolves to { approved, scope }:
 *   approved  the subset of items the reviewer released (empty array = denied)
 *   scope     'once'    release for this request only
 *             'session' remember, so the same passage isn't re-asked while this
 *                       manuscript stays open
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const GateContext = createContext(null);

export function ConsentGateProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const requestConsent = useCallback(
    (req) => new Promise((resolve) => {
      resolver.current = resolve;
      setRequest(req);
    }),
    [],
  );

  const settle = useCallback((approved, scope = 'once') => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.({ approved, scope });
  }, []);

  return (
    <GateContext.Provider value={{ requestConsent, request, settle }}>
      {children}
    </GateContext.Provider>
  );
}

export const useConsentGate = () => {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error('useConsentGate must be used inside <ConsentGateProvider>');
  return ctx;
};
