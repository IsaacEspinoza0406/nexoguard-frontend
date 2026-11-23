export function contentSecurityPolicy(nonce: string, api = '/api'): string {
  if (!/^[A-Za-z0-9+/]{24}$/.test(nonce)) throw new Error('Nonce inválido.');
  const connect = api.startsWith('/') && !api.startsWith('//') ? "'self'" : ` 'self' ${new URL(api).origin}`;
  return [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Existing React style attributes are needed; this grants no script execution.
    "style-src-attr 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    `connect-src ${connect.trim()}`, "object-src 'none'", "base-uri 'self'",
    "form-action 'self'", "frame-ancestors 'none'",
  ].join('; ');
}
