import React from 'react';

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      title: "Save time",
      description: "Launch campaigns in minutes instead of days — skip design and QA."
    },
    {
      title: "Look professional",
      description: "Modern, conversion-focused designs that elevate your brand."
    },
    {
      title: "Easy implementation",
      description: "Clean code, commented, and ESP-ready for Salesforce, Klaviyo, Mailchimp."
    },
    {
      title: "Fully responsive",
      description: "Mobile-first layouts tested across devices and clients."
    }
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Key benefits</h3>
      <div className="mt-6 grid gap-6 md:grid-cols-4">
        {features.map((feature, index) => (
          <div
            key={index}
            className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800"
          >
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{feature.title}</h4>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
