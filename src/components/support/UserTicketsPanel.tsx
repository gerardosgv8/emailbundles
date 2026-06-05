import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, Ticket } from 'lucide-react';
import {
  createSupportTicket,
  listMySupportTickets,
  type SupportTicket,
  type TicketCategory,
} from '../../services/supportTicketsApi';

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'technical', label: 'Technical' },
  { value: 'billing', label: 'Billing' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

function statusLabel(s: string): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return s;
  }
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case 'open':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200';
    case 'in_progress':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
    case 'resolved':
      return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200';
    case 'closed':
      return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

export const UserTicketsPanel: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const activeTicket = tickets.find((t) => t.status !== 'closed') ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMySupportTickets();
      setTickets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    const sub = subject.trim();
    const bod = body.trim();
    if (!sub || !bod) {
      setError('Please enter a subject and description.');
      return;
    }
    if (activeTicket) {
      setError('You already have an active ticket. Please wait until it is closed before submitting another.');
      return;
    }
    setSubmitting(true);
    try {
      await createSupportTicket({ subject: sub, body: bod, category });
      setSubject('');
      setBody('');
      setCategory('general');
      setSuccess('Ticket submitted. We will get back to you by email.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
          <Ticket className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">File a support ticket</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Describe your issue and we will respond via email. You can track status here.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="ticket-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subject
          </label>
          <input
            id="ticket-subject"
            type="text"
            value={subject}
            onChange={(ev) => setSubject(ev.target.value)}
            maxLength={500}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Short summary"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="ticket-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Category
          </label>
          <select
            id="ticket-category"
            value={category}
            onChange={(ev) => setCategory(ev.target.value as TicketCategory)}
            className="w-full max-w-md border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="ticket-body"
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            rows={5}
            maxLength={20000}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What happened? What did you expect?"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {success}
          </p>
        )}
        {activeTicket && (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            You already have an active ticket ({statusLabel(activeTicket.status)}). You can submit another once it is closed.
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || Boolean(activeTicket)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit ticket
        </button>
      </form>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Your tickets</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No tickets yet.</p>
        ) : (
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between gap-y-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{t.subject}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {t.category} · Updated {new Date(t.updatedAt).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap line-clamp-3">
                  {t.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
