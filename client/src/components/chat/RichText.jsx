import { Fragment } from 'react';

/**
 * Minimal renderer for the guide's replies.
 *
 * The answers contain markdown-ish text (bold, bullets, numbered lists, links) and can include
 * text pulled from Wikipedia, so this parses into React elements rather than injecting HTML —
 * nothing from the web can become markup.
 */

function inline(text, keyPrefix) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <a key={`${keyPrefix}-a${i}`} href={token} target="_blank" rel="noreferrer noopener">
          {token.replace(/^https?:\/\//, '').slice(0, 42)}
        </a>
      );
    }
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function RichText({ text }) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let list = null;

  const flush = () => {
    if (!list) return;
    const isOrdered = list.ordered;
    blocks.push(
      isOrdered ? (
        <ol key={`l${blocks.length}`} className="rich__list">
          {list.items.map((item, i) => (
            <li key={i}>{inline(item, `o${blocks.length}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l${blocks.length}`} className="rich__list">
          {list.items.map((item, i) => (
            <li key={i}>{inline(item, `u${blocks.length}-${i}`)}</li>
          ))}
        </ul>
      )
    );
    list = null;
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet) {
      if (!list || list.ordered) flush();
      list = list || { ordered: false, items: [] };
      list.items.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (!list || !list.ordered) flush();
      list = list || { ordered: true, items: [] };
      list.items.push(numbered[1]);
      return;
    }
    flush();
    if (!line.trim()) {
      blocks.push(<span key={`s${index}`} className="rich__gap" />);
      return;
    }
    blocks.push(
      <p key={`p${index}`} className="rich__p">
        {inline(line, `p${index}`)}
      </p>
    );
  });
  flush();

  return <div className="rich">{blocks.map((block, i) => <Fragment key={i}>{block}</Fragment>)}</div>;
}
