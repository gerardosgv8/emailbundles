/**
 * User Tier System
 * Defines tiers, capabilities, and limits for Starter, Standard, and Pro users
 */

export type UserTier = 'standard' | 'pro';

export interface TierCapabilities {
  maxTemplates: number;
  maxStorageMB: number;
  maxStorageBytes: number;
  canDownloadTemplateBundle: boolean;
  canUseEmailBuilder: boolean;
  canUseTemplateComposer: boolean;
  canSaveTemplates: boolean;
  canSaveEmails: boolean; // Only Pro tier can save emails
  supportLevel: 'email' | 'priority';
}

export interface TierDefinition {
  name: string;
  displayName: string;
  description: string;
  capabilities: TierCapabilities;
}

/**
 * Tier definitions with capabilities
 */
export const TIER_DEFINITIONS: Record<UserTier, TierDefinition> = {
  standard: {
    name: 'standard',
    displayName: 'Standard',
    description: 'Access to downloaded template bundle and email builder with default template base',
    capabilities: {
      maxTemplates: 0, // Standard tier cannot save templates
      maxStorageMB: 0,
      maxStorageBytes: 0,
      canDownloadTemplateBundle: true,
      canUseEmailBuilder: true,
      canUseTemplateComposer: false,
      canSaveTemplates: false,
      canSaveEmails: false, // Standard tier cannot save emails
      supportLevel: 'email',
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Access to template composer and saving templates (10 limit)',
    capabilities: {
      maxTemplates: 10,
      maxStorageMB: 5,
      maxStorageBytes: 5 * 1024 * 1024, // 5 MB
      canDownloadTemplateBundle: true,
      canUseEmailBuilder: true,
      canUseTemplateComposer: true,
      canSaveTemplates: true,
      canSaveEmails: true, // Pro tier can save emails
      supportLevel: 'priority',
    },
  },
};

/**
 * Get tier definition by tier name
 */
export function getTierDefinition(tier: UserTier | string | null | undefined): TierDefinition {
  const normalizedTier = (tier?.toLowerCase()?.trim() || 'standard') as UserTier;
  // If tier is 'starter' (legacy), default to 'standard'
  const validTier = normalizedTier === 'starter' ? 'standard' : normalizedTier;
  return TIER_DEFINITIONS[validTier] || TIER_DEFINITIONS.standard;
}

/**
 * Get capabilities for a user tier
 */
export function getTierCapabilities(tier: UserTier | string | null | undefined): TierCapabilities {
  return getTierDefinition(tier).capabilities;
}

/**
 * Check if a user has a specific capability
 */
export function hasCapability(
  tier: UserTier | string | null | undefined,
  capability: keyof TierCapabilities
): boolean {
  const capabilities = getTierCapabilities(tier);
  return capabilities[capability] === true;
}

/**
 * Get storage limits for a tier
 */
export function getTierStorageLimits(tier: UserTier | string | null | undefined) {
  const capabilities = getTierCapabilities(tier);
  return {
    maxTemplates: capabilities.maxTemplates,
    maxStorageMB: capabilities.maxStorageMB,
    maxStorageBytes: capabilities.maxStorageBytes,
    warningThreshold: 0.8, // 80%
    criticalThreshold: 0.9, // 90%
  };
}

/**
 * Check if user can perform an action based on tier
 */
export function canPerformAction(
  tier: UserTier | string | null | undefined,
  action: keyof TierCapabilities
): boolean {
  return hasCapability(tier, action);
}

/**
 * Get upgrade suggestions based on current usage
 */
export function getUpgradeSuggestion(
  tier: UserTier | string | null | undefined,
  currentTemplates: number,
  currentStorageMB: number
): { needsUpgrade: boolean; suggestedTier: UserTier | null; reason: string } {
  const currentCapabilities = getTierCapabilities(tier);
  
  // Check if user is at or near limits
  const templatesAtLimit = currentCapabilities.maxTemplates > 0 && currentTemplates >= currentCapabilities.maxTemplates * 0.9;
  const storageAtLimit = currentCapabilities.maxStorageMB > 0 && currentStorageMB >= currentCapabilities.maxStorageMB * 0.9;
  
  if (tier === 'standard') {
    // Standard users can upgrade to Pro for template composer and saving
    return {
      needsUpgrade: true,
      suggestedTier: 'pro',
      reason: 'Upgrade to Pro to access Template Composer and save templates.',
    };
  } else if (tier === 'pro') {
    if (templatesAtLimit || storageAtLimit) {
      return {
        needsUpgrade: false,
        suggestedTier: null,
        reason: templatesAtLimit
          ? 'You\'ve reached your template limit of 10 templates.'
          : 'You\'re running low on storage.',
      };
    }
  }
  
  return {
    needsUpgrade: false,
    suggestedTier: null,
    reason: '',
  };
}

/**
 * Compare tiers - returns 1 if tier1 > tier2, -1 if tier1 < tier2, 0 if equal
 */
export function compareTiers(tier1: UserTier | string | null, tier2: UserTier | string | null): number {
  const tierOrder: Record<UserTier, number> = {
    standard: 1,
    pro: 2,
  };
  
  // Handle legacy 'starter' tier as 'standard'
  const normalizeTier = (t: string | null): UserTier => {
    if (!t) return 'standard';
    const lower = t.toLowerCase();
    return lower === 'starter' ? 'standard' : (lower as UserTier);
  };
  
  const normalized1 = normalizeTier(tier1);
  const normalized2 = normalizeTier(tier2);
  
  const order1 = tierOrder[normalized1] || 0;
  const order2 = tierOrder[normalized2] || 0;
  
  return order1 - order2;
}

