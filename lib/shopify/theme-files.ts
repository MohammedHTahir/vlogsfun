import type { ThemeBuild, ThemeExportInput, ThemeFile } from './types';
import { SHOPIFY_THEME_VERSION } from './config';
import {
  buildTemplateJson,
  convertPageToSections,
  extractImageUrls,
  slugify,
  templateBaseName,
} from './liquid';

/**
 * Assemble a complete, uploadable Shopify theme from the generated pages
 * (AGENTS.md §10). Produces every required folder and file — assets, config,
 * layout, locales, sections, snippets, templates, templates/customers — with the
 * user's designed pages wired into real templates + sections, and valid
 * placeholders filling the standard templates Shopify expects so the ZIP uploads
 * without missing-template errors.
 */

/** Standard templates a live storefront routes to; placeholders fill any gaps. */
const REQUIRED_TEMPLATES = [
  'index',
  'product',
  'collection',
  'list-collections',
  'page',
  'blog',
  'article',
  'cart',
  'search',
  '404',
  'gift_card',
  'password',
];

/** Customer-account templates (templates/customers/*). */
const CUSTOMER_TEMPLATES = [
  'account',
  'activate_account',
  'addresses',
  'login',
  'order',
  'register',
  'reset_password',
];

function text(path: string, contents: string): ThemeFile {
  return { path, contents };
}

/** Pull the first `--brand`-style hex colour out of the theme CSS, if any. */
function pickColor(css: string, variable: string, fallback: string): string {
  const re = new RegExp(`--${variable}\\s*:\\s*(#[0-9a-fA-F]{3,8})`);
  const m = re.exec(css || '');
  return m ? m[1] : fallback;
}

