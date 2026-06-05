import React from 'react';
import { Link } from 'react-router';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold">ET</div>
          <span className="font-semibold">EmailTemplateBundle</span>
        </a>
        <nav className="hidden md:flex gap-6 items-center text-sm">
          <a href="#templates" className="hover:text-primary">Templates</a>
          <a href="#pricing" className="hover:text-primary">Pricing</a>
          <Link to="/docs" className="hover:text-primary">Docs</Link>
          <a href="#testimonials" className="hover:text-primary">Testimonials</a>
          <a href="#faq" className="hover:text-primary">FAQ</a>
          <Link
            to="/register"
            className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            Register
          </Link>
        </nav>
        <div className="md:hidden">
          <button 
            onClick={onMenuClick}
            className="p-2 rounded-md bg-gray-100"
          >
            Menu
          </button>
        </div>
      </div>
    </header>
  );
};
