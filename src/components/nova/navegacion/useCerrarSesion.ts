'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePendientes } from '@/components/nova/pendientes/ProveedorPendientes';

/**
 * Cierra la sesión con la ruta existente del login; la barra lateral, la hoja "Más" y Configuración lo comparten.
 * E11e (RB-75): con tareas sin enviar, primero se avisa; al confirmar se borran del dispositivo.
 */
export function useCerrarSesion() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [saliendo, setSaliendo] = useState(false);
  const { confirmarCierreSesion } = usePendientes();

  async function cerrarSesion() {
    setError('');
    if (!(await confirmarCierreSesion())) return;
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
