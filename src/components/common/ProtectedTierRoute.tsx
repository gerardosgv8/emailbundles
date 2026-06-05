import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { Lock } from 'lucide-react';

interface ProtectedTierRouteProps {
  children: React.ReactNode;
  requiredCapability: keyof ReturnType<typeof import('../../utils/userTiers').getTierCapabilities>;
  fallbackPath?: string;
}

/**
 * Route protection based on user tier capabilities
 */
export const ProtectedTierRoute: React.FC<ProtectedTierRouteProps> = ({
  children,
  requiredCapability,
  fallbackPath = '/user',
}) => {
  const { isAuthenticated, user } = useAuth();
  const { hasCapability, tierDefinition } = useUserTier();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admins use tier "standard" in /me but should not be blocked on tier-gated tools if they reach this route.
  if (user?.is_admin || user?.user_type === 'admin') {
    return <>{children}</>;
  }

  if (!hasCapability(requiredCapability)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Lock className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Feature Not Available</h2>
          <p className="text-gray-600 mb-4">
            This feature is not available in your current plan ({tierDefinition.displayName}).
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please upgrade your plan to access this feature.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

