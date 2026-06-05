import React, { useState, useEffect } from 'react';
import { Users, Crown, User, Zap, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers, updateUserTier, UserData } from '../../services/userService';
import { getTierDefinition, UserTier } from '../../utils/userTiers';

export const AdminUserTiers: React.FC = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingTier, setEditingTier] = useState<UserTier>('standard');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadUsers();
    }
  }, [token]);

  const loadUsers = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const usersData = await getAllUsers(token);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTier = (user: UserData) => {
    setEditingUserId(user.id);
    setEditingTier((user.tier as UserTier) || 'standard');
    setError(null);
    setSuccess(null);
  };

  const handleSaveTier = async () => {
    if (!token || !editingUserId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const success = await updateUserTier(editingUserId, editingTier, token);
      if (success) {
        setSuccess(`User tier updated to ${editingTier}`);
        await loadUsers();
        setEditingUserId(null);
      } else {
        setError('Failed to update user tier');
      }
    } catch (error) {
      console.error('Error updating tier:', error);
      setError('Failed to update user tier');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingTier('standard');
    setError(null);
    setSuccess(null);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'pro':
        return <Crown className="w-4 h-4 text-purple-600" />;
      case 'standard':
        return <Zap className="w-4 h-4 text-blue-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'standard':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'; // Default to standard
    }
  };

  // Group users by tier
  const usersByTier = {
    standard: users.filter(u => {
      const tier = u.tier || 'standard';
      return tier === 'standard' || tier === 'starter'; // Legacy support
    }),
    pro: users.filter(u => (u.tier || 'standard') === 'pro'),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Tier Management</h2>
          <p className="text-gray-600 mt-1">Manage user subscription tiers and capabilities</p>
        </div>
        <button
          onClick={loadUsers}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <span className="text-green-800">{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Tier Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['standard', 'pro'] as UserTier[]).map((tier) => {
          const tierDef = getTierDefinition(tier);
          const count = usersByTier[tier].length;
          return (
            <div key={tier} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getTierIcon(tier)}
                  <h3 className="text-lg font-semibold text-gray-900">{tierDef.displayName}</h3>
                </div>
                <span className="text-2xl font-bold text-gray-900">{count}</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">{tierDef.description}</p>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Templates:</span>
                  <span className="font-medium">{tierDef.capabilities.maxTemplates}</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="font-medium">{tierDef.capabilities.maxStorageMB} MB</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Users</h3>
        </div>

        {users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      <div className="text-xs text-gray-500">ID: {user.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <select
                          value={editingTier}
                          onChange={(e) => setEditingTier(e.target.value as UserTier)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1"
                        >
                          <option value="standard">Standard</option>
                          <option value="pro">Pro</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase border ${getTierColor(
                            user.tier || 'standard'
                          )}`}
                        >
                          {getTierIcon(user.tier || 'standard')}
                          {user.tier || 'standard'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        User
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveTier}
                            disabled={saving}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditTier(user)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          Edit Tier
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

