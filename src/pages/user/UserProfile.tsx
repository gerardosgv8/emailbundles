import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Shield, FileText, HardDrive, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { getSavedEmailsSupabase } from '../../services/savedEmailsSupabase';
import { getSavedTemplatesSupabase, getStorageInfoSupabase } from '../../services/savedTemplatesSupabase';
import { formatBytes } from '../../utils/savedEmailsStorage';
import { getTierStorageLimits, getTierCapabilities } from '../../utils/userTiers';

export const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const { tier, hasCapability } = useUserTier();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmails: 0,
    totalTemplates: 0,
    templateCount: 0,
    maxTemplates: 0,
    templateStorageUsed: 0,
    templateStorageLimit: 0,
    recentEmails: [] as any[],
    recentTemplates: [] as any[],
  });

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id, tier]);

  const loadProfileData = async () => {
    try {
      setLoading(true);

      let recentEmails: any[] = [];
      let totalEmails = 0;

      if (hasCapability('canSaveEmails')) {
        const savedEmails = await getSavedEmailsSupabase(user!.id);
        totalEmails = savedEmails.length;
        recentEmails = savedEmails
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);
      }

      // Load template stats if user can save templates
      let templateStats = {
        totalTemplates: 0,
        storageUsed: 0,
        storageLimit: 0,
        templateCount: 0,
        maxTemplates: 0,
        recentTemplates: [] as any[],
      };

      if (hasCapability('canSaveTemplates')) {
        const savedTemplates = await getSavedTemplatesSupabase(user!.id);
        const templateStorageInfo = await getStorageInfoSupabase(user!.id, tier);
        const tierCapabilities = getTierCapabilities(tier);
        
        const recentTemplates = savedTemplates
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);

        templateStats = {
          totalTemplates: savedTemplates.length,
          storageUsed: templateStorageInfo.storageUsedMB,
          storageLimit: templateStorageInfo.maxStorageMB,
          templateCount: templateStorageInfo.templatesCount,
          maxTemplates: tierCapabilities.maxTemplates || 0,
          recentTemplates,
        };
      }

      setStats({
        totalEmails,
        totalTemplates: templateStats.totalTemplates,
        templateCount: templateStats.templateCount || 0,
        maxTemplates: templateStats.maxTemplates || 0,
        templateStorageUsed: templateStats.storageUsed,
        templateStorageLimit: templateStats.storageLimit,
        recentEmails,
        recentTemplates: templateStats.recentTemplates,
      });
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-200';
      case 'standard':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            My Profile
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account information</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <User className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          My Profile
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">View your account information and activity</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-300 text-2xl font-bold">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user?.username}</h3>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getTierBadgeColor(tier || 'standard')}`}>
                {tier || 'standard'}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Member since {user?.created_at ? formatDate(user.created_at) : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>User ID: {user?.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hasCapability('canSaveEmails') && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/60 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Emails</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalEmails}</p>
          </div>
        )}

        {hasCapability('canSaveTemplates') && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/60 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Template Storage</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.templateCount} / {stats.maxTemplates}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              templates
            </p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full"
                style={{ width: `${stats.maxTemplates > 0 ? Math.min((stats.templateCount / stats.maxTemplates) * 100, 100) : 0}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasCapability('canSaveEmails') && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Recent Emails
              </h3>
            </div>
            {stats.recentEmails.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-8">No emails yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentEmails.map((email) => (
                  <div key={email.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{email.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Updated {formatDate(email.updatedAt)}
                      </p>
                    </div>
                    <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {hasCapability('canSaveTemplates') && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Recent Templates
              </h3>
            </div>
            {stats.recentTemplates.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-8">No templates yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{template.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Updated {formatDate(template.updatedAt)}
                      </p>
                    </div>
                    <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
