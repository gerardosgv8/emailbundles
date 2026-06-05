import { useState } from 'react'
import { Plus, Search, Filter, Grid, List, Eye } from 'lucide-react'

export function TemplateBuilder() {
  const [viewMode, setViewMode] = useState('grid')
  const [templates] = useState([
    { id: 1, name: 'Welcome Series', type: 'Automation', emails: 5, status: 'active' },
    { id: 2, name: 'Newsletter Template', type: 'Newsletter', emails: 1, status: 'draft' },
    { id: 3, name: 'Product Launch', type: 'Campaign', emails: 3, status: 'active' },
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Template Builder</h1>
        <p className="text-secondary-600 text-lg">Create and manage your email templates</p>
      </div>

      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-500" />
            <input 
              type="text" 
              placeholder="Search templates..." 
              className="pl-10 pr-4 py-3 border border-secondary-200 rounded-lg bg-white text-secondary-900 w-80 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button className="btn-secondary btn-sm">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className={`btn-icon btn-icon-sm ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'btn-ghost'}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button 
            className={`btn-icon btn-icon-sm ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'btn-ghost'}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
          <button className="btn-cta btn-lg group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            New Template
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {templates.map(template => (
          <div key={template.id} className="bg-white border border-secondary-200 rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors duration-200">{template.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                template.status === 'active' ? 'bg-success-100 text-success-800' :
                template.status === 'draft' ? 'bg-warning-100 text-warning-800' :
                'bg-secondary-100 text-secondary-800'
              }`}>
                {template.status}
              </span>
            </div>
            
            <div className="flex gap-4 mb-6 text-sm text-secondary-600">
              <span>{template.type}</span>
              <span>{template.emails} emails</span>
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1 group">
                <span className="group-hover:scale-105 transition-transform duration-200">Edit</span>
              </button>
              <button className="btn flex-1 group">
                <Eye className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
