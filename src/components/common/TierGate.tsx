import React, { ReactNode } from 'react';
import { Lock, Crown } from 'lucide-react';
import { useUserTier } from '../../hooks/useUserTier';
import { hasCapability, getTierDefinition, UserTier } from '../../utils/userTiers';

interface TierGateProps {
  capability: keyof ReturnType<typeof import('../../utils/userTiers').getTierCapabilities>;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  requiredTier?: UserTier;
  children: ReactNode;
}

/**
 * Component that gates features based on user tier capabilities
 */
export const TierGate: React.FC<TierGateProps> = ({
  capability,
  fallback,
  showUpgradePrompt = true,
  requiredTier,
  children,
}) => {
  const { tier, hasCapability: userHasCapability } = useUserTier();
  const hasAccess = userHasCapability(capability);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    const requiredTierDef = requiredTier ? getTierDefinition(requiredTier) : null;
    const currentTierDef = getTierDefinition(tier);
    
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-1">Feature Not Available</h3>
            <p className="text-sm text-yellow-800 mb-2">
              This feature is not available in your current plan ({currentTierDef.displayName}).
            </p>
            {requiredTierDef && (
              <p className="text-sm text-yellow-800">
                Upgrade to <strong>{requiredTierDef.displayName}</strong> to access this feature.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Hook to check if a feature is available
 */
export function useTierGate(capability: keyof ReturnType<typeof import('../../utils/userTiers').getTierCapabilities>) {
  const { hasCapability } = useUserTier();
  return hasCapability(capability);
}

