// @vitest-environment node
// E10e (9.6, RB-48 a RB-52): generar, ver, empezar intentos y responder.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), txQuery: vi.fn(), generarJson: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarJson: m.generarJson } }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/cuestionarios'));

import * as rutaCrear from '@/app/api/nova/cuestionarios/route';
import * as rutaResponder from '@/app/api/nova/intentos/[id]/respuestas/route';
import { crearCuestionario, empezarIntento, obtenerCuestionario, responderPregunta } from '@/lib/datos/cuestionarios';

const U = '11111111-1111-4111-8111-111111111111';
const DOC = '22222222-2222-4222-8222-222222222222';
const Q = '33333333-3333-4333-8333-333333333333';
const INT = '44444444-4444-4444-8444-444444444444';
const P1 = '55555555-5555-4555-8555-555555555551';
const P2 = '55555555-5555-4555-8555-555555555552';

// 6 páginas de 450 palabras exactas: la página n empieza en la palabra (n − 1) × 450, igual que el fragmento n.
const palabras = (pagina: number) => Array.from({ length: 450 }, (_, i) => `p${pagina}w${i}`);
const FRAGS = [1, 2, 3, 4, 5, 6].map((n) => ({
  numero: n,
  contenido: [...palabras(n), ...palabras(n + 1).slice(0, 50)].join(' '),
  pagina_inicio: n,
  pagina_fin: n + 1,
  etiqueta_paginas: `${n}–${n + 1}`,
}));
const CAPS = [{ id: 'cap1', orden: 0, nivel: 1, titulo: 'Uno', pagina_inicio: 1, pagina_fin: 3, etiqueta_paginas: '1–3' }];

/** Una pregunta válida sobre el fragmento i (F1 es el primero entregado), con una cita de la página del medio. */
const pregunta = (n: number, fuente = 'F1', inicioPalabra = 10) => ({
  enunciado: `¿Pregunta ${n}?`,
  opciones: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
  correcta: 2,
  explicacion: 'Porque lo dice el texto.',
  fuente,
  cita_textual: palabras(Number(fuente.slice(1))).slice(inicioPalabra, inicioPalabra + 4).join(' '),
});

function base(opciones: { documento?: Record<string, unknown> | null; frags?: typeof FRAGS } = {}) {
  const documento = opciones.documento === undefined ? { paginas: 7, progreso: null, inicio_paginas: [0, 450, 900, 1350, 1800, 2250, 2700] } : opciones.documento;
  m.consultar.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM documentos WHERE')) return documento ? [documento] : [];
    if (sql.includes('FROM capitulos')) return CAPS;
    if (sql.includes('FROM fragmentos_pdf')) return opciones.frags ?? FRAGS;
    return [];
  });
  let n = 0;
  m.txQuery.mockImplementation(async (sql: string) => ({ rows: sql.includes('RETURNING id') ? [{ id: `id${++n}` }] : [] }));
}

const DATOS = { documentoId: DOC, pedidas: 5 as const, dificultad: 'media' as const, alcance: 'documento' as const };
const insertsDe = (texto: string) => m.txQuery.mock.calls.filter(([sql]) => String(sql).includes(texto));

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
});

