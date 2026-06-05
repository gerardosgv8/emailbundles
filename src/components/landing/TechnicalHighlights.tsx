import React from 'react';

export const TechnicalHighlights: React.FC = () => {
  const highlights = [
    {
      title: "Bulletproof buttons",
      description: "VML buttons for Outlook and standard anchors for other clients so CTAs look consistent everywhere."
    },
    {
      title: "Table-based layout",
      description: "Hybrid table layout & inline CSS to maximize compatibility across ESPs and clients."
    },
    {
      title: "ESP compatibility",
      description: "Copy-paste ready for Salesforce Marketing Cloud, Klaviyo, Mailchimp, HubSpot, and more."
    }
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Technical highlights</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {highlights.map((highlight, index) => (
          <div
            key={index}
            className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800"
          >
            <h5 className="font-semibold text-gray-900 dark:text-gray-100">{highlight.title}</h5>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{highlight.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
