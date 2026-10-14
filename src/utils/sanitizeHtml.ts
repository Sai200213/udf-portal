/**
 * A robust, dependency-free HTML sanitizer to prevent XSS attacks in blog posts.
 * Uses the browser DOMParser to construct a true AST in memory and whitelist valid tags and attributes.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr',
  'a', 'img', 'figure', 'figcaption', 'span', 'div',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'iframe' // conditionally allowed below for safe video embeds
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'style', 'id', 'target', 'rel',
  'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'colspan', 'rowspan'
]);

const SAFE_URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

const SAFE_IFRAME_SRC = /^https:\/\/(www\.)?(youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/i;

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  if (typeof DOMParser === 'undefined') {
    // Fallback for non-DOM / Node environment
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/\bon[a-z]+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
               .replace(/\bhref\s*=\s*(['"]\s*javascript:[^'"]*['"]|javascript:[^\s>]+)/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const cleanNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // If tag is not in whitelist, remove it completely
      if (!ALLOWED_TAGS.has(tagName)) {
        el.remove();
        return;
      }

      // Special validation for iframe: must strictly match YouTube / Vimeo embed patterns
      if (tagName === 'iframe') {
        const src = el.getAttribute('src') || '';
        if (!SAFE_IFRAME_SRC.test(src.trim())) {
          el.remove();
          return;
        }
      }

      // Clean attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();

        // Strip any event handler attribute (e.g., onload, onclick, onerror)
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }

        // Only allow whitelisted attributes
        if (!ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name);
          continue;
        }

        // Validate URLs in href or src attributes
        if (name === 'href' || name === 'src') {
          if (!SAFE_URL_PATTERN.test(value) && !value.startsWith('./') && !value.startsWith('../')) {
            el.removeAttribute(attr.name);
            continue;
          }
        }

        // Security hardening for external links
        if (name === 'href' && el.getAttribute('target') === '_blank') {
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }

    // Recursively clean children
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      cleanNode(child);
      child = next;
    }
  };

  Array.from(doc.body.childNodes).forEach(node => cleanNode(node));

  return doc.body.innerHTML;
};
