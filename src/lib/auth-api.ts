const api = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

export function getSslLabs(site: string) { return fetch(`${api}/sites/${encodeURIComponent(site)}/ssl-labs`, { credentials: 'include', cache: 'no-store' }); }

export function getSiteMonitoring(site: string, resource: 'schedule' | 'alerts') { return fetch(`${api}/sites/${encodeURIComponent(site)}/${resource}`, { credentials: 'include', cache: 'no-store' }); }

export function getAnalysisComparison(siteId: string, before: string, after: string) {
  return fetch(`${api}/sites/${encodeURIComponent(siteId)}/analyses/compare/${encodeURIComponent(before)}/${encodeURIComponent(after)}`, { credentials: 'include', cache: 'no-store' });
}

export async function csrfMutation(path: string, body?: object) {
  const csrfResponse = await fetch(`${api}/auth/csrf`, { credentials: 'include', cache: 'no-store' });
  if (!csrfResponse.ok) return csrfResponse;
  const value: unknown = await csrfResponse.json();
  if (!value || typeof value !== 'object' || !('token' in value) || typeof value.token !== 'string') throw new Error('Respuesta inválida.');
  return fetch(`${api}${path}`, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': value.token }, body: body ? JSON.stringify(body) : undefined });
}

export function authMutation(action: 'login' | 'logout', body?: { email: string; password: string }) { return csrfMutation(`/auth/${action}`, body); }

export function getSites() { return fetch(`${api}/sites`, { credentials: 'include', cache: 'no-store' }); }

export function getAnalyses(siteId: string, id?: string) { return fetch(`${api}/sites/${encodeURIComponent(siteId)}/analyses${id ? `/${encodeURIComponent(id)}` : ''}`, { credentials: 'include', cache: 'no-store' }); }
