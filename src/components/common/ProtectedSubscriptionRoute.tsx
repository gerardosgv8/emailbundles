import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { isSubscriptionEndUtcPassed } from '../../utils/subscriptionDates';

interface ProtectedSubscriptionRouteProps {
  children: React.ReactNode;
}

export const ProtectedSubscriptionRoute: React.FC<ProtectedSubscriptionRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admins always have access
  if (user?.is_admin) {
    return <>{children}</>;
  }

  // Check subscription status
  const subscriptionStatus = user?.subscription_status || 'active';
  const expirationDate = user?.subscription_expiration_date;

  if (expirationDate && !isSubscriptionEndUtcPassed(expirationDate)) {
    return <>{children}</>;
  }

  const isExpired = Boolean(expirationDate && isSubscriptionEndUtcPassed(expirationDate));

  const subscriptionEnded =
    (subscriptionStatus === 'expired' && isExpired) ||
    (subscriptionStatus === 'cancelled' && isExpired);

  if (subscriptionEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Expired</h2>
            <p className="text-gray-600 mb-6">
              Your Pro subscription has ended. Saving emails, the Template Composer, and your saved email and template libraries are only available with an active Pro plan. Renew to restore access to those features and your saved work.
            </p>
            <div className="space-y-3">
              <a
                href="/user/settings"
                className="block w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-center"
              >
                <CreditCard className="w-5 h-5 inline-block mr-2" />
                Go to Settings to Renew
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Allow access if active or cancelled but not expired
  return <>{children}</>;
};
