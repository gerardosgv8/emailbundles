import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Edit2, Trash2, Eye, FileText, Plus, Calendar, Mail, Copy, PenSquare, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserTier } from '../../hooks/useUserTier';
import { getSavedEmails, deleteEmail, getEmailStorageInfo, formatBytes, EMAIL_STORAGE_LIMITS, convertSavedEmailToTemplate, duplicateEmail, saveEmail, emailNameExists, getSavedEmail } from '../../utils/savedEmailsStorage';
import { removeFooterSocialIcons } from '../../utils/removeFooterSocialIcons';
import { injectDarkModeMediaQueries } from '../../utils/injectDarkModeMediaQueries';
import { SuccessModal } from '../../components/common/SuccessModal';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

export function EmailLibrary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = location.pathname.startsWith('/gestion');
  const { hasCapability } = useUserTier();
  const canSaveEmails = hasCapability('canSaveEmails');
  const canMutateSavedEmails = isAdmin || canSaveEmails;
  const [emails, setEmails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [renameEmail, setRenameEmail] = useState(null); // Email being renamed
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, type: 'success', message: '', title: '' });
  const [deleteConfirmState, setDeleteConfirmState] = useState({ isOpen: false, emailId: null, isBulk: false, count: 0, emailIds: [] });
  const [isDeleting, setIsDeleting] = useState(false);

  // Load saved emails whenever we land on this route, user changes, or tab regains focus (after saving in builder).
  useEffect(() => {
    if (user?.id) {
      loadEmails();
    } else {
      setEmails([]);
      setStorageInfo(null);
    }
  }, [user?.id, location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      if (user?.id && document.visibilityState === 'visible') loadEmails();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user?.id]);

  const loadEmails = async () => {
    try {
      if (user?.id) {
        try {
          // Try Supabase first
          const { getSavedEmailsSupabase, getEmailStorageInfoSupabase } = await import('../../services/savedEmailsSupabase');
          const savedEmails = await getSavedEmailsSupabase(user.id);
          const sorted = savedEmails.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          setEmails(sorted);
          
          // Update storage info
          const info = await getEmailStorageInfoSupabase(user.id);
          setStorageInfo(info);
          console.log('✅ Emails loaded from Supabase');
        } catch (supabaseError) {
          console.warn('⚠️ Failed to load emails from Supabase, using localStorage:', supabaseError);
          // Fallback to localStorage
          const savedEmails = getSavedEmails(user.id);
          const sorted = savedEmails.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          setEmails(sorted);
          
          const info = getEmailStorageInfo(user.id);
          setStorageInfo(info);
        }
      } else {
        // Fallback if no user ID
        const savedEmails = getSavedEmails(user?.id);
        const sorted = savedEmails.sort((a, b) => 
          new Date(b.updatedAt) - new Date(a.updatedAt)
        );
        setEmails(sorted);
        
        const info = getEmailStorageInfo(user?.id);
        setStorageInfo(info);
      }
    } catch (error) {
      console.error('Error loading saved emails:', error);
      setEmails([]);
    }
  };

  const handleDelete = (emailId) => {
    setDeleteConfirmState({
      isOpen: true,
      emailId,
      isBulk: false,
      count: 1,
      emailIds: [emailId],
    });
  };

  const confirmDelete = async () => {
    const { emailId, isBulk, count, emailIds } = deleteConfirmState;
    if (!emailId && !isBulk) return;

    setIsDeleting(true);
    try {
      if (isBulk) {
        // Bulk delete
        const idsToDelete = emailIds.length > 0 ? emailIds : Array.from(selectedEmails);
        if (user?.id) {
          try {
            // Try Supabase first
            const { deleteEmailSupabase } = await import('../../services/savedEmailsSupabase');
            await Promise.all(
              idsToDelete.map(id => 
                deleteEmailSupabase(user.id, id)
              )
            );
            console.log('✅ Emails deleted from Supabase:', idsToDelete.length);
          } catch (supabaseError) {
            console.warn('⚠️ Failed to delete emails from Supabase, trying localStorage:', supabaseError);
            // Fallback to localStorage
            idsToDelete.forEach(id => {
              deleteEmail(user.id, id);
            });
          }
        } else {
          idsToDelete.forEach(id => {
            deleteEmail(user?.id, id);
          });
        }
        setSelectedEmails(new Set());
        setSelectMode(false);
        loadEmails();
        setModalState({
          isOpen: true,
          type: 'success',
          message: `${idsToDelete.length} email(s) deleted successfully!`,
          title: 'Emails Deleted',
        });
      } else {
        // Single delete
        if (user?.id) {
          try {
            // Try Supabase first
            const { deleteEmailSupabase } = await import('../../services/savedEmailsSupabase');
            await deleteEmailSupabase(user.id, emailId);
            console.log('✅ Email deleted from Supabase:', emailId);
          } catch (supabaseError) {
            console.warn('⚠️ Failed to delete email from Supabase, trying localStorage:', supabaseError);
            // Fallback to localStorage
            deleteEmail(user.id, emailId);
          }
        } else {
          deleteEmail(user?.id, emailId);
        }
        loadEmails();
        setModalState({
          isOpen: true,
          type: 'success',
          message: 'Email deleted successfully!',
          title: 'Email Deleted',
        });
      }
      setDeleteConfirmState({ isOpen: false, emailId: null, isBulk: false, count: 0, emailIds: [] });
    } catch (error) {
      console.error('Error deleting email:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: isBulk 
          ? 'Failed to delete emails. Please try again.'
          : 'Failed to delete email. Please try again.',
        title: 'Error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedEmails.size === 0) return;
    setDeleteConfirmState({
      isOpen: true,
      emailId: null,
      isBulk: true,
      count: selectedEmails.size,
      emailIds: Array.from(selectedEmails),
    });
  };

  const handleEdit = (email) => {
    // Navigate to email builder with the saved email
    const basePath = isAdmin ? '/gestion' : '/user';
    navigate(`${basePath}/email-builder/${email.id}`);
  };

  const handlePreview = (email) => {
    // Open preview in new window
    const template = convertSavedEmailToTemplate(email);
    const html = injectDarkModeMediaQueries(removeFooterSocialIcons(template.html));
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(html);
    previewWindow.document.close();
  };

  const handleDownloadHtml = async (e, emailId) => {
    e?.stopPropagation?.();
    if (!user?.id) return;
    try {
      let name = 'email';
      let html = '';
      try {
        const { getSavedEmailExportSupabase } = await import('../../services/savedEmailsSupabase');
        const exported = await getSavedEmailExportSupabase(emailId, user.id);
        if (exported) {
          name = exported.name;
          html = exported.html;
        }
      } catch (supabaseErr) {
        console.warn('Download: Supabase failed, trying localStorage', supabaseErr);
      }
      if (!html) {
        const local = getSavedEmail(user.id, emailId);
        if (local) {
          name = local.name;
          html = local.html || '';
        }
      }
      if (!html) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Could not load email HTML.',
          title: 'Download failed',
        });
        return;
      }
      const safeName = (name || 'email').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName || 'email'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'error',
        message: err?.message || 'Download failed.',
        title: 'Error',
      });
    }
  };

  const handleDuplicate = async (email) => {
    if (!canMutateSavedEmails) {
      setModalState({
        isOpen: true,
        type: 'warning',
        message: 'Duplicating saved emails requires Pro.',
        title: 'Pro feature',
      });
      return;
    }
    try {
      if (user?.id) {
        try {
          // Try Supabase first
          const { getSavedEmailSupabase, saveEmailSupabase, canSaveEmailSupabase } = await import('../../services/savedEmailsSupabase');
          
          // Check if can save
          const canSave = await canSaveEmailSupabase(user.id);
          if (!canSave.canSave) {
            throw new Error(canSave.reason || 'Cannot duplicate email. Storage limit reached.');
          }
          
          // Get original email
          const originalEmail = await getSavedEmailSupabase(user.id, email.id);
          if (!originalEmail) {
            throw new Error('Email not found.');
          }
          
          // Generate new ID and unique name
          const newId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          let newName = `${originalEmail.name.trim()} (Copy)`;
          let counter = 1;
          
          // Check name uniqueness
          const { emailNameExistsSupabase } = await import('../../services/savedEmailsSupabase');
          while (await emailNameExistsSupabase(user.id, newName)) {
            newName = `${originalEmail.name.trim()} (Copy ${counter})`;
            counter++;
          }
          
          // Create duplicate
          await saveEmailSupabase({
            ...originalEmail,
            id: newId,
            name: newName,
          }, user.id);
          
          console.log('✅ Email duplicated in Supabase:', newId);
        } catch (supabaseError) {
          console.warn('⚠️ Failed to duplicate email in Supabase, trying localStorage:', supabaseError);
          // Fallback to localStorage
          duplicateEmail(user.id, email.id);
        }
      } else {
        duplicateEmail(user?.id, email.id);
      }
      
      loadEmails();
      setModalState({
        isOpen: true,
        type: 'success',
        message: `Email "${email.name}" duplicated successfully!`,
        title: 'Email Duplicated',
      });
    } catch (error) {
      console.error('Error duplicating email:', error);
      setModalState({
        isOpen: true,
        type: 'error',
        message: error.message || 'Failed to duplicate email. Please try again.',
        title: 'Error',
      });
    }
  };

  const handleRename = (email) => {
    setRenameEmail(email);
    setRenameName(email.name);
    setRenameError(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameEmail || !renameName.trim()) {
      setRenameError('Email name cannot be empty.');
      return;
    }

    if (!canMutateSavedEmails) {
      setRenameError('Renaming saved emails requires Pro.');
      return;
    }

    if (!user?.id) {
      setRenameError('User ID is required. Please log in again.');
      return;
    }

    const trimmedName = renameName.trim();
    
    setIsRenaming(true);
    try {
      // Check if name already exists (excluding the current email)
      try {
        // Try Supabase first
        try {
          const { emailNameExistsSupabase } = await import('../../services/savedEmailsSupabase');
          const nameExists = await emailNameExistsSupabase(user.id, trimmedName, renameEmail.id);
          if (nameExists) {
            setRenameError(`An email with the name "${trimmedName}" already exists.`);
            setIsRenaming(false);
            return;
          }
        } catch (supabaseError) {
          console.warn('⚠️ Failed to check name in Supabase, trying localStorage:', supabaseError);
          // Fallback to localStorage
          if (emailNameExists(user.id, trimmedName, renameEmail.id)) {
            setRenameError(`An email with the name "${trimmedName}" already exists.`);
            setIsRenaming(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking email name:', error);
        // Continue anyway
      }

      // Get the current saved email and update
      try {
        // Try Supabase first
        try {
          const { getSavedEmailSupabase, saveEmailSupabase } = await import('../../services/savedEmailsSupabase');
          const savedEmail = await getSavedEmailSupabase(user.id, renameEmail.id);
          
          if (!savedEmail) {
            throw new Error('Email not found.');
          }

          // Update the email with new name
          await saveEmailSupabase({
            ...savedEmail,
            name: trimmedName,
          }, user.id);
          
          console.log('✅ Email renamed in Supabase:', renameEmail.id);
        } catch (supabaseError) {
          console.warn('⚠️ Failed to rename email in Supabase, trying localStorage:', supabaseError);
          // Fallback to localStorage
          const savedEmail = getSavedEmail(user.id, renameEmail.id);
          if (!savedEmail) {
            throw new Error('Email not found.');
          }

          saveEmail(user.id, {
            ...savedEmail,
            name: trimmedName,
          });
        }
      } catch (error) {
        throw error;
      }

      // Close modal and refresh list
      setRenameEmail(null);
      setRenameName('');
      setRenameError(null);
      loadEmails();
      setModalState({
        isOpen: true,
        type: 'success',
        message: `Email renamed to "${trimmedName}" successfully!`,
        title: 'Email Renamed',
      });
    } catch (error) {
      console.error('Error renaming email:', error);
      setRenameError(error?.message || 'Failed to rename email. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameEmail(null);
    setRenameName('');
    setRenameError(null);
  };

  const filteredEmails = emails.filter(email =>
    email.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (email.description && email.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Check if user is standard or pro tier (hide weight storage for these tiers)
  const userTier = (user?.tier?.toLowerCase() || 'standard');
  const isStandardOrPro = userTier === 'standard' || userTier === 'pro';

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Sign in required</h1>
          <p className="text-gray-600 dark:text-gray-400">Log in to view your saved emails.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Mail className="w-8 h-8 text-blue-600" />
            Saved Emails
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {canSaveEmails
              ? 'View, edit, and manage your saved emails'
              : 'View and download emails you saved while on Pro'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(isAdmin ? '/gestion/email-builder' : '/user/email-builder')}
          className="btn-cta btn-lg group flex items-center gap-2"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
          Create New Email
        </button>
      </div>

      {!canSaveEmails && !isAdmin && emails.length > 0 && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Your plan is Standard. You can open saved emails to preview and export HTML, but saving changes, renaming, duplicating, and deleting require Pro.
        </div>
      )}

      {/* Storage Info */}
      {storageInfo && canMutateSavedEmails && (
        <div className={`p-4 rounded-lg border ${
          storageInfo.isAtLimit
            ? 'bg-red-50 border-red-200 dark:bg-red-950/35 dark:border-red-800/80'
            : storageInfo.isWarning
            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800/80'
            : 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Storage Usage: {storageInfo.emailsCount} / {EMAIL_STORAGE_LIMITS.MAX_EMAILS} emails
              </p>
              {!isStandardOrPro && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {formatBytes(storageInfo.storageUsed)} / {formatBytes(EMAIL_STORAGE_LIMITS.MAX_STORAGE_BYTES)} used
                </p>
              )}
            </div>
            <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  storageInfo.isAtLimit 
                    ? 'bg-red-500' 
                    : storageInfo.isWarning 
                    ? 'bg-yellow-500' 
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storageInfo.storagePercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        {canMutateSavedEmails && selectMode && selectedEmails.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            className="btn-secondary btn-sm flex items-center gap-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedEmails.size})
          </button>
        )}
        {canMutateSavedEmails && (
          <button
            type="button"
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedEmails(new Set());
            }}
            className="btn-secondary btn-sm"
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
      </div>

      {/* Emails Grid */}
      {filteredEmails.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {searchQuery ? 'No emails found' : 'No saved emails yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchQuery
              ? 'Try adjusting your search terms'
              : canSaveEmails
                ? 'Create and save emails in the Email Builder to see them here'
                : 'Upgrade to Pro to save emails to your library, or open the Email Builder to export HTML without saving.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/gestion/email-builder' : '/user/email-builder')}
              className="btn-cta btn-lg"
            >
              {canSaveEmails ? 'Create Your First Email' : 'Open Email Builder'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmails.map((email) => (
            <div
              key={email.id}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{email.name}</h3>
                  {email.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{email.description}</p>
                  )}
                </div>
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(email.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedEmails);
                      if (e.target.checked) {
                        newSelected.add(email.id);
                      } else {
                        newSelected.delete(email.id);
                      }
                      setSelectedEmails(newSelected);
                    }}
                    className="ml-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mb-3">
                <Calendar className="w-3 h-3" />
                <span>Updated: {new Date(email.updatedAt).toLocaleDateString()}</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(email)}
                  className="flex-1 min-w-[6rem] btn-secondary btn-sm flex items-center justify-center gap-2 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title={canMutateSavedEmails ? 'Edit email' : 'Open in builder (preview / export)'}
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{canMutateSavedEmails ? 'Edit' : 'Open'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePreview(email)}
                  className="btn-secondary btn-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  title="Preview email"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDownloadHtml(e, email.id)}
                  className="btn-secondary btn-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  title="Download HTML"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </button>
                {!selectMode && canMutateSavedEmails && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRename(email)}
                      className="btn-secondary btn-sm flex items-center justify-center gap-2 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      title="Rename email"
                    >
                      <PenSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(email)}
                      className="btn-secondary btn-sm flex items-center justify-center gap-2 hover:bg-green-50 hover:text-green-600 transition-colors"
                      title="Duplicate email"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(email.id)}
                      className="btn-secondary btn-sm flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete email"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Email Dialog */}
      {renameEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000000] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 z-[1000001] relative">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Rename Email</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={renameName}
                  onChange={(e) => {
                    setRenameName(e.target.value);
                    setRenameError(null);
                  }}
                  placeholder="Enter email name"
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    renameError 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
                  }`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameSubmit();
                    } else if (e.key === 'Escape') {
                      handleRenameCancel();
                    }
                  }}
                />
                {renameError && (
                  <p className="mt-1 text-xs text-red-600">{renameError}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={handleRenameCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={isRenaming}
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={isRenaming || !renameName.trim() || !!renameError}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRenaming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Renaming...
                  </>
                ) : (
                  'Rename'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      <SuccessModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        type={modalState.type}
        message={modalState.message}
        title={modalState.title}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmState.isOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirmState({ isOpen: false, emailId: null, isBulk: false, count: 0, emailIds: [] });
          }
        }}
        onConfirm={confirmDelete}
        title={deleteConfirmState.isBulk ? 'Delete Multiple Emails' : 'Delete Email'}
        message={
          deleteConfirmState.isBulk
            ? `Are you sure you want to delete ${deleteConfirmState.count} email(s)? This action cannot be undone.`
            : 'Are you sure you want to delete this email? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isLoading={isDeleting}
      />
    </div>
  );
}
