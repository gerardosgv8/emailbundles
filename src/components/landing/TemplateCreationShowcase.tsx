import React from 'react';
import { Link } from 'react-router';

const TEMPLATE_BUILD_VIDEO_SRC = '/videos/TrimmedEmailBuild.mp4';
const VIDEO_POSTER = '/Email_showcase4.svg';

const tutorialLinkClass =
  'text-primary-600 font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-sm dark:text-blue-400 dark:focus-visible:ring-blue-500 dark:focus-visible:ring-offset-gray-950';

export const TemplateCreationShowcase: React.FC = () => {
  return (
    <section className="border-t border-gray-100 bg-gray-50 py-14 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2 md:gap-12">
        <div className="order-2 md:order-1">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-blue-400">
            See it in action
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-gray-900 dark:text-gray-100 md:text-3xl">
            The experience of building a template, end to end
          </h2>
          <p className="mt-4 leading-relaxed text-gray-600 dark:text-gray-400">
            Watch how teams go from a blank canvas to a polished, client-ready email—structure,
            styling, and checks—without leaving the builder.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-primary-600 dark:text-blue-400">•</span>
              <span>
                Creating email for an interior design company{' '}
                <Link to="/docs" className={tutorialLinkClass}>
                  Watch tutorial
                </Link>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-primary-600 dark:text-blue-400">•</span>
              <span>
                Creating email for an ecommerce{' '}
                <Link to="/docs" className={tutorialLinkClass}>
                  Watch tutorial
                </Link>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-primary-600 dark:text-blue-400">•</span>
              <span>
                Creating email for a product launch{' '}
                <Link to="/docs" className={tutorialLinkClass}>
                  Watch tutorial
                </Link>
              </span>
            </li>
          </ul>
        </div>

        <div className="order-1 md:order-2">
          <div className="aspect-video overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-gray-200/80 dark:ring-gray-700">
            <video
              className="w-full h-full object-cover object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={VIDEO_POSTER}
              aria-label="Screen recording: building an email template in the product"
            >
              <source src={TEMPLATE_BUILD_VIDEO_SRC} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
};
