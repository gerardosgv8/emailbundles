import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Mail, FileText, Plus, Calendar, Edit2, Eye, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { getSavedEmails, getEmailStorageInfo, formatBytes, EMAIL_STORAGE_LIMITS } from '../../utils/savedEmailsStorage';
import { getSavedTemplates, getStorageInfo } from '../../utils/savedTemplatesStorage';
import { getTierStorageLimits } from '../../utils/userTiers';
import { ProPlanUpgradeModal } from '../../components/user/ProPlanUpgradeModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const UserOverview: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const { tier, hasCapability } = useUserTier();
  const canSaveEmails = hasCapability('canSaveEmails');
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [showProPlanModal, setShowProPlanModal] = useState(false);
  const [emailStats, setEmailStats] = useState({
    totalEmails: 0,
    storageUsed: 0,
    storageLimit: 0,
    storagePercentage: 0,
    recentEmails: [] as any[],
  });
  const [templateStats, setTemplateStats] = useState({
    totalTemplates: 0,
    storageUsed: 0,
    storageLimit: 0,
    storagePercentage: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user?.id, tier]);

  const loadDashboardData = async () => {
    try {
      const canTemplates = hasCapability('canSaveTemplates');

      if (canSaveEmails && user?.id) {
        try {
          const { getSavedEmailsSupabase, getEmailStorageInfoSupabase } = await import('../../services/savedEmailsSupabase');
          const savedEmails = await getSavedEmailsSupabase(user.id);
          const emailStorageInfo = await getEmailStorageInfoSupabase(user.id);

          const recentEmails = savedEmails
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);

          setEmailStats({
            totalEmails: savedEmails.length,
            storageUsed: emailStorageInfo.storageUsedMB,
            storageLimit: EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB,
            storagePercentage: emailStorageInfo.storagePercentage,
            recentEmails,
          });
          console.log('✅ Email stats loaded from Supabase');
        } catch (supabaseError) {
          console.warn('⚠️ Failed to load email stats from Supabase, using localStorage:', supabaseError);

          const savedEmails = getSavedEmails(user.id);
          const emailStorageInfo = getEmailStorageInfo(user.id);

          const recentEmails = savedEmails
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);

          setEmailStats({
            totalEmails: savedEmails.length,
            storageUsed: emailStorageInfo.storageUsedMB,
            storageLimit: EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB,
            storagePercentage: emailStorageInfo.storagePercentage,
            recentEmails,
          });
        }
      } else if (canSaveEmails) {
        const savedEmails = getSavedEmails(user?.id);
        const emailStorageInfo = getEmailStorageInfo(user?.id);

        const recentEmails = savedEmails
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);

        setEmailStats({
          totalEmails: savedEmails.length,
          storageUsed: emailStorageInfo.storageUsedMB,
          storageLimit: EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB,
          storagePercentage: emailStorageInfo.storagePercentage,
          recentEmails,
        });
      } else {
        setEmailStats({
          totalEmails: 0,
          storageUsed: 0,
          storageLimit: EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB,
          storagePercentage: 0,
          recentEmails: [],
        });
      }

      if (canTemplates && user?.id) {
        try {
          const { getSavedTemplatesSupabase, getStorageInfoSupabase } = await import('../../services/savedTemplatesSupabase');
          const savedTemplates = await getSavedTemplatesSupabase(user.id);
          const templateStorageInfo = await getStorageInfoSupabase(user.id, tier);

          setTemplateStats({
            totalTemplates: savedTemplates.length,
            storageUsed: templateStorageInfo.storageUsedMB,
            storageLimit: templateStorageInfo.storageLimitMB,
            storagePercentage: templateStorageInfo.storagePercentage,
          });
          console.log('✅ Template stats loaded from Supabase');
        } catch (supabaseError) {
          console.warn('⚠️ Failed to load template stats from Supabase, using localStorage:', supabaseError);

          const savedTemplates = getSavedTemplates(user.id);
          const templateStorageInfo = getStorageInfo(user.id, tier);

          setTemplateStats({
            totalTemplates: savedTemplates.length,
            storageUsed: templateStorageInfo.storageUsedMB,
            storageLimit: templateStorageInfo.storageLimitMB,
            storagePercentage: templateStorageInfo.storagePercentage,
          });
        }
      } else if (canTemplates) {
        const savedTemplates = getSavedTemplates(user?.id);
        const templateStorageInfo = getStorageInfo(user?.id, tier);

        setTemplateStats({
          totalTemplates: savedTemplates.length,
          storageUsed: templateStorageInfo.storageUsedMB,
          storageLimit: templateStorageInfo.storageLimitMB,
          storagePercentage: templateStorageInfo.storagePercentage,
        });
      } else {
        setTemplateStats({
          totalTemplates: 0,
          storageUsed: 0,
          storageLimit: 0,
          storagePercentage: 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToPro = async (productId: string) => {
    setUpgradeError(null);
    setUpgrading(true);
    try {
      if (!token) {
        setUpgradeError('Authentication required. Please log in again.');
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
          typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(' ') : 'Failed to initiate upgrade';
        throw new Error(msg);
      }

      if (data.payment_required && data.checkout_url) {
        setShowProPlanModal(false);
        window.location.href = data.checkout_url;
        return;
      }

      setShowProPlanModal(false);
      await refreshUser();
    } catch (err: any) {
      setUpgradeError(err?.message || 'Failed to upgrade subscription. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-blue-600" />
            Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your email templates and activity</p>
        </div>
        <Link
          to="/user/email-builder"
          className="btn-cta btn-lg group flex items-center gap-2"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
          Create New Email
        </Link>
      </div>

      {!canSaveEmails && !loading && emailStats.totalEmails === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between gap-4 dark:bg-yellow-950/35 dark:border-yellow-800/70">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Upgrade to Pro to save emails</p>
            <p className="text-xs text-yellow-800 dark:text-yellow-200/90">
              Use the Email Builder anytime; saving to your library is a Pro feature.
            </p>
            {upgradeError && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-2 whitespace-pre-line">{upgradeError}</p>
            )}
          </div>
          <button
            onClick={() => {
              setUpgradeError(null);
              setShowProPlanModal(true);
            }}
            disabled={upgrading}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {upgrading ? 'Processing...' : 'Upgrade to Pro'}
          </button>
        </div>
      )}

      <ProPlanUpgradeModal
        open={showProPlanModal}
        onClose={() => {
          if (!upgrading) {
            setShowProPlanModal(false);
            setUpgradeError(null);
          }
        }}
        onContinue={(productId) => handleUpgradeToPro(productId)}
        submitting={upgrading}
        submitError={upgradeError}
      />

      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {canSaveEmails && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/60 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Link
                    to="/user/email-library"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    View All
                  </Link>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {emailStats.totalEmails}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Saved Emails</p>
                <>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((emailStats.totalEmails / EMAIL_STORAGE_LIMITS.MAX_EMAILS) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {emailStats.totalEmails} / {EMAIL_STORAGE_LIMITS.MAX_EMAILS} emails
                  </p>
                </>
              </div>
            )}

            {hasCapability('canSaveTemplates') && (() => {
              const tierLimits = getTierStorageLimits(tier);
              const maxTemplates = tierLimits.maxTemplates;
              const templatePercentage =
                maxTemplates > 0 ? (templateStats.totalTemplates / maxTemplates) * 100 : 0;

              return (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-950/60 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <Link
                      to="/user/saved-templates"
                      className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
                    >
                      View All
                    </Link>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {templateStats.totalTemplates}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Saved Templates</p>
                  <>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(templatePercentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {templateStats.totalTemplates} / {maxTemplates} templates
                    </p>
                  </>
                </div>
              );
            })()}
          </div>

          {/* Recent Emails and Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {canSaveEmails && (
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    Recent Emails
                  </h3>
                  <Link
                    to="/user/email-library"
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    View All
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {emailStats.recentEmails.length === 0 ? (
                  <div className="text-center py-8">
                    <Mail className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">No saved emails yet</p>
                    <Link
                      to="/user/email-builder"
                      className="btn-cta btn-sm inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Email
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailStats.recentEmails.map((email) => (
                      <Link
                        key={email.id}
                        to={`/user/email-builder/${email.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600">
                            {email.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>Updated {new Date(email.updatedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              window.open('', '_blank')?.document.write(
                                email.html || '<p>No preview available</p>'
                              );
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <Edit2 className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div
              className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 ${
                canSaveEmails ? '' : 'lg:col-span-3'
              }`}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/user/email-builder"
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/45 dark:hover:bg-blue-900/55 border border-transparent dark:border-blue-900/40 transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">Create New Email</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Start building from scratch</p>
                  </div>
                </Link>
                {canSaveEmails && (
                  <Link
                    to="/user/email-library"
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent dark:border-gray-700 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-gray-600 dark:bg-gray-500 rounded-lg flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:text-gray-300">Saved Emails</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Open your email library</p>
                    </div>
                  </Link>
                )}
                {hasCapability('canUseTemplateComposer') && (
                  <Link
                    to="/user/template-composer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-950/45 dark:hover:bg-green-900/55 border border-transparent dark:border-green-900/40 transition-colors group"
                  >
                    <div className="w-10 h-10 bg-green-600 dark:bg-green-500 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400">Template Composer</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Build custom templates</p>
                    </div>
                  </Link>
                )}
                <Link
                  to="/user/components"
                  className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/45 dark:hover:bg-purple-900/55 border border-transparent dark:border-purple-900/40 transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-600 dark:bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">Components</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Browse component library</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

