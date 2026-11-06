import { createElement, Fragment, type ReactNode } from 'react';
import { Lexer, type Token, type Tokens } from 'marked';
const decode = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, key: string) => {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };
    if (!key.startsWith('#')) return named[key.toLowerCase()] || match;
    const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '\ufffd';
  });
function safeURL(value: string) {
  try {
    const u = new URL(decode(value));
    return ['https:', 'http:', 'mailto:'].includes(u.protocol) && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function Markdown({ text }: { text: string }) {
  const tokens = Lexer.lex(String(text), { gfm: true });
  const headings = tokens
    .filter((t): t is Tokens.Heading => t.type === 'heading')
    .map((t) => t.depth);
  const base = headings.length ? Math.min(...headings) : 1;
  function render(list: Token[], depth = 0): ReactNode {
    if (depth > 40) return list.map((t) => t.raw || '').join('');
    return list.map((token, i) => {
      const child = (t: Token) =>
        'tokens' in t && Array.isArray(t.tokens)
          ? render(t.tokens as Token[], depth + 1)
          : 'text' in t
            ? decode(String(t.text))
            : '';
      let result: ReactNode;
      switch (token.type) {
        case 'space':
          return null;
        case 'heading':
          result = createElement(
            'h' + Math.min(6, 3 + (token as Tokens.Heading).depth - base),
            {},
            child(token),
          );
          break;
        case 'paragraph':
        case 'strong':
        case 'em':
        case 'del':
        case 'blockquote':
          result = createElement(token.type === 'paragraph' ? 'p' : token.type, {}, child(token));
          break;
        case 'codespan':
          result = <code>{decode(token.text)}</code>;
          break;
        case 'code':
          result = (
            <pre>
              <code>{token.text}</code>
            </pre>
          );
          break;
        case 'hr':
          result = <hr />;
          break;
        case 'br':
          result = <br />;
          break;
        case 'link': {
          const href = safeURL(token.href);
          result = href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {child(token)}
            </a>
          ) : (
            <span>{child(token)}</span>
          );
          break;
        }
        case 'list': {
          const list = token as Tokens.List;
          result = createElement(
            list.ordered ? 'ol' : 'ul',
            list.ordered && list.start !== 1 ? { start: list.start } : {},
            list.items.map((item, index) => (
              <li key={index}>
                {item.task ? (item.checked ? '☑ ' : '☐ ') : null}
                {render(item.tokens, depth + 1)}
              </li>
            )),
          );
          break;
        }
        case 'table': {
          const table = token as Tokens.Table;
          result = (
            <div className="jd-table">
              <table>
                <thead>
                  <tr>
                    {table.header.map((cell, index) => (
                      <th key={index}>{render(cell.tokens, depth + 1)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((cells, index) => (
                    <tr key={index}>
                      {cells.map((cell, j) => (
                        <td key={j}>{render(cell.tokens, depth + 1)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          break;
        }
        case 'image':
          result = token.text || '';
          break;
        case 'html':
          result = token.block
            ? (token.raw || token.text)
                .trim()
                .split(/\r?\n/)
                .map((line: string, index: number) => <p key={index}>{line}</p>)
            : token.raw || token.text;
          break;
        default:
          result = child(token) || decode(token.raw || '');
      }
      return <Fragment key={i}>{result}</Fragment>;
    });
  }
  return <div className="jd">{render(tokens)}</div>;
}
