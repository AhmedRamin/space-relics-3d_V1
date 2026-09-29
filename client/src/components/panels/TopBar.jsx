import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { formatNumber } from '../../lib/scale';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/** Header: brand, search, dataset totals, guide and the panel button on small screens. */
export function TopBar({
  counts,
  view,
  onBack,
  onJumpTo,
  chatOpen,
  setChatOpen,
  onToggleSidebar,
  sidebarOpen,
}) {
  const isPhone = useMediaQuery('(max-width: 700px)');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(query.trim(), { signal: controller.signal });
        setResults(res.data || []);
        setOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClick(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const showSearchField = !isPhone || searchOpen;

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn topbar__menu"
        onClick={onToggleSidebar}
        aria-label="Open bodies and hardware types"
        aria-expanded={sidebarOpen}
      >
        ☰
      </button>

      <button type="button" className="brand" onClick={onBack} title="Back to the Solar System">
        <img className="brand__logo" src="/logo.png" alt="" width="36" height="36" />
        <span className="brand__text">
          Space Relics
          <small>Solar System Explorer</small>
        </span>
      </button>

      {view.mode === 'body' && !isPhone ? (
        <button type="button" className="btn btn--sm btn--ghost" onClick={onBack}>
          ← Solar System
        </button>
      ) : null}

      {showSearchField ? (
        <div className="searchbox" ref={boxRef}>
          <span className="searchbox__icon" aria-hidden="true">🔍</span>
          <label className="visually-hidden" htmlFor="search">
            Search the dataset
          </label>
          <input
            id="search"
            type="search"
            value={query}
            autoFocus={isPhone && searchOpen}
            placeholder="Search a mission, station, rocket, moon or body…"
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => results.length && setOpen(true)}
          />
          {isPhone ? (
            <button
              type="button"
              className="searchbox__close"
              onClick={() => {
                setSearchOpen(false);
                setQuery('');
                setOpen(false);
              }}
              aria-label="Close search"
            >
              ✕
            </button>
          ) : null}

          {open && results.length ? (
            <div className="search-results">
              {results.map((hit) => (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  type="button"
                  className="search-hit"
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    setSearchOpen(false);
                    onJumpTo(hit);
                  }}
                >
                  <span className="search-hit__name">
                    {hit.name}
                    <small>{hit.kind === 'body' ? hit.subtitle : `${hit.kind} · ${hit.subtitle || ''}`}</small>
                  </span>
                  {hit.status ? <span className="tag">{hit.status}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button type="button" className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
          🔍
        </button>
      )}

      {!isPhone && counts ? (
        <div className="topbar__meta">
          <span><b>{formatNumber(counts.missions)}</b> missions</span>
          <span><b>{formatNumber(counts.stations)}</b> stations</span>
          <span><b>{formatNumber(counts.rockets)}</b> rockets</span>
          <span><b>{formatNumber(counts.bodies)}</b> bodies</span>
          <span><b>{formatNumber(counts.moons)}</b> moons</span>
        </div>
      ) : (
        <div className="topbar__spacer" />
      )}

      <button
        type="button"
        className={`btn btn--sm ${chatOpen ? 'btn--primary' : 'btn--primary'} topbar__ai`}
        onClick={() => setChatOpen(!chatOpen)}
      >
        <span aria-hidden="true">🤖</span>
        <span className="topbar__ai-label">AI Guide</span>
      </button>
    </header>
  );
}
