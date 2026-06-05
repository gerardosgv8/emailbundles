import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, DollarSign, TrendingUp, ArrowRight, Package, FileText, HardDrive, Users, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { verifySupabaseConnection, verifySupabaseServices } from '../../utils/verifySupabaseConnection';

interface Stats {
  total_transactions: number;
  total_revenue: number;
  average_transaction: number;
}

interface TemplateStats {
  totalTemplates: number;
  totalUsers: number;
  totalStorageMB: number;
}

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [templateStats, setTemplateStats] = useState<TemplateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    message: string;
    services?: { savedTemplates: boolean; componentLibrary: boolean; storageReport: boolean };
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/transactions/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.warn('Failed to fetch stats:', response.status);
          // Set default stats if API fails
          setStats({
            total_transactions: 0,
            total_revenue: 0,
            average_transaction: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        // Set default stats on error
        setStats({
          total_transactions: 0,
          total_revenue: 0,
          average_transaction: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchTemplateStats = async () => {
      try {
        // Try Supabase first
        try {
          const { getStorageSummary } = await import('../../services/storageReportSupabase');
          const summary = await getStorageSummary();
          
          setTemplateStats({
            totalTemplates: summary.totalTemplates,
            totalUsers: summary.totalUsers,
            totalStorageMB: summary.totalStorageUsedMB,
          });
          console.log('✅ Template stats loaded from Supabase');
        } catch (supabaseError) {
          console.warn('⚠️ Failed to load template stats from Supabase:', supabaseError);
          // Set default stats on error
          setTemplateStats({
            totalTemplates: 0,
            totalUsers: 0,
            totalStorageMB: 0,
          });
        }
      } catch (err) {
        console.error('Error fetching template stats:', err);
        setTemplateStats({
          totalTemplates: 0,
          totalUsers: 0,
          totalStorageMB: 0,
        });
      } finally {
        setTemplateLoading(false);
      }
    };

    fetchTemplateStats();
  }, []);

  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        const [connectionStatus, servicesStatus] = await Promise.all([
          verifySupabaseConnection(),
          verifySupabaseServices(),
        ]);

        setSupabaseStatus({
          connected: connectionStatus.connected,
          message: connectionStatus.message,
          services: servicesStatus,
          errors: connectionStatus.details?.errors,
        });
      } catch (error: any) {
        console.error('Error checking Supabase connection:', error);
        setSupabaseStatus({
          connected: false,
          message: `❌ Connection check failed: ${error.message}`,
        });
      }
    };

    checkSupabaseConnection();
  }, []);

  const quickLinks = [
    {
      title: 'Manage Users',
      description: 'View and manage all registered users',
      icon: Users,
      href: '/gestion/users',
      color: 'bg-blue-500'
    },
    {
      title: 'Manage Products',
      description: 'Create and manage your Stripe products',
      icon: Package,
      href: '/gestion/products',
      color: 'bg-purple-500'
    },
    {
      title: 'View Transactions',
      description: 'Browse all successful payments and customer data',
      icon: Database,
      href: '/gestion/transactions',
      color: 'bg-blue-500'
    },
    {
      title: 'View Analytics',
      description: 'Revenue trends and business insights',
      icon: TrendingUp,
      href: '/gestion/analytics',
      color: 'bg-green-500'
    },
    {
      title: 'Storage Report',
      description: 'Monitor template storage usage across all users',
      icon: HardDrive,
      href: '/gestion/storage-report',
      color: 'bg-cyan-500'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-600 mt-1">Monitor your e-commerce system</p>
      </div>

      {/* Stats Grid - Transactions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Transactions</h3>
          {loading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">{stats?.total_transactions || 0}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Revenue</h3>
          {loading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-green-600">${(stats?.total_revenue ?? 0).toFixed(2)}</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Average Transaction</h3>
          {loading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-purple-600">${(stats?.average_transaction ?? 0).toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Stats Grid - Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Templates</h3>
          {templateLoading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{templateStats?.totalTemplates || 0}</p>
              <p className="text-sm text-gray-600 mt-2">
                Storage: <span className="font-semibold">{(templateStats?.totalStorageMB || 0).toFixed(2)} MB</span>
              </p>
            </>
          )}
          <p className="text-xs text-gray-500 mt-1">Saved in Supabase</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Users with Templates</h3>
          {templateLoading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">{templateStats?.totalUsers || 0}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Active users</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Storage Used</h3>
          {templateLoading ? (
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">{(templateStats?.totalStorageMB || 0).toFixed(2)} MB</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Across all users</p>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.title}
                to={link.href}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow group"
              >
                <div className={`w-12 h-12 ${link.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                  {link.title}
                </h4>
                <p className="text-sm text-gray-600 mb-4">{link.description}</p>
                <span className="text-sm font-medium text-primary flex items-center gap-2 group-hover:gap-4 transition-all">
                  Go to page
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Frontend: Running</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Node Backend: Running</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">FastAPI: Running</span>
          </div>
        </div>

        {/* Supabase Connection Status */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Supabase Connection</h4>
          {supabaseStatus ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {supabaseStatus.connected ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-sm ${supabaseStatus.connected ? 'text-green-700' : 'text-red-700'}`}>
                  {supabaseStatus.message}
                </span>
              </div>
              
              {supabaseStatus.services && (
                <div className="ml-8 space-y-2">
                  <div className="flex items-center gap-2">
                    {supabaseStatus.services.savedTemplates ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">saved_templates table</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {supabaseStatus.services.componentLibrary ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">component_library table</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {supabaseStatus.services.storageReport ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs text-gray-600">storage report service</span>
                  </div>
                </div>
              )}

              {supabaseStatus.errors && supabaseStatus.errors.length > 0 && (
                <div className="ml-8 mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  <div className="font-semibold mb-1">Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {supabaseStatus.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600">Checking connection...</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Information</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>✅ Stripe integration active</p>
          <p>✅ Airtable CRM connected</p>
          <p>✅ Transaction recording enabled</p>
          <p>✅ Webhook automation ready</p>
        </div>
      </div>
    </div>
  );
};

