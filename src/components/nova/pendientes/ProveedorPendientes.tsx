'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Dialogo } from '@/components/ui/Dialogo';
import { BOTON_CERRAR_Y_BORRAR, textoCerrarSesion, textoEnviadas, type TareaPendiente } from '@/lib/reglas/tareasPendientes';
import {
  borrarPendientesDeOtros,
  borrarTodasPendientes,
  conCandado,
  enviarPendientes,
  escucharPendientes,
  listarPendientes,
} from '@/lib/tareasPendientes';

/** Cada cuánto se reintenta mientras queden pendientes (7.14). */
export const REINTENTO_MS = 30_000;
/** Un aviso que debe sobrevivir a un cambio de pantalla sin conexión (que recarga la página). */
const CLAVE_AVISO = 'nova-aviso-pendientes';

interface ValorPendientes {
  usuarioId: string | null;
  lista: TareaPendiente[];
  /** Muestra un aviso breve; con `alSiguientePantalla`, también si la página se recarga antes. */
  avisar: (texto: string, alSiguientePantalla?: boolean) => void;
  /** RB-75: true si se puede cerrar sesión (no hay pendientes, o el usuario aceptó borrarlas). */
  confirmarCierreSesion: () => Promise<boolean>;
}

const Contexto = createContext<ValorPendientes>({
  usuarioId: null,
  lista: [],
  avisar: () => undefined,
  confirmarCierreSesion: async () => true,
});

export const usePendientes = () => useContext(Contexto);

/** Las del usuario con fecha límite en `fecha` (para Inicio y el Calendario). */
export function usePendientesDelDia(fecha: string): TareaPendiente[] {
  return usePendientes().lista.filter((t) => t.datos.fechaLimite === fecha);
}

function leerAvisoGuardado(): string | null {
  try {
    const texto = sessionStorage.getItem(CLAVE_AVISO);
    sessionStorage.removeItem(CLAVE_AVISO);
    return texto;
  } catch {
    return null;
  }
}

/**
 * E11e (5.13; RB-70 a RB-75): las tareas creadas sin conexión de este usuario. Las envía solas al abrir Nova con
 * conexión, al volver la conexión y cada 30 s mientras queden; muestra los avisos y pide confirmación antes de
 * cerrar sesión si hay alguna sin enviar. Las de otro usuario se borran del dispositivo.
 */
export function ProveedorPendientes({ usuarioId, children }: { usuarioId: string; children: ReactNode }) {
  const router = useRouter();
  const [lista, setLista] = useState<TareaPendiente[]>([]);
  const [avisos, setAvisos] = useState<Array<{ id: number; texto: string }>>([]);
  const [confirmar, setConfirmar] = useState<{ n: number; resolver: (si: boolean) => void } | null>(null);
  const enviando = useRef(false);
  const origenDialogo = useRef<HTMLElement | null>(null);
  const contador = useRef(0);

  const avisar = useCallback((texto: string, alSiguientePantalla = false) => {
    if (alSiguientePantalla) {
      try {
        sessionStorage.setItem(CLAVE_AVISO, texto);
      } catch {
        // Sin almacenamiento: el aviso se ve solo si no se recarga.
      }
    }
    const id = ++contador.current;
    setAvisos((previos) => [...previos, { id, texto }]);
    window.setTimeout(() => setAvisos((previos) => previos.filter((a) => a.id !== id)), 7000);
  }, []);

  const recargar = useCallback(async () => {
    try {
      setLista(await listarPendientes(usuarioId));
    } catch {
      setLista([]); // sin IndexedDB (por ejemplo, navegación privada): no hay pendientes que mostrar
    }
  }, [usuarioId]);

  const enviar = useCallback(async () => {
    if (enviando.current || !navigator.onLine) return;
    enviando.current = true;
    try {
      const r = await conCandado(() => enviarPendientes(usuarioId));
      if (r.enviadas > 0) {
        avisar(textoEnviadas(r.enviadas));
        router.refresh();
      }
      for (const a of r.avisos) avisar(a);
    } catch {
      // Se reintenta en el próximo turno.
    } finally {
      enviando.current = false;
      void recargar();
    }
  }, [usuarioId, avisar, recargar, router]);

  useEffect(() => {
    const guardado = leerAvisoGuardado();
    if (guardado) avisar(guardado);
    let vivo = true;
    void (async () => {
      try {
        await borrarPendientesDeOtros(usuarioId); // RB-75
      } catch {
        // Sin IndexedDB.
      }
      if (vivo) {
        await recargar();
        await enviar();
      }
    })();
    const dejar = escucharPendientes(() => void recargar());
    const alVolver = () => void enviar();
    window.addEventListener('online', alVolver);
    return () => {
      vivo = false;
      dejar();
      window.removeEventListener('online', alVolver);
    };
  }, [usuarioId, avisar, recargar, enviar]);

  const quedan = lista.some((t) => t.estado === 'pendiente');
  useEffect(() => {
    if (!quedan) return;
    const temporizador = window.setInterval(() => void enviar(), REINTENTO_MS);
    return () => window.clearInterval(temporizador);
  }, [quedan, enviar]);

  const confirmarCierreSesion = useCallback(async () => {
    let n = 0;
    try {
      n = (await listarPendientes(usuarioId)).length;
    } catch {
      n = 0;
    }
    if (n === 0) return true;
    origenDialogo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const si = await new Promise<boolean>((resolver) => setConfirmar({ n, resolver }));
    if (si) await borrarTodasPendientes().catch(() => undefined);
    return si;
  }, [usuarioId]);

  const responder = (si: boolean) => {
    confirmar?.resolver(si);
    setConfirmar(null);
  };

  return (
    <Contexto.Provider value={{ usuarioId, lista, avisar, confirmarCierreSesion }}>
      {children}
      <Dialogo abierto={confirmar !== null} titulo="Cerrar sesión" descripcion={confirmar ? textoCerrarSesion(confirmar.n) : ''} alCerrar={() => responder(false)} origen={origenDialogo}>
        <div className="flex flex-wrap gap-3">
          <Boton variante="peligro" onClick={() => responder(true)}>
            {BOTON_CERRAR_Y_BORRAR}
          </Boton>
          <Boton variante="secundario" onClick={() => responder(false)}>
            Cancelar
          </Boton>
        </div>
      </Dialogo>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+var(--nova-seguro-abajo))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {avisos.map((a) => (
          <p key={a.id} className="max-w-md rounded-xl bg-texto px-4 py-2 text-center text-sm font-medium text-fondo shadow-suave">
            {a.texto}
          </p>
        ))}
      </div>
    </Contexto.Provider>
  );
}
