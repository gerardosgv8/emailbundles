import adaptiveCss from './embeddedThemeAdaptive.css?raw';
import lightOnlyCss from './embeddedThemeLightOnly.css?raw';

/** Controls which theme CSS is embedded in generated HTML (preview, save, export). */
export type ThemeCssMode = 'adaptive' | 'light-only';

/**
 * Inner CSS for the second &lt;style&gt; block in the email builder head (after body isolation).
 * - adaptive: prefers-color-scheme dark + light, and light + dark builder preview rules.
 * - light-only: prefers-color-scheme light and light preview rules only (no dark-mode CSS in HTML).
 */
export function buildEmbeddedThemeStyleContent(themeCssMode: ThemeCssMode): string {
  return themeCssMode === 'light-only' ? lightOnlyCss : adaptiveCss;
}
