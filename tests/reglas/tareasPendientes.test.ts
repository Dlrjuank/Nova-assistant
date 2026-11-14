// @vitest-environment node
// E11e (5.13, 7.14; RB-70 a RB-75; S-77 a S-80): reglas y envío de las tareas creadas sin conexión.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import {
  cabeOtraPendiente,
  decidirResultado,
  MAX_PENDIENTES,
  porEnviar,
  textoCerrarSesion,
  textoEnviadas,
  textoNoSeEnvio,
  textoPendientesDeEnviar,
  textoRecordatorioPasado,
  validarPendiente,
  type DatosPendiente,
  type TareaPendiente,
} from '@/lib/reglas/tareasPendientes';
import { borrarPendientesDeOtros, borrarTodasPendientes, conCandado, enviarPendientes, listarPendientes, type Almacen } from '@/lib/tareasPendientes';

const U = 'u1';
const datos = (extra: Partial<DatosPendiente> = {}): DatosPendiente => ({
  titulo: 'Clase',
  categoria: 'General',
  prioridad: 2,
  fechaLimite: '2026-11-20',
  horaInicio: null,
  horaFin: null,
  recordatorio: null,
  ...extra,
});
const pendiente = (id: string, creadaEn: number, extra: Partial<TareaPendiente> = {}): TareaPendiente => ({
  idCliente: id,
  usuarioId: U,
  creadaEn,
  datos: datos({ titulo: `Tarea ${id}` }),
  estado: 'pendiente',
  ...extra,
});

/** Un almacén en memoria con la misma interfaz que el de IndexedDB. */
function memoria(inicial: TareaPendiente[] = []): Almacen & { mapa: Map<string, TareaPendiente> } {
  const mapa = new Map(inicial.map((t) => [t.idCliente, t]));
  return {
    mapa,
    listar: async () => [...mapa.values()].map((t) => ({ ...t })),
    guardar: async (t) => void mapa.set(t.idCliente, { ...t }),
    borrar: async (id) => void mapa.delete(id),
  };
}

const respuesta = (estado: number, cuerpo: unknown = { ok: estado < 300, datos: {} }) => new Response(JSON.stringify(cuerpo), { status: estado });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mensajes exactos', () => {
  it('RB-71, RB-72, RB-73, RB-74 y RB-75, en singular y plural', () => {
    expect(textoPendientesDeEnviar(1)).toBe('1 tarea pendiente de enviar');
    expect(textoPendientesDeEnviar(3)).toBe('3 tareas pendientes de enviar');
    expect(textoEnviadas(2)).toBe('Se enviaron 2 tareas que creaste sin conexión.');
    expect(textoEnviadas(1)).toBe('Se envió 1 tarea que creaste sin conexión.');
    expect(textoRecordatorioPasado('Clase')).toBe('El recordatorio de «Clase» no se enviará: su momento pasó mientras estaba sin conexión.');
    expect(textoNoSeEnvio('La fecha no es válida.')).toBe('No se pudo enviar: La fecha no es válida.');
    expect(textoCerrarSesion(1)).toBe('Tienes 1 tarea sin enviar. Si cierras sesión, se borrará de este dispositivo.');
    expect(textoCerrarSesion(4)).toBe('Tienes 4 tareas sin enviar. Si cierras sesión, se borrarán de este dispositivo.');
  });
});

describe('S-77 · RB-70: mismas validaciones y tope de 50', () => {
  it('acepta una tarea válida y rechaza con los mensajes del servidor', () => {
    expect(() => validarPendiente(datos({ horaInicio: '10:00', recordatorio: '15_min', categoria: 'Universidad' }))).not.toThrow();
    expect(() => validarPendiente(datos({ titulo: '   ' }))).toThrow();
    expect(() => validarPendiente(datos({ fechaLimite: '2026-02-30' }))).toThrow(MENSAJES.FECHA_INVALIDA);
    expect(() => validarPendiente(datos({ prioridad: 5 }))).toThrow('La prioridad debe ser 1, 2 o 3');
    expect(() => validarPendiente(datos({ horaInicio: '11:00', horaFin: '10:00' }))).toThrow();
    expect(() => validarPendiente(datos({ recordatorio: '15_min' }))).toThrow('Ese recordatorio necesita la hora de inicio de la tarea.');
    expect(() => validarPendiente(datos({ categoria: 'x'.repeat(81) }))).toThrow();
  });

  it('como máximo 50; al corregir una que ya estaba no cuenta dos veces', () => {
    const llenas = Array.from({ length: MAX_PENDIENTES }, (_, i) => ({ idCliente: `t${i}` }));
    expect(MAX_PENDIENTES).toBe(50);
    expect(cabeOtraPendiente(llenas.slice(1), 'nueva')).toBe(true);
    expect(cabeOtraPendiente(llenas, 'nueva')).toBe(false);
    expect(cabeOtraPendiente(llenas, 't7')).toBe(true);
  });
});

