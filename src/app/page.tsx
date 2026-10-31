'use client';

import { FormEvent, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
type Errors = { email?: string; password?: string; confirmation?: string };

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next: Errors = {};
    const trimmed = email.trim();
    if (!trimmed || trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = 'Introduce un correo electrónico válido.';
    if (Array.from(password).length < 12 || Array.from(password).length > 128) next.password = 'La contraseña debe tener entre 12 y 128 caracteres.';
    if (!confirmation || confirmation !== password) next.confirmation = 'Las contraseñas deben coincidir.';
    setErrors(next); setMessage(''); setSuccess(false);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const tokenResponse = await fetch(`${apiUrl}/users/registration-token`, { credentials: 'include', cache: 'no-store' });
      if (!tokenResponse.ok) { setMessage(tokenResponse.status === 429 ? 'Demasiados intentos. Espera un momento y vuelve a intentarlo.' : 'No fue posible verificar la seguridad de la solicitud. Inténtalo de nuevo.'); return; }
      const data: unknown = await tokenResponse.json();
      if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string' || !data.token) throw new Error();
      const response = await fetch(`${apiUrl}/users`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': data.token }, body: JSON.stringify({ email: trimmed, password }) });
      if (response.status === 201) {
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id) throw new Error();
        setSuccess(true); setEmail(''); setPassword(''); setConfirmation('');
      } else {
        const messages: Record<number, string> = { 400: 'Revisa el correo y la contraseña e inténtalo de nuevo.', 403: 'No fue posible verificar la seguridad de la solicitud. Inténtalo de nuevo.', 409: 'No se pudo registrar ese correo. Comprueba los datos.', 429: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.', 500: 'El servicio no pudo completar el registro. Inténtalo más tarde.' };
        setMessage(messages[response.status] || 'No se pudo completar el registro. Inténtalo más tarde.');
      }
    } catch { setMessage('No se pudo conectar con el servicio. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally { setPending(false); }
  }

  return (
    <main className="page-shell">
      <section className="intro" aria-labelledby="intro-title">
        <div className="brand"><span className="brand-mark" aria-hidden="true">N</span><span>NexoGuard</span></div>
        <div className="intro-copy"><p className="eyebrow">SEGURIDAD MÁS CLARA</p><h1 id="intro-title">Conoce mejor la seguridad de tu sitio.</h1><p>Un espacio para revisar configuraciones, entender los hallazgos y tomar decisiones con más confianza.</p></div>
        <div className="intro-note"><span aria-hidden="true"></span><p>Comienza creando tu cuenta. Más adelante podrás registrar y verificar los sitios que administras.</p></div>
      </section>
      <section className="form-area" aria-labelledby="form-title">
        <div className="form-card"><p className="step">TU CUENTA EN NEXOGUARD</p><h2 id="form-title">Crear cuenta</h2><p className="description">Da el primer paso para conocer el estado de seguridad de tus sitios.</p>
          {success ? <div className="success" role="status"><strong>Cuenta creada correctamente.</strong><p>Tu registro se completó. El inicio de sesión estará disponible más adelante.</p><button className="text-button" type="button" onClick={() => setSuccess(false)}>Registrar otra cuenta</button></div> :
          <form onSubmit={submit} noValidate>
            <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />{errors.email && <p id="email-error" className="field-error">{errors.email}</p>}</div>
            <div className="field"><label htmlFor="password">Contraseña</label><input id="password" type={visible ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-help password-error' : 'password-help'} /><p id="password-help" className="help">Usa entre 12 y 128 caracteres.</p>{errors.password && <p id="password-error" className="field-error">{errors.password}</p>}</div>
            <div className="field"><label htmlFor="confirmation">Confirmar contraseña</label><input id="confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation ? 'confirmation-error' : undefined} />{errors.confirmation && <p id="confirmation-error" className="field-error">{errors.confirmation}</p>}</div>
            <label className="show-password"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Mostrar contraseñas</label>
            {message && <p className="form-error" role="alert">{message}</p>}
            <button className="submit" type="submit" disabled={pending}>{pending ? 'Creando cuenta…' : 'Crear cuenta'} <span aria-hidden="true">→</span></button>
          </form>}
          <p className="footer-note">Tus credenciales se utilizan únicamente para crear tu cuenta.</p>
        </div>
      </section>
    </main>
  );
}
