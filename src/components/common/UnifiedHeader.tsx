import React, { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { X, Menu } from 'lucide-react';

/** Main site navigation — same links on every page. Homepage sections use `/#id` where linked. */
export const UnifiedHeader: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const linkClass =
    'text-gray-700 transition-colors hover:text-primary dark:text-gray-300 dark:hover:text-blue-400';

  const mainNav = (
    <>
      <Link to="/docs" className={linkClass}>
        Docs
      </Link>
      <Link to="/#testimonials" className={linkClass}>
        Testimonials
      </Link>
      <Link to="/#faq" className={linkClass}>
        FAQ
      </Link>
      {isAuthenticated && (
        <Link to="/user" className={linkClass}>
          My Account
        </Link>
      )}
      {!isAuthenticated && (
        <>
          <Link to="/login" className="btn-secondary btn-sm !border-0 text-center">
            Login
          </Link>
          <Link to="/register" className="btn btn-sm">
            Register
          </Link>
        </>
      )}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-transparent bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-bold text-white">ET</div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">EmailTemplateBundle</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">{mainNav}</nav>
          <div className="md:hidden">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle mobile menu"
            >
              <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

        <div
          className={`fixed top-0 right-0 z-50 h-full w-80 transform bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-gray-950 dark:shadow-black/40 md:hidden ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h2>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close menu"
            >
              <X className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <nav className="flex flex-col space-y-4 p-6">
            <Link
              to="/docs"
              className="py-2 text-base font-medium text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-blue-400"
              onClick={closeMobileMenu}
            >
              Docs
            </Link>
            <Link
              to="/#testimonials"
              className="py-2 text-base font-medium text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-blue-400"
              onClick={closeMobileMenu}
            >
              Testimonials
            </Link>
            <Link
              to="/#faq"
              className="py-2 text-base font-medium text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-blue-400"
              onClick={closeMobileMenu}
            >
              FAQ
            </Link>
            {isAuthenticated && (
              <Link
                to="/user"
                className="py-2 text-base font-medium text-gray-700 hover:text-primary dark:text-gray-300 dark:hover:text-blue-400"
                onClick={closeMobileMenu}
              >
                My Account
              </Link>
            )}
          {!isAuthenticated && (
            <>
              <Link
                to="/login"
                className="btn-secondary btn-sm !border-0 mt-4 text-center"
                onClick={closeMobileMenu}
              >
                Login
              </Link>
              <Link to="/register" className="btn btn-sm mt-4" onClick={closeMobileMenu}>
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  );
};
