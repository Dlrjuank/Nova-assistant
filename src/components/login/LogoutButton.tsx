'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function handleLogout() {
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        setError('No se pudo cerrar la sesión de Supabase.');
        return;
      }
      router.replace('/login');
    } catch {
      setError('No se pudo conectar con Supabase.');
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white transition hover:bg-white/10"
        onClick={handleLogout}
        type="button"
      >
        Cerrar sesión
      </button>
      {error && <p className="text-sm text-rose-200" role="alert">{error}</p>}
    </div>
  );
}
