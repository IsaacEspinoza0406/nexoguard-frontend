'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authMutation } from '../../lib/auth-api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim() || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || Array.from(password).length < 12 || Array.from(password).length > 128) { setError('Introduce un correo válido y una contraseña de 12 a 128 caracteres.'); return; }
    setPending(true); setError('');
    try {
      const response = await authMutation('login', { email: email.trim(), password });
      if (response.ok) { setPassword(''); router.replace('/cuenta'); router.refresh(); }
      else setError(response.status === 401 ? 'Correo o contraseña incorrectos.' : response.status === 429 ? 'Demasiados intentos. Espera un minuto.' : response.status === 403 ? 'La solicitud caducó o no es válida. Inténtalo de nuevo.' : 'No se pudo iniciar sesión. Inténtalo más tarde.');
    } catch { setError('No se pudo conectar con el servicio.'); }
    finally { setPending(false); }
  }
  return <main className="form-area" style={{ minHeight: '100vh' }}><section className="form-card" aria-labelledby="login-title"><p className="step">NEXOGUARD</p><h1 id="login-title">Iniciar sesión</h1><p className="description">Accede a tu cuenta.</p><form onSubmit={submit} noValidate><div className="field"><label htmlFor="login-email">Correo electrónico</label><input id="login-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div><div className="field"><label htmlFor="login-password">Contraseña</label><input id="login-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div><label className="show-password"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />Mostrar contraseña</label>{error && <p role="alert" className="form-error">{error}</p>}<button className="submit" disabled={pending}>{pending ? 'Accediendo…' : 'Iniciar sesión'}</button></form><p className="footer-note">¿Todavía no tienes cuenta? <Link className="text-button" href="/">Crear cuenta</Link></p></section></main>;
}
