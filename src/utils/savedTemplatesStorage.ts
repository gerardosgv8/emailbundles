/**
 * Utility functions for user-specific saved templates storage
 * Smart Storage System - monitors usage and enforces limits
 * Now supports tier-based limits (Starter, Standard, Pro)
 */

import { getTierStorageLimits, UserTier } from './userTiers';

// Type definitions
export interface TemplateComponent {
  id: string;
  componentId: string;
  html: string; // Required - full HTML stored
  order: number;
  backgroundColor?: string;
  visible?: boolean; // Component visibility (default: true)
}

export interface TemplateData {
  id: string;
  name: string;
  components: TemplateComponent[];
  createdAt: string;
  updatedAt: string;
  /** Embedded in generated HTML (preview/export); omitted on legacy saves → adaptive. */
  themeCssMode?: 'adaptive' | 'light-only';
}

// Legacy storage limits (for backward compatibility - defaults to Standard tier)
export const STORAGE_LIMITS = {
  MAX_TEMPLATES: 30, // Maximum templates per user (Standard tier default)
  MAX_STORAGE_BYTES: 5 * 1024 * 1024, // 5 MB (Standard tier default)
  WARNING_THRESHOLD: 0.8, // Warn at 80% capacity
  CRITICAL_THRESHOLD: 0.9, // Critical at 90% capacity
};

export interface StorageInfo {
  templatesCount: number;
  storageUsed: number; // bytes
  storageUsedMB: number;
  storageLimitMB: number;
  storagePercentage: number;
  templatesRemaining: number;
  isWarning: boolean;
  isCritical: boolean;
  isAtLimit: boolean;
}

/**
 * Get the storage key for saved templates based on user ID
 * @param userId - The user ID (number or string)
 * @returns The storage key string
 */
export function getSavedTemplatesKey(userId?: number | string | null): string {
  if (!userId) {
    // For non-authenticated users, use a default key
    // This allows anonymous users to save templates temporarily
    return 'composedTemplates_anonymous';
  }
  return `composedTemplates_${userId}`;
}

/**
 * Get saved templates for a specific user
 * @param userId - The user ID
 * @returns Array of saved templates
 */
export function getSavedTemplates(userId?: number | string | null): TemplateData[] {
  try {
    const key = getSavedTemplatesKey(userId);
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading saved templates:', error);
    return [];
  }
}

/**
 * Calculate storage size of templates
 * @param templates - Array of templates
 * @returns Size in bytes
 */
export function calculateTemplatesSize(templates: any[]): number {
  try {
    const jsonString = JSON.stringify(templates);
    return new Blob([jsonString]).size;
  } catch (error) {
    console.error('Error calculating templates size:', error);
    return 0;
  }
}

/**
 * Get storage information for a user (with tier support)
 * @param userId - The user ID
 * @param userTier - The user's tier (starter, standard, pro)
 * @returns Storage information object
 */
export function getStorageInfo(userId?: number | string | null, userTier?: UserTier | string | null): StorageInfo {
  const templates = getSavedTemplates(userId);
  const storageUsed = calculateTemplatesSize(templates);
  const storageUsedMB = storageUsed / (1024 * 1024);
  
  // Get tier-based limits
  const tierLimits = getTierStorageLimits(userTier);
  const storageLimitMB = tierLimits.maxStorageMB;
  const maxStorageBytes = tierLimits.maxStorageBytes;
  const maxTemplates = tierLimits.maxTemplates;
  
  // Handle cases where tier doesn't allow saving (maxTemplates = 0)
  if (maxTemplates === 0 || maxStorageBytes === 0) {
    return {
      templatesCount: templates.length,
      storageUsed,
      storageUsedMB,
      storageLimitMB: 0,
      storagePercentage: 0,
      templatesRemaining: 0,
      isWarning: false,
      isCritical: false,
      isAtLimit: true, // At limit because saving is not allowed
    };
  }
  
  const storagePercentage = (storageUsed / maxStorageBytes) * 100;
  const templatesCount = templates.length;
  const templatesRemaining = maxTemplates - templatesCount;
  
  return {
    templatesCount,
    storageUsed,
    storageUsedMB,
    storageLimitMB,
    storagePercentage,
    templatesRemaining,
    isWarning: storagePercentage >= tierLimits.warningThreshold * 100 || templatesCount >= maxTemplates * tierLimits.warningThreshold,
    isCritical: storagePercentage >= tierLimits.criticalThreshold * 100 || templatesCount >= maxTemplates * tierLimits.criticalThreshold,
    isAtLimit: templatesCount >= maxTemplates || storagePercentage >= 100,
  };
}

/**
 * Check if a new template can be saved (with tier support)
 * @param userId - The user ID
 * @param userTier - The user's tier (starter, standard, pro)
 * @param newTemplateSize - Estimated size of the new template in bytes (optional)
 * @returns Object with canSave flag and reason if cannot save
 */
export function canSaveTemplate(
  userId?: number | string | null,
  userTier?: UserTier | string | null,
  newTemplateSize?: number
): { canSave: boolean; reason?: string } {
  const storageInfo = getStorageInfo(userId, userTier);
  const tierLimits = getTierStorageLimits(userTier);
  
  // Check template count limit
  if (storageInfo.templatesCount >= tierLimits.maxTemplates) {
    return {
      canSave: false,
      reason: `You've reached the maximum limit of ${tierLimits.maxTemplates} templates for your tier. Please delete some templates or upgrade your plan to save new ones.`,
    };
  }
  
  // Check storage limit
  const estimatedNewSize = newTemplateSize || 0;
  const estimatedTotalSize = storageInfo.storageUsed + estimatedNewSize;
  const estimatedPercentage = (estimatedTotalSize / tierLimits.maxStorageBytes) * 100;
  
  if (estimatedPercentage > 100) {
    return {
      canSave: false,
      reason: `Not enough storage space. You're using ${storageInfo.storageUsedMB.toFixed(2)} MB of ${storageInfo.storageLimitMB} MB. Please delete some templates or upgrade your plan to free up space.`,
    };
  }
  
  return { canSave: true };
}

/**
 * Save templates for a specific user with storage validation (with tier support)
 * @param userId - The user ID
 * @param templates - Array of templates to save
 * @param userTier - The user's tier (starter, standard, pro)
 * @throws Error if storage limit would be exceeded
 */
export function saveTemplates(
  userId: number | string | null | undefined,
  templates: any[],
  userTier?: UserTier | string | null
): void {
  try {
    const tierLimits = getTierStorageLimits(userTier);
    
    // Validate before saving
    if (templates.length > tierLimits.maxTemplates) {
      throw new Error(`Cannot save more than ${tierLimits.maxTemplates} templates for your tier.`);
    }
    
    const newSize = calculateTemplatesSize(templates);
    if (newSize > tierLimits.maxStorageBytes) {
      throw new Error(`Template data exceeds storage limit of ${tierLimits.maxStorageMB.toFixed(2)} MB for your tier.`);
    }
    
    const key = getSavedTemplatesKey(userId);
    localStorage.setItem(key, JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving templates:', error);
    throw error;
  }
}

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}


