import { MENSAJES } from '@/lib/reglas/errores';
import { decidirResultado, porEnviar, textoRecordatorioPasado, type TareaPendiente } from '@/lib/reglas/tareasPendientes';

/**
 * E11e (5.13, 7.14): las tareas creadas sin conexión, guardadas en este dispositivo (IndexedDB), y su envío. Solo
 * en el navegador. Cada cambio se avisa a esta pestaña (evento) y a las demás (BroadcastChannel).
 */

const BASE = 'nova-pendientes';
const ALMACEN = 'tareas';
const EVENTO = 'nova-pendientes';
const CANDADO = 'nova-envio-pendientes';

export interface Almacen {
  listar(): Promise<TareaPendiente[]>;
  guardar(t: TareaPendiente): Promise<void>;
  borrar(idCliente: string): Promise<void>;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(ALMACEN)) pedido.result.createObjectStore(ALMACEN, { keyPath: 'idCliente' });
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error ?? new Error('IndexedDB'));
  });
}

async function operar<T>(modo: IDBTransactionMode, hacer: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  try {
    return await new Promise<T>((resolver, rechazar) => {
      const tx = bd.transaction(ALMACEN, modo);
      const pedido = hacer(tx.objectStore(ALMACEN));
      tx.oncomplete = () => resolver(pedido.result);
      tx.onerror = () => rechazar(tx.error ?? new Error('IndexedDB'));
      tx.onabort = () => rechazar(tx.error ?? new Error('IndexedDB'));
    });
  } finally {
    bd.close();
  }
}

function avisarCambio(): void {
  window.dispatchEvent(new Event(EVENTO));
  try {
    const canal = new BroadcastChannel(EVENTO);
    canal.postMessage('cambio');
    canal.close();
  } catch {
    // Sin BroadcastChannel: las otras pestañas se enteran en su siguiente revisión.
  }
}

/** El almacén real del dispositivo. */
export const almacenDispositivo: Almacen = {
  listar: () => operar('readonly', (a) => a.getAll() as IDBRequest<TareaPendiente[]>),
  guardar: async (t) => {
    await operar('readwrite', (a) => a.put(t));
    avisarCambio();
  },
  borrar: async (idCliente) => {
    await operar('readwrite', (a) => a.delete(idCliente));
    avisarCambio();
  },
};

/** Las del usuario, en el orden en que se crearon (pendientes y rechazadas). */
export async function listarPendientes(usuarioId: string, almacen: Almacen = almacenDispositivo): Promise<TareaPendiente[]> {
  return (await almacen.listar()).filter((t) => t.usuarioId === usuarioId).sort((a, b) => a.creadaEn - b.creadaEn);
}

export async function obtenerPendiente(idCliente: string, usuarioId: string, almacen: Almacen = almacenDispositivo): Promise<TareaPendiente | null> {
  return (await listarPendientes(usuarioId, almacen)).find((t) => t.idCliente === idCliente) ?? null;
}

/** RB-75: las de otro usuario nunca se envían con esta sesión y se borran al detectarlo. */
export async function borrarPendientesDeOtros(usuarioId: string, almacen: Almacen = almacenDispositivo): Promise<number> {
  const otras = (await almacen.listar()).filter((t) => t.usuarioId !== usuarioId);
  for (const t of otras) await almacen.borrar(t.idCliente);
  return otras.length;
}

/** RB-75: al cerrar sesión, todas. */
export async function borrarTodasPendientes(almacen: Almacen = almacenDispositivo): Promise<void> {
  for (const t of await almacen.listar()) await almacen.borrar(t.idCliente);
}

/** Escucha los cambios de esta pestaña y de las demás. Devuelve la función para dejar de escuchar. */
export function escucharPendientes(alCambiar: () => void): () => void {
  window.addEventListener(EVENTO, alCambiar);
  let canal: BroadcastChannel | null = null;
  try {
    canal = new BroadcastChannel(EVENTO);
    canal.onmessage = alCambiar;
  } catch {
    canal = null;
  }
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    canal?.close();
  };
}

/** Una sola pestaña envía a la vez (Web Locks); las demás esperan su turno y luego encuentran la lista vacía. */
export async function conCandado<T>(trabajo: () => Promise<T>): Promise<T> {
  const candados = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!candados?.request) return trabajo();
  return candados.request(CANDADO, () => trabajo()) as Promise<T>;
}

export interface ResultadoEnvioPendientes {
  enviadas: number;
  /** RB-73: los recordatorios que ya pasaron. */
  avisos: string[];
  rechazadas: number;
  /** Se detuvo por red, 5xx o sesión: quedan pendientes para el próximo intento. */
  detenido: boolean;
}

/**
 * RB-72, 7.14: envía las pendientes del usuario, en orden de creación, con su `idCliente`; el servidor nunca las
 * duplica. Cada resultado decide qué pasa con la tarea en el dispositivo.
 */
export async function enviarPendientes(
  usuarioId: string,
  dependencias: { almacen?: Almacen; pedir?: typeof fetch } = {},
): Promise<ResultadoEnvioPendientes> {
  const almacen = dependencias.almacen ?? almacenDispositivo;
  const pedir = dependencias.pedir ?? fetch;
  const r: ResultadoEnvioPendientes = { enviadas: 0, avisos: [], rechazadas: 0, detenido: false };
  for (const t of porEnviar(await almacen.listar(), usuarioId)) {
    let respuesta: Response;
    try {
      respuesta = await pedir('/api/nova/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...t.datos, idCliente: t.idCliente }),
      });
    } catch {
      r.detenido = true; // red: se reintenta después
      return r;
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      datos?: { recordatorioEstado?: string | null };
      error?: { mensaje?: string };
    } | null;
    const decision = decidirResultado(respuesta.status);
    if (decision === 'enviada') {
      await almacen.borrar(t.idCliente);
      r.enviadas++;
      if (t.datos.recordatorio && cuerpo?.datos?.recordatorioEstado === 'omitido') r.avisos.push(textoRecordatorioPasado(t.datos.titulo));
    } else if (decision === 'rechazada') {
      await almacen.guardar({ ...t, estado: 'rechazada', error: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO });
      r.rechazadas++;
    } else {
      r.detenido = true;
      return r;
    }
  }
  return r;
}
