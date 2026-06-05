import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, LifeBuoy, Mail } from 'lucide-react';
import { UserTicketsPanel } from '../components/support/UserTicketsPanel';

const SUPPORT_EMAIL = 'support@emailtemplatebundle.com';

export type SupportPageContext = 'admin' | 'subscriber';

interface SupportPageProps {
  context?: SupportPageContext;
}

export const SupportPage: React.FC<SupportPageProps> = ({ context = 'subscriber' }) => {
  const isAdmin = context === 'admin';

  return (
    <div className={`space-y-8 ${isAdmin ? 'max-w-3xl' : 'max-w-4xl'}`}>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <LifeBuoy className="w-9 h-9 text-blue-600 dark:text-blue-400 shrink-0" />
          Support
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
          {isAdmin
            ? 'Resources for operating the platform and helping subscribers.'
            : 'Get help with your account, billing, and the email builder.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 p-3">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email us</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {isAdmin
                  ? 'Subscriber-facing issues, billing questions, and product feedback.'
                  : 'We typically reply within one business day.'}
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-violet-50 dark:bg-violet-950/40 p-3">
              <BookOpen className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documentation</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Guides for templates, the builder, exports, and ESP integration.
              </p>
              <Link
                to="/docs"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                Open docs
                <ArrowRight className="w-3.5 h-3.5 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Admin quick links</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/gestion/users"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Users
                </Link>
                <span className="text-gray-500 dark:text-gray-500"> — accounts and access</span>
              </li>
              <li>
                <Link
                  to="/gestion/transactions"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Transactions
                </Link>
                <span className="text-gray-500 dark:text-gray-500"> — payments and Stripe</span>
              </li>
              <li>
                <Link
                  to="/gestion/storage-report"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Storage report
                </Link>
                <span className="text-gray-500 dark:text-gray-500"> — templates and usage</span>
              </li>
              <li>
                <Link
                  to="/gestion/tickets"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Support tickets
                </Link>
                <span className="text-gray-500 dark:text-gray-500"> — subscriber requests</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {!isAdmin && <UserTicketsPanel />}
    </div>
  );
};
