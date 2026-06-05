/**
 * Saved emails — persisted via FastAPI using the subscriber JWT.
 * User scope is enforced on the server (user_id from token only); the browser no longer
 * queries `saved_emails` with the Supabase anon key (which could not enforce per-user RLS).
 */

import { SavedEmailData, EMAIL_STORAGE_LIMITS, EmailStorageInfo } from '../utils/savedEmailsStorage';
import { TemplateElement, TemplateSection } from '../services/templateService';
import { apiUrl } from '../utils/apiBase';

export type SavedEmailUserId = number | string;

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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${token}`,
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

function normalizeEmail(raw: Record<string, unknown>): SavedEmailData {
  const mode = raw.themeCssMode;
  const themeCssMode: SavedEmailData['themeCssMode'] =
    mode === 'light-only' || mode === 'adaptive' ? mode : 'adaptive';
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    templateId: String(raw.templateId ?? ''),
    templateName: String(raw.templateName ?? ''),
    html: String(raw.html ?? ''),
    elements: (Array.isArray(raw.elements) ? raw.elements : []) as TemplateElement[],
    sections: Array.isArray(raw.sections) ? (raw.sections as TemplateSection[]) : undefined,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    description: raw.description != null ? String(raw.description) : undefined,
    themeCssMode,
  };
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function getSavedEmailsSupabase(_userId: SavedEmailUserId): Promise<SavedEmailData[]> {
  const res = await fetch(apiUrl('/api/saved-emails'), {
    headers: authHeaders(),
  });
  const body = (await parseJsonOrThrow(res)) as unknown;
  if (!Array.isArray(body)) return [];
  return body.map((row) => normalizeEmail(row as Record<string, unknown>));
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function getSavedEmailSupabase(
  _userId: SavedEmailUserId,
  emailId: string
): Promise<SavedEmailData | null> {
  const res = await fetch(apiUrl(`/api/saved-emails/${encodeURIComponent(emailId)}`), {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  const body = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return normalizeEmail(body);
}

export async function getSavedEmailExportSupabase(
  emailId: string,
  _userId: SavedEmailUserId
): Promise<{ name: string; html: string } | null> {
  const res = await fetch(apiUrl(`/api/saved-emails/${encodeURIComponent(emailId)}/export`), {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  const body = (await parseJsonOrThrow(res)) as { name?: string; html?: string };
  return { name: String(body.name || 'email'), html: String(body.html || '') };
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function saveEmailSupabase(
  email: Omit<SavedEmailData, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
  _userId: SavedEmailUserId
): Promise<SavedEmailData> {
  const payload = {
    id: email.id,
    name: email.name,
    templateId: email.templateId,
    templateName: email.templateName,
    html: email.html,
    elements: email.elements || [],
    sections: email.sections,
    description: email.description,
    themeCssMode: email.themeCssMode,
    createdAt: email.createdAt,
    updatedAt: email.updatedAt,
  };
  const res = await fetch(apiUrl('/api/saved-emails'), {
    method: 'PUT',
    headers: authHeadersJson(),
    body: JSON.stringify(payload),
  });
  const body = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return normalizeEmail(body);
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function deleteEmailSupabase(_userId: SavedEmailUserId, emailId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/saved-emails/${encodeURIComponent(emailId)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await parseJsonOrThrow(res);
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function getEmailStorageInfoSupabase(_userId: SavedEmailUserId): Promise<EmailStorageInfo> {
  const res = await fetch(apiUrl('/api/saved-emails/storage-summary'), {
    headers: authHeaders(),
  });
  const body = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return {
    emailsCount: Number(body.emailsCount ?? 0),
    storageUsed: Number(body.storageUsed ?? 0),
    storageUsedMB: Number(body.storageUsedMB ?? 0),
    storageLimitMB: Number(body.storageLimitMB ?? EMAIL_STORAGE_LIMITS.MAX_STORAGE_MB),
    storagePercentage: Number(body.storagePercentage ?? 0),
    emailsRemaining: Number(body.emailsRemaining ?? 0),
    isWarning: Boolean(body.isWarning),
    isCritical: Boolean(body.isCritical),
    isAtLimit: Boolean(body.isAtLimit),
  };
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function canSaveEmailSupabase(
  _userId: SavedEmailUserId,
  newEmailSize?: number
): Promise<{ canSave: boolean; reason?: string }> {
  const q = new URLSearchParams();
  q.set('estimated_bytes', String(Math.max(0, newEmailSize || 0)));
  const res = await fetch(`${apiUrl('/api/saved-emails/can-save')}?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = (await parseJsonOrThrow(res)) as { canSave?: boolean; reason?: string };
  return {
    canSave: Boolean(body.canSave),
    reason: body.reason,
  };
}

/**
 * @param _userId Kept for call-site compatibility; the API uses the JWT only.
 */
export async function emailNameExistsSupabase(
  _userId: SavedEmailUserId,
  name: string,
  excludeEmailId?: string
): Promise<boolean> {
  const q = new URLSearchParams();
  q.set('name', name.trim());
  if (excludeEmailId) q.set('exclude_email_id', excludeEmailId);
  const res = await fetch(`${apiUrl('/api/saved-emails/name-exists')}?${q.toString()}`, {
    headers: authHeaders(),
  });
  const body = (await parseJsonOrThrow(res)) as { exists?: boolean };
  return Boolean(body.exists);
}
