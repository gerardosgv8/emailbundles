import { Outlet, useNavigate } from 'react-router-dom'
import { Mail, BarChart3, Users, Settings, FileText, Palette, Library, TestTube } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { user, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  if (!isLoading && isAuthenticated && user) {
    const isAdmin = user.is_admin || user.user_type === 'admin'
    if (isAdmin) {
      navigate('/gestion', { replace: true })
      return null
    }
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const isAdmin = user.is_admin || user.user_type === 'admin'
      if (isAdmin) {
        navigate('/gestion', { replace: true })
      }
    }
  }, [isLoading, isAuthenticated, user, navigate])

  const isPro = ((user?.tier || '') + '').toLowerCase() === 'pro'

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/dashboard' },
    { id: 'template-builder', label: 'Template Builder', icon: Palette, path: '/template-builder' },
    { id: 'saved-templates', label: 'Template Library', icon: FileText, path: '/saved-templates', proOnly: true },
    { id: 'email-builder', label: 'Email Builder', icon: Mail, path: '/email-builder' },
    { id: 'email-library', label: 'Email Library', icon: Library, path: '/email-library', proOnly: true },
    { id: 'test-area', label: 'Test Area', icon: TestTube, path: '/test-area' },
  ].filter((item) => !item.proOnly || isPro)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-secondary-200 flex flex-col">
        <div className="p-6 border-b border-secondary-200">
          <div className="flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary-500" />
            <h1 className="text-xl font-bold text-secondary-900">EmailBundles</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-4">
          {navigation.map(item => {
            const Icon = item.icon
            return (
              <a
                key={item.id}
                href={item.path}
                className={`flex items-center gap-3 px-6 py-3 text-secondary-500 no-underline transition-all duration-200 hover:bg-secondary-100 hover:text-secondary-700 ${
                  activeTab === item.id ? 'bg-primary-500 text-white hover:bg-primary-600 hover:text-white' : ''
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </a>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
