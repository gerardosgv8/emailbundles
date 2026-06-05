import React from 'react';

export const DOCS_TOC_ITEMS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'template-structure', label: 'Template Structure' },
  { id: 'customization', label: 'Customization Guide' },
  { id: 'esp-integration', label: 'ESP Integration' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'best-practices', label: 'Best Practices' },
  { id: 'templates', label: 'Template Reference' },
  { id: 'support', label: 'Support' },
] as const;

type Variant = 'aside' | 'mobile-card';

interface TableOfContentsProps {
  variant?: Variant;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ variant = 'mobile-card' }) => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (variant === 'aside') {
    return (
      <nav
        aria-label="Documentation table of contents"
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">On this page</p>
        <ul className="space-y-1 border-l-2 border-gray-200 pl-3">
          {DOCS_TOC_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-left text-sm text-gray-700 hover:text-primary"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Table of Contents</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-2 text-sm">
          {DOCS_TOC_ITEMS.slice(0, 4).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-left text-primary hover:underline"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <ul className="space-y-2 text-sm">
          {DOCS_TOC_ITEMS.slice(4).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-left text-primary hover:underline"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
