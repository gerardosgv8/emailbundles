import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase-client';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/apiBase';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuthToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setLoading(true);

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw new Error(sessionError.message);
        }
        const session = data.session;
        if (!session) {
          throw new Error('No Supabase session found after sign-in');
        }

        const response = await fetch(apiUrl('/api/auth/supabase-exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token }),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.detail || body?.message || 'Token exchange failed');
        }

        await setAuthToken(body.access_token);
        navigate('/user', { replace: true });
      } catch (e: any) {
        console.error('Auth callback error:', e);
        setError(e?.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate, setAuthToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Signing you in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign-in failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallbackPage;

