'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authMutation } from '../../lib/auth-api';

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await authMutation('logout');
      if (response.status === 204 || response.status === 401) { router.replace('/login'); router.refresh(); }
      else setError('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    } catch { setError('No se pudo conectar con el servicio.'); }
    finally { setPending(false); }
  }
  return <>{error && <p role="alert" className="form-error">{error}</p>}<button type="button" className="submit" onClick={logout} disabled={pending}>{pending ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></>;
}
