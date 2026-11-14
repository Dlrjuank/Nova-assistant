// @vitest-environment node
// E12 (6.4, RB-05 a RB-10, RB-35): materias, cortes, componentes y notas, con aislamiento por usuario.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), txQuery: vi.fn(), exigirSesion: vi.fn(), preferencias: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/datos/configuracion', () => ({ obtenerPreferencias: m.preferencias }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/semestre'));

import * as rutaCortes from '@/app/api/nova/materias/[id]/cortes/route';
import * as rutaMaterias from '@/app/api/nova/materias/route';
import * as rutaNotas from '@/app/api/nova/componentes/[id]/notas/route';
import {
  crearComponente,
  crearMateria,
  crearNota,
  dividirEnCortes,
  editarMateria,
  eliminarMateria,
  guardarCortes,
  listarMaterias,
  quitarCortes,
} from '@/lib/datos/semestre';

const U = '11111111-1111-4111-8111-111111111111';
const MAT = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333331';
const C2 = '33333333-3333-4333-8333-333333333332';
const COMP = '44444444-4444-4444-8444-444444444444';

const llamadas = (texto: string) => m.txQuery.mock.calls.filter(([sql]) => String(sql).includes(texto));
const duplicado = (constraint: string) => Object.assign(new Error('duplicado'), { code: '23505', constraint });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
  m.preferencias.mockResolvedValue({ cortesDefecto: [3000, 3000, 4000] });
});

describe('materias (6.4, RB-05, RB-06)', () => {
  it('crear: la materia, su corte único de 100 % y su categoría', async () => {
    m.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO materias')) return { rows: [{ id: MAT }] };
      if (sql.includes('SELECT nombre FROM categorias')) return { rows: llamadas('INSERT INTO categorias').length ? [{ nombre: 'Cálculo I' }] : [] };
      return { rows: [] };
    });
    await expect(crearMateria(U, { nombre: '  Cálculo   I ', creditos: '3', docente: '' })).resolves.toEqual({ id: MAT, categoria: 'Cálculo I' });
    expect(llamadas('INSERT INTO materias')[0]?.[1]).toEqual([U, 'Cálculo I', 3, null]);
    expect(llamadas('INSERT INTO cortes')[0]?.[1]).toEqual([MAT, U, 'Corte único']);
    expect(String(llamadas('INSERT INTO cortes')[0]?.[0])).toContain('10000');
    expect(llamadas('INSERT INTO categorias')[0]?.[1]?.slice(0, 2)).toEqual([U, 'Cálculo I']);
  });

  it('RB-05: un nombre repetido da el mensaje exacto', async () => {
    m.txQuery.mockRejectedValueOnce(duplicado('idx_materias_nombre'));
    await expect(crearMateria(U, { nombre: 'Cálculo', creditos: 3 })).rejects.toMatchObject({ codigo: 'MATERIA_DUPLICADA', message: 'Ya existe una materia con ese nombre.' });
    m.consultar.mockRejectedValueOnce(duplicado('idx_materias_nombre'));
    await expect(editarMateria(U, MAT, { nombre: 'Cálculo' })).rejects.toMatchObject({ codigo: 'MATERIA_DUPLICADA' });
  });

  it('RB-06: créditos fuera de 1 a 10 se rechazan sin tocar la base', async () => {
    await expect(crearMateria(U, { nombre: 'Física', creditos: '11' })).rejects.toMatchObject({ message: 'Los créditos deben ser un número entero entre 1 y 10.' });
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('otro usuario: editar y eliminar responden como inexistente (RB-01)', async () => {
    m.consultar.mockResolvedValue([]);
    await expect(editarMateria(U, MAT, { creditos: 4 })).rejects.toMatchObject({ codigo: 'MATERIA_NO_ENCONTRADA' });
    await expect(eliminarMateria(U, MAT)).rejects.toMatchObject({ codigo: 'MATERIA_NO_ENCONTRADA' });
    for (const [, valores] of m.consultar.mock.calls) expect(valores).toContain(U);
  });

  it('listar arma el árbol materia → cortes → componentes → notas, solo del usuario', async () => {
    m.consultar.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM materias')) return [{ id: MAT, nombre: 'Cálculo', creditos: 3, docente: null, usa_cortes: false }];
      if (sql.includes('FROM cortes')) return [{ id: C1, materia_id: MAT, orden: 1, nombre: 'Corte único', porcentaje: 10000, fecha: null }];
      if (sql.includes('FROM componentes')) return [{ id: COMP, corte_id: C1, orden: 1, nombre: 'Parcial', porcentaje: 4000 }];
      if (sql.includes('FROM notas')) return [{ id: 'n1', componente_id: COMP, orden: 1, nombre: null, nota: 350, fecha: '2026-11-10' }];
      return [];
    });
    const [materia] = await listarMaterias(U);
    expect(materia?.cortes[0]?.componentes[0]?.notas).toEqual([{ id: 'n1', orden: 1, nombre: null, nota: 350, fecha: '2026-11-10' }]);
    for (const [, valores] of m.consultar.mock.calls) expect(valores?.[0]).toBe(U);
  });
});

