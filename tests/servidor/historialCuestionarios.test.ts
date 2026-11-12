// @vitest-environment node
// E10f (5.11, RB-53): historial, sugerencias de repaso y tarea de repaso.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), txQuery: vi.fn(), resolverCategoria: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));
vi.mock('@/lib/datos/categorias', () => ({ resolverCategoria: m.resolverCategoria }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/historialCuestionarios'));

import * as rutaCuestionarios from '@/app/api/nova/cuestionarios/route';
import * as rutaRepaso from '@/app/api/nova/intentos/[id]/tarea-repaso/route';
import { crearTareaRepaso, listarCuestionarios, sugerenciasDeRepaso, type Consulta } from '@/lib/datos/historialCuestionarios';

const U = '11111111-1111-4111-8111-111111111111';
const DOC = '22222222-2222-4222-8222-222222222222';
const INT = '44444444-4444-4444-8444-444444444444';
const CAP = '66666666-6666-4666-8666-666666666661';

const CAPITULOS = [
  { id: CAP, orden: 0, nivel: 1, titulo: 'Capítulo 1. La célula', etiqueta_paginas: '1–20' },
  { id: 'cap1b', orden: 1, nivel: 2, titulo: 'Membrana', etiqueta_paginas: '5–9' },
  { id: 'cap2', orden: 2, nivel: 1, titulo: 'Los tejidos', etiqueta_paginas: '21–40' },
];

/** Respuestas de la base para las sugerencias y la tarea de repaso. */
function base(o: { falladas?: Array<string | null>; existentes?: string[]; intento?: Record<string, unknown> | null } = {}) {
  const responder = async (sql: string): Promise<unknown[]> => {
    if (sql.includes('FROM respuestas_intento r')) return (o.falladas ?? [CAP, CAP, 'cap2']).map((capitulo_id) => ({ capitulo_id }));
    if (sql.includes('FROM capitulos c')) return CAPITULOS;
    if (sql.includes('titulo = ANY')) return (o.existentes ?? []).map((titulo) => ({ titulo }));
    if (sql.includes('i.terminado_en IS NOT NULL AS terminado, d.categoria')) return o.intento === null ? [] : [o.intento ?? { terminado: true, categoria: 'Biología' }];
    if (sql.includes('SELECT 1 FROM tareas_personales')) return (o.existentes ?? []).length ? [{ '?column?': 1 }] : [];
    if (sql.includes('INSERT INTO tareas_personales')) return [{ id: 't1' }];
    return [];
  };
  m.consultar.mockImplementation(responder);
  m.txQuery.mockImplementation(async (sql: string) => ({ rows: await responder(sql) }));
}

const TITULO = 'Repasar cap. 1: La célula (pp. 1–20)';

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
  m.resolverCategoria.mockImplementation(async (_tx: unknown, _u: string, texto: string) => texto);
});

describe('sugerencias de repaso (S-59, RB-53)', () => {
  it('solo los capítulos con 2 o más falladas, con el título numerado', async () => {
    base();
    await expect(sugerenciasDeRepaso(m.consultar as unknown as Consulta, U, INT)).resolves.toEqual([{ capituloId: CAP, titulo: TITULO, falladas: 2, yaExiste: false }]);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([INT, U]); // solo del dueño
  });

  it('marca si ya hay una tarea sin completar con ese título', async () => {
    base({ existentes: [TITULO] });
    const [s] = await sugerenciasDeRepaso(m.consultar as unknown as Consulta, U, INT);
    expect(s?.yaExiste).toBe(true);
    const sql = String(m.consultar.mock.calls.find(([q]) => String(q).includes('titulo = ANY'))?.[0]);
    expect(sql).toContain("estado <> 'Completada'");
  });

  it('sin capítulos con 2 falladas no consulta nada más', async () => {
    base({ falladas: [CAP, 'cap2', null] });
    await expect(sugerenciasDeRepaso(m.consultar as unknown as Consulta, U, INT)).resolves.toEqual([]);
    expect(m.consultar).toHaveBeenCalledTimes(1);
  });
});