describe('crear (RB-48 a RB-52)', () => {
  it('con todas válidas: una sola llamada, guarda cuestionario, preguntas barajadas y el primer intento', async () => {
    base();
    m.generarJson.mockResolvedValueOnce([1, 2, 3, 4, 5].map((n) => pregunta(n)));
    await expect(crearCuestionario(U, DATOS)).resolves.toEqual({ id: 'id1', creadas: 5, pedidas: 5 });
    expect(m.generarJson).toHaveBeenCalledTimes(1);
    expect(m.generarJson.mock.calls[0]?.[0].contenido).toContain('[F1]');
    const preguntas = insertsDe('INSERT INTO preguntas_cuestionario');
    expect(preguntas).toHaveLength(5);
    for (const [, v] of preguntas) {
      const opciones = JSON.parse(v[4]) as string[];
      expect(opciones[v[5]]).toMatch(/^c\d$/); // la correcta sigue siendo la misma tras barajar
      expect(v[8]).toBe('1'); // la página exacta de la cita, no la del fragmento (1–2)
      expect(v[9]).toBe('cap1');
    }
    expect(insertsDe('INSERT INTO intentos_cuestionario')[0]?.[1]).toEqual(['id1', U, ['id2', 'id3', 'id4', 'id5', 'id6'], 5]);
  });

  it('si faltan, una segunda llamada solo por las que faltan y sin repetirlas', async () => {
    base();
    m.generarJson.mockResolvedValueOnce([pregunta(1), pregunta(2), { ...pregunta(3), fuente: 'F99' }]).mockResolvedValueOnce([pregunta(1), pregunta(4)]);
    await expect(crearCuestionario(U, DATOS)).resolves.toMatchObject({ creadas: 3, pedidas: 5 });
    expect(m.generarJson).toHaveBeenCalledTimes(2);
    const segunda = m.generarJson.mock.calls[1]?.[0].contenido as string;
    expect(segunda).toContain('Escribe 3 preguntas.');
    expect(segunda).toContain('- ¿Pregunta 1?');
  });

  it('con menos de la mitad tras validar no se crea nada (RB-49)', async () => {
    base();
    m.generarJson.mockResolvedValueOnce([pregunta(1)]).mockResolvedValueOnce([pregunta(2)]);
    await expect(crearCuestionario(U, DATOS)).rejects.toMatchObject({
      codigo: 'CONTENIDO_INSUFICIENTE',
      message: 'Este contenido no alcanza para un cuestionario. Elige más páginas o menos preguntas.',
    });
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('B-60: con un rango, el modelo solo recibe el texto de esas páginas y la cita queda dentro', async () => {
    base();
    m.generarJson.mockResolvedValueOnce([1, 2, 3].map((n) => ({ ...pregunta(n, 'F2'), cita_textual: palabras(3).slice(100 + n, 104 + n).join(' ') })));
    await crearCuestionario(U, { ...DATOS, alcance: 'paginas', desde: 3, hasta: 4 });
    const contenido = m.generarJson.mock.calls[0]?.[0].contenido as string;
    expect(contenido).toContain('p3w0 ');
    expect(contenido).toContain('p4w449');
    expect(contenido).not.toMatch(/p2w|p5w/);
    expect(insertsDe('INSERT INTO preguntas_cuestionario').every(([, v]) => ['3', '4'].includes(v[8]))).toBe(true);
  });

  it('20 preguntas de una sola página: no alcanza y no gasta cuota (B-61)', async () => {
    base();
    await expect(crearCuestionario(U, { ...DATOS, pedidas: 20, alcance: 'paginas', desde: 3, hasta: 3 })).rejects.toMatchObject({ codigo: 'CONTENIDO_INSUFICIENTE' });
    expect(m.generarJson).not.toHaveBeenCalled();
  });

  it('un rango que no existe da el mensaje con las páginas del documento', async () => {
    base();
    await expect(crearCuestionario(U, { ...DATOS, alcance: 'paginas', desde: 5, hasta: 9 })).rejects.toMatchObject({
      codigo: 'RANGO_PAGINAS_INVALIDO',
      message: 'El rango de páginas no es válido: este documento tiene 7 páginas.',
    });
  });

  it.each([
    ['ajeno o inexistente', null, 'DOCUMENTO_NO_ENCONTRADO'],
    ['sin páginas (anterior a E10b)', { paginas: null, progreso: null, inicio_paginas: null }, 'DOCUMENTO_SIN_PAGINAS'],
    ['a medio indexar', { paginas: 7, progreso: 40, inicio_paginas: null }, 'DOCUMENTO_INDEXANDO'],
  ])('un documento %s se rechaza sin llamar a Gemini', async (_, documento, codigo) => {
    base({ documento });
    await expect(crearCuestionario(U, DATOS)).rejects.toMatchObject({ codigo });
    expect(m.generarJson).not.toHaveBeenCalled();
  });

  it('un capítulo solo usa sus fragmentos y la cita no sale de él', async () => {
    base({ documento: { paginas: 7, progreso: null, inicio_paginas: null } });
    m.generarJson.mockResolvedValueOnce([1, 2, 3].map((n) => pregunta(n, 'F3', 400 + n)));
    await crearCuestionario(U, { ...DATOS, alcance: 'capitulo', capitulo: 0 });
    const contenido = m.generarJson.mock.calls[0]?.[0].contenido as string;
    expect(contenido).toContain('[F3]');
    expect(contenido).not.toContain('[F4]'); // capítulo de las páginas 1–3: fragmentos 1, 2 y 3
    // Sin inicio de páginas, la etiqueta del fragmento recortada al capítulo.
    expect(insertsDe('INSERT INTO preguntas_cuestionario').every(([, v]) => v[8] === '3')).toBe(true);
    // E10f (S-59): en un cuestionario de un capítulo, las preguntas cuentan para ese capítulo.
    expect(insertsDe('INSERT INTO preguntas_cuestionario').every(([, v]) => v[9] === 'cap1')).toBe(true);
  });

  it('sin cupo en la primera llamada: CUOTA_AGOTADA y nada guardado (RB-52)', async () => {
    base();
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.generarJson.mockRejectedValueOnce(new ErrorDeNegocio('CUOTA_AGOTADA'));
    await expect(crearCuestionario(U, DATOS)).rejects.toMatchObject({ codigo: 'CUOTA_AGOTADA' });
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('si falla la segunda llamada, se guarda lo de la primera', async () => {
    base();
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.generarJson.mockResolvedValueOnce([1, 2, 3, 4].map((n) => pregunta(n))).mockRejectedValueOnce(new ErrorDeNegocio('ERROR_LLM'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(crearCuestionario(U, DATOS)).resolves.toMatchObject({ creadas: 4 });
  });
});

const FILA_PREGUNTA = (id: string, correcta: number) => ({ id, enunciado: `¿${id}?`, opciones: ['a', 'b', 'c', 'd'], correcta, explicacion: 'e', cita_textual: 'cita', etiqueta_paginas: '4' });

describe('ver (RB-50)', () => {
  it('la correcta solo va en las respondidas', async () => {
    m.consultar.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM cuestionarios c')) return [{ documento_id: DOC, nombre: 'libro.pdf', alcance: 'paginas', capitulo: null, pagina_desde: 2, pagina_hasta: 4, dificultad: 'media', pedidas: 5 }];
      if (sql.includes('FROM intentos_cuestionario')) return [{ id: INT, preguntas: [P1, P2], repaso_de: null, aciertos: null, total: 2, puntaje: null, terminado: false }];
      if (sql.includes('FROM preguntas_cuestionario')) return [FILA_PREGUNTA(P2, 3), FILA_PREGUNTA(P1, 1)];
      if (sql.includes('FROM respuestas_intento')) return [{ pregunta_id: P1, elegida: 0, acierto: false }];
      return [];
    });
    const vista = await obtenerCuestionario(U, Q);
    expect(vista.alcance).toBe('Páginas 2–4');
    expect(vista.intento.preguntas.map((p) => p.id)).toEqual([P1, P2]); // en el orden del intento
    expect(vista.intento.preguntas[0]?.respuesta).toEqual({ elegida: 0, acierto: false, correcta: 1, explicacion: 'e', cita: 'cita', fuente: 'libro.pdf · p. 4' });
    expect(JSON.stringify(vista.intento.preguntas[1])).not.toMatch(/correcta|explicacion|cita/);
  });

  it('uno ajeno responde como inexistente', async () => {
    m.consultar.mockResolvedValue([]);
    await expect(obtenerCuestionario(U, Q)).rejects.toMatchObject({ codigo: 'CUESTIONARIO_NO_ENCONTRADO' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([Q, U]);
  });
});

describe('intentos', () => {
  it('"Repetir solo las que fallé" trae solo las falladas, en su orden', async () => {
    m.consultar.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM cuestionarios WHERE')) return [{ id: Q }];
      if (sql.includes('SELECT preguntas FROM intentos_cuestionario')) return [{ preguntas: [P1, P2, 'p3'] }];
      if (sql.includes('NOT acierto')) return [{ pregunta_id: 'p3' }, { pregunta_id: P1 }];
      if (sql.includes('INSERT INTO intentos_cuestionario')) return [{ id: 'nuevo' }];
      return [];
    });
    await expect(empezarIntento(U, Q, INT)).resolves.toEqual({ id: 'nuevo' });
    const insert = m.consultar.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO intentos_cuestionario'));
    expect(insert?.[1]).toEqual([Q, U, [P1, 'p3'], INT, 2]);
  });

  it('un repaso sin falladas o de un intento sin terminar no se crea', async () => {
    m.consultar.mockImplementation(async (sql: string) => (sql.includes('FROM cuestionarios WHERE') ? [{ id: Q }] : []));
    await expect(empezarIntento(U, Q, INT)).rejects.toMatchObject({ codigo: 'CUESTIONARIO_NO_ENCONTRADO' });
  });
});

describe('responder (RB-51)', () => {
  function intento(respondidas: Array<{ pregunta_id: string; elegida: number; acierto: boolean }>, preguntas = [P1, P2]) {
    m.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM intentos_cuestionario i')) return { rows: [{ preguntas, total: preguntas.length, nombre: 'libro.pdf' }] };
      if (sql.includes('FROM preguntas_cuestionario')) return { rows: [FILA_PREGUNTA(P1, 1)] };
      if (sql.includes('FROM respuestas_intento')) return { rows: respondidas };
      return { rows: [] };
    });
  }

  it('una pregunta que no es del intento responde como inexistente', async () => {
    intento([], [P2]);
    await expect(responderPregunta(U, INT, P1, 1)).rejects.toMatchObject({ codigo: 'PREGUNTA_NO_ENCONTRADA', message: 'La pregunta no existe.' });
  });

  it('guarda una sola vez: si ya estaba, devuelve la guardada sin cambiarla', async () => {
    intento([{ pregunta_id: P1, elegida: 3, acierto: false }]);
    await expect(responderPregunta(U, INT, P1, 1)).resolves.toMatchObject({ elegida: 3, acierto: false, correcta: 1 });
    expect(insertsDe('ON CONFLICT (intento_id, pregunta_id) DO NOTHING')).toHaveLength(1);
  });

  it('con la última, califica: 1 de 2 → 250 centésimas', async () => {
    intento([
      { pregunta_id: P2, elegida: 0, acierto: false },
      { pregunta_id: P1, elegida: 1, acierto: true },
    ]);
    await expect(responderPregunta(U, INT, P1, 1)).resolves.toMatchObject({ acierto: true, resultado: { aciertos: 1, total: 2, puntaje: 250 } });
    expect(insertsDe('UPDATE intentos_cuestionario SET aciertos')[0]?.[1]).toEqual([INT, 1, 250]);
  });

  it('E10f: con la última, trae las sugerencias de repaso de los capítulos con 2 o más falladas (RB-53)', async () => {
    intento([
      { pregunta_id: P2, elegida: 0, acierto: false },
      { pregunta_id: P1, elegida: 0, acierto: false },
    ]);
    const previo = m.txQuery.getMockImplementation() as (sql: string) => Promise<{ rows: unknown[] }>;
    m.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM respuestas_intento r')) return { rows: [{ capitulo_id: 'cap1' }, { capitulo_id: 'cap1' }] };
      if (sql.includes('FROM capitulos c')) return { rows: CAPS };
      return previo(sql);
    });
    const r = await responderPregunta(U, INT, P1, 0);
    expect(r.resultado?.sugerencias).toEqual([{ capituloId: 'cap1', titulo: 'Repasar cap. 1: Uno (pp. 1–3)', falladas: 2, yaExiste: false }]);
  });
});

describe('rutas', () => {
  it('crear usa el dueño de la sesión y rechaza datos mal formados sin llegar al servicio', async () => {
    base();
    const pedir = (cuerpo: unknown) => rutaCrear.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }));
    for (const malo of [{ ...DATOS, pedidas: 7 }, { ...DATOS, dificultad: 'extrema' }, { ...DATOS, alcance: 'capitulo' }, { ...DATOS, documentoId: 'x' }]) {
      expect((await pedir(malo)).status).toBeGreaterThanOrEqual(400);
    }
    expect(m.consultar).not.toHaveBeenCalled();
    m.generarJson.mockResolvedValueOnce([1, 2, 3, 4, 5].map((n) => pregunta(n)));
    expect((await pedir(DATOS)).status).toBe(201);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([DOC, U]);
  });

  it('responder valida la opción de 0 a 3', async () => {
    const pedir = (cuerpo: unknown) => rutaResponder.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) }), { params: Promise.resolve({ id: INT }) });
    expect((await pedir({ preguntaId: P1, elegida: 4 })).status).toBeGreaterThanOrEqual(400);
    expect(m.txQuery).not.toHaveBeenCalled();
  });
});
