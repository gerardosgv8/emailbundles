import React from 'react';
import { Link } from 'react-router';

export const DocsFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t mt-12">
      <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-6">
        <div>
          <h5 className="font-semibold">EmailTemplateBundle</h5>
          <p className="text-sm text-gray-600 mt-2">
            Production-ready HTML email templates for small eCommerce teams.
          </p>
        </div>
        <div>
          <h6 className="font-semibold">Resources</h6>
          <ul className="mt-2 text-sm text-gray-600 space-y-2">
            <li><Link to="/docs#getting-started">Getting Started</Link></li>
            <li><Link to="/docs#customization">Customization</Link></li>
            <li><Link to="/docs#troubleshooting">Troubleshooting</Link></li>
            <li><Link to="/landing">Home</Link></li>
          </ul>
        </div>
        <div>
          <h6 className="font-semibold">Support</h6>
          <ul className="mt-2 text-sm text-gray-600 space-y-2">
            <li><a href="mailto:support@emailtemplatebundle.com">Email Support</a></li>
            <li><Link to="/landing#faq">FAQ</Link></li>
            <li><Link to="/landing#testimonials">Testimonials</Link></li>
            <li><Link to="/landing#buy">Purchase</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-4 text-sm text-gray-500">
          © {new Date().getFullYear()} EmailTemplateBundle — All rights reserved.
        </div>
      </div>
    </footer>
  );
};
