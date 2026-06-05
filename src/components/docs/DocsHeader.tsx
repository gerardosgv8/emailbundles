import React from 'react';
import { Link } from 'react-router';

interface DocsHeaderProps {
  onMenuClick?: () => void;
}

export const DocsHeader: React.FC<DocsHeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/landing" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold">ET</div>
          <span className="font-semibold">EmailTemplateBundle</span>
        </Link>
        <nav className="hidden md:flex gap-6 items-center text-sm">
          <Link to="/landing" className="hover:text-primary">Home</Link>
          <a href="#getting-started" className="hover:text-primary">Getting Started</a>
          <a href="#customization" className="hover:text-primary">Customization</a>
          <a href="#troubleshooting" className="hover:text-primary">Troubleshooting</a>
          <a href="#templates" className="hover:text-primary">Templates</a>
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
