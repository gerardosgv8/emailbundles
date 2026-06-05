import React from 'react';

export const TemplatesGallery: React.FC = () => {
  const templates = [
    {
      name: "Creating email for an interior design company",
      description: "Watch tutorial"
    },
    {
      name: "Creating email for an ecommerce",
      description: "Watch tutorial"
    },
    {
      name: "Creating email for a product launch",
      description: "Watch tutorial"
    }
  ];

  return (
    <section id="templates" className="mx-auto max-w-6xl px-6 py-12">
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">View Tutorials</h3>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        All templates come as editable HTML files with modular sections.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800"
          >
            <div className="flex h-40 items-center justify-center rounded-md bg-gradient-to-br from-slate-100 to-white px-3 text-center text-sm text-gray-600 dark:from-slate-800 dark:to-gray-900 dark:text-gray-300">
              {template.name}
            </div>
            <div className="p-4">
              <h5 className="font-semibold text-gray-900 dark:text-gray-100">{template.name}</h5>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{template.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <a href="#buy" className="bg-primary text-white px-6 py-3 rounded-md font-semibold">
          Get the bundle — $79
        </a>
      </div>
    </section>
  );
};