describe('cortes (6.4, RB-07, RB-35)', () => {
  function materia(usaCortes: boolean, cortes: string[] = [C1]) {
    m.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM materias') && sql.includes('FOR UPDATE')) return { rows: [{ usa_cortes: usaCortes }] };
      if (sql.includes('SELECT id FROM cortes')) return { rows: cortes.map((id) => ({ id })) };
      if (sql.includes('count(*)')) return { rows: [{ n: cortes.length }] };
      return { rows: [] };
    });
  }

  it('dividir: el corte único pasa a Corte 1 con su componentes y se agregan los demás de la plantilla', async () => {
    materia(false);
    await expect(dividirEnCortes(U, MAT)).resolves.toEqual({ cortes: 3 });
    expect(llamadas('UPDATE cortes SET orden')[0]?.[1]).toEqual([MAT, U, 1, 'Corte 1', 3000]);
    expect(llamadas('INSERT INTO cortes').map(([, v]) => v)).toEqual([
      [MAT, U, 2, 'Corte 2', 3000],
      [MAT, U, 3, 'Corte 3', 4000],
    ]);
    expect(llamadas('UPDATE materias SET usa_cortes = true')).toHaveLength(1);
  });

  it('RB-35: quitar con más de un corte se rechaza; con uno, vuelve a 100 % y queda oculto', async () => {
    materia(true, [C1, C2]);
    await expect(quitarCortes(U, MAT)).rejects.toMatchObject({ codigo: 'QUITAR_CORTES_INVALIDO', message: 'Para quitar los cortes, deja solo uno.' });
    expect(llamadas('UPDATE materias')).toHaveLength(0);
    materia(true, [C1]);
    await quitarCortes(U, MAT);
    expect(llamadas("UPDATE cortes SET orden = 1, nombre = $3, porcentaje = 10000")[0]?.[1]).toEqual([MAT, U, 'Corte único']);
    expect(llamadas('UPDATE materias SET usa_cortes = false')).toHaveLength(1);
  });

  it('en bloque: actualiza, crea y borra los que faltan; una suma de 90 % se guarda (RB-07 es aviso)', async () => {
    materia(true, [C1, C2]);
    await guardarCortes(U, MAT, [
      { id: C2, nombre: 'Primero', porcentaje: '40', fecha: '2026-12-01' },
      { nombre: 'Nuevo', porcentaje: '50' },
    ]);
    expect(llamadas('DELETE FROM cortes')[0]?.[1]).toEqual([[C1], U]);
    expect(llamadas('UPDATE cortes SET orden = $3')[0]?.[1]).toEqual([C2, U, 1, 'Primero', 4000, '2026-12-01']);
    expect(llamadas('INSERT INTO cortes')[0]?.[1]).toEqual([MAT, U, 2, 'Nuevo', 5000, null]);
  });

  it('en bloque: un corte de otra materia, ninguno o un porcentaje inválido se rechazan', async () => {
    materia(true, [C1]);
    await expect(guardarCortes(U, MAT, [{ id: C2, nombre: 'x', porcentaje: 100 }])).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
    await expect(guardarCortes(U, MAT, [])).rejects.toMatchObject({ codigo: 'SIN_CORTES' });
    await expect(guardarCortes(U, MAT, [{ id: C1, nombre: 'x', porcentaje: '0' }])).rejects.toMatchObject({ message: 'El porcentaje debe ser mayor que 0 y como máximo 100.' });
    expect(llamadas('DELETE FROM cortes')).toHaveLength(0);
  });

  it('sin cortes: solo cambia la fecha final del corte único', async () => {
    materia(false, [C1]);
    await guardarCortes(U, MAT, [{ id: C1, nombre: 'Otro', porcentaje: 50, fecha: '2026-12-15' }]);
    expect(llamadas('UPDATE cortes SET fecha')[0]?.[1]).toEqual([C1, U, '2026-12-15']);
    expect(llamadas('UPDATE cortes SET orden')).toHaveLength(0);
  });
});

