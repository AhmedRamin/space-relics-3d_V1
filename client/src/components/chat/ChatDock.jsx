import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { RichText } from './RichText';

const GREETING =
  'Ask me anything about the missions, stations, rockets, moons and planets in this dataset — or about space exploration in general. I answer from the local data file first, then fill gaps from the wider web, and I label which source each answer came from.';

const SOURCE_META = {
  dataset: { label: 'Your database', icon: '🗄️' },
  web: { label: 'Internet', icon: '🌐' },
  model: { label: 'Free AI model', icon: '🤖' },
  offline: { label: 'Data only', icon: '⚡' },
};

const STARTERS = [
  { icon: '🛰', text: 'Which rovers are still working on Mars?' },
  { icon: '🌐', text: 'What is a sky crane landing?' },
  { icon: '🚀', text: 'Tallest rocket in service' },
  { icon: '🌙', text: 'Moons of Saturn' },
];

function stamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="msg-action"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch (err) {
          /* clipboard can be blocked; the button simply does nothing */
        }
      }}
      title="Copy this answer"
    >
      {copied ? '✓ copied' : '⧉ copy'}
    </button>
  );
}

/** The guide. Answers carry source badges so a fact can always be traced. */
export function ChatDock({ context, seed, onConsumeSeed, onSelectRef, onClose, isFullScreen }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: GREETING, refs: [], citations: [], sources: [], at: stamp() },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState(STARTERS.map((s) => s.text));
  const [error, setError] = useState(null);
  const [engines, setEngines] = useState({ mode: 'dataset', web: false, model: 'none' });
  const [useWeb, setUseWeb] = useState(true);
  const [available, setAvailable] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .engines()
      .then((res) => !cancelled && setAvailable(res.data))
      .catch(() => !cancelled && setAvailable({ web: { available: false }, models: { any: false } }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(
    async (text, ctx = context) => {
      const question = String(text || '').trim();
      if (!question || busy) return;

      setError(null);
      setMessages((prev) => [...prev, { role: 'user', content: question, refs: [], citations: [], sources: [], at: stamp() }]);
      setInput('');
      setBusy(true);

      try {
        const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
        const res = await api.chat({ message: question, context: ctx, history, useWeb });
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.answer,
            refs: res.refs || [],
            citations: res.citations || [],
            sources: res.sources || [],
            note: res.notes || res.providerError || null,
            at: stamp(),
          },
        ]);
        setEngines({ mode: res.mode || 'dataset', web: Boolean(res.webUsed), model: res.modelUsed || 'none' });
        if (res.suggestions && res.suggestions.length) setSuggestions(res.suggestions);
      } catch (err) {
        setError(err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'I could not reach the API just now. Is the server running?', refs: [], citations: [], sources: [], at: stamp() },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, context, useWeb]
  );

  useEffect(() => {
    if (seed) {
      send(seed);
      if (onConsumeSeed) onConsumeSeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const clear = () => {
    setMessages([{ role: 'assistant', content: GREETING, refs: [], citations: [], sources: [], at: stamp() }]);
    setSuggestions(STARTERS.map((s) => s.text));
  };

  const showStarters = messages.length <= 1;

  return (
    <section className={`chat-dock${isFullScreen ? ' chat-dock--full' : ''}`} aria-label="AI mission guide">
      <header className="chat-dock__head">
        <img className="chat-dock__logo" src="/logo.png" alt="" width="34" height="34" />
        <div className="chat-dock__who">
          <strong>Mission Guide</strong>
          <span className="chat-dock__status">
            <span className={`dot${engines.mode.includes('dataset') ? ' dot--on' : ''}`} /> data
            {engines.web ? <><span className="dot dot--web" /> web</> : null}
            {engines.model !== 'none' ? <><span className="dot dot--model" /> model</> : null}
          </span>
        </div>
        <button
          type="button"
          className={`toggle-pill${useWeb ? ' toggle-pill--on' : ''}`}
          onClick={() => setUseWeb((v) => !v)}
          aria-pressed={useWeb}
          title={
            available && available.web && !available.web.available
              ? 'Internet lookup is switched off on the server (WEB_KNOWLEDGE=false)'
              : 'Also search the internet when the database cannot answer'
          }
          disabled={Boolean(available && available.web && !available.web.available)}
        >
          <span aria-hidden="true">🌐</span>
          <span className="toggle-pill__label">Internet</span>
          <span className="toggle-pill__state">{useWeb ? 'on' : 'off'}</span>
        </button>
        <button type="button" className="icon-btn" onClick={clear} title="Clear the conversation" aria-label="Clear conversation">
          ⟲
        </button>
        {onClose ? (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close the guide">
            ✕
          </button>
        ) : null}
      </header>

      <div className="chat-dock__log" ref={logRef} aria-live="polite">
        {messages.map((message, index) => (
          <article key={`${index}-${message.role}`} className={`bubble bubble--${message.role === 'user' ? 'user' : 'ai'}`}>
            {message.role === 'assistant' ? <img className="bubble__avatar" src="/logo.png" alt="" width="24" height="24" /> : null}
            <div className="bubble__body">
              <RichText text={message.content} />

              {message.sources && message.sources.length ? (
                <div className="bubble__sources">
                  {message.sources.map((source) => (
                    <span key={source.id} className={`src src--${source.id}`} title={source.detail || ''}>
                      <span aria-hidden="true">{(SOURCE_META[source.id] || {}).icon || '·'}</span>
                      {source.label || (SOURCE_META[source.id] || {}).label || source.id}
                    </span>
                  ))}
                </div>
              ) : null}

              {message.refs && message.refs.length ? (
                <div className="bubble__refs">
                  {message.refs.map((ref) => (
                    <button key={`${ref.kind}-${ref.id}`} type="button" className="chip" onClick={() => onSelectRef(ref)}>
                      {ref.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {message.citations && message.citations.length ? (
                <div className="bubble__links">
                  {message.citations.slice(0, 4).map((c) => (
                    <a key={c.url} href={c.url} target="_blank" rel="noreferrer noopener">
                      ↗ {c.label}
                    </a>
                  ))}
                </div>
              ) : null}

              {message.note ? <div className="small muted">{message.note}</div> : null}

              <div className="bubble__foot">
                <span className="bubble__time">{message.at}</span>
                {message.role === 'assistant' && index > 0 ? <CopyButton text={message.content} /> : null}
              </div>
            </div>
          </article>
        ))}

        {busy ? (
          <article className="bubble bubble--ai">
            <img className="bubble__avatar" src="/logo.png" alt="" width="24" height="24" />
            <div className="bubble__body">
              <span className="thinking">Checking the dataset{useWeb ? ' and the web' : ''}…</span>
              <span className="typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </span>
            </div>
          </article>
        ) : null}
      </div>

      {showStarters ? (
        <div className="chat-starters">
          {STARTERS.map((starter) => (
            <button key={starter.text} type="button" className="starter" onClick={() => send(starter.text)} disabled={busy}>
              <span aria-hidden="true">{starter.icon}</span>
              {starter.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="chat-dock__chips">
          {suggestions.slice(0, 3).map((s) => (
            <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error ? <div className="error-box">{error.message}</div> : null}

      <form
        className="chat-dock__form"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <label className="visually-hidden" htmlFor="chat-input">
          Ask the guide a question
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={context ? `Ask about ${context.name}…` : 'Ask about any mission, station or rocket…'}
          maxLength={1000}
        />
        <button type="submit" className="btn btn--primary send" disabled={busy || !input.trim()} aria-label="Send">
          ➤
        </button>
      </form>
    </section>
  );
}
