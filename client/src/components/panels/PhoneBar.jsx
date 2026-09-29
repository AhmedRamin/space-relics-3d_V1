/** One-thumb control bar for phones: panels, the guide, and going back a layer. */
export function PhoneBar({ view, onToggleSidebar, sidebarOpen, onOpenChat, chatOpen, onBack }) {
  return (
    <nav className="phone-bar" aria-label="Controls">
      <button
        type="button"
        className={`phone-bar__item${sidebarOpen ? ' phone-bar__item--on' : ''}`}
        onClick={onToggleSidebar}
        aria-expanded={sidebarOpen}
      >
        <span aria-hidden="true">☰</span>
        Panels
      </button>
      <button
        type="button"
        className={`phone-bar__item${chatOpen ? ' phone-bar__item--on' : ''}`}
        onClick={onOpenChat}
      >
        <span aria-hidden="true">🤖</span>
        Guide
      </button>
      <button type="button" className="phone-bar__item" onClick={onBack} disabled={view.mode === 'system'}>
        <span aria-hidden="true">↩</span>
        System
      </button>
    </nav>
  );
}
