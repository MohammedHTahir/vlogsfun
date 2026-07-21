import type { ExportPage } from './types';

/**
 * HTML → Shopify Liquid conversion helpers (AGENTS.md §10). Deterministic and
 * browser-side: each generated page is split into its builder sections, and each
 * section becomes a real `sections/*.liquid` file with a `{% schema %}` block so
 * it is editable in the Shopify Theme Editor. The static markup is wrapped in
 * `{% raw %}` so any literal `{{`/`{%` in AI-authored copy can never be parsed as
 * Liquid — the section renders exactly what was designed.
 *
 * We intentionally keep per-section settings minimal for v1 (theme-level design
 * settings live in config/settings_schema.json); the goal is a valid, uploadable
 * theme, not exhaustive per-text setting extraction.
 */

/** Shopify handle: lowercase, alphanumeric + single hyphens, never empty. */
export function slugify(text: string, fallback = 'section'): string {
  const slug = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || fallback;
}

/** Title-case a slug for human-facing section/schema names. */
export function titleize(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface BuilderSection {
  /** Slug from data-builder-section-id (or a synthesized one). */
  id: string;
  /** data-builder-section-type, if present. */
  kind: string;
  html: string;
}

/**
 * Split a page body into Shopify sections — one per top-level element, in order,
 * so NOTHING is lost (a header/footer the model emits without a builder id still
 * becomes its own section). A builder section id is used when present; otherwise
 * an id is derived from the tag/class. Falls back to a single "main" section when
 * DOMParser is unavailable or the markup has no element children.
 */
export function splitIntoSections(html: string): BuilderSection[] {
  if (typeof DOMParser === 'undefined') {
    return [{ id: 'main', kind: 'main', html }];
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  } catch {
    return [{ id: 'main', kind: 'main', html }];
  }

  const children = Array.from(doc.body.children);
  if (children.length === 0) {
    const body = doc.body.innerHTML.trim();
    return [{ id: 'main', kind: 'main', html: body || html }];
  }

  const seen = new Map<string, number>();
  const sections: BuilderSection[] = [];

  children.forEach((el, index) => {
    const builderId = el.getAttribute('data-builder-section-id');
    const firstClass = el.getAttribute('class')?.trim().split(/\s+/)[0] ?? '';
    const base =
      builderId ||
      el.tagName.toLowerCase().replace(/^section$/, `section-${index + 1}`) ||
      firstClass ||
      `block-${index + 1}`;

    let id = slugify(base, `block-${index + 1}`);
    // Guarantee uniqueness within the page (duplicate ids would collide as files).
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;

    const kind = slugify(el.getAttribute('data-builder-section-type') || id, id);
    sections.push({ id, kind, html: el.outerHTML });
  });

  return sections;
}

/** Collect distinct absolute image URLs referenced by a chunk of HTML. */
export function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = (m[2] ?? m[3] ?? '').trim();
    if (/^https?:\/\//i.test(src)) urls.add(src);
  }
  return Array.from(urls);
}

/**
 * Make static HTML safe to embed inside a Liquid section: strip any nested
 * raw-tag markers (so our own wrapper can't be closed early), then wrap in
 * `{% raw %}` so no `{{ }}` / `{% %}` in the content is ever evaluated.
 */
function rawWrap(html: string): string {
  const safe = html.replace(/\{%-?\s*(end)?raw\s*-?%\}/gi, '');
  return `{% raw %}\n${safe.trim()}\n{% endraw %}`;
}

/** The `{% schema %}` block for a converted section (valid JSON, with a preset). */
export function sectionSchema(name: string): string {
  const schema = {
    name: name.slice(0, 25) || 'Section',
    tag: 'section',
    class: 'shopify-section',
    settings: [],
    presets: [{ name: name.slice(0, 25) || 'Section' }],
  };
  return `{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`;
}

export interface ConvertedSection {
  /** Unique section type across the whole theme (the file basename). */
  type: string;
  /** Instance id used inside the template JSON `sections`/`order`. */
  instanceId: string;
  fileName: string;
  liquid: string;
}

/**
 * Convert one page into its ordered list of Shopify sections. `type` is prefixed
 * with the page key so sections from different pages never collide as filenames.
 */
export function convertPageToSections(page: ExportPage): ConvertedSection[] {
  const pageSlug = slugify(page.key, 'page');
  const sections = splitIntoSections(page.html);

  return sections.map((section) => {
    const type = `${pageSlug}-${section.id}`;
    const name = titleize(`${pageSlug} ${section.id}`);
    const liquid = `${rawWrap(section.html)}\n\n${sectionSchema(name)}\n`;
    return {
      type,
      instanceId: section.id.replace(/[^a-z0-9_]/g, '_'),
      fileName: `sections/${type}.liquid`,
      liquid,
    };
  });
}

/** Map a page to its Shopify template base name (without the .json extension). */
export function templateBaseName(page: ExportPage): string {
  const key = slugify(page.key, 'page');
  switch (page.type) {
    case 'home':
      return 'index';
    case 'product':
      return 'product';
    case 'collection':
      return 'collection';
    case 'cart':
      return 'cart';
    // checkout can't be a standard template; export it as a normal page template.
    case 'checkout':
    case 'custom':
    default:
      return `page.${key}`;
  }
}

/** Build the JSON template body that wires a page's sections together. */
export function buildTemplateJson(sections: ConvertedSection[]): string {
  const order: string[] = [];
  const map: Record<string, { type: string; settings: Record<string, never> }> = {};
  const seen = new Map<string, number>();

  for (const section of sections) {
    let id = section.instanceId || 'section';
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}_${count + 1}`;
    map[id] = { type: section.type, settings: {} };
    order.push(id);
  }

  return JSON.stringify({ sections: map, order }, null, 2);
}
