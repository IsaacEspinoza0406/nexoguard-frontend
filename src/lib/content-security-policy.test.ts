import { contentSecurityPolicy } from './content-security-policy';

test('CSP limita scripts por nonce, conexiones de producción al mismo origen y conserva atributos de estilo', () => {
  const policy = contentSecurityPolicy('a'.repeat(24));
  expect(policy).toContain("script-src 'self' 'nonce-" + 'a'.repeat(24) + "' 'strict-dynamic'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain('unsafe-eval');
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  expect(policy).toContain("style-src-attr 'unsafe-inline'");
  expect(() => contentSecurityPolicy("bad'; script-src *")).toThrow();
});
test('CSP conserva la API explícita local durante desarrollo Docker', () => {
  expect(contentSecurityPolicy('b'.repeat(24), 'http://127.0.0.1:3001')).toContain("connect-src 'self' http://127.0.0.1:3001");
});
