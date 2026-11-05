import { htmlToMarkdown } from '../jd-content.mjs';

export const wwrCategories = ['front-end-programming', 'full-stack-programming', 'product'];
export function wwrFeedURL(category) {
  if (!wwrCategories.includes(category)) throw Error('Unsupported WWR category');
  return `https://weworkremotely.com/categories/remote-${category}-jobs.rss`;
}
// This bounded reader supports WWR's RSS 2.0 fields, not arbitrary XML documents.
// It never loads DTDs, expands custom entities, fetches links or executes markup.
function decode(value) {
  return value.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[\da-f]+);/gi, (match, entity) => {
    const named = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
    if (named[entity]) return named[entity];
    if (!entity.startsWith('#')) return match;
    const n =
      entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  });
}
function field(item, tag) {
  const value =
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item)?.[1]?.trim() || '';
  if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) return value.slice(9, -3).trim();
  return decode(value);
}
export function parseWwrRSS(xml) {
  if (
    typeof xml !== 'string' ||
    xml.length > 8_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    !/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>[\s\S]*<\/channel>\s*<\/rss>\s*$/i.test(xml)
  )
    throw Error('Unexpected WWR RSS');
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  if ((xml.match(/<item(?:\s[^>]*)?>/gi) || []).length !== items.length)
    throw Error('Incomplete RSS item');
  return items.slice(0, 100).map(([, item]) => {
    const title = field(item, 'title'),
      separator = title.indexOf(': ');
    const link = field(item, 'link');
    let safeLink = null;
    try {
      const u = new URL(link);
      if (
        u.protocol === 'https:' &&
        u.hostname === 'weworkremotely.com' &&
        !u.username &&
        !u.password &&
        !u.port &&
        u.pathname.startsWith('/remote-jobs/')
      )
        safeLink = u.href;
    } catch {}
    const published = field(item, 'pubDate');
    const date = Date.parse(published);
    const description = htmlToMarkdown(field(item, 'description'));
    return {
      company: separator > 0 ? title.slice(0, separator) : 'Unknown company',
      title: separator > 0 ? title.slice(separator + 2) : title,
      url: safeLink,
      sourceURL: safeLink,
      description,
      descriptionKind: description ? 'excerpt' : 'summary',
      location: [field(item, 'region'), field(item, 'country'), field(item, 'state')]
        .filter(Boolean)
        .join(', '),
      remoteMode: 'remote',
      posting: {
        date: Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : null,
        kind: 'unknown',
        raw: `WWR RSS publication: ${published || 'not provided'}; not verified employer first posting`,
      },
    };
  });
}
