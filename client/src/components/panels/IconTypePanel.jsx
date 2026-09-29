import { useState } from 'react';
import { KINDS, KIND_ORDER, PRECISION } from '../../lib/constants';

/**
 * The icon-type component.
 *
 * One button on the left rail ("Hardware types"). Clicking it opens the icon grid:
 * every hardware type with its icon, its colour, how many are in the dataset, and a
 * filter action — clicking a type narrows both the scene and the list to that icon.
 * The panel also carries the display toggles and the map key, so nothing is hidden in
 * a corner of the screen.
 */
export function IconTypePanel({
  kinds = [],
  kindFilter,
  setKindFilter,
  workingOnly,
  setWorkingOnly,
  showDwarfs,
  setShowDwarfs,
  counts,
  defaultOpen = false,
  onNavigate,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const countFor = (value) => {
    const facet = kinds.find((k) => k.value === value);
    return facet ? facet.count : 0;
  };

  const total = kinds.reduce((sum, k) => sum + k.count, 0);
  const active = kindFilter ? KINDS[kindFilter] : null;

  return (
    <section className={`icon-panel${open ? ' icon-panel--open' : ''}`} aria-label="Hardware icon types">
      <button
        type="button"
        className="icon-panel__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="icon-type-grid"
      >
        <span className="icon-panel__grid" aria-hidden="true">
          {KIND_ORDER.slice(0, 9).map((kind) => (
            <i key={kind} style={{ background: KINDS[kind].color }} />
          ))}
        </span>
        <span className="icon-panel__title">
          <strong>Hardware types</strong>
          <span className="small muted">
            {active ? `${active.icon} ${active.label} only` : `All ${total} objects`}
          </span>
        </span>
        <span className="icon-panel__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div className="icon-panel__body" id="icon-type-grid">
          <button
            type="button"
            className={`icon-tile icon-tile--all${!kindFilter ? ' icon-tile--on' : ''}`}
            onClick={() => setKindFilter(null)}
            aria-pressed={!kindFilter}
          >
            <span className="icon-tile__icon" aria-hidden="true">＊</span>
            <span className="icon-tile__label">All</span>
            <span className="icon-tile__count">{total}</span>
          </button>

          {KIND_ORDER.map((kind) => {
            const meta = KINDS[kind];
            const count = countFor(kind);
            return (
              <button
                key={kind}
                type="button"
                className={`icon-tile${kindFilter === kind ? ' icon-tile--on' : ''}${count === 0 ? ' icon-tile--empty' : ''}`}
                style={{ '--tile': meta.color }}
                onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
                aria-pressed={kindFilter === kind}
                title={count === 0 ? `No ${meta.label} in the dataset` : `${count} ${meta.label} — click to show only these`}
              >
                <span className="icon-tile__icon" aria-hidden="true">{meta.icon}</span>
                <span className="icon-tile__label">{meta.label}</span>
                <span className="icon-tile__count">{count}</span>
              </button>
            );
          })}

          <div className="icon-panel__toggles">
            <button
              type="button"
              className={`switch${workingOnly ? ' switch--on' : ''}`}
              onClick={() => setWorkingOnly(!workingOnly)}
              aria-pressed={workingOnly}
            >
              <span className="switch__track" aria-hidden="true">
                <span className="switch__thumb" />
              </span>
              Working only
            </button>
            <button
              type="button"
              className={`switch${showDwarfs ? ' switch--on' : ''}`}
              onClick={() => setShowDwarfs(!showDwarfs)}
              aria-pressed={showDwarfs}
            >
              <span className="switch__track" aria-hidden="true">
                <span className="switch__thumb" />
              </span>
              Dwarf planets
            </button>
          </div>

          <div className="icon-panel__key">
            <span className="eyebrow">Map key</span>
            <span className="key-row">
              <span className="key-ring" aria-hidden="true" /> still working
            </span>
            <span className="key-row">
              <span className="key-disc" aria-hidden="true" /> mission ended
            </span>
            <span className="key-row">
              <span className="key-symbol" aria-hidden="true">◎</span> measured position
            </span>
            <span className="key-row">
              <span className="key-symbol" aria-hidden="true">◍</span> approximate
            </span>
            <span className="key-row">
              <span className="key-symbol" aria-hidden="true">≈</span> position not published
            </span>
          </div>

          {onNavigate ? (
            <div className="icon-panel__actions">
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('missions')}>
                Browse all missions
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export { PRECISION };
