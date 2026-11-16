// @vitest-environment node
// E15 (6.6, 7.8; RB-01, RB-16, RB-17): servicio de metas semanales con la base simulada y sus rutas.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultar: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar, conTransaccion: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/metasSemanales'));

import * as rutaMeta from '@/app/api/nova/metas/[id]/route';
import * as rutaMetas from '@/app/api/nova/metas/route';
import { crearMetaSemanal, eliminarMetaSemanal, listarMetasSemanales } from '@/lib/datos/metasSemanales';

const U = '11111111-1111-4111-8111-111111111111';
const ID = '66666666-6666-4666-8666-666666666666';
const json = (cuerpo: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) });
const duplicada = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'idx_metas_semanales_unica' });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
});

describe('metas semanales (6.6, 7.8)', () => {
  it('listar: solo las del usuario, con las tareas cerradas de la semana de Bogotá y el progreso calculado', async () => {
    m.consultar
      .mockResolvedValueOnce([
        { id: 'a', tipo: 'tareas', categoria: null, objetivo: 5 },
        { id: 'b', tipo: 'minutos', categoria: 'Universidad', objetivo: 180 },
      ])
      .mockResolvedValueOnce([
        { estado: 'Completada', fechaCierre: '2026-11-17', categoria: 'Universidad', minutosInvertidos: 120 },
        { estado: 'Completada', fechaCierre: '2026-11-22', categoria: 'Hogar', minutosInvertidos: 40 },
      ]);
    // Domingo 22 de nov. a las 23:00 en Bogotá (lunes 04:00 UTC): sigue siendo la semana del 16 al 22.
    const r = await listarMetasSemanales(U, new Date('2026-11-23T04:00:00Z'));
    expect(r.lunes).toBe('2026-11-16');
    expect(r.domingo).toBe('2026-11-22');
    expect(r.metas).toEqual([
      { id: 'a', tipo: 'tareas', categoria: null, objetivo: 5, progreso: 2, porcentaje: 40, cumplida: false },
      { id: 'b', tipo: 'minutos', categoria: 'Universidad', objetivo: 180, progreso: 120, porcentaje: 66, cumplida: false },
    ]);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U]);
    expect(String(m.consultar.mock.calls[1]?.[0])).toContain('fecha_cierre BETWEEN');
    expect(m.consultar.mock.calls[1]?.[1]).toEqual([U, '2026-11-16', '2026-11-22']);
  });

  it('crear de tareas global y de tiempo con la categoría guardada (" universidad " → "Universidad")', async () => {
    m.consultar.mockResolvedValueOnce([{ id: ID, tipo: 'tareas', categoria: null, objetivo: 5 }]);
    await crearMetaSemanal(U, { tipo: 'tareas', categoria: '', objetivo: '5' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, 'tareas', null, 5]);

    m.consultar.mockReset();
    m.consultar.mockResolvedValueOnce([{ nombre: 'Universidad' }]).mockResolvedValueOnce([{ id: ID, tipo: 'minutos', categoria: 'Universidad', objetivo: 180 }]);
    await crearMetaSemanal(U, { tipo: 'minutos', categoria: ' universidad ', horas: '3', minutos: '' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, 'universidad']);
    expect(m.consultar.mock.calls[1]?.[1]).toEqual([U, 'minutos', 'Universidad', 180]);
  });

  it('RB-16 sin tocar la base; una categoría que no es del usuario responde como inexistente', async () => {
    await expect(crearMetaSemanal(U, { tipo: 'tareas', objetivo: '0' })).rejects.toMatchObject({ codigo: 'OBJETIVO_INVALIDO', message: 'El objetivo debe ser un número entero mayor que 0.' });
    await expect(crearMetaSemanal(U, { tipo: 'minutos', horas: '0', minutos: '0' })).rejects.toMatchObject({ codigo: 'OBJETIVO_INVALIDO' });
    expect(m.consultar).not.toHaveBeenCalled();
    m.consultar.mockResolvedValueOnce([]);
    await expect(crearMetaSemanal(U, { tipo: 'tareas', categoria: 'Ajena', objetivo: 3 })).rejects.toMatchObject({ codigo: 'CATEGORIA_NO_ENCONTRADA' });
  });

  it('RB-17: la misma meta responde "Ya tienes una meta igual."', async () => {
    m.consultar.mockRejectedValueOnce(duplicada);
    await expect(crearMetaSemanal(U, { tipo: 'tareas', objetivo: 4 })).rejects.toMatchObject({ codigo: 'META_SEMANAL_DUPLICADA', message: 'Ya tienes una meta igual.' });
  });

  it('eliminar: solo la del usuario; ajena o inexistente responde como inexistente', async () => {
    m.consultar.mockResolvedValueOnce([{ id: ID }]);
    await expect(eliminarMetaSemanal(U, ID)).resolves.toEqual({ id: ID });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([ID, U]);
    m.consultar.mockResolvedValueOnce([]);
    await expect(eliminarMetaSemanal(U, ID)).rejects.toMatchObject({ codigo: 'META_SEMANAL_NO_ENCONTRADA' });
  });
});

describe('rutas /api/nova/metas', () => {
  const contexto = (id = ID) => ({ params: Promise.resolve({ id }) });

  it('sin sesión 401 y fuera de la lista 403, sin tocar la base', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await rutaMetas.GET()).status).toBe(estado);
      expect((await rutaMetas.POST(json({ tipo: 'tareas', objetivo: 3 }))).status).toBe(estado);
      expect((await rutaMeta.DELETE(new Request('http://x', { method: 'DELETE' }), contexto())).status).toBe(estado);
    }
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('crear responde 201 con el dueño de la sesión; RB-16 422 y RB-17 409 con sus mensajes', async () => {
    m.consultar.mockResolvedValueOnce([{ id: ID, tipo: 'tareas', categoria: null, objetivo: 3 }]);
    expect((await rutaMetas.POST(json({ tipo: 'tareas', categoria: null, objetivo: '3' }))).status).toBe(201);
    expect(m.consultar.mock.calls[0]?.[1]?.[0]).toBe(U);

    const invalido = await rutaMetas.POST(json({ tipo: 'tareas', objetivo: '-1' }));
    expect(invalido.status).toBe(422);
    expect((await invalido.json()).error.mensaje).toBe('El objetivo debe ser un número entero mayor que 0.');

    m.consultar.mockRejectedValueOnce(duplicada);
    const repetida = await rutaMetas.POST(json({ tipo: 'tareas', objetivo: 3 }));
    expect(repetida.status).toBe(409);
    expect((await repetida.json()).error.mensaje).toBe('Ya tienes una meta igual.');
  });

  it('un tipo desconocido, un campo de más o un id que no es uuid: 400', async () => {
    expect((await rutaMetas.POST(json({ tipo: 'horas', objetivo: 3 }))).status).toBe(400);
    expect((await rutaMetas.POST(json({ tipo: 'tareas', objetivo: 3, usuarioId: U }))).status).toBe(400);
    expect((await rutaMeta.DELETE(new Request('http://x', { method: 'DELETE' }), contexto('no-es-uuid'))).status).toBe(400);
    expect(m.consultar).not.toHaveBeenCalled();
  });
});
