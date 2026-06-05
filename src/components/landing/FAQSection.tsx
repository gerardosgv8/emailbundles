import React from 'react';

export const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "Are these templates compatible with my platform?",
      answer: "Yes. They are compatible with Salesforce, Klaviyo, Mailchimp, HubSpot, and can be used in any ESP that accepts HTML templates."
    },
    {
      question: "Can I customize colors and fonts?",
      answer: "Yes — colors and fonts are commented in the code. We include a quick-start guide to edit safely."
    },
    {
      question: "Will these work on mobile?",
      answer: "Yes — templates are responsive and mobile-first. We test across common devices and email clients."
    },
    {
      question: "Do I need to know HTML?",
      answer: "Basic familiarity helps, but the templates are easy to edit. We provide clear docs and examples; any marketer can update text and images."
    }
  ];

  return (
    <section id="faq" className="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl px-6">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Frequently asked questions</h3>
        <dl className="mt-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
          {faqs.map((faq, index) => (
            <div key={index}>
              <dt className="font-semibold text-gray-900 dark:text-gray-100">{faq.question}</dt>
              <dd className="mt-1 text-gray-600 dark:text-gray-400">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
