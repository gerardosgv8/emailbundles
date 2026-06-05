import { useAuth } from '../context/AuthContext';
import { UserTier, getTierCapabilities, getTierDefinition, hasCapability, getTierStorageLimits } from '../utils/userTiers';

/**
 * Hook to access user tier information and capabilities
 */
export function useUserTier() {
  const { user } = useAuth();
  const raw = String(user?.tier ?? '')
    .toLowerCase()
    .trim();
  const userTier: UserTier =
    !raw || raw === 'starter' ? 'standard' : raw === 'pro' ? 'pro' : 'standard';

  return {
    tier: userTier,
    tierDefinition: getTierDefinition(userTier),
    capabilities: getTierCapabilities(userTier),
    storageLimits: getTierStorageLimits(userTier),
    hasCapability: (capability: keyof ReturnType<typeof getTierCapabilities>) => 
      hasCapability(userTier, capability),
  };
}

