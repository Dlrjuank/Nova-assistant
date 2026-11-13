'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { claseBoton } from '@/components/ui/Boton';
import { esFallaDeRed, NECESITAS_CONEXION } from '@/lib/reglas/sinConexion';
import {
  CLASE_CAMPO_ACCESO,
  CLASE_ENLACE_ACCESO,
  CLASE_ERROR_ACCESO,
  CLASE_ETIQUETA_ACCESO,
  CLASE_EXITO_ACCESO,
  TarjetaAcceso,
} from './TarjetaAcceso';

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8 || password.length > 128) {
      setError('La contraseña debe tener entre 8 y 128 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = (await response.json()) as {
        error?: string;
        data?: { requiresEmailConfirmation?: boolean; requiresLogin?: boolean };
      };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo crear la cuenta.');
        return;
      }

      if (result.data?.requiresEmailConfirmation) {
        setConfirmationEmail(email.trim());
        setSuccess('Revisa tu correo y confirma la cuenta para poder iniciar sesión.');
        return;
      }

      if (result.data?.requiresLogin) {
        setSuccess('La cuenta se creó. Inicia sesión con el correo y la contraseña que elegiste.');
        return;
      }

      router.replace('/home');
    } catch (error) {
      // E11b: sin internet (o sin llegar al servidor) no es un problema de configuración.
      setError(esFallaDeRed(error) ? NECESITAS_CONEXION : 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmation() {
    setError('');
    setSuccess('');
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: confirmationEmail }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo reenviar el correo de confirmación.');
        return;
      }

      setSuccess('Enviamos un nuevo enlace de confirmación. Usa el más reciente; los anteriores pueden haber vencido.');
    } catch {
      setError('No se pudo conectar con Supabase para reenviar la confirmación.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <TarjetaAcceso
      titulo="Crear cuenta"
      subtitulo="Elige un correo y una contraseña. No necesitas confirmar el correo para entrar."
      pie={
        <>
          ¿Ya tienes cuenta?{' '}
          <a className={CLASE_ENLACE_ACCESO} href="/login">
            Inicia sesión
          </a>
        </>
      }
    >
      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className={CLASE_ETIQUETA_ACCESO}>
            Correo electrónico
          </label>
          <input
            autoComplete="email"
            className={`${CLASE_CAMPO_ACCESO} border-borde`}
            id="email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            required
            type="email"
            value={email}
          />
        </div>
        <div>
          <label htmlFor="password" className={CLASE_ETIQUETA_ACCESO}>
            Contraseña
          </label>
          <input
            autoComplete="new-password"
            className={`${CLASE_CAMPO_ACCESO} border-borde`}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            type="password"
            value={password}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className={CLASE_ETIQUETA_ACCESO}>
            Confirmar contraseña
          </label>
          <input
            autoComplete="new-password"
            className={`${CLASE_CAMPO_ACCESO} border-borde`}
            id="confirm-password"
            name="confirm-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        {error && (
          <p className={CLASE_ERROR_ACCESO} role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className={CLASE_EXITO_ACCESO} role="status">
            {success}
          </p>
        )}
        {confirmationEmail && (
          <button
            className={`${claseBoton('secundario')} w-full`}
            disabled={isResending}
            onClick={resendConfirmation}
            type="button"
          >
            {isResending ? 'Reenviando…' : 'Reenviar correo de confirmación'}
          </button>
        )}

        <button
          className={`${claseBoton('primario')} min-h-12 w-full`}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

    </TarjetaAcceso>
  );
}
