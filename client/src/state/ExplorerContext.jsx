import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * All explorer state: which layer is on screen, which object is selected, and the
 * filters. The selection is also what the chat guide receives as context.
 */
const ExplorerContext = createContext(null);

export function ExplorerProvider({ children }) {
  const [view, setView] = useState({ mode: 'system', bodyId: null });
  const [selected, setSelected] = useState(null); // { kind, id, name, data }
  const [kindFilter, setKindFilter] = useState(null);
  const [workingOnly, setWorkingOnly] = useState(false);
  const [showDwarfs, setShowDwarfs] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeed, setChatSeed] = useState('');

  const focusBody = useCallback((body) => {
    setView({ mode: 'body', bodyId: body.id });
    setSelected({ kind: 'body', id: body.id, name: body.name, data: body });
  }, []);

  const backToSystem = useCallback(() => {
    setView({ mode: 'system', bodyId: null });
    setSelected(null);
  }, []);

  const selectObject = useCallback((object) => {
    setSelected(object);
  }, []);

  const askAbout = useCallback((object, question = '') => {
    setSelected(object);
    setChatOpen(true);
    setChatSeed(question);
  }, []);

  const value = useMemo(
    () => ({
      view,
      selected,
      kindFilter,
      workingOnly,
      showDwarfs,
      chatOpen,
      chatSeed,
      focusBody,
      backToSystem,
      selectObject,
      setKindFilter,
      setWorkingOnly,
      setShowDwarfs,
      setChatOpen,
      askAbout,
      clearSeed: () => setChatSeed(''),
    }),
    [view, selected, kindFilter, workingOnly, showDwarfs, chatOpen, chatSeed, focusBody, backToSystem, selectObject, askAbout]
  );

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorer must be used inside <ExplorerProvider>');
  return ctx;
}
