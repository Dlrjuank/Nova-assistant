'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { claseBoton } from '@/components/ui/Boton';
import {
  CLASE_CAMPO_ACCESO,
  CLASE_ERROR_ACCESO,
  CLASE_ETIQUETA_ACCESO,
} from './TarjetaAcceso';

interface PasswordResetFormProps {
  token: string;
}

export function PasswordResetForm({ token }: PasswordResetFormProps) {
  const router = useRouter();
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contrasena, confirmacion }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo cambiar la contraseña.');
        return;
      }

      router.replace('/login?restablecida=1');
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="contrasena" className={CLASE_ETIQUETA_ACCESO}>
          Nueva contraseña
        </label>
        <input
          autoComplete="new-password"
          className={`${CLASE_CAMPO_ACCESO} border-borde`}
          id="contrasena"
          minLength={8}
          onChange={(event) => setContrasena(event.target.value)}
          required
          type="password"
          value={contrasena}
        />
      </div>
      <div>
        <label htmlFor="confirmacion" className={CLASE_ETIQUETA_ACCESO}>
          Confirmar contraseña
        </label>
        <input
          autoComplete="new-password"
          className={`${CLASE_CAMPO_ACCESO} border-borde`}
          id="confirmacion"
          minLength={8}
          onChange={(event) => setConfirmacion(event.target.value)}
          required
          type="password"
          value={confirmacion}
        />
      </div>
      {error && (
        <p
          className={CLASE_ERROR_ACCESO}
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        className={`${claseBoton('primario')} min-h-12 w-full`}
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Actualizando…' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}
