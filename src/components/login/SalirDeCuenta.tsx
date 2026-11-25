'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton } from '@/components/ui/Boton';

/** E20c-2: "Cerrar sesión" en /cuenta, para entrar con otra cuenta. */
export function SalirDeCuenta() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function salir() {
    setCargando(true);
    setError('');
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) {
        setError('No se pudo cerrar la sesión. Intenta de nuevo.');
        return;
      }
      router.replace('/login');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Boton type="button" variante="secundario" className="min-h-12 w-full" cargando={cargando} onClick={salir}>
        Cerrar sesión
      </Boton>
      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
