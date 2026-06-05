import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Database, Home, Settings, ChevronRight, Package, LogOut, Layers, Layout, FileText, Mail, HardDrive, Crown, Inbox, Users, LifeBuoy, Ticket, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard Overview', href: '/gestion', icon: Home, current: location.pathname === '/gestion' },
    { name: 'Products', href: '/gestion/products', icon: Package, current: location.pathname === '/gestion/products' },
    { name: 'Components', href: '/gestion/components', icon: Layout, current: location.pathname === '/gestion/components' },
    { name: 'Email Builder', href: '/gestion/email-builder', icon: Mail, current: location.pathname === '/gestion/email-builder' || location.pathname.startsWith('/gestion/email-builder/') },
    { name: 'Saved Emails', href: '/gestion/email-library', icon: Inbox, current: location.pathname === '/gestion/email-library' },
    { name: 'Template Composer', href: '/gestion/template-composer', icon: Layers, current: location.pathname === '/gestion/template-composer' || location.pathname.startsWith('/gestion/template-composer/') },
    { name: 'Template Library', href: '/gestion/saved-templates', icon: FileText, current: location.pathname === '/gestion/saved-templates' },
    { name: 'Users', href: '/gestion/users', icon: Users, current: location.pathname === '/gestion/users' },
    { name: 'Transactions', href: '/gestion/transactions', icon: Database, current: location.pathname === '/gestion/transactions' },
    { name: 'Analytics', href: '/gestion/analytics', icon: BarChart3, current: location.pathname === '/gestion/analytics' },
    { name: 'Storage Report', href: '/gestion/storage-report', icon: HardDrive, current: location.pathname === '/gestion/storage-report' },
    { name: 'User Tiers', href: '/gestion/user-tiers', icon: Crown, current: location.pathname === '/gestion/user-tiers' },
    { name: 'Support', href: '/gestion/support', icon: LifeBuoy, current: location.pathname === '/gestion/support' },
    { name: 'Support tickets', href: '/gestion/tickets', icon: Ticket, current: location.pathname === '/gestion/tickets' },
    { name: 'Email alerts', href: '/gestion/email-alerts', icon: Bell, current: location.pathname === '/gestion/email-alerts' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold flex-shrink-0">ET</div>
            {sidebarOpen && <span className="font-semibold whitespace-nowrap">Admin Panel</span>}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all
                  ${item.current
                    ? 'bg-primary text-black'
                    : 'text-gray-700 hover:bg-gray-100 hover:underline'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 space-y-2">
          {sidebarOpen ? (
            <>
              <div className="text-xs text-gray-500 mb-2">
                <p>Admin Dashboard</p>
                <p className="mt-1">EmailTemplateBundle</p>
              </div>
              {user && (
                <div className="text-xs text-gray-600 mb-2">
                  <p className="font-medium">{user.username}</p>
                  <p className="text-gray-500">{user.email}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center">
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all
              ${sidebarOpen
                ? 'text-red-600 hover:bg-red-50 justify-start'
                : 'text-red-400 justify-center'
              }
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              ← Back to Site
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

