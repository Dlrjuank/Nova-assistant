'use client';

import { useState, type FormEvent } from 'react';
import { claseBoton } from '@/components/ui/Boton';
import {
  CLASE_CAMPO_ACCESO,
  CLASE_ERROR_ACCESO,
  CLASE_ETIQUETA_ACCESO,
  CLASE_EXITO_ACCESO,
} from './TarjetaAcceso';

export function RecoveryRequestForm() {
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensaje('');
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = (await response.json()) as { mensaje?: string; error?: string };

      if (!response.ok) {
        setError(result.error ?? 'No se pudo procesar la solicitud.');
        return;
      }

      setMensaje(
        result.mensaje ??
          'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
      );
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className={CLASE_ETIQUETA_ACCESO}>
          Correo electrónico
        </label>
        <input
          autoComplete="email"
          className={`${CLASE_CAMPO_ACCESO} border-borde`}
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          required
          type="email"
          value={email}
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
      {mensaje && (
        <p
          className={CLASE_EXITO_ACCESO}
          role="status"
        >
          {mensaje}
        </p>
      )}
      <button
        className={`${claseBoton('primario')} min-h-12 w-full`}
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
      </button>
    </form>
  );
}
