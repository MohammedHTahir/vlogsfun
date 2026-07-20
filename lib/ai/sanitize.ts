/**
 * Generated storefront HTML is untrusted (AGENTS.md §9). This module strips the
 * dangerous bits server-side before the HTML ever reaches the browser, and
 * builds the sandboxed preview document the iframe renders.
 *
 * Isomorphic on purpose: `sanitizeGeneratedHtml` runs in the route handler and
 * `buildPreviewShell` runs in the client, but neither imports server-only code.
 */

import { previewEditorScript } from './preview-editor';

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
 * Sanitize the project-level global stylesheet (AGENTS.md §9). It is applied via
 * `style.textContent`, which never parses HTML, so tag breakout isn't possible;
 * this strips the CSS-specific risks (external fetches and legacy script vectors)
 * and any stray <style> wrapper the model may have added.
 */
export function sanitizeThemeCss(raw: string): string {
  let css = raw;

  // Drop accidental markdown code fences and any <style> wrapper.
  css = css.replace(/```(?:css)?\s*/gi, '').replace(/```\s*$/g, '');
  css = css.replace(/<\/?style\b[^>]*>/gi, '');

  // Remove external fetches and legacy JS-in-CSS vectors.
  css = css.replace(/@import\b[^;]*;?/gi, '');
  css = css.replace(/expression\s*\(/gi, '(');
  css = css.replace(/javascript:/gi, '');

  return css.trim();
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
<style id="__builder_theme__"></style>
<script>${previewEditorScript()}</script>
<script>
  (function () {
    var themeEl = document.getElementById('__builder_theme__');
    var editMode = false;
    window.addEventListener('message', function (event) {
      var data = event && event.data;
      if (!data) return;
      if (data.type === 'builder:setBody') {
        document.body.innerHTML = data.html || '';
        // The new body has no editor UI or listeners; re-apply edit mode so
        // hover/highlight/toolbar keep working after a content swap.
        if (editMode && window.__builderSetEditMode) window.__builderSetEditMode(true);
      } else if (data.type === 'builder:setTheme') {
        // Assigning textContent never parses HTML, so the project stylesheet
        // cannot break out of this <style> element.
        if (themeEl) themeEl.textContent = data.css || '';
      } else if (data.type === 'builder:setEditMode') {
        editMode = !!data.enabled;
        if (window.__builderSetEditMode) window.__builderSetEditMode(editMode);
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
