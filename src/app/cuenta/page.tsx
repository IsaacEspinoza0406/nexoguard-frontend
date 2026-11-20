import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from './logout-button';
import SitesManager from './sites-manager';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const jar = await cookies();
  const token = jar.get('__Host-nexoguard_session') || jar.get('nexoguard_session');
  if (!token || !/^[0-9a-f]{64}$/.test(token.value)) redirect('/login');
  let response: Response;
  try {
    response = await fetch(`${process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001'}/auth/me`, { cache: 'no-store', headers: { Cookie: `${token.name}=${token.value}` } });
  } catch { return <main className="form-area"><p role="alert">No se pudo comprobar tu sesión. Vuelve a cargar la página.</p></main>; }
  if (response.status === 401) redirect('/login');
  if (!response.ok) return <main className="form-area"><p role="alert">El servicio no está disponible. Inténtalo más tarde.</p></main>;
  const user: unknown = await response.json();
  if (!user || typeof user !== 'object' || !('email' in user) || typeof user.email !== 'string') throw new Error('Respuesta de sesión inválida.');
  return <main className="form-area" style={{ minHeight: '100vh' }}><section className="form-card account-card"><p className="step">NEXOGUARD · ÁREA PRIVADA</p><h1>Tu cuenta</h1><p className="description">Sesión iniciada como {user.email}.</p><LogoutButton /><SitesManager /></section></main>;
}
