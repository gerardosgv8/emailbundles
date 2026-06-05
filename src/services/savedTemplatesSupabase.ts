/**
 * Saved templates — persisted via FastAPI using the subscriber JWT.
 * User scope is enforced on the server; the browser no longer writes `saved_templates`
 * with the Supabase anon key (RLS / anon could block or mis-scope saves).
 */

import { TemplateData, TemplateComponent } from '../utils/savedTemplatesStorage';
import { UserTier } from '../utils/userTiers';
import { apiUrl } from '../utils/apiBase';

interface SavedTemplateRow {
  id: string;
  user_id: number;
  name: string;
  html: string;
  components: TemplateComponent[];
  metadata: Record<string, unknown>;
  storage_size: number;
  created_at: string;
  updated_at: string;
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

/** Admins pass user_id so reports can target another account; subscribers ignore the param server-side. */
function urlWithUser(path: string, userId: number): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const sep = p.includes('?') ? '&' : '?';
  return `${apiUrl(p)}${sep}user_id=${encodeURIComponent(String(userId))}`;
}

function apiItemToTemplateData(raw: Record<string, unknown>): TemplateData {
  const mode = raw.themeCssMode;
  const themeCssMode: TemplateData['themeCssMode'] =
    mode === 'light-only' || mode === 'adaptive' ? mode : 'adaptive';
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    components: (Array.isArray(raw.components) ? raw.components : []) as TemplateComponent[],
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    themeCssMode,
  };
}

function upsertResponseToRow(
  raw: Record<string, unknown>,
  userId: number,
  html: string
): SavedTemplateRow {
  const td = apiItemToTemplateData(raw);
  const meta = { themeCssMode: td.themeCssMode ?? 'adaptive' };
  const storageSize = new Blob([JSON.stringify(td)]).size;
  return {
    id: td.id,
    user_id: userId,
    name: td.name,
    html,
    components: td.components,
    metadata: meta,
    storage_size: storageSize,
    created_at: td.createdAt,
    updated_at: td.updatedAt,
  };
}

export async function getSavedTemplatesSupabase(userId: number): Promise<TemplateData[]> {
  const res = await fetch(urlWithUser('/api/saved-templates', userId), {
    headers: authHeaders(),
  });
  const body = (await parseJsonOrThrow(res)) as unknown;
  if (!Array.isArray(body)) return [];
  return body.map((row) => apiItemToTemplateData(row as Record<string, unknown>));
}

export async function saveTemplateSupabase(
  template: TemplateData,
  userId: number,
  html: string
): Promise<SavedTemplateRow> {
  const payload = {
    id: template.id,
    name: template.name,
    components: template.components || [],
    html,
    themeCssMode: template.themeCssMode ?? 'adaptive',
    createdAt: template.createdAt || undefined,
    updatedAt: template.updatedAt || undefined,
  };
  const res = await fetch(apiUrl('/api/saved-templates'), {
    method: 'PUT',
    headers: authHeadersJson(),
    body: JSON.stringify(payload),
  });
  const raw = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return upsertResponseToRow(raw, userId, html);
}

export async function saveTemplatesSupabase(
  templates: TemplateData[],
  userId: number,
  htmlMap: Record<string, string> = {}
): Promise<SavedTemplateRow[]> {
  const rows = await Promise.all(
    templates.map((t) => saveTemplateSupabase(t, userId, htmlMap[t.id] || ''))
  );
  return rows;
}

export async function deleteTemplateSupabase(templateId: string, userId: number): Promise<void> {
  const res = await fetch(
    urlWithUser(`/api/saved-templates/${encodeURIComponent(templateId)}`, userId),
    { method: 'DELETE', headers: authHeaders() }
  );
  await parseJsonOrThrow(res);
}

export async function getStorageInfoSupabase(
  userId: number,
  _userTier: UserTier = 'standard'
): Promise<{
  templatesCount: number;
  storageUsed: number;
  storageUsedMB: number;
  storageLimitMB: number;
  storagePercentage: number;
  templatesRemaining: number;
  isWarning: boolean;
  isCritical: boolean;
  isAtLimit: boolean;
}> {
  const res = await fetch(urlWithUser('/api/saved-templates/storage-summary', userId), {
    headers: authHeaders(),
  });
  const b = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return {
    templatesCount: Number(b.templatesCount ?? 0),
    storageUsed: Number(b.storageUsed ?? 0),
    storageUsedMB: Number(b.storageUsedMB ?? 0),
    storageLimitMB: Number(b.storageLimitMB ?? 0),
    storagePercentage: Number(b.storagePercentage ?? 0),
    templatesRemaining: Number(b.templatesRemaining ?? 0),
    isWarning: Boolean(b.isWarning),
    isCritical: Boolean(b.isCritical),
    isAtLimit: Boolean(b.isAtLimit),
  };
}

export async function getSavedTemplateExportSupabase(
  templateId: string,
  userId: number
): Promise<{ name: string; html: string } | null> {
  const res = await fetch(
    urlWithUser(`/api/saved-templates/${encodeURIComponent(templateId)}/export`, userId),
    { headers: authHeaders() }
  );
  if (res.status === 404) return null;
  const body = (await parseJsonOrThrow(res)) as { name?: string; html?: string };
  return { name: String(body.name || 'template'), html: String(body.html || '') };
}

export async function getTemplateByIdSupabase(
  templateId: string,
  userId: number
): Promise<TemplateData | null> {
  const res = await fetch(
    urlWithUser(`/api/saved-templates/${encodeURIComponent(templateId)}`, userId),
    { headers: authHeaders() }
  );
  if (res.status === 404) return null;
  const raw = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  return apiItemToTemplateData(raw);
}

export async function updateTemplateSupabase(
  template: TemplateData,
  userId: number,
  html: string
): Promise<SavedTemplateRow> {
  return saveTemplateSupabase(template, userId, html);
}
