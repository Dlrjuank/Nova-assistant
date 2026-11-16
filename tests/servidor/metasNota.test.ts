// @vitest-environment node
// E16 (6.7, RB-01, RB-18): metas de nota de una materia o de sus cortes, con la base simulada, y su ruta.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultar: vi.fn(), txQuery: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/datos/configuracion', () => ({ obtenerPreferencias: vi.fn() }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/semestre'));

import * as ruta from '@/app/api/nova/metas-nota/route';
import { guardarMetaNota, listarMetasNota, quitarCortes, quitarMetaNota } from '@/lib/datos/semestre';

const U = '11111111-1111-4111-8111-111111111111';
const MAT = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333331';

const llamadas = (texto: string) => m.txQuery.mock.calls.filter(([sql]) => String(sql).includes(texto));
/** La materia bloqueada (con o sin cortes) y si el corte pedido es suyo. */
function base(usaCortes: boolean | null, corteEsSuyo = true) {
  m.txQuery.mockImplementation(async (sql: string, valores: unknown[]) => {
    if (sql.includes('FROM materias')) return { rows: usaCortes === null ? [] : [{ usa_cortes: usaCortes }] };
    if (sql.includes('SELECT 1 FROM cortes')) return { rows: corteEsSuyo ? [{}] : [] };
    if (sql.includes('INSERT INTO metas_nota')) return { rows: [{ materiaId: valores[1], corteId: valores[2], meta: valores[3] }] };
    if (sql.includes('count(*)')) return { rows: [{ n: 1 }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
});

describe('metas de nota (6.7)', () => {
  it('meta de la materia: 4,5 → 450; se crea o se cambia (una por materia)', async () => {
    base(false);
    await expect(guardarMetaNota(U, { materiaId: MAT, corteId: null, meta: '4,5' })).resolves.toEqual({ materiaId: MAT, corteId: null, meta: 450 });
    const sql = String(llamadas('INSERT INTO metas_nota')[0]?.[0]);
    expect(sql).toContain('ON CONFLICT ON CONSTRAINT metas_nota_unica DO UPDATE');
    expect(llamadas('INSERT INTO metas_nota')[0]?.[1]).toEqual([U, MAT, null, 450]);
    expect(String(llamadas('FROM materias')[0]?.[0])).toContain('FOR UPDATE');
  });

  it('RB-18 sin tocar la base', async () => {
    for (const malo of ['0', '5,1', 'cuatro', '']) {
      await expect(guardarMetaNota(U, { materiaId: MAT, corteId: null, meta: malo })).rejects.toMatchObject({ codigo: 'META_INVALIDA', message: 'La meta debe estar entre 0,1 y 5,0.' });
    }
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('meta de corte: solo en materias con cortes y con un corte de esa materia', async () => {
    base(true);
    await expect(guardarMetaNota(U, { materiaId: MAT, corteId: C1, meta: '4' })).resolves.toMatchObject({ corteId: C1, meta: 400 });
    expect(llamadas('SELECT 1 FROM cortes')[0]?.[1]).toEqual([C1, MAT, U]);
    base(false);
    await expect(guardarMetaNota(U, { materiaId: MAT, corteId: C1, meta: '4' })).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
    base(true, false);
    await expect(guardarMetaNota(U, { materiaId: MAT, corteId: C1, meta: '4' })).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
  });

  it('RB-01: una materia ajena responde como inexistente', async () => {
    base(null);
    await expect(guardarMetaNota(U, { materiaId: MAT, corteId: null, meta: '4' })).rejects.toMatchObject({ codigo: 'MATERIA_NO_ENCONTRADA' });
  });

  it('listar y quitar solo las del usuario; quitar la que no existe responde 404', async () => {
    m.consultar.mockResolvedValueOnce([{ materiaId: MAT, corteId: null, meta: 400 }]);
    await expect(listarMetasNota(U, MAT)).resolves.toHaveLength(1);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, MAT]);
    m.consultar.mockResolvedValueOnce([{ id: 'x' }]);
    await quitarMetaNota(U, { materiaId: MAT, corteId: C1 });
    expect(String(m.consultar.mock.calls[1]?.[0])).toContain('corte_id IS NOT DISTINCT FROM');
    expect(m.consultar.mock.calls[1]?.[1]).toEqual([MAT, U, C1]);
    m.consultar.mockResolvedValueOnce([]);
    await expect(quitarMetaNota(U, { materiaId: MAT, corteId: null })).rejects.toMatchObject({ codigo: 'META_NO_ENCONTRADA' });
  });

  it('al quitar los cortes se borran las metas de corte; la de la materia queda', async () => {
    base(true);
    await quitarCortes(U, MAT);
    const borrar = llamadas('DELETE FROM metas_nota');
    expect(String(borrar[0]?.[0])).toContain('corte_id IS NOT NULL');
    expect(borrar[0]?.[1]).toEqual([MAT, U]);
  });
});

describe('ruta /api/nova/metas-nota', () => {
  const put = (cuerpo: unknown) => new Request('http://x', { method: 'PUT', body: JSON.stringify(cuerpo) });

  it('sin sesión 401 y fuera de la lista 403, sin tocar la base', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await ruta.PUT(put({ materiaId: MAT, corteId: null, meta: '4' }))).status).toBe(estado);
      expect((await ruta.DELETE(new Request(`http://x?materia=${MAT}`, { method: 'DELETE' }))).status).toBe(estado);
    }
    expect(m.txQuery).not.toHaveBeenCalled();
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('PUT guarda con el dueño de la sesión; RB-18 responde 422; un id que no es uuid, 400', async () => {
    base(false);
    const r = await ruta.PUT(put({ materiaId: MAT, corteId: null, meta: '4,5' }));
    expect(r.status).toBe(200);
    expect(llamadas('INSERT INTO metas_nota')[0]?.[1]?.[0]).toBe(U);
    const mala = await ruta.PUT(put({ materiaId: MAT, corteId: null, meta: '6' }));
    expect(mala.status).toBe(422);
    expect((await mala.json()).error.mensaje).toBe('La meta debe estar entre 0,1 y 5,0.');
    expect((await ruta.PUT(put({ materiaId: 'x', corteId: null, meta: '4' }))).status).toBe(400);
  });

  it('DELETE con ?materia= y ?corte=', async () => {
    m.consultar.mockResolvedValueOnce([{ id: 'x' }]);
    expect((await ruta.DELETE(new Request(`http://x?materia=${MAT}&corte=${C1}`, { method: 'DELETE' }))).status).toBe(200);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([MAT, U, C1]);
    expect((await ruta.DELETE(new Request('http://x?materia=no', { method: 'DELETE' }))).status).toBe(400);
  });
});
