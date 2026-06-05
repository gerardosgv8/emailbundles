import React from 'react';

export const ProblemSolutionSection: React.FC = () => {
  return (
    <section className="border-t border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 md:grid-cols-2">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Stop wasting hours designing emails from scratch
          </h3>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Outlook breaks designs, inconsistent branding dilutes trust, and slow QA cycles stall campaigns. 
            Our bundle solves those problems with pre-tested templates tailored for eCommerce use cases.
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-300">
            <li>• Pre-tested across major clients (Outlook, Gmail, Apple Mail)</li>
            <li>• Modular sections for flexible layouts</li>
            <li>• Inline CSS & table-based structure for ESP compatibility</li>
          </ul>
        </div>
        <div>
          <div className="rounded-md bg-gray-50 p-6 dark:bg-gray-900 dark:ring-1 dark:ring-gray-800">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Templates included</h4>
            <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Welcome series • Abandoned cart • Product launch</li>
              <li>Sale / Promotion • Order confirmation • Shipping update</li>
              <li>Re-engagement • Feedback request • Holiday campaigns</li>
            </ul>
            <a href="#templates" className="mt-6 inline-block bg-primary text-white px-4 py-2 rounded-md font-semibold">
              View gallery
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
