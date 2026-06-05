import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  listAllSupportTicketsAdmin,
  updateSupportTicketAdmin,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from '../../services/supportTicketsApi';

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES: TicketPriority[] = ['high', 'normal', 'low'];

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ');
}

const TicketRow: React.FC<{
  ticket: SupportTicket;
  onUpdated: () => void;
}> = ({ ticket, onUpdated }) => {
  const initialPriority = ((): TicketPriority => {
    const p = (ticket.priority || 'normal').toLowerCase();
    return PRIORITIES.includes(p as TicketPriority) ? (p as TicketPriority) : 'normal';
  })();
  const [status, setStatus] = useState<TicketStatus>(
    (STATUSES.includes(ticket.status as TicketStatus) ? ticket.status : 'open') as TicketStatus
  );
  const [priority, setPriority] = useState<TicketPriority>(initialPriority);
  const [adminNotes, setAdminNotes] = useState(ticket.adminNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus((STATUSES.includes(ticket.status as TicketStatus) ? ticket.status : 'open') as TicketStatus);
    const p = (ticket.priority || 'normal').toLowerCase();
    setPriority(PRIORITIES.includes(p as TicketPriority) ? (p as TicketPriority) : 'normal');
    setAdminNotes(ticket.adminNotes || '');
  }, [ticket]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateSupportTicketAdmin(ticket.id, {
        status,
        priority,
        adminNotes: adminNotes.trim() || null,
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const ticketPriorityNorm: TicketPriority = PRIORITIES.includes(
    (ticket.priority || 'normal').toLowerCase() as TicketPriority
  )
    ? ((ticket.priority || 'normal').toLowerCase() as TicketPriority)
    : 'normal';

  const dirty =
    status !== ticket.status ||
    priority !== ticketPriorityNorm ||
    (adminNotes.trim() || '') !== (ticket.adminNotes || '').trim();

  return (
    <tr className="border-b border-gray-200 align-top">
      <td className="py-3 px-2 text-sm text-gray-600 w-36">
        <div className="text-xs text-gray-500">{new Date(ticket.createdAt).toLocaleString()}</div>
        <div className="font-mono text-[11px] text-gray-400 truncate max-w-[8rem]" title={ticket.id}>
          {ticket.id.slice(0, 8)}…
        </div>
      </td>
      <td className="py-3 px-2 text-sm">
        <div className="font-medium text-gray-900">{ticket.userUsername || `User #${ticket.userId}`}</div>
        <div className="text-gray-600 text-xs">{ticket.userEmail || '—'}</div>
      </td>
      <td className="py-3 px-2 text-sm">
        <div className="font-medium text-gray-900">{ticket.subject}</div>
        <div className="text-gray-600 text-xs mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap">{ticket.body}</div>
        <div className="text-xs text-gray-500 mt-1 capitalize">{ticket.category}</div>
      </td>
      <td className="py-3 px-2 text-sm w-32">
        <label className="sr-only" htmlFor={`pri-${ticket.id}`}>
          Priority
        </label>
        <select
          id={`pri-${ticket.id}`}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm capitalize"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3 px-2 text-sm w-40">
        <label className="sr-only" htmlFor={`st-${ticket.id}`}>
          Status
        </label>
        <select
          id={`st-${ticket.id}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3 px-2 text-sm min-w-[12rem]">
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes (not shown to user)"
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="mt-2 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-black disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
    </tr>
  );
};

export const AdminTickets: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'' | TicketStatus>('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listAllSupportTicketsAdmin(filter || undefined);
      setTickets(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support tickets</h1>
          <p className="text-gray-600 mt-1">
            Tickets filed by subscribers from Support → File a ticket. Sorted by priority (high first), then newest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ticket-filter" className="text-sm text-gray-600">
            Status
          </label>
          <select
            id="ticket-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as '' | TicketStatus)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatus(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load()}
            className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{loadError}</div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-gray-600">No tickets match this filter.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full min-w-[920px] text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Created</th>
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">User</th>
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Ticket</th>
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Priority</th>
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="py-2 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Admin</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <TicketRow key={t.id} ticket={t} onUpdated={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
