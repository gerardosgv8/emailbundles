/**
 * Preview thumbnails for Email Builder template cards (EmailDemoImages).
 * Uses .svg when present for a given basename, otherwise .png.
 *
 * Resolution order:
 * 1. Basename matches meta.templateName (e.g. "Thank You Email")
 * 2. Basename matches template id (e.g. "freeflow_thank_you")
 * 3. Explicit per-template fallback (e.g. numbered PNG when no SVG exists)
 */

const pngModules = import.meta.glob('../../EmailDemoImages/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const svgModules = import.meta.glob('../../EmailDemoImages/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function basenameFromGlobPath(globPath: string): string {
  const seg = globPath.split('/').pop() || '';
  return seg.replace(/\.(png|svg)$/i, '');
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** basename (no ext) → preferred preview URL (SVG wins over PNG for same name) */
function mergeByBasename(): Map<string, string> {
  const byBase = new Map<string, { url: string; isSvg: boolean }>();

  const add = (globPath: string, url: string, isSvg: boolean) => {
    const base = basenameFromGlobPath(globPath);
    const prev = byBase.get(base);
    if (isSvg) {
      byBase.set(base, { url, isSvg: true });
    } else if (!prev) {
      byBase.set(base, { url, isSvg: false });
    }
  };

  for (const [path, url] of Object.entries(pngModules)) {
    add(path, url, false);
  }
  for (const [path, url] of Object.entries(svgModules)) {
    add(path, url, true);
  }

  const out = new Map<string, string>();
  for (const [base, { url }] of byBase) {
    out.set(base, url);
  }
  return out;
}

const basenameToUrl = mergeByBasename();

/** By normalized display title (matches meta.templateName). */
const normalizedNameToUrl = new Map<string, string>();
/** By template id when file is named exactly {templateId}.png|.svg */
const templateIdToUrl = new Map<string, string>();

for (const [base, url] of basenameToUrl) {
  normalizedNameToUrl.set(normalizeName(base), url);

  if (/^\d+$/.test(base.trim())) {
    normalizedNameToUrl.set(base.trim(), url);
  }

  if (/^[a-z][a-z0-9_]*$/i.test(base)) {
    templateIdToUrl.set(base.toLowerCase(), url);
  }
}

export function resolveEmailTemplatePreviewUrl(
  templateId: string,
  templateName: string
): string | undefined {
  const byTitle = normalizedNameToUrl.get(normalizeName(templateName));
  if (byTitle) return byTitle;

  const byIdFile = templateIdToUrl.get(templateId.toLowerCase());
  if (byIdFile) return byIdFile;

  return undefined;
}
