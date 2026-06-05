/**
 * Supabase Service for Storage Reports
 * Gets storage data for all users from Supabase
 */

import { supabase } from './supabase-client';
import { UserTier, getTierStorageLimits } from '../utils/userTiers';

export interface UserStorageData {
  userId: number;
  templatesCount: number;
  storageUsed: number;
  storageUsedMB: number;
  storageLimitMB: number;
  storagePercentage: number;
  templatesRemaining: number;
  isWarning: boolean;
  isCritical: boolean;
  isAtLimit: boolean;
  tier?: string;
}

export interface StorageSummary {
  totalUsers: number;
  totalTemplates: number;
  totalStorageUsed: number;
  totalStorageUsedMB: number;
  averageStoragePerUser: number;
  averageTemplatesPerUser: number;
  usersAtWarning: number;
  usersAtCritical: number;
  usersAtLimit: number;
}

/**
 * Get storage data for all users from Supabase
 */
export async function getAllUsersStorageData(): Promise<UserStorageData[]> {
  try {
    // Get distinct user_ids and their template counts/storage
    const { data, error } = await supabase
      .from('saved_templates')
      .select('user_id, storage_size')
      .order('user_id');

    if (error) {
      console.error('Error fetching storage data:', error);
      throw error;
    }

    // Group by user_id and calculate totals
    const userStorageMap = new Map<number, { templatesCount: number; storageUsed: number }>();

    (data || []).forEach((row: any) => {
      const userId = row.user_id;
      const storageSize = row.storage_size || 0;

      if (!userStorageMap.has(userId)) {
        userStorageMap.set(userId, { templatesCount: 0, storageUsed: 0 });
      }

      const userData = userStorageMap.get(userId)!;
      userData.templatesCount++;
      userData.storageUsed += storageSize;
    });

    // Get user tiers from users table
    // Note: We'll fetch user tiers separately if needed
    // For now, we'll default to 'standard' and let the caller override
    
    // Convert to array format
    const result: UserStorageData[] = Array.from(userStorageMap.entries()).map(([userId, data]) => {
      // Default tier - caller should provide actual tier
      const defaultTier: UserTier = 'standard';
      const tierLimits = getTierStorageLimits(defaultTier);
      const storageUsedMB = data.storageUsed / (1024 * 1024);
      const storageLimitMB = tierLimits.maxStorageMB;
      const storagePercentage = storageLimitMB > 0 ? (storageUsedMB / storageLimitMB) * 100 : 0;
      
      // Calculate limits based on tier
      const templatesAtLimit = tierLimits.maxTemplates === 0 
        ? true 
        : tierLimits.maxTemplates > 0 && data.templatesCount >= tierLimits.maxTemplates;
      const storageAtLimit = storageLimitMB > 0 && storageUsedMB > 0 && storageUsedMB >= storageLimitMB;
      const isAtLimit = templatesAtLimit || storageAtLimit;

      return {
        userId,
        templatesCount: data.templatesCount,
        storageUsed: data.storageUsed,
        storageUsedMB,
        storageLimitMB,
        storagePercentage,
        templatesRemaining: tierLimits.maxTemplates > 0 
          ? Math.max(0, tierLimits.maxTemplates - data.templatesCount)
          : Infinity,
        isWarning: storagePercentage >= 80 && storageUsedMB > 0,
        isCritical: storagePercentage >= 90 && storageUsedMB > 0,
        isAtLimit,
        tier: defaultTier,
      };
    });

    return result;
  } catch (error) {
    console.error('Error in getAllUsersStorageData:', error);
    throw error;
  }
}

/**
 * Get storage summary for all users
 */
export async function getStorageSummary(): Promise<StorageSummary> {
  try {
    const userData = await getAllUsersStorageData();
    
    const totalUsers = userData.length;
    const totalTemplates = userData.reduce((sum, user) => sum + user.templatesCount, 0);
    const totalStorageUsed = userData.reduce((sum, user) => sum + user.storageUsed, 0);
    const totalStorageUsedMB = totalStorageUsed / (1024 * 1024);
    const averageStoragePerUser = totalUsers > 0 ? totalStorageUsedMB / totalUsers : 0;
    const averageTemplatesPerUser = totalUsers > 0 ? totalTemplates / totalUsers : 0;
    const usersAtWarning = userData.filter(u => u.isWarning && !u.isCritical && !u.isAtLimit).length;
    const usersAtCritical = userData.filter(u => u.isCritical && !u.isAtLimit).length;
    const usersAtLimit = userData.filter(u => u.isAtLimit).length;

    return {
      totalUsers,
      totalTemplates,
      totalStorageUsed,
      totalStorageUsedMB,
      averageStoragePerUser,
      averageTemplatesPerUser,
      usersAtWarning,
      usersAtCritical,
      usersAtLimit,
    };
  } catch (error) {
    console.error('Error in getStorageSummary:', error);
    throw error;
  }
}

/**
 * Get storage data for a specific user
 */
export async function getUserStorageData(userId: number, userTier: UserTier = 'standard'): Promise<UserStorageData> {
  try {
    const { getStorageInfoSupabase } = await import('./savedTemplatesSupabase');
    const storageInfo = await getStorageInfoSupabase(userId, userTier);
    
    return {
      userId,
      templatesCount: storageInfo.templatesCount,
      storageUsed: storageInfo.storageUsed,
      storageUsedMB: storageInfo.storageUsedMB,
      storageLimitMB: storageInfo.storageLimitMB,
      storagePercentage: storageInfo.storagePercentage,
      templatesRemaining: storageInfo.templatesRemaining,
      isWarning: storageInfo.isWarning,
      isCritical: storageInfo.isCritical,
      isAtLimit: storageInfo.isAtLimit,
      tier: userTier,
    };
  } catch (error) {
    console.error('Error in getUserStorageData:', error);
    throw error;
  }
}

