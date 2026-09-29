import { useEffect, useState } from 'react';

const KEY = 'space-relics-welcome-v2';

const CARDS = [
  { id: 'system', icon: '🪐', title: 'Explore the Solar System', body: 'Fly from the Sun to Sedna. Every planet carries its real hardware.' },
  { id: 'hardware', icon: '🛰', title: 'Open a mission', body: 'Click any rover, satellite or station to read its record and see its photograph.' },
  { id: 'guide', icon: '🤖', title: 'Ask the guide', body: 'Answers come from your dataset first, then the web — labelled every time.' },
];

/** First-run overlay: three ways in, dismissible, remembered in localStorage. */
export function WelcomeOverlay({ counts, onChoose }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setOpen(true);
    } catch (err) {
      setOpen(true);
    }
  }, []);

  const close = (choice) => {
    try {
      window.localStorage.setItem(KEY, 'seen');
    } catch (err) {
      /* storage can be unavailable in private mode */
    }
    setOpen(false);
    if (choice && onChoose) onChoose(choice);
  };

  if (!open) return null;

  return (
    <div className="welcome" role="dialog" aria-label="Welcome to Space Relics">
      <div className="welcome__card">
        <img className="welcome__logo" src="/logo.png" alt="" width="84" height="84" />
        <h1>Space Relics 3D</h1>
        <p className="welcome__lead">
          A digital museum of exploration you can fly through — {counts ? counts.missions : 211} missions,{' '}
          {counts ? counts.stations : 19} space stations and {counts ? counts.moons : 460} moons, placed at their real
          positions.
        </p>

        <div className="welcome__grid">
          {CARDS.map((card) => (
            <button key={card.id} type="button" className="welcome__card-item" onClick={() => close(card.id)}>
              <span className="welcome__icon" aria-hidden="true">{card.icon}</span>
              <strong>{card.title}</strong>
              <span className="small muted">{card.body}</span>
            </button>
          ))}
        </div>

        <div className="welcome__foot">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => close(null)}>
            Just explore
          </button>
          <span className="small muted">
            Drag to orbit · click a body to descend · press <span className="mono">?</span> for shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}
