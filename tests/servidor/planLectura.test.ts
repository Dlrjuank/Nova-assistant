// @vitest-environment node
// E10d (RB-42): vista previa y confirmación del plan de lectura.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), txQuery: vi.fn(), resolverCategoria: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));
vi.mock('@/lib/datos/categorias', () => ({ resolverCategoria: m.resolverCategoria }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/planLectura'));

import * as rutaConfirmar from '@/app/api/nova/documentos/[id]/plan-lectura/confirmar/route';
import * as rutaVista from '@/app/api/nova/documentos/[id]/plan-lectura/route';
import { confirmarPlanLectura, vistaPreviaPlanLectura } from '@/lib/datos/planLectura';

const U = '11111111-1111-4111-8111-111111111111';
const DOC = '22222222-2222-4222-8222-222222222222';
const CAPS = [
  { id: 'c0', orden: 0, nivel: 1, titulo: 'Capítulo 1. Energía', etiqueta_paginas: '1–10', en_tareas: false },
  { id: 'c1', orden: 1, nivel: 2, titulo: '1.1 Calor', etiqueta_paginas: '3–5', en_tareas: false },
  { id: 'c2', orden: 2, nivel: 1, titulo: 'Capítulo 2. Ecosistemas', etiqueta_paginas: '11–20', en_tareas: true },
  { id: 'c3', orden: 3, nivel: 1, titulo: 'Capítulo 3. Células', etiqueta_paginas: '21–30', en_tareas: false },
];
const PLAN = { modo: 'fechas' as const, inicio: '2026-11-16', fin: '2026-11-29', capitulos: [0, 2, 3] };

/** Responde a cada SQL según su texto, como la base. */
function base(documento: { categoria: string } | null = { categoria: 'Biología' }) {
  const responder = async (sql: string) => {
    if (sql.includes('FROM documentos')) return documento ? [documento] : [];
    if (sql.includes('FROM capitulos')) return CAPS;
    if (sql.includes('INSERT INTO tareas_personales')) return [{ id: `t${m.txQuery.mock.calls.length}` }];
    return [];
  };
  m.consultar.mockImplementation(responder);
  m.txQuery.mockImplementation(async (sql: string) => ({ rows: await responder(sql) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  m.resolverCategoria.mockImplementation(async (_tx: unknown, _u: string, texto: string) => texto);
  m.exigirSesion.mockResolvedValue({ id: U });
});

describe('vista previa', () => {
  it('reparte solo los capítulos que no están en Tareas, en orden, y no escribe nada', async () => {
    base();
    await expect(vistaPreviaPlanLectura(U, DOC, PLAN)).resolves.toEqual({
      categoria: 'Biología',
      tareas: [
        { orden: 0, titulo: 'Leer cap. 1: Energía (pp. 1–10)', fechaLimite: '2026-11-22' },
        { orden: 3, titulo: 'Leer cap. 3: Células (pp. 21–30)', fechaLimite: '2026-11-29' },
      ],
      yaEnTareas: [{ orden: 2, titulo: 'Capítulo 2. Ecosistemas' }],
    });
    expect(m.consultar.mock.calls.every(([sql]) => /^\s*SELECT/.test(sql) && !String(sql).includes('FOR UPDATE'))).toBe(true);
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('un documento ajeno o inexistente responde como inexistente', async () => {
    base(null);
    await expect(vistaPreviaPlanLectura(U, DOC, PLAN)).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([DOC, U]);
  });

  it('una sección (nivel 2) o un capítulo que no existe no se aceptan', async () => {
    base();
    await expect(vistaPreviaPlanLectura(U, DOC, { ...PLAN, capitulos: [1] })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(vistaPreviaPlanLectura(U, DOC, { ...PLAN, capitulos: [9] })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });

  it('la categoría elegida reemplaza a la del documento', async () => {
    base();
    await expect(vistaPreviaPlanLectura(U, DOC, { ...PLAN, categoria: ' Lectura ' })).resolves.toMatchObject({ categoria: 'Lectura' });
  });
});

describe('confirmar', () => {
  it('crea una tarea por capítulo con prioridad 2, marca tarea_id y bloquea las filas', async () => {
    base();
    await expect(confirmarPlanLectura(U, DOC, PLAN)).resolves.toEqual({ creadas: 2, omitidas: 1, categoria: 'Biología' });
    const sqls = m.txQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqls.find((s) => s.includes('FROM capitulos'))).toContain('FOR UPDATE');
    const inserts = m.txQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO tareas_personales'));
    expect(inserts.map(([, v]) => [v[0], v[1], v[2], v[3], v[5]])).toEqual([
      ['Leer cap. 1: Energía (pp. 1–10)', 'Biología', 2, '2026-11-22', U],
      ['Leer cap. 3: Células (pp. 21–30)', 'Biología', 2, '2026-11-29', U],
    ]);
    const marcas = m.txQuery.mock.calls.filter(([sql]) => String(sql).includes('UPDATE capitulos SET tarea_id'));
    expect(marcas.map(([, v]) => [v[1], v[2]])).toEqual([
      ['c0', U],
      ['c3', U],
    ]);
    expect(m.resolverCategoria).toHaveBeenCalledTimes(1); // RB-33
  });

  it('si todos ya están en Tareas, no crea nada y lo dice', async () => {
    base();
    await expect(confirmarPlanLectura(U, DOC, { ...PLAN, capitulos: [2] })).rejects.toMatchObject({
      codigo: 'CAPITULO_EN_TAREAS',
      message: 'Este capítulo ya está en Tareas.',
    });
    expect(m.txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('las fechas invertidas no crean nada', async () => {
    base();
    await expect(confirmarPlanLectura(U, DOC, { ...PLAN, fin: '2026-11-01' })).rejects.toMatchObject({ codigo: 'PLAN_FECHAS_INVERTIDAS' });
    expect(m.txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });
});

describe('rutas', () => {
  const pedir = (ruta: typeof rutaVista, cuerpo: unknown, id = DOC) =>
    ruta.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id }) });

  it('la vista previa responde 200 y confirmar 201, con el dueño de la sesión', async () => {
    base();
    expect((await pedir(rutaVista, PLAN)).status).toBe(200);
    const r = await pedir(rutaConfirmar, PLAN);
    expect(r.status).toBe(201);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([DOC, U]);
  });

  it('datos mal formados no llegan al servicio', async () => {
    base();
    for (const cuerpo of [{ ...PLAN, capitulos: [] }, { modo: 'semana', inicio: '2026-11-16', capitulos: [0] }, { ...PLAN, modo: 'otro' }]) {
      expect((await pedir(rutaVista, cuerpo)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await pedir(rutaVista, PLAN, 'no-es-uuid')).status).toBeGreaterThanOrEqual(400);
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('las fechas invertidas responden 422 con el mensaje exacto', async () => {
    base();
    const r = await pedir(rutaVista, { ...PLAN, fin: '2026-11-01' });
    expect(r.status).toBe(422);
    expect((await r.json()).error.mensaje).toBe('La fecha final debe ser igual o posterior a la de inicio.');
  });
});
