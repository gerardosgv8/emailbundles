import { useState, useEffect } from 'react'
import { Plus, Save, Eye, Download, Undo, Redo, Settings, Palette, Search } from 'lucide-react'
import { componentLibraryService } from '../../services/componentLibraryService'

export function EmailBuilder() {
  const [components, setComponents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Load live components from library
  useEffect(() => {
    const liveComponents = componentLibraryService.getLiveComponents()
    setComponents(liveComponents)
  }, [])

  // Get unique categories
  const categories = Array.from(new Set(components.map(c => c.category || 'other').filter(Boolean))).sort()

  // Filter components
  const filteredComponents = components.filter(component => {
    const matchesSearch = component.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || (component.category || 'other') === categoryFilter
    return matchesSearch && matchesCategory
  })
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Email Builder</h1>
        <p className="text-secondary-600 text-lg">Design and build your emails with our drag-and-drop editor</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white border border-secondary-200 rounded-xl">
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm group">
            <Undo className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
          <button className="btn-secondary btn-sm group">
            <Redo className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
          <div className="w-px h-6 bg-secondary-200 mx-2"></div>
          <button className="btn-ghost btn-sm group">
            <Settings className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            Settings
          </button>
          <button className="btn-ghost btn-sm group">
            <Palette className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            Themes
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm group">
            <Eye className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            Preview
          </button>
          <button className="btn-outline btn-sm group">
            <Save className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
            Save Draft
          </button>
          <button className="btn-cta btn-lg group">
            <Download className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            Export Email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[250px_1fr_250px] gap-4 h-[calc(100vh-300px)]">
        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-secondary-900">Components</h3>
            <button className="btn-icon btn-icon-sm btn-ghost" title="Add Component">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
            <input
              type="text"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mb-3 px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          )}

          {/* Components List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredComponents.length === 0 ? (
              <div className="text-center py-8 text-secondary-500">
                <p className="text-sm">
                  {searchQuery || categoryFilter !== 'all'
                    ? 'No components match your search'
                    : 'No live components available'}
                </p>
                <p className="text-xs mt-1">Create components in Component Builder</p>
              </div>
            ) : (
              filteredComponents.map((component) => (
                <div
                  key={component.id}
                  className="p-3 border border-secondary-200 rounded-lg hover:bg-secondary-50 cursor-pointer transition-colors duration-200 group"
                  title={`${component.name} - ${component.elements.length} elements`}
                >
                  <div className="text-sm font-medium text-secondary-900">{component.name}</div>
                  <div className="text-xs text-secondary-600 mt-1">
                    {component.category ? component.category.charAt(0).toUpperCase() + component.category.slice(1) : 'Other'} • {component.elements.length} elements
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Email Canvas</h3>
            <p className="text-secondary-600 text-sm mb-4">Drag components here to start building</p>
            <button className="btn-cta btn-lg group">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Start Building
            </button>
          </div>
        </div>
        
        <div className="bg-white border border-secondary-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">Properties</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Font Size</label>
              <input type="range" className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Color</label>
              <div className="flex gap-2">
                <div className="w-6 h-6 bg-primary-500 rounded border"></div>
                <div className="w-6 h-6 bg-secondary-500 rounded border"></div>
                <div className="w-6 h-6 bg-success-500 rounded border"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
