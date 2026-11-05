import { Lexer } from './vendor/marked.mjs';

// Render a token allowlist with DOM APIs, never HTML strings. External images and raw HTML stay inert.
export function renderMarkdown(text, doc = document) {
  const root = doc.createElement('div');
  root.className = 'jd';
  const tokens = Lexer.lex(String(text), { gfm: true });
  const headings = tokens.filter((t) => t.type === 'heading').map((t) => t.depth);
  const base = headings.length ? Math.min(...headings) : 1;
  const node = (tag, value) => {
    const n = doc.createElement(tag);
    if (value !== undefined) n.textContent = value;
    return n;
  };
  const decode = (value) =>
    String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, key) => {
      const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      if (!key.startsWith('#')) return named[key.toLowerCase()] || match;
      const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '\ufffd';
    });
  const safeUrl = (value) => {
    try {
      const url = new URL(decode(value));
      return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password
        ? url.href
        : null;
    } catch {
      return null;
    }
  };
  function append(parent, list, depth = 0) {
    if (depth > 40) {
      parent.append(doc.createTextNode(list.map((t) => t.raw || t.text || '').join('')));
      return;
    }
    for (const t of list || []) {
      let n;
      switch (t.type) {
        case 'space':
          continue;
        case 'heading':
          n = node('h' + Math.min(6, 3 + t.depth - base));
          break;
        case 'paragraph':
          n = node('p');
          break;
        case 'strong':
          n = node('strong');
          break;
        case 'em':
          n = node('em');
          break;
        case 'del':
          n = node('del');
          break;
        case 'blockquote':
          n = node('blockquote');
          break;
        case 'codespan':
          parent.append(node('code', decode(t.text)));
          continue;
        case 'code':
          n = node('pre');
          n.append(node('code', t.text));
          parent.append(n);
          continue;
        case 'hr':
          parent.append(node('hr'));
          continue;
        case 'br':
          parent.append(node('br'));
          continue;
        case 'link': {
          const href = safeUrl(t.href);
          n = node(href ? 'a' : 'span');
          if (href) {
            n.href = href;
            n.target = '_blank';
            n.rel = 'noopener noreferrer';
          }
          break;
        }
        case 'list': {
          n = node(t.ordered ? 'ol' : 'ul');
          if (t.ordered && t.start !== 1) n.setAttribute('start', String(t.start));
          for (const item of t.items) {
            const li = node('li');
            if (item.task) li.append(doc.createTextNode(item.checked ? '☑ ' : '☐ '));
            append(li, item.tokens, depth + 1);
            n.append(li);
          }
          parent.append(n);
          continue;
        }
        case 'table': {
          const wrap = node('div');
          wrap.className = 'jd-table';
          n = node('table');
          const head = node('thead'),
            row = node('tr');
          for (const cell of t.header) {
            const th = node('th');
            append(th, cell.tokens, depth + 1);
            row.append(th);
          }
          head.append(row);
          n.append(head);
          const body = node('tbody');
          for (const cells of t.rows) {
            const tr = node('tr');
            for (const cell of cells) {
              const td = node('td');
              append(td, cell.tokens, depth + 1);
              tr.append(td);
            }
            body.append(tr);
          }
          n.append(body);
          wrap.append(n);
          parent.append(wrap);
          continue;
        }
        case 'image':
          parent.append(doc.createTextNode(t.text || ''));
          continue;
        case 'html':
          if (t.block) {
            for (const line of (t.raw || t.text).trim().split(/\r?\n/))
              parent.append(node('p', line));
          } else parent.append(doc.createTextNode(t.raw || t.text));
          continue;
        default:
          if (t.tokens) append(parent, t.tokens, depth + 1);
          else parent.append(doc.createTextNode(decode(t.text ?? t.raw ?? '')));
          continue;
      }
      append(n, t.tokens || [{ type: 'text', text: t.text || '' }], depth + 1);
      parent.append(n);
    }
  }
  append(root, tokens);
  return root;
}
