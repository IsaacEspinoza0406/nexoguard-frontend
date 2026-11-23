'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authMutation } from '../../lib/auth-api';
import { Icon } from '../../components/ui';
import { useNotifications } from '../../components/notifications';

export default function LogoutButton() {
  const router = useRouter();
  const { notify } = useNotifications();
  const submitting = useRef(false);
  function reportError(text: string) { setError(text); notify('account.logout', 'error', text); }
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError(''); notify('account.logout', 'progress', 'Cerrando tu sesión…');
    try {
      const response = await authMutation('logout');
      if (response.status === 204 || response.status === 401) { notify('account.logout', response.status === 204 ? 'success' : 'info', response.status === 204 ? 'Sesión cerrada correctamente.' : 'Tu sesión ya había caducado. Inicia sesión para continuar.'); router.replace('/login'); router.refresh(); }
      else reportError('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    } catch { reportError('No se pudo conectar con el servicio.'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <>{error && <p role="alert" className="form-error">{error}</p>}<button type="button" className="submit" onClick={logout} disabled={pending}><Icon name="logout" />{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></>;
}
