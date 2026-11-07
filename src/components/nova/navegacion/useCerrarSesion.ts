'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Cierra la sesión con la ruta existente del login; la barra lateral y la hoja "Más" lo comparten. */
export function useCerrarSesion() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setError('');
    setSaliendo(true);
    try {
      const respuesta = await fetch('/api/auth/logout', { method: 'POST' });
      if (!respuesta.ok) {
        setError('No se pudo cerrar la sesión.');
        return;
      }
      router.replace('/login');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setSaliendo(false);
    }
  }

  return { cerrarSesion, error, saliendo };
}
