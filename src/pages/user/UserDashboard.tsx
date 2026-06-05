import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, Settings, ChevronRight, LogOut, LayoutDashboard, Mail, Layers, Layout, FileText, LifeBuoy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { ProPlanUpgradeModal } from '../../components/user/ProPlanUpgradeModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const UserDashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { hasCapability, tier } = useUserTier();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showProPlanModal, setShowProPlanModal] = React.useState(false);
  const [upgradeSubmitting, setUpgradeSubmitting] = React.useState(false);
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null);
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUpgradeToPro = async (productId: string) => {
    if (tier === 'pro') return;

    setUpgradeSubmitting(true);
    setUpgradeError(null);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setUpgradeError('Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/upgrade`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_id: productId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const d = data?.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(' ')
              : 'Could not start upgrade';
        setUpgradeError(msg);
        return;
      }

      if (data.payment_required && data.checkout_url) {
        setShowProPlanModal(false);
        window.location.href = data.checkout_url;
        return;
      }

      setShowProPlanModal(false);
      await refreshUser();
    } catch {
      setUpgradeError('Something went wrong. Try again.');
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  const canSaveEmails = hasCapability('canSaveEmails');

  const coreNavigation = [
    { name: 'Dashboard', href: '/user', icon: LayoutDashboard, current: location.pathname === '/user' },
    { name: 'Email Builder', href: '/user/email-builder', icon: Mail, current: location.pathname === '/user/email-builder' || location.pathname.startsWith('/user/email-builder/') },
  ];

  const savedEmailsNav = {
    name: 'Saved Emails',
    href: '/user/email-library',
    icon: FileText,
    current: location.pathname === '/user/email-library',
  };

  const componentsNav = {
    name: 'Components',
    href: '/user/components',
    icon: Layout,
    current: location.pathname === '/user/components',
  };

  const templateComposerNav = {
    name: 'Template Composer',
    href: '/user/template-composer',
    icon: Layers,
    current:
      location.pathname === '/user/template-composer' ||
      location.pathname.startsWith('/user/template-composer/'),
  };
  const templateLibraryNav = {
    name: 'Template Library',
    href: '/user/saved-templates',
    icon: FileText,
    current: location.pathname === '/user/saved-templates',
  };

  // Common navigation items
  const commonNavigation = [
    { name: 'My Profile', href: '/user/profile', icon: User, current: location.pathname === '/user/profile' },
    { name: 'Settings', href: '/user/settings', icon: Settings, current: location.pathname === '/user/settings' },
    { name: 'Support', href: '/user/support', icon: LifeBuoy, current: location.pathname === '/user/support' },
  ];

  // Combine navigation based on tier (composer + save are both Pro; do not require redundant checks)
  const canUseTemplateComposer = hasCapability('canUseTemplateComposer');
  const canSaveTemplates = hasCapability('canSaveTemplates');

  const navigation = [
    ...coreNavigation,
    ...(canSaveEmails ? [savedEmailsNav] : []),
    ...(canUseTemplateComposer ? [templateComposerNav] : []),
    ...(canSaveTemplates ? [templateLibraryNav] : []),
    componentsNav,
    ...commonNavigation,
  ];

  return (
      <div className="flex h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold flex-shrink-0">ET</div>
            {sidebarOpen && <span className="font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100">My Account</span>}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
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
                    ? 'bg-primary text-black dark:bg-blue-600 dark:text-white dark:ring-1 dark:ring-blue-400/80'
                    : 'text-gray-700 hover:bg-gray-100 hover:underline dark:text-gray-300 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="whitespace-nowrap flex items-center gap-2">
                    {item.name}
                    {item.proOnly && (
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">
                        PRO
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
          {sidebarOpen ? (
            <>
              {user && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{user.username}</p>
                  <p className="text-gray-500 dark:text-gray-500">{user.email}</p>
                  <p className="mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                      tier === 'pro'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200'
                    }`}>
                      {tier}
                    </span>
                  </p>
                </div>
              )}
              {tier !== 'pro' && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md dark:bg-yellow-950/30 dark:border-yellow-800/60">
                  <p className="text-[10px] text-yellow-800 dark:text-yellow-200 font-medium mb-1">Upgrade to Pro</p>
                  <p className="text-[9px] text-yellow-700 dark:text-yellow-300/90 leading-snug">
                    <button
                      type="button"
                      onClick={() => {
                        setUpgradeError(null);
                        setShowProPlanModal(true);
                      }}
                      className="text-left w-full font-normal text-yellow-800/90 dark:text-yellow-200 underline decoration-yellow-600/35 dark:decoration-yellow-500/40 underline-offset-2 hover:decoration-yellow-800 dark:hover:decoration-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 transition-colors"
                    >
                      Unlock Template Composer &amp; Template Library — choose a Pro plan
                    </button>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center">
              <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all
              ${sidebarOpen
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 justify-start'
                : 'text-red-400 dark:text-red-400/80 justify-center'
              }
            `}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 h-16 flex items-center justify-between px-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Subscriber Dashboard</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
            >
              ← Back to Site
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
          <Outlet />
        </main>
      </div>

      <ProPlanUpgradeModal
        open={showProPlanModal}
        onClose={() => {
          if (!upgradeSubmitting) {
            setShowProPlanModal(false);
            setUpgradeError(null);
          }
        }}
        onContinue={(productId) => handleUpgradeToPro(productId)}
        submitting={upgradeSubmitting}
        submitError={upgradeError}
      />
      </div>
  );
};

