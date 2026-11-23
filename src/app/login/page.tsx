'use client';
import Link from 'next/link';
import AuthShell from '../../components/auth-shell';
import { useNotifications } from '../../components/notifications';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authMutation } from '../../lib/auth-api';

export default function Login() {
  const router = useRouter();
  const { notify } = useNotifications();
  const submitting = useRef(false);
  function reportError(text: string) { setError(text); notify('account.login', 'error', text); }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!email.trim() || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || Array.from(password).length < 12 || Array.from(password).length > 128) { reportError('Introduce un correo válido y una contraseña de 12 a 128 caracteres.'); return; }
    submitting.current = true; setPending(true); setError(''); notify('account.login', 'progress', 'Comprobando tu acceso a NexoGuard…');
    try {
      const response = await authMutation('login', { email: email.trim(), password });
      if (response.ok) { setPassword(''); notify('account.login', 'success', 'Sesión iniciada. Bienvenido a tu espacio de trabajo.'); router.replace('/cuenta'); router.refresh(); }
      else reportError(response.status === 401 ? 'Correo o contraseña incorrectos.' : response.status === 429 ? 'Demasiados intentos. Espera un minuto.' : response.status === 403 ? 'La solicitud caducó o no es válida. Inténtalo de nuevo.' : 'No se pudo iniciar sesión. Inténtalo más tarde.');
    } catch { reportError('No se pudo conectar con el servicio.'); }
    finally { submitting.current = false; setPending(false); }
  }
  return <AuthShell><section className="form-card" aria-labelledby="login-title">
    <p className="step">BIENVENIDO A NEXOGUARD</p><h1 id="login-title">Iniciar sesión</h1>
    <p className="description">Retoma el seguimiento de tus sitios. Usa el correo y la contraseña de tu cuenta NexoGuard.</p>
    <form onSubmit={submit} noValidate aria-busy={pending}>
      <div className="field"><label htmlFor="login-email">Correo electrónico</label><input id="login-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} /></div>
      <div className="field"><label htmlFor="login-password">Contraseña</label><input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} /></div>
      <label className="show-password"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Mostrar contraseña</label>
      {error && <p id="login-error" role="alert" className="form-error">{error}</p>}
      <button className="submit" disabled={pending}>{pending ? 'Accediendo…' : 'Iniciar sesión'}<span aria-hidden="true">→</span></button>
    </form>
    <p className="footer-note">¿Todavía no tienes cuenta? <Link className="text-button" href="/">Crear cuenta</Link></p>
  </section></AuthShell>;
}
