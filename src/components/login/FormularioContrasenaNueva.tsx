'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { CLASE_CONTROL } from '@/components/ui/Campo';
import { useListo } from '@/components/ui/useListo';
import { validarContrasenaNueva } from '@/lib/reglas/cuentas';
import { MENSAJES } from '@/lib/reglas/errores';

/**
 * E20c-3: poner una contraseña propia. Lo usan la pantalla obligatoria tras la contraseña temporal (RB-91, sin la
 * anterior; al terminar entra a Nova) y Configuración → Sesión (con la anterior, salvo si la sesión entró con Google).
 */
export function FormularioContrasenaNueva({ pideActual, alTerminar }: { pideActual: boolean; alTerminar: 'nova' | 'quedarse' }) {
  const router = useRouter();
  const id = useId();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, marcarListo] = useListo();

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invalida = validarContrasenaNueva(nueva, confirmar);
    if (invalida) {
      setError(invalida);
      return;
    }
    setError('');
    setGuardando(true);
    try {
      const r = await fetch('/api/cuenta/contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(pideActual ? { actual } : {}), nueva, confirmar }),
      });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: { mensaje?: string } } | null;
      if (!r.ok || !d?.ok) {
        setError(d?.error?.mensaje ?? MENSAJES.ERROR_INTERNO);
        return;
      }
      setActual('');
      setNueva('');
      setConfirmar('');
      marcarListo();
      if (alTerminar === 'nova') router.replace('/nova');
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const campo = (etiqueta: string, sufijo: string, valor: string, cambiar: (v: string) => void, autocompletar: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-${sufijo}`} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>
      <input id={`${id}-${sufijo}`} type="password" autoComplete={autocompletar} value={valor} onChange={(e) => cambiar(e.target.value)} className={CLASE_CONTROL} />
    </div>
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={enviar} noValidate data-contrasena-nueva>
      {pideActual && campo('Contraseña actual', 'actual', actual, setActual, 'current-password')}
      {campo('Contraseña nueva', 'nueva', nueva, setNueva, 'new-password')}
      {campo('Repite la contraseña nueva', 'confirmar', confirmar, setConfirmar, 'new-password')}
      <p className="text-xs text-texto-suave">De 8 a 128 caracteres.</p>
      {error && (
        <p role="alert" className="text-sm font-medium text-peligro">
          {error}
        </p>
      )}
      <Boton type="submit" cargando={guardando} listo={listo} textoListo="Guardada" className="self-start">
        Guardar contraseña
      </Boton>
    </form>
  );
}
