/**
 * Generated storefront HTML is untrusted (AGENTS.md §9). This module strips the
 * dangerous bits server-side before the HTML ever reaches the browser, and
 * builds the sandboxed preview document the iframe renders.
 *
 * Isomorphic on purpose: `sanitizeGeneratedHtml` runs in the route handler and
 * `buildPreviewShell` runs in the client, but neither imports server-only code.
 */

/** Remove scripts, event handlers, and unsafe URLs from model-generated HTML. */
export function sanitizeGeneratedHtml(raw: string): string {
  let html = raw;

  // Strip any accidental markdown code fences.
  html = html.replace(/```html\s*/gi, '').replace(/```\s*$/g, '');

  // Remove <script>...</script> blocks and lone <script> tags.
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script\b[^>]*>/gi, '');

  // Remove inline event handlers: on*="..." / on*='...' / on*=value.
  html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

  // Neutralise javascript: and data:text/html URLs in href/src.
  html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  html = html.replace(/(href|src)\s*=\s*("|')\s*data:text\/html[^"']*\2/gi, '$1=$2#$2');

  // Drop <style> blocks — styling must come from Tailwind classes only.
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  return html.trim();
}

/**
 * The preview iframe document, loaded exactly ONCE per editor session. Tailwind
 * loads a single time; page content is streamed in afterwards via postMessage
 * (`builder:setBody`), so live updates never reload the document or re-fetch the
 * CDN. The iframe is rendered with sandbox="allow-scripts" and NO
 * allow-same-origin, so this runtime is isolated from the app's origin, cookies,
 * and storage. (The Tailwind CDN runtime is for live preview only — never for
 * export, per AGENTS.md §10.)
 */
export function buildPreviewShell(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<style>body{margin:0}</style>
<script>
  (function () {
    window.addEventListener('message', function (event) {
      var data = event && event.data;
      if (data && data.type === 'builder:setBody') {
        document.body.innerHTML = data.html || '';
      }
    });
    // Tell the parent the listener is attached and it can send content.
    if (window.parent) window.parent.postMessage({ type: 'builder:ready' }, '*');
  })();
</script>
</head>
<body class="bg-white text-gray-900 antialiased"></body>
</html>`;
}
