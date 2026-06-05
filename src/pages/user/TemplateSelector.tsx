import React, { useState, useEffect } from 'react';
import { Mail, Loader2, FileText, Plus, Inbox } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { templateService, TemplateListItem } from '../../services/templateService';
import { getSavedTemplates } from '../../utils/savedTemplatesStorage';
import { getSavedEmails, convertSavedEmailToTemplate } from '../../utils/savedEmailsStorage';

interface SavedTemplate {
  id: string;
  name: string;
  components: any[];
  createdAt: string;
  updatedAt: string;
}

export const TemplateSelector: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasCapability, tier } = useUserTier();

  const canSaveTemplates = hasCapability('canSaveTemplates');
  const isAdmin = location.pathname.startsWith('/gestion');
  const canUseTemplateComposer = hasCapability('canUseTemplateComposer');
  const canSaveEmails = hasCapability('canSaveEmails');
  const isPro = tier === 'pro';
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [savedEmails, setSavedEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'saved' | 'saved-emails'>('templates');

  useEffect(() => {
    loadTemplates();
    if (isAdmin || canSaveTemplates) {
      loadSavedTemplates();
    } else {
      setSavedTemplates([]);
    }
    if (user?.id && canSaveEmails) {
      loadSavedEmails();
    } else {
      setSavedEmails([]);
    }
  }, [user, isAdmin, canSaveEmails, canSaveTemplates, tier]);

  useEffect(() => {
    if (activeTab === 'saved-emails' && !canSaveEmails) {
      setActiveTab('templates');
    }
    if (activeTab === 'saved' && !isAdmin && !canSaveTemplates) {
      setActiveTab('templates');
    }
  }, [activeTab, canSaveEmails, canSaveTemplates, isAdmin]);

  // Reload saved emails and templates when component comes into focus (e.g., when navigating back)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id && canSaveEmails) loadSavedEmails();
      else setSavedEmails([]);
      if (isAdmin || canSaveTemplates) loadSavedTemplates();
      else setSavedTemplates([]);
    };
    
    // Also listen for storage events to sync when templates are saved in other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes('composedTemplates')) {
        loadSavedTemplates();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, canSaveEmails, canSaveTemplates, isAdmin]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templateList = await templateService.getTemplateList();
      // Filter out master_template for non-admin users
      // Check both isAdmin (from path) and user.is_admin/user.user_type for admin detection
      const isUserAdmin = user?.is_admin || user?.user_type === 'admin';
      const shouldShowMasterTemplate = isAdmin || isUserAdmin;
      const filteredTemplates = shouldShowMasterTemplate
        ? templateList 
        : templateList.filter(template => template.id !== 'master_template');
      setTemplates(filteredTemplates);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedTemplates = async () => {
    if (!user?.id) {
      setSavedTemplates([]);
      return;
    }

    try {
      // Try Supabase first (same logic as SavedTemplates.jsx)
      try {
        const { getSavedTemplatesSupabase } = await import('../../services/savedTemplatesSupabase');
        const saved = await getSavedTemplatesSupabase(user.id);
        // Sort by updated date (newest first)
        const sorted = saved.sort((a: SavedTemplate, b: SavedTemplate) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSavedTemplates(sorted);
      } catch {
        // Fallback to localStorage
        const saved = getSavedTemplates(user.id);
        // Sort by updated date (newest first)
        const sorted = saved.sort((a: SavedTemplate, b: SavedTemplate) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSavedTemplates(sorted);
      }
    } catch (error) {
      console.error('Error loading saved templates:', error);
      setSavedTemplates([]);
    }
  };

  const loadSavedEmails = async () => {
    try {
      if (user?.id) {
        try {
          // Try Supabase first
          const { getSavedEmailsSupabase } = await import('../../services/savedEmailsSupabase');
          const saved = await getSavedEmailsSupabase(user.id);
          // Sort by updated date (newest first)
          const sorted = saved.sort((a: any, b: any) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setSavedEmails(sorted);
        } catch {
          // Fallback to localStorage
          const saved = getSavedEmails(user.id);
          const sorted = saved.sort((a: any, b: any) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          setSavedEmails(sorted);
        }
      } else {
        // Fallback if no user ID
        const saved = getSavedEmails(user?.id);
        const sorted = saved.sort((a: any, b: any) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setSavedEmails(sorted);
      }
    } catch (error) {
      console.error('Error loading saved emails:', error);
      setSavedEmails([]);
    }
  };

  const handleTemplateSelect = (template: TemplateListItem) => {
    // Generate session ID
    const sessionId = user 
      ? templateService.generateUserSessionId(user.id)
      : templateService.generateSessionId();
    
    // Navigate to builder with template ID
    // Admin uses /gestion/email-builder/:templateId
    // User uses /user/builder/:templateId/:sessionId
    if (isAdmin) {
      navigate(`/gestion/email-builder/${template.id}`);
    } else {
      const path = templateService.getTemplatePath(template.id, sessionId);
      navigate(`/user/${path}`);
    }
  };

  const handleSavedTemplateSelect = (template: SavedTemplate, event?: React.MouseEvent) => {
    // Check if user wants to edit in composer (right-click or ctrl/cmd+click) or open in builder (normal click)
    const openInComposer = event?.ctrlKey || event?.metaKey || event?.button === 2;
    const basePath = isAdmin ? '/gestion' : '/user';

    if (openInComposer) {
      // Navigate to template composer to edit the saved template
      navigate(`${basePath}/template-composer/${template.id}`);
    } else {
      // Navigate to template builder to edit with full element editing capabilities
      if (isAdmin) {
        // Admin route doesn't use sessionId
        navigate(`${basePath}/email-builder/${template.id}`);
      } else {
        const sessionId = user
          ? templateService.generateUserSessionId(user.id)
          : templateService.generateSessionId();
        navigate(`${basePath}/builder/${template.id}/${sessionId}`);
      }
    }
  };

  const handleCreateNewTemplate = () => {
    const basePath = isAdmin ? '/gestion' : '/user';
    navigate(`${basePath}/template-composer`);
  };

  const handleSavedEmailSelect = (email: any) => {
    const basePath = isAdmin ? '/gestion' : '/user';
    navigate(`${basePath}/email-builder/${email.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Mail className="w-7 h-7 text-blue-600" />
              Email Builder
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Choose a template to get started</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 dark:bg-red-950/35 dark:border-red-900/60">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Error Loading Templates</h3>
          <p className="text-red-700 dark:text-red-200/90">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Mail className="w-7 h-7 text-blue-600" />
            Email Builder
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Choose a template to get started</p>
        </div>
        {(isAdmin || (isPro && canUseTemplateComposer)) && (
          <button
            onClick={handleCreateNewTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
          }`}
        >
          <Mail className="w-4 h-4 inline mr-2" />
          Email Templates
        </button>
        {(isAdmin || (isPro && canUseTemplateComposer)) && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            My Template Library ({savedTemplates.length})
          </button>
        )}
        {user?.id && canSaveEmails && (
          <button
            onClick={() => setActiveTab('saved-emails')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              activeTab === 'saved-emails'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
            }`}
          >
            <Inbox className="w-4 h-4 inline mr-2" />
            Saved Emails ({savedEmails.length})
          </button>
        )}
      </div>
      {user?.id && canSaveEmails && (
        <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          <Link
            to={`${isAdmin ? '/gestion' : '/user'}/email-library`}
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Open full Saved Emails library →
          </Link>
          <span className="mx-2">·</span>
          <span>Manage, preview, duplicate, and delete emails in one place.</span>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleTemplateSelect(template)}
              >
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden">
                  {template.previewThumbUrl ? (
                    <img
                      src={template.previewThumbUrl}
                      alt={template.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <Mail className="w-16 h-16 text-blue-600 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {template.category}
                    </span>
                    <span className="text-blue-600 font-medium text-sm group-hover:underline">
                      Start Building →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
              <div className="text-center">
                <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Templates Available
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Check back soon for new email templates.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Template Library Tab */}
      {activeTab === 'saved' && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={(e) => handleSavedTemplateSelect(template, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleSavedTemplateSelect(template, e);
                }}
                title="Click to edit in Builder | Right-click or Ctrl+Click to edit in Composer"
              >
                <div className="aspect-video bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                  <FileText className="w-16 h-16 text-green-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {template.components.length} component{template.components.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Updated: {new Date(template.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-green-600 font-medium text-sm group-hover:underline">
                      Edit Template →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {savedTemplates.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Templates in Library Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first template to get started.
                </p>
                <button
                  onClick={handleCreateNewTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Template
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Saved Emails Tab */}
      {activeTab === 'saved-emails' && user?.id && canSaveEmails && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedEmails.map((email) => (
              <div
                key={email.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handleSavedEmailSelect(email)}
              >
                <div className="aspect-video bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
                  <Inbox className="w-16 h-16 text-purple-600 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {email.name}
                  </h3>
                  {email.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {email.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Updated: {new Date(email.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="text-purple-600 font-medium text-sm group-hover:underline">
                      {isAdmin || canSaveEmails ? 'Edit Email →' : 'Open →'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {savedEmails.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
              <div className="text-center">
                <Inbox className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Saved Emails
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {isAdmin || canSaveEmails
                    ? 'Save emails from the Email Builder to see them here.'
                    : 'Upgrade to Pro to save emails to your library. You can still use the Email Builder to export HTML.'}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

