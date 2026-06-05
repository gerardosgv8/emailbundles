/**
 * Removes footer social icon placeholders from email HTML.
 *
 * In the templates, the 4 social slots are typically anchors like:
 *   <a data-element="footer-social-facebook" ...>Facebook</a>
 *
 * We hide the closest containing cell to prevent leftover spacing.
 */
export function removeFooterSocialIcons(html: string): string {
  if (!html) return html;

  // In rare cases (SSR/tests), DOMParser may not exist.
  if (typeof DOMParser === 'undefined') return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = Array.from(
      doc.querySelectorAll('a[data-element^="footer-social-"], a[data-element^="footer-icon-"]')
    ) as HTMLElement[];

    anchors.forEach((a) => {
      // Hide the anchor itself.
      a.style.setProperty('display', 'none', 'important');

      // Also hide the closest td/tr container to prevent layout gaps.
      const td = a.closest('td');
      if (td instanceof HTMLElement) td.style.setProperty('display', 'none', 'important');

      const tr = a.closest('tr');
      if (tr instanceof HTMLElement) tr.style.setProperty('display', 'none', 'important');
    });

    return doc.documentElement.outerHTML;
  } catch {
    // If parsing fails, don't break rendering; just return original HTML.
    return html;
  }
}

