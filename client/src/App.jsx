import { useCallback, useEffect, useMemo, useState } from 'react';
import { SceneHost } from './components/three/SceneHost';
import { SolarSystemScene } from './components/scene/SolarSystemScene';
import { BodyScene } from './components/scene/BodyScene';
import { TopBar } from './components/panels/TopBar';
import { Sidebar } from './components/panels/Sidebar';
import { InfoPanel } from './components/panels/InfoPanel';
import { WelcomeOverlay } from './components/panels/WelcomeOverlay';
import { PhoneBar } from './components/panels/PhoneBar';
import { ChatDock } from './components/chat/ChatDock';
import { ExplorerProvider, useExplorer } from './state/ExplorerContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useAsync } from './hooks/useAsync';
import { useBreakpoints } from './hooks/useMediaQuery';
import { api } from './services/api';

/** The explorer: one canvas, two 3D layers, a left rail and the guide. */
export function Explorer() {
  const {
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
    clearSeed,
  } = useExplorer();

  const { isPhone, isTablet } = useBreakpoints();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renderAll, setRenderAll] = useState(false);

  const catalog = useAsync(() => api.catalog(), []);
  const bodyData = useAsync(
    () => (view.mode === 'body' ? api.body(view.bodyId) : Promise.resolve(null)),
    [view.mode, view.bodyId]
  );

  const bodies = (catalog.data && catalog.data.data.bodies) || [];
  const counts = catalog.data && catalog.data.data.counts;
  const facets = catalog.data && catalog.data.data.facets;

  const bodyNames = useMemo(
    () => bodies.reduce((acc, body) => ({ ...acc, [body.id]: body.name }), {}),
    [bodies]
  );

  const bodyImages = useMemo(
    () => bodies.reduce((acc, body) => (body.imageUrl ? { ...acc, [body.id]: body.imageUrl } : acc), {}),
    [bodies]
  );

  const current = view.mode === 'body' ? bodyData.data && bodyData.data.data.body : null;
  const hardware = (bodyData.data && bodyData.data.data.hardware) || [];
  const moons = (bodyData.data && bodyData.data.data.moons) || [];

  // The rail becomes a drawer below the tablet breakpoint.
  useEffect(() => {
    if (!isTablet) setSidebarOpen(true);
    else setSidebarOpen(false);
  }, [isTablet]);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        if (chatOpen) setChatOpen(false);
        else if (isTablet && sidebarOpen) setSidebarOpen(false);
        else if (view.mode === 'body') backToSystem();
      }
      if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key.toLowerCase() === 'f') setWorkingOnly(!workingOnly);
      if (event.key.toLowerCase() === 'd') setShowDwarfs(!showDwarfs);
      if (event.key.toLowerCase() === 'm') setSidebarOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.mode, chatOpen, workingOnly, showDwarfs, isTablet, sidebarOpen, backToSystem, setChatOpen, setWorkingOnly, setShowDwarfs]);

  const openBody = useCallback(
    (body) => {
      setRenderAll(false);
      focusBody(body);
      if (isTablet) setSidebarOpen(false);
    },
    [focusBody, isTablet]
  );

  const selectHardware = useCallback(
    (item) => {
      selectObject({ kind: item.kind || 'mission', id: item.id, name: item.name, data: item });
      if (isPhone) setSidebarOpen(false);
    },
    [selectObject, isPhone]
  );

  /**
   * The welcome overlay's cards drive the first action.
   *
   * This must stay below `bodies` and `openBody`: a dependency array is evaluated during
   * render, so listing a `const` declared later in the same body throws "Cannot access
   * 'bodies' before initialization" and takes the whole scene down.
   */
  const welcomeChoose = useCallback(
    (choice) => {
      if (choice === 'guide') setChatOpen(true);
      else if (choice === 'hardware') {
        const mars = bodies.find((b) => b.id === 'mars');
        if (mars) openBody(mars);
      }
    },
    [bodies, openBody, setChatOpen]
  );

  const chatContext = useMemo(() => (selected ? { kind: selected.kind, id: selected.id, name: selected.name } : null), [selected]);

  /** Jump from a search hit or a chat reference straight to the object. */
  const jumpTo = useCallback(
    async (ref) => {
      if (ref.kind === 'body') {
        const body = bodies.find((b) => b.id === ref.id);
        if (body) openBody(body);
        return;
      }
      try {
        if (ref.kind === 'mission') {
          const res = await api.mission(ref.id);
          const mission = res.data.mission;
          const body = bodies.find((b) => b.id === mission.bodyId) || bodies.find((b) => b.id === ref.bodyId);
          if (body && view.bodyId !== body.id) openBody(body);
          selectObject({ kind: 'mission', id: mission.id, name: mission.name, data: mission });
        } else if (ref.kind === 'station') {
          const res = await api.stations();
          const station = (res.data || []).find((s) => s.id === ref.id);
          const earth = bodies.find((b) => b.id === 'earth');
          if (earth && view.bodyId !== 'earth') openBody(earth);
          if (station) selectObject({ kind: 'station', id: station.id, name: station.name, data: station });
        } else if (ref.kind === 'rocket') {
          const res = await api.rockets();
          const rocket = (res.data || []).find((r) => r.id === ref.id);
          if (rocket) selectObject({ kind: 'rocket', id: rocket.id, name: rocket.name, data: rocket });
        } else if (ref.kind === 'moon') {
          setChatOpen(true);
          askAbout({ kind: 'moon', id: ref.id, name: ref.name }, `Tell me about ${ref.name}`);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[jump] failed', err.message);
      }
    },
    [bodies, openBody, selectObject, view.bodyId, askAbout, setChatOpen]
  );

  if (catalog.error) {
    return (
      <div className="state" style={{ height: '100vh' }}>
        <img src="/logo.png" alt="" width="72" height="72" style={{ borderRadius: '50%' }} />
        <h2>The dataset could not be loaded</h2>
        <div className="error-box">{catalog.error.message}</div>
        <button type="button" className="btn btn--primary" onClick={catalog.reload}>
          Try again
        </button>
        <p className="small muted">
          Start the API with <span className="mono">npm run dev</span> inside <span className="mono">server/</span>, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className={`app${sidebarOpen ? ' app--rail-open' : ''}${chatOpen ? ' app--chat-open' : ''}`}>
      <TopBar
        counts={counts}
        view={view}
        onBack={backToSystem}
        onJumpTo={jumpTo}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <main className="stage">
        <div className="canvas-layer">
          {!bodies.length ? (
            <div className="state" style={{ height: '100%' }}>
              <div className="spinner" />
              <p className="small">Reading the dataset…</p>
            </div>
          ) : view.mode === 'system' ? (
            <SceneHost camera={{ position: [0, 76, 146], fov: 46, near: 0.05, far: 4000 }}>
              <SolarSystemScene
                bodies={bodies}
                onFocusBody={openBody}
                selectedBodyId={selected && selected.kind === 'body' ? selected.id : null}
                showDwarfs={showDwarfs}
              />
            </SceneHost>
          ) : bodyData.loading && !current ? (
            <div className="state" style={{ height: '100%' }}>
              <div className="spinner" />
              <p className="small">Building the surface at this body…</p>
            </div>
          ) : current ? (
            <SceneHost camera={{ position: [0, 6, 22], fov: 45, near: 0.02, far: 2000 }}>
              <BodyScene
                body={current}
                hardware={hardware}
                moons={moons}
                selectedId={selected ? selected.id : null}
                onSelect={selectHardware}
                kindFilter={kindFilter}
                workingOnly={workingOnly}
                renderAll={renderAll}
                onClearSelection={() => selectObject(null)}
              />
            </SceneHost>
          ) : null}
        </div>

        {isTablet && sidebarOpen ? (
          <button type="button" className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close panels" />
        ) : null}

        <Sidebar
          view={view}
          bodies={bodies}
          current={current}
          hardware={hardware}
          selectedId={selected ? selected.id : null}
          onFocusBody={openBody}
          onSelect={selectHardware}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          workingOnly={workingOnly}
          setWorkingOnly={setWorkingOnly}
          showDwarfs={showDwarfs}
          setShowDwarfs={setShowDwarfs}
          facets={facets}
          renderAll={renderAll}
          setRenderAll={setRenderAll}
          isPhone={isPhone}
          onClose={() => setSidebarOpen(false)}
        />

        <InfoPanel
          selected={selected}
          bodyNames={bodyNames}
          bodyImages={bodyImages}
          isPhone={isPhone}
          onClose={() => selectObject(null)}
          onFocusBody={openBody}
          onAsk={askAbout}
        />

        {!chatOpen && !selected ? (
          <button type="button" className="fab" onClick={() => setChatOpen(true)} aria-label="Open the AI guide">
            <span aria-hidden="true">🤖</span>
            <span className="fab__label">Ask the guide</span>
          </button>
        ) : null}

        {!selected && !chatOpen && !isPhone ? (
          <p className="hint">Drag to orbit · Scroll to zoom · Click any vehicle to fly to it · Esc goes back</p>
        ) : null}

        {isPhone ? (
          <PhoneBar
            view={view}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            chatOpen={chatOpen}
            onOpenChat={() => setChatOpen(!chatOpen)}
            onBack={backToSystem}
          />
        ) : null}
      </main>

      <WelcomeOverlay counts={counts} onChoose={welcomeChoose} />

      {chatOpen ? (
        <ChatDock
          context={chatContext}
          seed={chatSeed}
          onConsumeSeed={clearSeed}
          onSelectRef={jumpTo}
          isFullScreen={isPhone}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ExplorerProvider>
        <Explorer />
      </ExplorerProvider>
    </ErrorBoundary>
  );
}