function layoutTheme(projectName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="{{ settings.brand_color }}">
    <title>{{ page_title }}{% unless page_title contains shop.name %} &middot; {{ shop.name }}{% endunless %}</title>
    <link rel="canonical" href="{{ canonical_url }}">
    {% render 'meta-tags' %}
    {{ 'tailwind.css' | asset_url | stylesheet_tag }}
    {{ 'theme.css' | asset_url | stylesheet_tag }}
    {{ content_for_header }}
  </head>
  <body class="bg-white text-gray-900 antialiased" data-theme="${slugify(projectName, 'theme')}">
    <main id="main-content" role="main">
      {{ content_for_layout }}
    </main>
  </body>
</html>
`;
}

function metaSnippet(): string {
  return `{%- comment -%}
  Basic document meta. Extend with Open Graph / Twitter tags as needed.
{%- endcomment -%}
<meta name="description" content="{{ page_description | default: shop.description | escape }}">
`;
}

function placeholderSection(): string {
  const body = `<section class="shopify-section" style="padding:4rem 1.5rem;text-align:center;font-family:system-ui,sans-serif">
  <div style="max-width:640px;margin:0 auto">
    <h1 style="font-size:1.75rem;font-weight:700;margin-bottom:.75rem">{{ section.settings.heading }}</h1>
    <p style="color:#6b7280">{{ section.settings.body }}</p>
  </div>
</section>`;
  const schema = {
    name: 'Placeholder',
    settings: [
      { type: 'text', id: 'heading', label: 'Heading', default: 'Coming soon' },
      {
        type: 'textarea',
        id: 'body',
        label: 'Body',
        default: 'This page has not been designed yet. Customize it in the theme editor.',
      },
    ],
    presets: [{ name: 'Placeholder' }],
  };
  return `${body}\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`;
}

/** A JSON template that renders a single "placeholder" section. */
function placeholderTemplateJson(): string {
  return JSON.stringify(
    { sections: { main: { type: 'placeholder', settings: {} } }, order: ['main'] },
    null,
    2
  );
}

function settingsSchema(projectName: string, css: string): string {
  const brand = pickColor(css, 'brand', '#111827');
  const accent = pickColor(css, 'accent', '#ff6747');
  const schema = [
    {
      name: 'theme_info',
      theme_name: `${projectName} (AI Shopify Theme Builder)`.slice(0, 60),
      theme_version: SHOPIFY_THEME_VERSION,
      theme_author: 'AI Shopify Theme Builder',
      theme_documentation_url: '',
      theme_support_url: '',
    },
    {
      name: 'Colors',
      settings: [
        { type: 'color', id: 'brand_color', label: 'Brand', default: brand },
        { type: 'color', id: 'accent_color', label: 'Accent', default: accent },
      ],
    },
    {
      name: 'Typography',
      settings: [
        {
          type: 'select',
          id: 'heading_font_stack',
          label: 'Headings',
          default: 'system',
          options: [
            { value: 'system', label: 'System' },
            { value: 'serif', label: 'Serif' },
          ],
        },
      ],
    },
  ];
  return JSON.stringify(schema, null, 2);
}

function settingsData(css: string): string {
  const brand = pickColor(css, 'brand', '#111827');
  const accent = pickColor(css, 'accent', '#ff6747');
  const values = { brand_color: brand, accent_color: accent, heading_font_stack: 'system' };
  return JSON.stringify({ current: values, presets: { Default: values } }, null, 2);
}

function defaultLocale(): string {
  return JSON.stringify(
    {
      general: {
        meta: { tags: 'Tagged "{{ tags }}"', page: 'Page {{ page }}' },
        search: { title: 'Search', placeholder: 'Search', submit: 'Search' },
      },
      products: { product: { add_to_cart: 'Add to cart', sold_out: 'Sold out' } },
      cart: { general: { title: 'Your cart', checkout: 'Checkout', empty: 'Your cart is empty' } },
    },
    null,
    2
  );
}

/**
 * Build the full theme file set. Deterministic and side-effect-free so it can be
 * validated, zipped, and re-run without touching state.
 */
export function buildThemeFiles(input: ThemeExportInput): ThemeBuild {
  const files: ThemeFile[] = [];
  const imageUrls = new Set<string>();
  const usedBaseNames = new Set<string>();

  // --- Assets: vendored Tailwind + the project's global stylesheet ---
  files.push(text('assets/tailwind.css', input.tailwindCss));
  files.push(
    text(
      'assets/theme.css',
      `/* Project global theme — generated by AI Shopify Theme Builder */\n${input.themeCss || ''}\n`
    )
  );

  // --- Layout + snippet ---
  files.push(text('layout/theme.liquid', layoutTheme(input.projectName)));
  files.push(text('snippets/meta-tags.liquid', metaSnippet()));

  // --- Config ---
  files.push(text('config/settings_schema.json', settingsSchema(input.projectName, input.themeCss)));
  files.push(text('config/settings_data.json', settingsData(input.themeCss)));

  // --- Locales ---
  files.push(text('locales/en.default.json', defaultLocale()));

  // --- User pages → sections + templates ---
  for (const page of input.pages) {
    if (!page.html || !page.html.trim()) continue;

    for (const url of extractImageUrls(page.html)) imageUrls.add(url);

    const sections = convertPageToSections(page);
    for (const section of sections) {
      files.push(text(section.fileName, section.liquid));
    }

    // Resolve a unique template base name (custom pages could collide).
    let base = templateBaseName(page);
    if (usedBaseNames.has(base)) {
      let n = 2;
      while (usedBaseNames.has(`${base}-${n}`)) n += 1;
      base = `${base}-${n}`;
    }
    usedBaseNames.add(base);
    files.push(text(`templates/${base}.json`, buildTemplateJson(sections)));
  }

  // --- Placeholder section used by every gap-filling template ---
  files.push(text('sections/placeholder.liquid', placeholderSection()));

  // --- Fill required standard templates the user didn't design ---
  for (const base of REQUIRED_TEMPLATES) {
    if (usedBaseNames.has(base)) continue;
    usedBaseNames.add(base);
    files.push(text(`templates/${base}.json`, placeholderTemplateJson()));
  }

  // --- Customer-account templates (templates/customers/*) ---
  for (const name of CUSTOMER_TEMPLATES) {
    files.push(text(`templates/customers/${name}.json`, placeholderTemplateJson()));
  }

  // Sections must exist for the schema block referenced above; placeholder added.

  return { files, imageUrls: Array.from(imageUrls) };
}