describe('componentes y notas (RB-08 a RB-10)', () => {
  it('componente: porcentaje válido (RB-10) y nombre repetido con su mensaje', async () => {
    await expect(crearComponente(U, C1, { nombre: 'Parcial', porcentaje: '100,5' })).rejects.toMatchObject({ message: 'El porcentaje debe ser mayor que 0 y como máximo 100.' });
    m.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM cortes')) return { rows: [{}] };
      if (sql.includes('INSERT INTO componentes')) throw duplicado('idx_componentes_nombre');
      return { rows: [] };
    });
    await expect(crearComponente(U, C1, { nombre: 'Parcial', porcentaje: '40' })).rejects.toMatchObject({ message: 'Ya existe un componente con ese nombre.' });
  });

  it('componente de un corte ajeno responde como inexistente', async () => {
    m.txQuery.mockResolvedValue({ rows: [] });
    await expect(crearComponente(U, C1, { nombre: 'Parcial', porcentaje: '40' })).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
    expect(llamadas('FROM cortes')[0]?.[1]).toEqual([C1, U]);
  });

  it('nota: 3,75 → 375; vacía queda "sin nota"; 5,5 se rechaza (RB-09)', async () => {
    m.txQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM componentes') ? [{}] : [{ id: 'n' }] }));
    await crearNota(U, COMP, { nota: '3,75', nombre: 'Quiz 1', fecha: '2026-11-10' });
    await crearNota(U, COMP, { nota: null });
    expect(llamadas('INSERT INTO notas').map(([, v]) => v)).toEqual([
      [COMP, U, 'Quiz 1', 375, '2026-11-10'],
      [COMP, U, null, null, null],
    ]);
    await expect(crearNota(U, COMP, { nota: '5,5' })).rejects.toMatchObject({ message: 'La nota debe estar entre 0,0 y 5,0.' });
    await expect(crearNota(U, COMP, { nota: '4', fecha: '2026-02-30' })).rejects.toMatchObject({ codigo: 'FECHA_INVALIDA' });
  });
});

describe('rutas', () => {
  it('crear materia usa el dueño de la sesión y devuelve 201', async () => {
    m.txQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('INSERT INTO materias') ? [{ id: MAT }] : sql.includes('SELECT nombre') ? [{ nombre: 'Física' }] : [] }));
    const r = await rutaMaterias.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ nombre: 'Física', creditos: 4 }) }));
    expect(r.status).toBe(201);
    expect(llamadas('INSERT INTO materias')[0]?.[1]?.[0]).toBe(U);
  });

  it('la nota 5,5 responde 422 con el mensaje exacto; una acción de cortes desconocida, 400', async () => {
    const r = await rutaNotas.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ nota: '5,5' }) }), { params: Promise.resolve({ id: COMP }) });
    expect(r.status).toBe(422);
    expect((await r.json()).error.mensaje).toBe('La nota debe estar entre 0,0 y 5,0.');
    const a = await rutaCortes.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ accion: 'borrar' }) }), { params: Promise.resolve({ id: MAT }) });
    expect(a.status).toBe(400);
    expect(m.txQuery).not.toHaveBeenCalled();
  });
});
