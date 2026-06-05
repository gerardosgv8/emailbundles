import React, { useState, useEffect } from 'react';
import { Settings, Shield, Bell, CreditCard, Trash2, ArrowUp, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { getTierDefinition, TIER_DEFINITIONS, UserTier } from '../../utils/userTiers';
import { ProPlanUpgradeModal } from '../../components/user/ProPlanUpgradeModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const UserSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { tier, hasCapability } = useUserTier();
  const [loading, setLoading] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<UserTier>('standard');
  const [updatingTier, setUpdatingTier] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showProPlanModal, setShowProPlanModal] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewalEligible, setRenewalEligible] = useState(false);

  useEffect(() => {
    // Initialize email_optin from user data
    // If user.email_optin is explicitly false, set to false
    // If user.email_optin is true or undefined, set to true (default)
    if (user) {
      const optInValue = user.email_optin !== undefined ? user.email_optin : true;
      setEmailOptIn(optInValue);
      
      // Initialize selected tier from user data
      const userTier = (user.tier as UserTier) || 'standard';
      setSelectedTier(userTier);
    } else {
      // Default to true if no user data yet
      setEmailOptIn(true);
      setSelectedTier('standard');
    }
  }, [user]);

  // Check renewal eligibility
  useEffect(() => {
    const checkRenewalEligibility = async () => {
      if (!user?.subscription_expiration_date) {
        setRenewalEligible(false);
        return;
      }

      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`http://localhost:3002/api/subscriptions/renewal-eligibility`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRenewalEligible(data.eligible);
        }
      } catch (err) {
        console.error('Error checking renewal eligibility:', err);
      }
    };

    checkRenewalEligibility();
  }, [user]);

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800/60';
      case 'standard':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800/60';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-800';
    }
  };

  const handleEmailOptInToggle = async (checked: boolean) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

        const response = await fetch(`${API_BASE_URL}/api/users/me/email-optin?email_optin=${checked}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Update local state immediately
        setEmailOptIn(checked);
        setSuccess('Email preference updated successfully');
        
        // Refresh user data from API to ensure sync
        try {
          await refreshUser();
        } catch {
          // Not critical - local state is already updated
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to update email preference');
        // Revert toggle on error
        setEmailOptIn(!checked);
      }
    } catch (err: any) {
      console.error('Error updating email opt-in:', err);
      setError('Failed to update email preference. Please try again.');
      // Revert toggle on error
      setEmailOptIn(!checked);
    } finally {
      setSaving(false);
    }
  };

  const handleTierUpdate = async (newTier: UserTier) => {
    if (newTier === tier) {
      return; // No change needed
    }

    try {
      setUpdatingTier(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`http://localhost:3002/api/users/me/tier?tier=${newTier}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTier(newTier);
        setSuccess(`Subscription tier updated to ${newTier} successfully`);
        
        // Refresh user data from API to ensure sync
        try {
          await refreshUser();
        } catch {
          /* ignore */
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to update subscription tier');
        // Revert selection on error
        setSelectedTier(tier as UserTier || 'standard');
      }
    } catch (err: any) {
      console.error('Error updating tier:', err);
      setError('Failed to update subscription tier. Please try again.');
      // Revert selection on error
      setSelectedTier(tier as UserTier || 'standard');
    } finally {
      setUpdatingTier(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (tier !== 'pro') {
      setError('You can only cancel a Pro subscription.');
      return;
    }

    try {
      setCancelling(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      // Use the new cancel subscription endpoint
      const response = await fetch(`http://localhost:3002/api/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'Subscription cancelled successfully. You will retain access until your expiration date.');
        setShowCancelConfirm(false);
        
        // Refresh user data from API to ensure sync
        try {
          await refreshUser();
        } catch {
          /* ignore */
        }
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const handleUpgradeToPro = async (productId: string) => {
    if (tier === 'pro') {
      setError('You are already on Pro tier.');
      return;
    }

    try {
      setUpgrading(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_id: productId }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.payment_required && data.checkout_url) {
          setShowProPlanModal(false);
          window.location.href = data.checkout_url;
        } else {
          setShowProPlanModal(false);
          setSuccess('Subscription upgraded to Pro successfully');
          await refreshUser();
          setTimeout(() => setSuccess(null), 5000);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const d = errorData.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(' ')
              : 'Failed to initiate upgrade';
        setError(msg);
      }
    } catch (err: any) {
      console.error('Error upgrading subscription:', err);
      setError('Failed to upgrade subscription. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      setRenewing(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      // Call renewal endpoint to get payment link
      const response = await fetch(`http://localhost:3002/api/subscriptions/renew`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.checkout_url) {
          // Redirect to Stripe checkout
          window.location.href = data.checkout_url;
        } else {
          setError('No checkout URL received');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to initiate renewal');
      }
    } catch (err: any) {
      console.error('Error renewing subscription:', err);
      setError('Failed to renew subscription. Please try again.');
    } finally {
      setRenewing(false);
    }
  };

  // Calculate days until expiration
  const getDaysUntilExpiration = (): number | null => {
    if (!user?.subscription_expiration_date) return null;
    const expirationDate = new Date(user.subscription_expiration_date);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Format expiration date
  const formatExpirationDate = (): string | null => {
    if (!user?.subscription_expiration_date) return null;
    const expirationDate = new Date(user.subscription_expiration_date);
    return expirationDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Get subscription status badge color
  const getStatusBadgeColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/45 dark:text-green-200 dark:border-green-800/60';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/45 dark:text-red-200 dark:border-red-800/60';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/45 dark:text-yellow-200 dark:border-yellow-800/60';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Settings className="w-7 h-7 text-blue-600" />
            Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your preferences and account settings</p>
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
          <Settings className="w-7 h-7 text-blue-600" />
          Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your preferences and account settings</p>
      </div>

      {/* Account Information */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Account Information</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-gray-900 dark:text-gray-100">
                {user?.username}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md text-gray-900 dark:text-gray-100">
                {user?.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Tier</label>
              <div className={`px-4 py-2 border rounded-md inline-block ${getTierBadgeColor(tier || 'standard')}`}>
                <span className="font-semibold capitalize">{tier || 'standard'}</span>
              </div>
            </div>
          </div>

          {/* Subscription Renewal Disclaimer */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-800/70">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Subscription Renewal Policy</h4>
                <p className="text-sm text-blue-700 dark:text-blue-200/90">
                  Your subscription will run for one year without auto-renewal. Within 30 days prior to the expiration date, you can renew your subscription to continue using the product and its features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription & Tier */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Subscription & Tier</h3>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Tier</span>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getTierBadgeColor(tier || 'standard')}`}>
                {tier || 'standard'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2 mt-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscription Status</span>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeColor(user?.subscription_status)}`}>
                {user?.subscription_status || 'active'}
              </span>
            </div>
            {/* Subscription Days Counter - Always show for both standard and pro users */}
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-800/60">
              {user?.subscription_expiration_date ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expiration Date</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatExpirationDate()}</span>
                      <button
                        onClick={handleRenewSubscription}
                        disabled={renewing || !renewalEligible}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={renewalEligible ? "Renew subscription" : "Renewal available when subscription expires in less than 20 days"}
                      >
                        <RefreshCw className={`w-3 h-3 ${renewing ? 'animate-spin' : ''}`} />
                        <span>Update</span>
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const daysRemaining = getDaysUntilExpiration();
                    if (daysRemaining !== null) {
                      if (daysRemaining <= 0) {
                        return (
                          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
                            <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                              <span className="text-xl font-bold text-red-600 dark:text-red-400">0</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-800 dark:text-red-200">Subscription Expired</p>
                              <p className="text-xs text-red-600 dark:text-red-300/90">
                                {tier === 'pro' 
                                  ? 'Please renew to continue using premium features'
                                  : 'Please renew to continue using your subscription features'}
                              </p>
                            </div>
                          </div>
                        );
                      } else if (daysRemaining <= 30) {
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/35 dark:border-yellow-800/60">
                              <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/45 rounded-full flex items-center justify-center">
                                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-300">{daysRemaining}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                                  {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'} Remaining
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-300/85">Your subscription will expire soon</p>
                              </div>
                            </div>
                            {/* Show renewal button when < 20 days */}
                            {renewalEligible && daysRemaining < 20 && (
                              <button
                                onClick={handleRenewSubscription}
                                disabled={renewing}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                              >
                                {renewing ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Processing...</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowUp className="w-4 h-4" />
                                    <span>Renew {tier === 'pro' ? 'Pro' : 'Standard'} Subscription</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/35 dark:border-green-900/60">
                            <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/45 rounded-full flex items-center justify-center">
                              <span className="text-xl font-bold text-green-700 dark:text-green-300">{daysRemaining}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                                {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'} Remaining
                              </p>
                              <p className="text-xs text-green-600 dark:text-green-300/85">Your subscription is active</p>
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-600 dark:text-gray-400">∞</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Lifetime Subscription</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Your subscription has no expiration date</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {tier === 'pro' 
                ? 'You have access to all features including template saving and unlimited storage.'
                : 'Upgrade to Pro to get access to the template builder.'}
            </p>
          </div>

          {/* Tier Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Update Subscription Tier</label>
            <div className="space-y-3">
              {Object.values(TIER_DEFINITIONS).map((tierDef) => {
                const isCurrentTier = tier === tierDef.name;
                const isSelected = selectedTier === tierDef.name;
                const tierCapabilities = tierDef.capabilities;
                
                return (
                  <div
                    key={tierDef.name}
                    className={`p-4 border-2 rounded-lg cursor-default transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 dark:bg-gray-900/30'
                    } ${isCurrentTier ? 'ring-2 ring-green-400 dark:ring-green-500/70' : ''}`}
                    onClick={() => {
                      // Subscription is included for all users; tier selection is disabled.
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{tierDef.displayName}</h4>
                          {isCurrentTier && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{tierDef.description}</p>
                        
                        {/* Tier Features */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${tierCapabilities.canSaveTemplates ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            <span className="text-gray-600 dark:text-gray-400">
                              {tierCapabilities.canSaveTemplates ? 'Save Templates' : 'No Template Saving'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${tierCapabilities.canUseTemplateComposer ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            <span className="text-gray-600 dark:text-gray-400">
                              {tierCapabilities.canUseTemplateComposer ? 'Template Composer' : 'No Composer'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${tierCapabilities.canSaveEmails ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            <span className="text-gray-600 dark:text-gray-400">
                              {tierCapabilities.canSaveEmails ? 'Save Emails' : 'No Email Saving'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${tierCapabilities.maxTemplates > 0 ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                            <span className="text-gray-600 dark:text-gray-400">
                              {tierCapabilities.maxTemplates > 0 
                                ? `${tierCapabilities.maxTemplates} Templates Max`
                                : 'No Template Limit'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && !isCurrentTier && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // If upgrading from standard to pro, use upgrade flow
                            if (tier === 'standard' && tierDef.name === 'pro') {
                              setError(null);
                              setShowProPlanModal(true);
                            } else {
                              handleTierUpdate(tierDef.name as UserTier);
                            }
                          }}
                          disabled={updatingTier || upgrading}
                          className="ml-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {(updatingTier || upgrading) ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>{tier === 'standard' && tierDef.name === 'pro' ? 'Processing...' : 'Updating...'}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUp className="w-4 h-4" />
                              <span>{tier === 'standard' && tierDef.name === 'pro' ? 'Upgrade to Pro' : `Update to ${tierDef.displayName}`}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
                <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-line">{error}</p>
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/35 dark:border-green-900/60">
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            )}

            <ProPlanUpgradeModal
              open={showProPlanModal}
              onClose={() => {
                if (!upgrading) {
                  setShowProPlanModal(false);
                  setError(null);
                }
              }}
              onContinue={(productId) => handleUpgradeToPro(productId)}
              submitting={upgrading}
              submitError={error}
            />
          </div>

          {/* Current Capabilities */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Your Current Capabilities</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasCapability('canSaveEmails') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Save Emails</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasCapability('canSaveTemplates') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Save Templates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasCapability('canUseEmailBuilder') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Email Builder</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasCapability('canUseTemplateComposer') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Template Composer</span>
              </div>
            </div>
          </div>

          {/* Cancel Subscription (for Pro users only) */}
          {false && (
            <div className="mt-6 pt-6 border-t border-red-200">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">Cancel Subscription</h4>
                    <p className="text-sm text-red-700 dark:text-red-200/90 mb-4">
                      Cancelling your Pro subscription will mark it as cancelled. You will retain access until your expiration date ({formatExpirationDate() || 'N/A'}), then you will lose access to:
                    </p>
                    <ul className="text-sm text-red-700 dark:text-red-200/90 list-disc list-inside mb-4 space-y-1">
                      <li>Email Builder</li>
                      <li>Template Composer</li>
                      <li>All saved templates and emails will remain viewable</li>
                    </ul>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancelling || updatingTier}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Pro Subscription
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancelled Subscription Info */}
          {user?.subscription_status === 'cancelled' && (
            <div className="mt-6 pt-6 border-t border-yellow-200 dark:border-yellow-900/40">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/35 dark:border-yellow-800/60">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Subscription Cancelled</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200/90 mb-2">
                      Your subscription has been cancelled. You will retain access until {formatExpirationDate() || 'your expiration date'}.
                    </p>
                    {(() => {
                      const daysRemaining = getDaysUntilExpiration();
                      if (daysRemaining !== null && daysRemaining > 0) {
                        return (
                          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} of access remaining
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expired Subscription Warning */}
          {false && (
            <div className="mt-6 pt-6 border-t border-red-200">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">Subscription Expired</h4>
                    <p className="text-sm text-red-700 dark:text-red-200/90 mb-4">
                      Your subscription has expired. You can still view your saved emails and templates, but you cannot use the Email Builder or Template Composer.
                    </p>
                    <button
                      onClick={handleRenewSubscription}
                      disabled={renewing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {renewing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="w-4 h-4" />
                          <span>Renew {tier === 'pro' ? 'Pro' : 'Standard'} Subscription</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Cancel Pro Subscription?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to cancel your Pro subscription? Your subscription will remain active until {formatExpirationDate() || 'your expiration date'}, then you will lose access to Pro features.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 dark:bg-yellow-950/35 dark:border-yellow-800/60">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">After expiration, you will lose:</p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-200/90 list-disc list-inside space-y-1">
                    <li>Access to Email Builder</li>
                    <li>Access to Template Composer</li>
                    <li>Ability to create new content</li>
                    <li className="text-green-700 dark:text-green-300 font-medium">✓ Your saved emails and templates will remain viewable</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Pro Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Yes, Cancel Subscription</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preferences</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Marketing Emails</label>
              <p className="text-xs text-gray-500 dark:text-gray-500">Receive product updates and tips</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={emailOptIn === true}
                onChange={(e) => {
                  handleEmailOptInToggle(e.target.checked);
                }}
                disabled={saving}
              />
              <div className={`w-11 h-6 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600/40 transition-colors ${
                emailOptIn ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className={`absolute top-[2px] left-[2px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-full h-5 w-5 transition-transform ${
                  emailOptIn ? 'translate-x-full' : 'translate-x-0'
                }`}></div>
              </div>
            </label>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/35 dark:border-green-900/60">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-red-200 dark:border-red-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Danger Zone</h3>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/35 dark:border-red-900/60">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Delete Account</p>
            <p className="text-xs text-red-700 dark:text-red-200/85 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
