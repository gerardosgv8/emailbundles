import { useState } from 'react'
import { Mail, Users, BarChart3, Plus, TrendingUp, Eye, MousePointer } from 'lucide-react'

export function Dashboard() {
  const [stats] = useState({
    totalTemplates: 12,
    activeCampaigns: 8,
    totalSubscribers: 15420,
    avgOpenRate: 24.5,
    avgClickRate: 3.2,
    totalEmails: 156
  })

  const recentActivity = [
    { id: 1, action: 'Created template', template: 'Welcome Series', time: '2 hours ago' },
    { id: 2, action: 'Updated email', template: 'Newsletter #45', time: '4 hours ago' },
    { id: 3, action: 'Published campaign', template: 'Product Launch', time: '1 day ago' },
    { id: 4, action: 'Created template', template: 'Holiday Sale', time: '2 days ago' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">Dashboard</h1>
        <p className="text-secondary-600 text-lg">Overview of your email marketing performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center text-white">
            <Mail className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.totalTemplates}</h3>
            <p className="text-secondary-600 text-sm">Total Templates</p>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-success-500 rounded-lg flex items-center justify-center text-white">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.activeCampaigns}</h3>
            <p className="text-secondary-600 text-sm">Active Campaigns</p>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-warning-500 rounded-lg flex items-center justify-center text-white">
            <Users className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.totalSubscribers.toLocaleString()}</h3>
            <p className="text-secondary-600 text-sm">Total Subscribers</p>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-error-500 rounded-lg flex items-center justify-center text-white">
            <Eye className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.avgOpenRate}%</h3>
            <p className="text-secondary-600 text-sm">Avg Open Rate</p>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center text-white">
            <MousePointer className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.avgClickRate}%</h3>
            <p className="text-secondary-600 text-sm">Avg Click Rate</p>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary-500 rounded-lg flex items-center justify-center text-white">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-secondary-900 mb-1">{stats.totalEmails}</h3>
            <p className="text-secondary-600 text-sm">Emails Sent</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-secondary-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-cta btn-lg group">
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Create New Template
          </button>
          <button className="btn-outline btn-lg group">
            <Mail className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            Send Campaign
          </button>
          <button className="btn-success btn-lg group">
            <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
            View Analytics
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-secondary-900">Recent Activity</h2>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm">
              View All
            </button>
            <button className="btn btn-sm">
              <Plus className="w-4 h-4" />
              New Activity
            </button>
          </div>
        </div>

        <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
          {recentActivity.map(activity => (
            <div key={activity.id} className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 last:border-b-0 hover:bg-secondary-50 transition-colors duration-200 group">
              <div className="flex-1">
                <h4 className="font-medium text-secondary-900 mb-1 group-hover:text-primary-600 transition-colors duration-200">{activity.action}</h4>
                <p className="text-secondary-600 text-sm">{activity.template}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-secondary-600 text-sm">{activity.time}</span>
                <button className="btn-icon btn-icon-sm btn-ghost opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
          </div>
        </div>
      )
    }
