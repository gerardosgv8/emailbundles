import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Calendar, Layout, CheckSquare, Square, Mail, RefreshCw, Trash2, Download } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useUserTier } from '../../hooks/useUserTier'
import { templateService } from '../../services/templateService'
import { getSavedTemplates, saveTemplates } from '../../utils/savedTemplatesStorage'
import { SuccessModal } from '../../components/common/SuccessModal'
import { ConfirmationModal } from '../../components/common/ConfirmationModal'

export function SavedTemplates() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasCapability } = useUserTier()
  const canSaveTemplates = hasCapability('canSaveTemplates')
  const canSaveEmails = hasCapability('canSaveEmails')
  const [templates, setTemplates] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplates, setSelectedTemplates] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [modalState, setModalState] = useState({ isOpen: false, type: 'success', message: '', title: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirmation, setDeleteConfirmation] = useState({ 
    isOpen: false, 
    templateId: null, 
    isBulk: false,
    count: 0 
  })
  const [isDeleting, setIsDeleting] = useState(false)

  // Load saved templates
  useEffect(() => {
    loadTemplates()
  }, [user])

  // Reload templates when component comes into focus (e.g., when navigating back)
  useEffect(() => {
    const handleFocus = () => {
      loadTemplates()
    }
    
    // Also listen for storage events to sync when templates are saved in other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key?.includes('composedTemplates')) {
        loadTemplates()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [user])

  const loadTemplates = async () => {
    if (!user?.id) {
      setIsLoading(false)
      setTemplates([])
      return
    }

    setIsLoading(true)
    try {
      // Try Supabase first
      const { getSavedTemplatesSupabase } = await import('../../services/savedTemplatesSupabase')
      const savedTemplates = await getSavedTemplatesSupabase(user.id)
      
      // Sort by updated date (newest first)
      const sorted = savedTemplates.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      setTemplates(sorted)
      console.log('✅ Templates loaded from Supabase:', sorted.length)
    } catch (error) {
      console.warn('⚠️ Failed to load templates from Supabase, falling back to localStorage:', error)
      
      // Fallback to localStorage
      try {
        const savedTemplates = getSavedTemplates(user.id)
        const sorted = savedTemplates.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        setTemplates(sorted)
        console.log('✅ Templates loaded from localStorage:', sorted.length)
      } catch (localError) {
        console.error('❌ Error loading templates from localStorage:', localError)
      setTemplates([])
    }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (templateId) => {
    // Find template name for better confirmation message
    const template = templates.find(t => t.id === templateId)
    const templateName = template?.name || 'this template'
    
    setDeleteConfirmation({
      isOpen: true,
      templateId: templateId,
      isBulk: false,
      count: 1
    })
  }

  const confirmDelete = async () => {
    const { templateId, isBulk } = deleteConfirmation
    
    if (!user?.id) {
      setModalState({
        isOpen: true,
        type: 'error',
        message: 'User ID is required. Please log in again.',
        title: 'Error',
      })
      setDeleteConfirmation({ isOpen: false, templateId: null, isBulk: false, count: 0 })
      return
    }

    setIsDeleting(true)

    try {
      if (isBulk) {
        // Bulk delete logic
        const count = selectedTemplates.size
        try {
          const { deleteTemplateSupabase } = await import('../../services/savedTemplatesSupabase')
          
          // Delete each template from Supabase
          const deletePromises = Array.from(selectedTemplates).map(id =>
            deleteTemplateSupabase(id, user.id)
          )
          await Promise.all(deletePromises)
          console.log(`✅ ${count} template(s) deleted from Supabase`)
        } catch (supabaseError) {
          console.warn('⚠️ Failed to delete from Supabase, trying localStorage:', supabaseError)
          
          // Fallback to localStorage
          const savedTemplates = getSavedTemplates(user.id)
          const filtered = savedTemplates.filter((t) => !selectedTemplates.has(t.id))
          saveTemplates(user.id, filtered)
        }

        // Reload templates
        await loadTemplates()
        
        setSelectedTemplates(new Set())
        setSelectMode(false)
      
        setModalState({
          isOpen: true,
          type: 'success',
          message: `${count} template${count !== 1 ? 's' : ''} deleted successfully!`,
          title: 'Templates Deleted',
        })
      } else {
        // Single delete logic
        try {
          const { deleteTemplateSupabase } = await import('../../services/savedTemplatesSupabase')
          await deleteTemplateSupabase(templateId, user.id)
          console.log('✅ Template deleted from Supabase:', templateId)
        } catch (supabaseError) {
          console.warn('⚠️ Failed to delete from Supabase, trying localStorage:', supabaseError)
          
          // Fallback to localStorage
          const savedTemplates = getSavedTemplates(user.id)
          const filtered = savedTemplates.filter((t) => t.id !== templateId)
          saveTemplates(user.id, filtered)
        }

        // Reload templates
        await loadTemplates()
        
        // Remove from selection if selected
        setSelectedTemplates(prev => {
          const newSet = new Set(prev)
          newSet.delete(templateId)
          return newSet
        })
      
        setModalState({
          isOpen: true,
          type: 'success',
          message: 'Template deleted successfully!',
          title: 'Template Deleted',
        })
      }
    } catch (error) {
      console.error('❌ Error deleting template:', error)
      setModalState({
        isOpen: true,
        type: 'error',
        message: `Failed to delete template: ${error?.message || 'Unknown error'}`,
        title: 'Error',
      })
    } finally {
      setIsDeleting(false)
      setDeleteConfirmation({ isOpen: false, templateId: null, isBulk: false, count: 0 })
    }
  }

  const handleBulkDelete = () => {
    const count = selectedTemplates.size
    if (count === 0) return
    
    setDeleteConfirmation({
      isOpen: true,
      templateId: null,
      isBulk: true,
      count: count
    })
  }

  const handleToggleSelect = (templateId) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateId)) {
        newSet.delete(templateId)
      } else {
        newSet.add(templateId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      setSelectedTemplates(new Set())
    } else {
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)))
    }
  }

  const handleToggleSelectMode = () => {
    setSelectMode(!selectMode)
    if (selectMode) {
      setSelectedTemplates(new Set())
    }
  }

  const handleEdit = (templateId) => {
    // Navigate to email builder (TemplateBuilder) with the saved template
    // Generate session ID
    const sessionId = user 
      ? templateService.generateUserSessionId(user.id)
      : templateService.generateSessionId()
    
    // Navigate to email builder with template and session IDs
    navigate(`/user/builder/${templateId}/${sessionId}`)
  }

  const handleCreateEmail = (templateId) => {
    // Navigate to email builder (TemplateBuilder) with the saved template to create an email
    // Generate session ID
    const sessionId = user 
      ? templateService.generateUserSessionId(user.id)
      : templateService.generateSessionId()
    
    // Navigate to email builder with template and session IDs
    navigate(`/user/builder/${templateId}/${sessionId}`)
  }

  const handleCreateNew = () => {
    // Navigate to template composer
    const path = window.location.pathname
    if (path.includes('/gestion')) {
      navigate('/gestion/template-composer')
    } else if (path.includes('/user')) {
      navigate('/user/template-composer')
    } else {
      // Default to user route if accessed from /saved-templates
      navigate('/user/template-composer')
    }
  }

  const handleDownloadHtml = async (e, templateId) => {
    e?.stopPropagation?.()
    if (!user?.id) return
    try {
      const { getSavedTemplateExportSupabase } = await import('../../services/savedTemplatesSupabase')
      const exported = await getSavedTemplateExportSupabase(templateId, user.id)
      if (!exported) {
        setModalState({
          isOpen: true,
          type: 'error',
          message: 'Could not load template HTML.',
          title: 'Download failed',
        })
        return
      }
      const safeName = (exported.name || 'template').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80)
      const blob = new Blob([exported.html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName || 'template'}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setModalState({
        isOpen: true,
        type: 'error',
        message: err?.message || 'Download failed.',
        title: 'Error',
      })
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="text-gray-900 dark:text-gray-100">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-gray-100 mb-2">Template Library</h1>
            <p className="text-secondary-600 dark:text-gray-400 text-lg">
              {canSaveTemplates
                ? 'Manage and edit your saved email templates'
                : 'View and download templates you saved while on Pro'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canSaveTemplates && selectMode && selectedTemplates.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Delete Selected ({selectedTemplates.size})
              </button>
            )}
            {canSaveTemplates && (
            <button
              onClick={handleToggleSelectMode}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {selectMode ? (
                <>
                  <Square className="w-5 h-5" />
                  Cancel Selection
                </>
              ) : (
                <>
                  <CheckSquare className="w-5 h-5" />
                  Select Templates
                </>
              )}
            </button>
            )}
            {canSaveTemplates && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Template
            </button>
            )}
          </div>
        </div>
      </div>

      {!canSaveTemplates && templates.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100">
          Your plan is Standard. You can open templates to preview and export HTML, but saving changes requires Pro.
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-secondary-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-secondary-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Selection Header */}
      {canSaveTemplates && selectMode && filteredTemplates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >
              {selectedTemplates.size === filteredTemplates.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              {selectedTemplates.size === filteredTemplates.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedTemplates.size} of {filteredTemplates.length} selected
            </span>
          </div>
          {selectedTemplates.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-16 px-8 text-secondary-600 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-lg border border-secondary-200 dark:border-gray-800">
          <RefreshCw className="w-16 h-16 mx-auto mb-4 text-secondary-400 dark:text-gray-500 animate-spin" />
          <h3 className="text-2xl font-semibold text-secondary-900 dark:text-gray-100 mb-2">Loading templates...</h3>
          <p className="mb-4">Please wait while we fetch your templates</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 px-8 text-secondary-600 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-lg border border-secondary-200 dark:border-gray-800">
          <FileText className="w-16 h-16 mx-auto mb-4 text-secondary-400 dark:text-gray-500" />
          <h3 className="text-2xl font-semibold text-secondary-900 dark:text-gray-100 mb-2">
            {searchQuery ? 'No templates found' : 'No templates in library yet'}
          </h3>
          <p className="mb-4">
            {searchQuery 
              ? 'Try adjusting your search query' 
              : 'Create your first template to get started'}
          </p>
          {!searchQuery && canSaveTemplates && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-secondary-200 dark:border-gray-800 overflow-hidden">
          <div className="divide-y divide-secondary-200 dark:divide-gray-800">
            {filteredTemplates.map((template) => {
              const isSelected = selectedTemplates.has(template.id)
              return (
                <div
                  key={template.id}
                  className={`p-6 transition-colors ${
                    isSelected 
                      ? 'bg-blue-50 border-l-4 border-blue-600 dark:bg-blue-950/50 dark:border-l-blue-500' 
                      : 'hover:bg-secondary-50 dark:hover:bg-gray-800/80'
                  } ${selectMode ? 'cursor-pointer' : 'cursor-pointer'}`}
                  onClick={() => {
                    if (selectMode) {
                      handleToggleSelect(template.id)
                    } else {
                      handleEdit(template.id)
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {selectMode && (
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-secondary-400 dark:text-gray-500" />
                            )}
                          </div>
                        )}
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/35 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-secondary-900 dark:text-gray-100 truncate">
                            {template.name}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-secondary-600 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <Layout className="w-4 h-4" />
                              <span>{template.components.length} component{template.components.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Updated: {new Date(template.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Created: {new Date(template.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {!selectMode && (
                      <div className="flex items-center gap-2 ml-4 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={(e) => handleDownloadHtml(e, template.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-secondary-200 dark:border-gray-700 text-secondary-800 dark:text-gray-200 rounded-lg hover:bg-secondary-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download HTML
                        </button>
                        {canSaveEmails && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCreateEmail(template.id)
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            <Mail className="w-4 h-4" />
                            Create Email
                          </button>
                        )}
                        {canSaveTemplates && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template.id)
                            }}
                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/40 transition-colors"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
        isOpen={deleteConfirmation.isOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirmation({ isOpen: false, templateId: null, isBulk: false, count: 0 })
          }
        }}
        onConfirm={confirmDelete}
        title={deleteConfirmation.isBulk ? 'Delete Multiple Templates' : 'Delete Template'}
        message={
          deleteConfirmation.isBulk
            ? `Are you sure you want to delete ${deleteConfirmation.count} template${deleteConfirmation.count !== 1 ? 's' : ''}? This action cannot be undone.`
            : 'Are you sure you want to delete this template? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isLoading={isDeleting}
      />
    </div>
  )
}
