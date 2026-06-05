import React, { useState, useEffect } from 'react';
import { Database, HardDrive, FileText, AlertTriangle, TrendingUp, RefreshCw, Download } from 'lucide-react';
import { getStorageInfo, formatBytes, STORAGE_LIMITS, getSavedTemplates } from '../../utils/savedTemplatesStorage';
import { getTierStorageLimits, getTierDefinition, UserTier } from '../../utils/userTiers';
import { useAuth } from '../../context/AuthContext';
import { getUserTier } from '../../services/userService';

interface UserStorageData {
  userId: string | number;
  templatesCount: number;
  storageUsed: number;
  storageUsedMB: number;
  storagePercentage: number;
  templatesRemaining: number;
  isWarning: boolean;
  isCritical: boolean;
  isAtLimit: boolean;
  templates: any[];
  tier?: string; // User tier (starter, standard, pro)
  tierLimits?: {
    maxTemplates: number;
    maxStorageMB: number;
  };
}

interface StorageSummary {
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

export const AdminStorageReport: React.FC = () => {
  const { token } = useAuth();
  const [userStorageData, setUserStorageData] = useState<UserStorageData[]>([]);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'userId' | 'storage' | 'templates' | 'tier'>('storage');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadStorageData();
  }, [token]);

  const loadStorageData = async () => {
    setLoading(true);
    try {
      const allStorageData: UserStorageData[] = [];
      
      // Try Supabase first
      try {
        const { getAllUsersStorageData } = await import('../../services/storageReportSupabase');
        const supabaseData = await getAllUsersStorageData();
        
        // Get user tiers from backend API
        const userIds = supabaseData.map(u => u.userId);
        
        // Fetch user tiers in parallel
        const userTiersMap = new Map<number, string>();
        if (token) {
          await Promise.all(
            userIds.map(async (userId) => {
              try {
                const tier = await getUserTier(userId, token) || 'standard';
                userTiersMap.set(userId, tier);
              } catch (err) {
                console.warn(`Failed to get tier for user ${userId}, defaulting to standard:`, err);
                userTiersMap.set(userId, 'standard');
              }
            })
          );
        } else {
          // Default all to standard if no token
          userIds.forEach(userId => userTiersMap.set(userId, 'standard'));
        }
        
        // Enhance Supabase data with user tiers and limits
        const { getStorageInfoSupabase } = await import('../../services/savedTemplatesSupabase');
        
        for (const userData of supabaseData) {
          const userTier = userTiersMap.get(userData.userId) || 'standard';
          const tierLimits = getTierStorageLimits(userTier as UserTier);
          
          // Recalculate with correct tier
          try {
            const storageInfo = await getStorageInfoSupabase(userData.userId, userTier as UserTier);
            
            allStorageData.push({
              userId: String(userData.userId),
              templatesCount: storageInfo.templatesCount,
              storageUsed: storageInfo.storageUsed,
              storageUsedMB: storageInfo.storageUsedMB,
              storagePercentage: storageInfo.storagePercentage,
              templatesRemaining: storageInfo.templatesRemaining,
              isWarning: storageInfo.isWarning,
              isCritical: storageInfo.isCritical,
              isAtLimit: storageInfo.isAtLimit,
              templates: [], // We don't need full template data for the report
              tier: userTier,
              tierLimits: {
                maxTemplates: tierLimits.maxTemplates,
                maxStorageMB: tierLimits.maxStorageMB,
              },
            });
          } catch (error) {
            console.error(`Error loading storage info for user ${userData.userId}:`, error);
            // Use data from Supabase query as fallback
            allStorageData.push({
              userId: String(userData.userId),
              templatesCount: userData.templatesCount,
              storageUsed: userData.storageUsed,
              storageUsedMB: userData.storageUsedMB,
              storagePercentage: userData.storagePercentage,
              templatesRemaining: userData.templatesRemaining,
              isWarning: userData.isWarning,
              isCritical: userData.isCritical,
              isAtLimit: userData.isAtLimit,
              templates: [],
              tier: userTier,
              tierLimits: {
                maxTemplates: tierLimits.maxTemplates,
                maxStorageMB: tierLimits.maxStorageMB,
              },
            });
          }
        }
        
        console.log('✅ Storage data loaded from Supabase:', allStorageData.length, 'users');
      } catch (supabaseError) {
        console.warn('⚠️ Failed to load from Supabase, falling back to localStorage:', supabaseError);
        
        // Fallback to localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('composedTemplates_')) {
          const userId = key.replace('composedTemplates_', '');
          if (userId === 'anonymous') continue;
          
          try {
            let userTier: string | null = 'standard';
            if (token && !isNaN(Number(userId))) {
              try {
                userTier = await getUserTier(Number(userId), token) || 'standard';
              } catch (err) {
                userTier = 'standard';
              }
            }
            
            const tierLimits = getTierStorageLimits(userTier);
            const storageInfo = getStorageInfo(userId, userTier);
            const templates = getSavedTemplates(userId);
            
            allStorageData.push({
              userId,
              templatesCount: storageInfo.templatesCount,
              storageUsed: storageInfo.storageUsed,
              storageUsedMB: storageInfo.storageUsedMB,
              storagePercentage: storageInfo.storagePercentage,
              templatesRemaining: storageInfo.templatesRemaining,
              isWarning: storageInfo.isWarning,
              isCritical: storageInfo.isCritical,
              isAtLimit: storageInfo.isAtLimit,
              templates,
              tier: userTier || 'standard',
              tierLimits: {
                maxTemplates: tierLimits.maxTemplates,
                maxStorageMB: tierLimits.maxStorageMB,
              },
            });
          } catch (error) {
            console.error(`Error loading storage for user ${userId}:`, error);
            }
          }
        }
      }
      
      // Calculate summary
      const totalUsers = allStorageData.length;
      const totalTemplates = allStorageData.reduce((sum, user) => sum + user.templatesCount, 0);
      const totalStorageUsed = allStorageData.reduce((sum, user) => sum + user.storageUsed, 0);
      const totalStorageUsedMB = totalStorageUsed / (1024 * 1024);
      const averageStoragePerUser = totalUsers > 0 ? totalStorageUsedMB / totalUsers : 0;
      const averageTemplatesPerUser = totalUsers > 0 ? totalTemplates / totalUsers : 0;
      const usersAtWarning = allStorageData.filter(u => u.isWarning && !u.isCritical && !u.isAtLimit).length;
      const usersAtCritical = allStorageData.filter(u => u.isCritical && !u.isAtLimit).length;
      const usersAtLimit = allStorageData.filter(u => u.isAtLimit).length;
      
      setSummary({
        totalUsers,
        totalTemplates,
        totalStorageUsed,
        totalStorageUsedMB,
        averageStoragePerUser,
        averageTemplatesPerUser,
        usersAtWarning,
        usersAtCritical,
        usersAtLimit,
      });
      
      // Sort data
      const sorted = [...allStorageData].sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'storage') {
          comparison = a.storageUsed - b.storageUsed;
        } else if (sortBy === 'templates') {
          comparison = a.templatesCount - b.templatesCount;
        } else if (sortBy === 'tier') {
          const tierOrder: Record<string, number> = { standard: 1, pro: 2 };
          const tierA = tierOrder[a.tier || 'standard'] || 0;
          const tierB = tierOrder[b.tier || 'standard'] || 0;
          comparison = tierA - tierB;
        } else {
          comparison = String(a.userId).localeCompare(String(b.userId));
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      
      setUserStorageData(sorted);
    } catch (error) {
      console.error('Error loading storage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'userId' | 'storage' | 'templates') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary,
      users: userStorageData.map(user => ({
        userId: user.userId,
        templatesCount: user.templatesCount,
        storageUsedMB: user.storageUsedMB,
        storagePercentage: user.storagePercentage,
        status: user.isAtLimit ? 'At Limit' : user.isCritical ? 'Critical' : user.isWarning ? 'Warning' : 'Normal',
      })),
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Loading storage data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Storage Report</h2>
          <p className="text-gray-600 mt-1">Monitor template storage usage across all users</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStorageData}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Templates</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalTemplates}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: {summary.averageTemplatesPerUser.toFixed(1)} per user
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Storage Used</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalStorageUsedMB.toFixed(2)} MB</p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: {summary.averageStoragePerUser.toFixed(2)} MB per user
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Users at Risk</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-red-600">{summary.usersAtLimit}</span>
                  <span className="text-xs text-gray-500">at limit</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-orange-600">{summary.usersAtCritical}</span>
                  <span className="text-xs text-gray-500">critical</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-yellow-600">{summary.usersAtWarning}</span>
                  <span className="text-xs text-gray-500">warning</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Limits Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Tier-Based Access & Limits</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <strong>Standard:</strong> Template bundle download, Email builder (no template saving)
              </p>
              <p>
                <strong>Pro:</strong> Template composer, Save templates ({getTierStorageLimits('pro').maxTemplates} templates, {getTierStorageLimits('pro').maxStorageMB} MB)
              </p>
              <p className="mt-2 text-xs">
                Warnings appear at {STORAGE_LIMITS.WARNING_THRESHOLD * 100}% capacity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* User Storage Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">User Storage Details</h3>
        </div>
        
        {userStorageData.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No user storage data found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('userId')}
                  >
                    User ID
                    {sortBy === 'userId' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('templates')}
                  >
                    Templates
                    {sortBy === 'templates' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('storage')}
                  >
                    Storage Used
                    {sortBy === 'storage' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('tier')}
                  >
                    Tier
                    {sortBy === 'tier' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStorageData.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>{user.templatesCount} / {user.tierLimits?.maxTemplates || STORAGE_LIMITS.MAX_TEMPLATES}</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              user.isAtLimit
                                ? 'bg-red-500'
                                : user.isCritical
                                ? 'bg-orange-500'
                                : user.isWarning
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${(user.templatesCount / (user.tierLimits?.maxTemplates || STORAGE_LIMITS.MAX_TEMPLATES)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.storageUsedMB.toFixed(2)} MB / {user.tierLimits?.maxStorageMB || STORAGE_LIMITS.MAX_STORAGE_BYTES / (1024 * 1024)} MB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                        user.tier === 'pro'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.tier || 'standard'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              user.isAtLimit
                                ? 'bg-red-500'
                                : user.isCritical
                                ? 'bg-orange-500'
                                : user.isWarning
                                ? 'bg-yellow-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${user.storagePercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{user.storagePercentage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isAtLimit
                            ? 'bg-red-100 text-red-800'
                            : user.isCritical
                            ? 'bg-orange-100 text-orange-800'
                            : user.isWarning
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.isAtLimit
                          ? 'At Limit'
                          : user.isCritical
                          ? 'Critical'
                          : user.isWarning
                          ? 'Warning'
                          : 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

