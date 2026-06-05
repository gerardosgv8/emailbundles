import React, { useCallback, useEffect, useState } from 'react';
import { Bell, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiUrl } from '../../utils/apiBase';

interface TemplateRow {
  event_key: string;
  enabled: boolean;
  subject_template: string;
  html_template: string;
  updated_at?: string | null;
}

interface SentRow {
  id: number;
  event_key: string;
  user_id: number | null;
  recipient_email: string;
  subject: string;
  provider_message_id: string | null;
  error_message: string | null;
  created_at?: string | null;
}

export const AdminEmailAlerts: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user && (user.is_admin || user.user_type === 'admin');

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sent, setSent] = useState<SentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; html: string; enabled: boolean }>>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') : null;

  const load = useCallback(async () => {
    if (!isAdmin || !token) return;
    setLoading(true);
    setError(null);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(apiUrl('/api/admin/email-alerts/templates'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(apiUrl('/api/admin/email-alerts/sent?limit=80'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!tRes.ok) throw new Error(await tRes.text());
      if (!sRes.ok) throw new Error(await sRes.text());
      const tData: TemplateRow[] = await tRes.json();
      const sData: SentRow[] = await sRes.json();
      setTemplates(tData);
      setSent(sData);
      const next: Record<string, { subject: string; html: string; enabled: boolean }> = {};
      for (const r of tData) {
        next[r.event_key] = {
          subject: r.subject_template,
          html: r.html_template,
          enabled: r.enabled,
        };
      }
      setDrafts(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
  }, [authLoading, isAdmin, load]);

  const saveTemplate = async (eventKey: string) => {
    const d = drafts[eventKey];
    if (!d || !token) return;
    setSavingKey(eventKey);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/email-alerts/templates/${encodeURIComponent(eventKey)}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: d.enabled,
          subject_template: d.subject,
          html_template: d.html,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  if (!isAdmin) {
    return <div className="p-6 text-gray-600">Admin access required.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Transactional email alerts</h1>
            <p className="text-sm text-gray-600 mt-1">
              Resend-backed templates (welcome, tickets, Pro upgrade). Use placeholders like{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">{'{{username}}'}</code>,{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">{'{{ticket_subject}}'}</code>, etc.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-200">{error}</div>
      )}

      <section className="space-y-6">
        <h2 className="text-lg font-medium text-gray-900">Templates</h2>
        {loading && templates.length === 0 ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          templates.map((row) => {
            const d = drafts[row.event_key] || {
              subject: row.subject_template,
              html: row.html_template,
              enabled: row.enabled,
            };
            return (
              <div key={row.event_key} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-gray-800">{row.event_key}</span>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.event_key]: { ...d, enabled: e.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                  <input
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value={d.subject}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.event_key]: { ...d, subject: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">HTML body</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono min-h-[140px]"
                    value={d.html}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.event_key]: { ...d, html: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {row.updated_at ? `Updated ${row.updated_at}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => saveTemplate(row.event_key)}
                    disabled={savingKey === row.event_key}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-black text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {savingKey === row.event_key ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-gray-900 mb-3">Recent sends</h2>
        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Resend ID / error</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.event_key}</td>
                  <td className="px-3 py-2">{r.recipient_email}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.subject}>
                    {r.subject}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.provider_message_id ? (
                      <span className="text-green-700">{r.provider_message_id}</span>
                    ) : (
                      <span className="text-red-700">{r.error_message || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sent.length === 0 && !loading && (
            <p className="p-4 text-gray-500 text-sm">No rows yet. Sends are logged after each attempt.</p>
          )}
        </div>
      </section>
    </div>
  );
};
