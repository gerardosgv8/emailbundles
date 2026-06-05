import React, { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';

interface Stats {
  total_transactions: number;
  total_revenue: number;
  average_transaction: number;
}

export const AdminAnalytics: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/transactions/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
        <p className="text-gray-600 mt-1">Revenue trends and business insights</p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
        <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Advanced Analytics Coming Soon</h3>
        <p className="text-gray-600 mb-6">
          Rich analytics, charts, and insights will be available here soon.
        </p>

        {/* Current Stats */}
        {!loading && stats && (
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_transactions}</div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">${stats.total_revenue.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600">${stats.average_transaction.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Average Order</div>
            </div>
          </div>
        )}
      </div>

      {/* Features Coming */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Planned Features</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
              Revenue by date ranges
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
              Customer retention metrics
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
              Conversion rates
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
              Interactive charts
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Current Features</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Total transactions
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Total revenue
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Average transaction
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Real-time updates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