describe('crear la tarea de repaso (RB-53)', () => {
  it('crea "Repasar cap. N" de prioridad media con la fecha y la categoría elegidas (RB-33)', async () => {
    base();
    await expect(crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-11-20', categoria: 'Repasos' })).resolves.toEqual({ id: 't1', titulo: TITULO, categoria: 'Repasos' });
    const insert = m.txQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO tareas_personales'));
    expect(insert?.[1]).toEqual([TITULO, 'Repasos', 2, '2026-11-20', expect.any(String), U]);
    expect(m.resolverCategoria).toHaveBeenCalledTimes(1);
    // Bloqueo por usuario y título antes de revisar si ya existe.
    const sqls = m.txQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqls.findIndex((s) => s.includes('pg_advisory_xact_lock'))).toBeLessThan(sqls.findIndex((s) => s.includes('SELECT 1 FROM tareas_personales')));
  });

  it('sin categoría, la del documento', async () => {
    base();
    await crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-11-20' });
    expect(m.resolverCategoria.mock.calls[0]?.[2]).toBe('Biología');
  });

  it('si ya hay una pendiente con ese título: "Ya tienes esa tarea de repaso." y no crea otra', async () => {
    base({ existentes: [TITULO] });
    await expect(crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-11-20' })).rejects.toMatchObject({ codigo: 'TAREA_REPASO_EXISTENTE', message: 'Ya tienes esa tarea de repaso.' });
    expect(m.txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });

  it('un capítulo con menos de 2 falladas, un intento sin terminar o ajeno, o una fecha inválida no crean nada', async () => {
    base();
    await expect(crearTareaRepaso(U, INT, { capituloId: 'cap2', fecha: '2026-11-20' })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    base({ intento: { terminado: false, categoria: 'Biología' } });
    await expect(crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-11-20' })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    base({ intento: null });
    await expect(crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-11-20' })).rejects.toMatchObject({ codigo: 'CUESTIONARIO_NO_ENCONTRADO' });
    await expect(crearTareaRepaso(U, INT, { capituloId: CAP, fecha: '2026-02-30' })).rejects.toMatchObject({ codigo: 'FECHA_INVALIDA' });
    expect(m.txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
  });
});

const fila = (o: Record<string, unknown>) => ({
  documento_id: DOC,
  nombre: 'biologia.pdf',
  cuestionario_id: 'q1',
  alcance: 'documento',
  capitulo: null,
  capitulo_orden: null,
  pagina_desde: null,
  pagina_hasta: null,
  dificultad: 'media',
  preguntas: 5,
  creado_en: '2026-11-10T15:00:00Z',
  creado_dia: '2026-11-10',
  intento_id: null,
  fecha: '2026-11-10',
  repaso: false,
  terminado: true,
  aciertos: 3,
  total: 5,
  puntaje: 300,
  ...o,
});

describe('historial (5.11, S-58)', () => {
  it('por documento y, dentro, el documento completo, los capítulos en orden y luego las páginas; intentos del más reciente', async () => {
    m.consultar.mockResolvedValue([
      fila({ cuestionario_id: 'qp', alcance: 'paginas', pagina_desde: 3, pagina_hasta: 4, intento_id: 'p1' }),
      fila({ cuestionario_id: 'qc2', alcance: 'capitulo', capitulo: 'Los tejidos', capitulo_orden: 2, intento_id: 'c21' }),
      fila({ cuestionario_id: 'qc1', alcance: 'capitulo', capitulo: 'La célula', capitulo_orden: 0, intento_id: 'a', puntaje: 200 }),
      fila({ cuestionario_id: 'qc1', alcance: 'capitulo', capitulo: 'La célula', capitulo_orden: 0, intento_id: 'b', repaso: true, puntaje: 500 }),
      fila({ cuestionario_id: 'qc1', alcance: 'capitulo', capitulo: 'La célula', capitulo_orden: 0, intento_id: 'c', puntaje: 400 }),
      fila({ cuestionario_id: 'qc1', alcance: 'capitulo', capitulo: 'La célula', capitulo_orden: 0, intento_id: 'd', terminado: false, aciertos: null, puntaje: null }),
      fila({ cuestionario_id: 'qd', intento_id: 'd1' }),
    ]);
    const [doc] = await listarCuestionarios(U);
    expect(doc?.cuestionarios.map((c) => c.alcance)).toEqual(['Todo el documento', 'La célula', 'Los tejidos', 'Páginas 3–4']);
    const celula = doc?.cuestionarios[1];
    expect(celula?.intentos.map((i) => [i.id, i.repaso, i.terminado, i.comparacion])).toEqual([
      ['d', false, false, null],
      ['c', false, true, 'mejor'], // 400 frente a 200, sin contar el repaso de 500
      ['b', true, true, null],
      ['a', false, true, null],
    ]);
    expect(celula?.creadoEn).toBe('2026-11-10');
  });

  it('solo del usuario, y con ?documentoId= solo de ese documento', async () => {
    m.consultar.mockResolvedValue([fila({ intento_id: null })]);
    const [doc] = await listarCuestionarios(U, DOC);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, DOC]);
    expect(doc?.cuestionarios[0]?.intentos).toEqual([]);
    m.consultar.mockResolvedValue([]);
    await expect(listarCuestionarios(U)).resolves.toEqual([]);
    expect(m.consultar.mock.calls[1]?.[1]).toEqual([U, null]);
  });
});

describe('rutas', () => {
  it('GET /api/nova/cuestionarios usa el dueño de la sesión y valida el filtro', async () => {
    m.consultar.mockResolvedValue([]);
    const r = await rutaCuestionarios.GET(new Request(`http://x/api/nova/cuestionarios?documentoId=${DOC}`));
    expect(r.status).toBe(200);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, DOC]);
    const mal = await rutaCuestionarios.GET(new Request('http://x/api/nova/cuestionarios?documentoId=nada'));
    expect(mal.status).toBe(400);
  });

  it('POST tarea-repaso responde 201, y 409 con RB-53', async () => {
    base();
    const pedir = () =>
      rutaRepaso.POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capituloId: CAP, fecha: '2026-11-20' }) }), {
        params: Promise.resolve({ id: INT }),
      });
    expect((await pedir()).status).toBe(201);
    base({ existentes: [TITULO] });
    const repetida = await pedir();
    expect(repetida.status).toBe(409);
    expect(((await repetida.json()) as { error: { mensaje: string } }).error.mensaje).toBe('Ya tienes esa tarea de repaso.');
  });

  it('POST tarea-repaso rechaza un id o un capítulo mal formados sin llegar a la base', async () => {
    const r = await rutaRepaso.POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capituloId: 'x', fecha: '2026-11-20' }) }), {
      params: Promise.resolve({ id: INT }),
    });
    expect(r.status).toBe(400);
    const r2 = await rutaRepaso.POST(new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capituloId: CAP, fecha: '2026-11-20' }) }), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(r2.status).toBe(400);
    expect(m.txQuery).not.toHaveBeenCalled();
  });
});
