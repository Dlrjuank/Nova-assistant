// @vitest-environment node
// E09 (RB-29): servicio editarTarea (base simulada) y PATCH /api/nova/tareas/[id].
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio, MENSAJES } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ tx: { query: vi.fn() }, consultar: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: (trabajo: (tx: typeof m.tx) => Promise<unknown>) => trabajo(m.tx),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/tareas'));

import * as ruta from '@/app/api/nova/tareas/[id]/route';
import { editarTarea, obtenerTarea } from '@/lib/datos/tareas';

const U = '11111111-1111-4111-8111-111111111111';
const T = '22222222-2222-4222-8222-222222222222';
const DATOS = { titulo: '  Nuevo título ', categoria: ' universidad ', prioridad: 3, fechaLimite: '2026-12-01', horaInicio: '08:00', horaFin: '09:30' };

/** Simula la base: estado de la tarea (null = no existe) y categoría ya registrada. */
function base(estado: string | null) {
  m.tx.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT estado')) return { rows: estado ? [{ estado }] : [] };
    if (sql.startsWith('SELECT nombre')) return { rows: [{ nombre: 'Universidad' }] };
    if (sql.includes('UPDATE tareas_personales')) return { rows: [{ id: T, titulo: 'Nuevo título', categoria: 'Universidad' }] };
    return { rows: [] };
  });
}
const sentencias = () => m.tx.query.mock.calls.map((c) => String(c[0]));
const patch = (cuerpo: unknown) => new Request(`http://x/api/nova/tareas/${T}`, { method: 'PATCH', body: JSON.stringify(cuerpo) });
const ctx = (id = T) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
});

describe('editarTarea', () => {
  it('actualiza solo título, categoría (RB-33), prioridad, fecha y horario, y solo del usuario', async () => {
    base('Pendiente');
    await editarTarea(U, T, DATOS);
    const update = m.tx.query.mock.calls.find((c) => String(c[0]).includes('UPDATE tareas_personales')) ?? [];
    const sql = String(update[0]);
    expect(sql).toContain('WHERE id = $1 AND usuario_id = $2');
    expect(update[1]).toEqual([T, U, 'Nuevo título', 'Universidad', 3, '2026-12-01', '08:00', '09:30']);
    const asignaciones = sql.slice(sql.indexOf('SET'), sql.indexOf('WHERE'));
    for (const intocable of ['estado', 'minutos_invertidos', 'fecha_cierre', 'fecha_creacion', 'usuario_id']) expect(asignaciones).not.toContain(intocable);
    expect(sentencias()[0]).toContain('FOR UPDATE');
  });

  it('completada: TAREA_YA_COMPLETADA, sin crear categoría ni actualizar', async () => {
    base('Completada');
    await expect(editarTarea(U, T, DATOS)).rejects.toMatchObject({ codigo: 'TAREA_YA_COMPLETADA' });
    expect(sentencias()).toHaveLength(1);
  });

  it('de otro usuario o inexistente: TAREA_NO_ENCONTRADA, filtrando por dueño', async () => {
    base(null);
    await expect(editarTarea(U, T, DATOS)).rejects.toMatchObject({ codigo: 'TAREA_NO_ENCONTRADA' });
    expect(m.tx.query.mock.calls[0]?.[1]).toEqual([T, U]);
    expect(sentencias()).toHaveLength(1);
  });

  it('valida como crear antes de tocar la base', async () => {
    await expect(editarTarea(U, T, { ...DATOS, fechaLimite: '2026-02-30' })).rejects.toMatchObject({ codigo: 'FECHA_INVALIDA' });
    await expect(editarTarea(U, T, { ...DATOS, prioridad: 5 })).rejects.toMatchObject({ codigo: 'PRIORIDAD_INVALIDA' });
    await expect(editarTarea(U, T, { ...DATOS, titulo: '   ' })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(editarTarea(U, T, { ...DATOS, horaInicio: null, horaFin: '09:00' })).rejects.toMatchObject({ codigo: 'HORA_FIN_SIN_INICIO' });
    expect(m.tx.query).not.toHaveBeenCalled();
  });

  it('obtenerTarea filtra por dueño y devuelve null si no hay', async () => {
    m.consultar.mockResolvedValue([]);
    expect(await obtenerTarea(U, T)).toBeNull();
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([T, U]);
  });
});

describe('PATCH /api/nova/tareas/[id]', () => {
  it('sin sesión 401; id inválido 4xx; datos válidos 200', async () => {
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await ruta.PATCH(patch(DATOS), ctx())).status).toBe(401);
    expect((await ruta.PATCH(patch(DATOS), ctx('no-es-uuid'))).status).toBeGreaterThanOrEqual(400);
    base('Pendiente');
    const r = await ruta.PATCH(patch(DATOS), ctx());
    expect(r.status).toBe(200);
    expect((await r.json()).datos.categoria).toBe('Universidad');
  });

  it('responde los mensajes exactos de crear y de RB-29', async () => {
    const error = async (cuerpo: unknown) => (await (await ruta.PATCH(patch(cuerpo), ctx())).json()).error.mensaje;
    expect(await error({ ...DATOS, fechaLimite: '2026-02-30' })).toBe(MENSAJES.FECHA_INVALIDA);
    expect(await error({ ...DATOS, prioridad: 5 })).toBe(MENSAJES.PRIORIDAD_INVALIDA);
    base('Completada');
    const completada = await ruta.PATCH(patch(DATOS), ctx());
    expect(completada.status).toBe(409);
    expect((await completada.json()).error.mensaje).toBe('La tarea ya está completada.');
    base(null);
    const ajena = await ruta.PATCH(patch(DATOS), ctx());
    expect(ajena.status).toBe(404);
    expect((await ajena.json()).error.mensaje).toBe('La tarea no existe.');
  });
});
