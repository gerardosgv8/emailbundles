import { apiUrl } from '../utils/apiBase';

export type TicketCategory = 'billing' | 'technical' | 'account' | 'general' | 'other';
export type TicketPriority = 'low' | 'normal' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: number;
  subject: string;
  body: string;
  category: string;
  status: string;
  /** Present on admin API only; omitted for subscriber list/create. */
  priority?: string;
  createdAt: string;
  updatedAt: string;
  adminNotes?: string | null;
  userUsername?: string;
  userEmail?: string;
}

function authHeadersJson(): HeadersInit {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text };
  }
  if (!res.ok) {
    const o = body as { detail?: unknown; message?: unknown };
    const msg = o?.detail ?? o?.message ?? res.statusText;
    const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
    throw new Error(s);
  }
  return body;
}

function normalizeTicket(raw: Record<string, unknown>): SupportTicket {
  const t: SupportTicket = {
    id: String(raw.id ?? ''),
    userId: Number(raw.userId ?? 0),
    subject: String(raw.subject ?? ''),
    body: String(raw.body ?? ''),
    category: String(raw.category ?? 'general'),
    status: String(raw.status ?? 'open'),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    adminNotes: raw.adminNotes != null ? String(raw.adminNotes) : undefined,
    userUsername: raw.userUsername != null ? String(raw.userUsername) : undefined,
    userEmail: raw.userEmail != null ? String(raw.userEmail) : undefined,
  };
  if (raw.priority != null && String(raw.priority) !== '') {
    t.priority = String(raw.priority);
  }
  return t;
}

export async function createSupportTicket(payload: {
  subject: string;
  body: string;
  category: TicketCategory;
}): Promise<SupportTicket> {
  const res = await fetch(apiUrl('/api/tickets'), {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify({
      subject: payload.subject,
      body: payload.body,
      category: payload.category,
    }),
  });
  const body = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return normalizeTicket(body);
}

export async function listMySupportTickets(): Promise<SupportTicket[]> {
  const res = await fetch(apiUrl('/api/tickets'), {
    headers: authHeadersJson(),
  });
  const body = (await parseJsonOrThrow(res)) as unknown;
  if (!Array.isArray(body)) return [];
  return body.map((row) => normalizeTicket(row as Record<string, unknown>));
}

export async function listAllSupportTicketsAdmin(status?: TicketStatus | ''): Promise<SupportTicket[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/api/admin/tickets${q}`), {
    headers: authHeadersJson(),
  });
  const body = (await parseJsonOrThrow(res)) as unknown;
  if (!Array.isArray(body)) return [];
  return body.map((row) => normalizeTicket(row as Record<string, unknown>));
}

export async function updateSupportTicketAdmin(
  ticketId: string,
  payload: { status?: TicketStatus; priority?: TicketPriority; adminNotes?: string | null }
): Promise<SupportTicket> {
  const res = await fetch(apiUrl(`/api/admin/tickets/${encodeURIComponent(ticketId)}`), {
    method: 'PATCH',
    headers: authHeadersJson(),
    body: JSON.stringify({
      ...(payload.status != null ? { status: payload.status } : {}),
      ...(payload.priority != null ? { priority: payload.priority } : {}),
      ...(payload.adminNotes !== undefined ? { adminNotes: payload.adminNotes } : {}),
    }),
  });
  const body = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return normalizeTicket(body);
}
