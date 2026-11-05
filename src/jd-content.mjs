import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let converter;

// Convert only the chosen JD fragment. Selection of the correct role is a separate verification step.
export function htmlToMarkdown(value) {
  const text = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(text)) return text.trim();
  // Offline onboarding and CLI help do not need provider dependencies.
  if (!converter) {
    const TurndownService = require('turndown');
    converter = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });
    converter.remove([
      'script',
      'style',
      'nav',
      'footer',
      'form',
      'button',
      'iframe',
      'noscript',
      'svg',
      'img',
    ]);
  }
  return converter.turndown(text).trim();
}
