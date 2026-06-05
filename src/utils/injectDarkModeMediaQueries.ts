/**
 * Injects `prefers-color-scheme` media queries into an email HTML string.
 *
 * We keep this lightweight and rely on `!important` to override inline colors where possible.
 */
export function injectDarkModeMediaQueries(html: string): string {
  if (!html) return html;
  if (html.includes('prefers-color-scheme: dark')) return html;

  const style = `
<style>
  @media (prefers-color-scheme: dark) {
    html { background-color: #0b1220 !important; }
    body { background-color: #0b1220 !important; }
    body, table, td, tr { background-color: #0b1220 !important; }
    body, table, td, tr, p, a, span, div, li, blockquote, h1, h2, h3, h4, h5, h6 { color: #e5e7eb !important; }
    a { color: #93c5fd !important; }

    /* Flip inline white backgrounds to dark */
    *[style*="background-color: #ffffff"],
    *[style*="background-color:#ffffff"],
    *[style*="background-color: #fff"],
    *[style*="background-color:#fff"],
    *[style*="background-color:white"],
    *[style*="background-color: rgb(255, 255, 255)"],
    *[style*="background-color:rgb(255,255,255)"] {
      background-color: #0b1220 !important;
      color: #e5e7eb !important;
    }
  }

  @media (prefers-color-scheme: light) {
    html { background-color: #ffffff !important; }
    body { background-color: #ffffff !important; }
    body, table, td, tr { background-color: #ffffff !important; }
    body, table, td, tr, p, a, span, div, li, blockquote, h1, h2, h3, h4, h5, h6 { color: #111827 !important; }
    a { color: #2563eb !important; }

    /* Flip inline black backgrounds to light */
    *[style*="background-color: #000000"],
    *[style*="background-color:#000000"],
    *[style*="background-color: #000"],
    *[style*="background-color:#000"],
    *[style*="background-color:black"],
    *[style*="background-color: rgb(0, 0, 0)"],
    *[style*="background-color:rgb(0,0,0)"] {
      background-color: #ffffff !important;
      color: #111827 !important;
    }
  }
</style>`;

  if (html.includes('</head>')) {
    return html.replace(/<\/head>/i, `${style}</head>`);
  }

  return html;
}

