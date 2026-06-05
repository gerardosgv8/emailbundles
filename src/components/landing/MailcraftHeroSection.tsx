import React from 'react';

export const MailcraftHeroSection: React.FC = () => {
  return (
    <section className="relative flex items-center">
      <div className="w-full h-full flex flex-col md:flex-row">
        {/* Left Side - Header & Value Proposition (50%) */}
        <div className="flex min-h-[50vh] w-full items-center justify-center bg-white px-6 py-12 dark:bg-gray-950 md:min-h-screen md:w-1/2 md:px-12 md:py-20">
          <div className="max-w-xl">
            <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 dark:text-gray-100 sm:text-4xl md:mb-6 md:text-5xl">
              Craft Beautiful Email Templates in Minutes
            </h1>
            <p className="mb-6 text-lg leading-relaxed text-gray-600 dark:text-gray-400 sm:text-xl md:mb-8">
              Professional email templates that work everywhere. No coding required.
              Build, customize, and export stunning emails that convert.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-8 py-4 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Get Started Free
              </button>
              <button
                type="button"
                className="rounded-lg border-2 border-gray-300 px-8 py-4 font-semibold text-gray-700 transition-colors hover:border-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500"
              >
                View Demo
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - Showcase image (50%) */}
        <div className="relative min-h-[50vh] w-full overflow-hidden bg-gray-100 dark:bg-gray-900 md:min-h-screen md:w-1/2">
          <img
            src="/Email_showcase1.svg"
            alt="Email template showcase"
            className="absolute top-0 left-0 w-full h-full object-cover object-center"
          />
        </div>
      </div>
    </section>
  );
};
