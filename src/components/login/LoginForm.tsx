'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { claseBoton } from '@/components/ui/Boton';
import { esFallaDeRed, NECESITAS_CONEXION } from '@/lib/reglas/sinConexion';
import {
  CLASE_CAMPO_ACCESO,
  CLASE_ENLACE_ACCESO,
  CLASE_ERROR_ACCESO,
  CLASE_ERROR_CAMPO,
  CLASE_ETIQUETA_ACCESO,
  CLASE_EXITO_ACCESO,
} from './TarjetaAcceso';
import { EntradaNova } from './EntradaNova';
import { EntrarConGoogle } from './EntrarConGoogle';

type FormErrors = {
  email?: string;
  password?: string;
};

interface LoginFormProps {
  successMessage?: string | undefined;
  /** E20c-3: el aviso al volver de Google (tope de cuentas o un error). */
  errorInicial?: string | undefined;
}

export function LoginForm({ successMessage, errorInicial }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [authError, setAuthError] = useState(errorInicial ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    }
    if (!password.trim()) {
      nextErrors.password = 'Ingresa tu contraseña.';
    }

    setErrors(nextErrors);
    setAuthError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const result = (await response.json()) as {
        error?: string;
        data?: { isAdmin?: boolean };
      };

      if (!response.ok) {
        setAuthError(result.error ?? 'No se pudo iniciar sesión.');
        return;
      }

      router.replace('/nova');
    } catch (error) {
      // E11b: sin internet (o sin llegar al servidor) no es un problema de configuración.
      setAuthError(esFallaDeRed(error) ? NECESITAS_CONEXION : 'No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // E20b (commit 10): la entrada con la Estrella nova en un cielo de noche. El formulario y su lógica no cambian.
    <EntradaNova
      titulo="Bienvenido de nuevo"
      subtitulo="Inicia sesión para continuar."
      pie={
        <span className="flex flex-col items-center gap-3">
          <a className={CLASE_ENLACE_ACCESO} href="/register">
            Crear una cuenta
          </a>
          <a className={CLASE_ENLACE_ACCESO} href="/privacidad">
            Privacidad
          </a>
        </span>
      }
    >
      {/* E20c-3 (RB-81): "Entrar con Google" arriba; el correo y la contraseña, debajo. */}
      <div className="mb-5">
        <EntrarConGoogle />
      </div>
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
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            type="email"
            value={email}
          />
          {errors.email && (
            <p className={CLASE_ERROR_CAMPO} id="email-error">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium text-texto">
              Contraseña
            </label>
            <a
              className={`text-right text-sm ${CLASE_ENLACE_ACCESO}`}
              href="/recuperar-contrasena"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
          <input
            autoComplete="current-password"
            className={`${CLASE_CAMPO_ACCESO} border-borde`}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            aria-describedby={errors.password ? 'password-error' : undefined}
            aria-invalid={Boolean(errors.password)}
            type="password"
            value={password}
          />
          {errors.password && (
            <p className={CLASE_ERROR_CAMPO} id="password-error">
              {errors.password}
            </p>
          )}
        </div>

        {successMessage && (
          <p
            className={CLASE_EXITO_ACCESO}
            role="status"
          >
            {successMessage}
          </p>
        )}

        {authError && (
          <p className={CLASE_ERROR_ACCESO} role="alert">
            {authError}
          </p>
        )}

        <button
          className={`${claseBoton('primario')} min-h-12 w-full`}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Entrando...' : 'Iniciar sesión'}
        </button>
      </form>

    </EntradaNova>
  );
}