describe('S-78 · RB-72, 7.14: el envío según el resultado', () => {
  it('qué hace con cada respuesta', () => {
    expect([200, 201].map(decidirResultado)).toEqual(['enviada', 'enviada']);
    expect([400, 422].map(decidirResultado)).toEqual(['rechazada', 'rechazada']);
    expect([401, 403].map(decidirResultado)).toEqual(['detener', 'detener']);
    expect([500, 503, 404, 429].map(decidirResultado)).toEqual(['reintentar', 'reintentar', 'reintentar', 'reintentar']);
  });

  it('solo las del usuario de la sesión y pendientes, en el orden en que se crearon', () => {
    const lista = [pendiente('c', 3), pendiente('a', 1), pendiente('x', 0, { usuarioId: 'otro' }), pendiente('r', 2, { estado: 'rechazada' }), pendiente('b', 2)];
    expect(porEnviar(lista, U).map((t) => t.idCliente)).toEqual(['a', 'b', 'c']);
  });

  it('201 y 200 (ya existía) se borran; cada envío lleva su idCliente y sus datos', async () => {
    const almacen = memoria([pendiente('b', 2), pendiente('a', 1)]);
    const pedir = vi.fn<typeof fetch>().mockResolvedValueOnce(respuesta(201)).mockResolvedValueOnce(respuesta(200));
    await expect(enviarPendientes(U, { almacen, pedir })).resolves.toEqual({ enviadas: 2, avisos: [], rechazadas: 0, detenido: false });
    expect(almacen.mapa.size).toBe(0);
    const cuerpos = pedir.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(cuerpos.map((c) => c.idCliente)).toEqual(['a', 'b']);
    expect(cuerpos[0]).toMatchObject({ titulo: 'Tarea a', fechaLimite: '2026-11-20', categoria: 'General' });
    expect(pedir.mock.calls[0]?.[0]).toBe('/api/nova/tareas');
  });

  it('422: queda "No se pudo enviar" con el mensaje del servidor y sigue con las demás; no se reintenta sola', async () => {
    const almacen = memoria([pendiente('a', 1), pendiente('b', 2)]);
    const pedir = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(respuesta(422, { ok: false, error: { codigo: 'FECHA_INVALIDA', mensaje: 'La fecha límite no es válida' } }))
      .mockResolvedValueOnce(respuesta(201));
    await expect(enviarPendientes(U, { almacen, pedir })).resolves.toMatchObject({ enviadas: 1, rechazadas: 1, detenido: false });
    expect(almacen.mapa.get('a')).toMatchObject({ estado: 'rechazada', error: 'La fecha límite no es válida' });
    pedir.mockClear();
    await enviarPendientes(U, { almacen, pedir });
    expect(pedir).not.toHaveBeenCalled();
  });

  it('401: se detiene sin borrar nada; sin red o con 5xx, queda pendiente para el próximo intento', async () => {
    for (const fallo of [() => Promise.resolve(respuesta(401)), () => Promise.resolve(respuesta(503)), () => Promise.reject(new TypeError('Failed to fetch'))]) {
      const almacen = memoria([pendiente('a', 1), pendiente('b', 2)]);
      const pedir = vi.fn<typeof fetch>().mockImplementation(fallo);
      await expect(enviarPendientes(U, { almacen, pedir })).resolves.toMatchObject({ enviadas: 0, detenido: true });
      expect(pedir).toHaveBeenCalledTimes(1); // no sigue con las demás
      expect([...almacen.mapa.values()].every((t) => t.estado === 'pendiente')).toBe(true);
    }
  });

  it('Web Locks: dos pestañas a la vez, una espera a la otra y no envía nada dos veces', async () => {
    const cola: Array<() => Promise<unknown>> = [];
    let ocupado = Promise.resolve();
    vi.stubGlobal('navigator', {
      locks: {
        request: (_nombre: string, trabajo: () => Promise<unknown>) => {
          const turno = ocupado.then(() => trabajo());
          ocupado = turno.then(
            () => undefined,
            () => undefined,
          );
          cola.push(() => turno);
          return turno;
        },
      },
    });
    const almacen = memoria([pendiente('a', 1), pendiente('b', 2)]);
    const pedir = vi.fn<typeof fetch>().mockImplementation(async () => respuesta(201));
    const [uno, dos] = await Promise.all([conCandado(() => enviarPendientes(U, { almacen, pedir })), conCandado(() => enviarPendientes(U, { almacen, pedir }))]);
    expect(uno.enviadas + dos.enviadas).toBe(2);
    expect(pedir).toHaveBeenCalledTimes(2);
    expect(cola).toHaveLength(2);
  });
});

describe('S-79 · RB-73: el recordatorio lo calcula el servidor', () => {
  it('si llegó omitido porque su momento pasó, avisa con el título', async () => {
    const t = pendiente('a', 1, { datos: datos({ titulo: 'Pagar', recordatorio: 'a_la_hora' }) });
    const almacen = memoria([t, pendiente('b', 2, { datos: datos({ titulo: 'Sin aviso' }) })]);
    const pedir = vi.fn<typeof fetch>().mockImplementation(async () => respuesta(201, { ok: true, datos: { recordatorioEstado: 'omitido' } }));
    const r = await enviarPendientes(U, { almacen, pedir });
    expect(r.avisos).toEqual(['El recordatorio de «Pagar» no se enviará: su momento pasó mientras estaba sin conexión.']);
  });
});

describe('S-80 · RB-75: otro usuario y cerrar sesión', () => {
  it('las de otro usuario no se listan ni se envían, y se borran al detectarlo; cerrar sesión borra todas', async () => {
    const almacen = memoria([pendiente('a', 1), pendiente('x', 0, { usuarioId: 'otro' })]);
    expect((await listarPendientes(U, almacen)).map((t) => t.idCliente)).toEqual(['a']);
    const pedir = vi.fn<typeof fetch>().mockImplementation(async () => respuesta(201));
    await enviarPendientes(U, { almacen, pedir });
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(pedir.mock.calls[0]?.[1]?.body)).idCliente).toBe('a');
    expect(await borrarPendientesDeOtros(U, almacen)).toBe(1);
    expect(almacen.mapa.size).toBe(0);
    const otra = memoria([pendiente('a', 1), pendiente('b', 2)]);
    await borrarTodasPendientes(otra);
    expect(otra.mapa.size).toBe(0);
  });
});
