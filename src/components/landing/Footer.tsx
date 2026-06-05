import React from 'react';
import { Link } from 'react-router';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-10 md:grid-cols-3">
        <div>
          <h5 className="font-semibold text-gray-900 dark:text-gray-100">EmailTemplateBundle</h5>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Production-ready HTML email templates for small eCommerce teams.
          </p>
        </div>
        <div>
          <h6 className="font-semibold text-gray-900 dark:text-gray-100">Resources</h6>
          <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <Link to="/docs" className="hover:text-primary dark:hover:text-blue-400">
                Documentation
              </Link>
            </li>
            <li>
              <a href="#faq" className="hover:text-primary dark:hover:text-blue-400">
                FAQ
              </a>
            </li>
            <li>
              <a href="#testimonials" className="hover:text-primary dark:hover:text-blue-400">
                Testimonials
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h6 className="font-semibold text-gray-900 dark:text-gray-100">Legal</h6>
          <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <a href="#" className="hover:text-primary dark:hover:text-blue-400">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary dark:hover:text-blue-400">
                Terms of Use
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary dark:hover:text-blue-400">
                Refund Policy
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-gray-500 dark:text-gray-500">
          © {new Date().getFullYear()} EmailTemplateBundle — All rights reserved.
        </div>
      </div>
    </footer>
  );
};
