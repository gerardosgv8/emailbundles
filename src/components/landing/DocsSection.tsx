import React from 'react';

export const DocsSection: React.FC = () => {
  const docItems = [
    {
      title: "Getting started",
      description: "Open the template, edit copy & images, and upload to your ESP."
    },
    {
      title: "Customization",
      description: "Change colors, fonts, and sections. All styles are inlined and commented."
    },
    {
      title: "Troubleshooting",
      description: "Common fixes for images, spacing, and Outlook rendering quirks."
    }
  ];

  return (
    <section id="docs" className="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-6xl px-6">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Documentation & Support</h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Step-by-step guides to import, edit, and send templates. Includes screenshots and troubleshooting tips.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {docItems.map((item, index) => (
            <div key={index} className="rounded-md bg-gray-50 p-4 dark:bg-gray-900 dark:ring-1 dark:ring-gray-800">
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</h5>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
