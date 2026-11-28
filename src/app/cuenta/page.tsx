import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LogoutButton from './logout-button';
import SitesManager from './sites-manager';
import { Brand, Icon } from '../../components/ui';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const jar = await cookies();
  const token = jar.get('__Host-nexoguard_session') || jar.get('nexoguard_session');
  if (!token || !/^[0-9a-f]{64}$/.test(token.value)) redirect('/login');
  let response: Response;
  try {
    const api = new URL(process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001');
    if (process.env.NODE_ENV === 'production' && process.env.NEXOGUARD_HTTP_MODE !== 'local' && (api.protocol !== 'https:' || !process.env.NODE_EXTRA_CA_CERTS)) throw new Error('INTERNAL_API_HTTPS_REQUIRED');
    response = await fetch(`${api.origin}/auth/me`, { cache: 'no-store', headers: { Cookie: `${token.name}=${token.value}` } });
  } catch { return <main className="session-error"><p role="alert">No se pudo comprobar tu sesión. Vuelve a cargar la página.</p></main>; }
  if (response.status === 401) redirect('/login');
  if (!response.ok) return <main className="session-error"><p role="alert">El servicio no está disponible. Inténtalo más tarde.</p></main>;
  const user: unknown = await response.json();
  if (!user || typeof user !== 'object' || !('email' in user) || typeof user.email !== 'string') throw new Error('Respuesta de sesión inválida.');
  return <div className="dashboard">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <aside className="sidebar"><Brand /><nav aria-label="Navegación del espacio de trabajo"><p className="nav-caption">ESPACIO DE TRABAJO</p><div className="workspace-nav"><a href="#sites-heading" aria-current="page"><Icon name="grid" />Mis sitios</a><a href="#add-site"><Icon name="plus" />Agregar sitio</a></div></nav><div className="sidebar-bottom"><strong>NexoGuard</strong>Proyecto universitario<br />Revisión de seguridad web</div></aside>
    <div className="workspace"><header className="workspace-bar"><div className="breadcrumb"><Icon name="grid" /> Espacio de trabajo <span>/ Mis sitios</span></div><div className="account-menu"><div className="account-identity">Sesión iniciada como<strong>{user.email}</strong></div><LogoutButton /></div></header>
      <main className="workspace-content" id="main-content"><header className="dashboard-heading"><div><p className="eyebrow">CENTRO DE REVISIÓN</p><h1>Tu cuenta</h1><p>Una vista clara de tus sitios, su evidencia y los próximos pasos.</p></div><a className="button-secondary" href="#add-site"><Icon name="plus" /> Agregar sitio</a></header><SitesManager /></main>
    </div>
  </div>;
}
