/**
 * User service for fetching and managing user data
 */

const API_BASE_URL = 'http://localhost:3002/api';

export interface UserData {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  user_type: string;
  tier: string;
  created_at: string;
}

/**
 * Get user data by ID (admin only)
 */
export async function getUserById(userId: number, token: string): Promise<UserData | null> {
  try {
    // Note: This endpoint would need to be added to the backend
    // For now, we'll use the /api/auth/me endpoint pattern
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(token: string): Promise<UserData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

/**
 * Update user tier (admin only)
 */
export async function updateUserTier(
  userId: number,
  tier: string,
  token: string
): Promise<boolean> {
  try {
    // Backend expects tier as a query parameter or in the URL
    const response = await fetch(`${API_BASE_URL}/users/${userId}/tier?tier=${tier}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating user tier:', error);
    return false;
  }
}

/**
 * Get user tier
 */
export async function getUserTier(userId: number, token: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/tier`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Normalize tier: convert 'starter' (legacy) to 'standard'
      const tier = data.tier || 'standard';
      return tier === 'starter' ? 'standard' : tier;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user tier:', error);
    return null;
  }
}

