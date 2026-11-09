// @vitest-environment node
// E10c (RB-39 a RB-41): preguntas por página o capítulo y "Explicar de otra manera".
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ bd: vi.fn(), responder: vi.fn(), capitulos: vi.fn(), txQuery: vi.fn(), embedding: vi.fn(), existen: vi.fn(), tareas: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.bd,
  conTransaccion: async (t: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => t({ query: m.txQuery }),
  aLiteralVector: (v: number[]) => `[${v}]`,
}));
vi.mock('@/lib/llm/gemini', () => ({ llm: { responder: m.responder, generarEmbedding: m.embedding } }));
vi.mock('@/lib/datos/documentos', () => ({ capitulosDeDocumento: m.capitulos, existenDocumentos: m.existen }));
vi.mock('@/lib/datos/tareas', () => ({ tareasPendientesComoTexto: m.tareas }));

import { consultar } from '@/lib/datos/consulta';
import { explicarRespuesta } from '@/lib/datos/conversacion';

const U = '11111111-1111-4111-8111-111111111111';
const D = '22222222-2222-4222-8222-222222222222';
const fila = (numero: number, etiqueta: string | null, ini = numero, fin = numero) => ({ id: `f${numero}`, documento_id: D, numero, contenido: `texto ${numero}`, nombre_archivo: 'l.pdf', etiqueta_paginas: etiqueta, pagina_inicio: ini, pagina_fin: fin });
const CAPITULOS = [
  { orden: 1, nivel: 1, titulo: 'Capítulo 1: A', paginaInicio: 1, paginaFin: 2, etiquetaPaginas: '1–2' },
  { orden: 2, nivel: 1, titulo: 'Capítulo 2: B', paginaInicio: 3, paginaFin: 500, etiquetaPaginas: '3–500' },
];

/** Responde según el SQL: documentos listos, fragmentos del libro y búsqueda por ids. */
function base(documentos: unknown[], fragmentos: unknown[] = []) {
  m.bd.mockImplementation(async (sql: string) => {
    if (sql.includes('num_fragmentos > 0')) return documentos;
    if (sql.includes('ORDER BY f.numero')) return fragmentos;
    return [];
  });
}
const contextoDe = () => String(m.responder.mock.calls[0]?.[0].contexto);
const LIBRO = { id: D, nombre: 'l.pdf', paginas: 40 };

beforeEach(() => {
  vi.resetAllMocks();
  m.responder.mockResolvedValue('Respuesta [l.pdf · p. 2].');
  m.embedding.mockResolvedValue([0.1]);
  m.existen.mockResolvedValue(true);
  m.tareas.mockResolvedValue([]);
  m.capitulos.mockResolvedValue({ documento: { id: D, nombreArchivo: 'l.pdf', paginas: 40 }, capitulos: CAPITULOS });
});

describe('página (RB-39)', () => {
  it('responde con esa página, sin búsqueda vectorial, y la cita', async () => {
    base([LIBRO], [fila(1, '1'), fila(2, '2'), fila(3, '3')]);
    const r = await consultar(U, '¿Qué dice la página 2?', [], { documentoId: D });
    expect(contextoDe()).toContain('[l.pdf · p. 2]\ntexto 2');
    expect(contextoDe()).not.toContain('texto 1');
    expect(m.responder.mock.calls[0]?.[0].pregunta).toBe('Los fragmentos del contexto son de la página 2 del documento. ¿Qué dice la página 2?');
    expect(r.fuentes).toEqual([{ tipo: 'pdf', etiqueta: 'l.pdf · p. 2' }]);
    expect(r.contexto).toEqual({ fragmentos: ['f2'] });
  });

  it('una página que no existe dice cuántas tiene, sin llamar a Gemini', async () => {
    base([LIBRO], [fila(1, '1')]);
    await expect(consultar(U, '¿Qué dice la página 99?', [], { documentoId: D })).resolves.toEqual({ respuesta: 'Ese documento tiene 40 páginas.', fuentes: [] });
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('con un solo libro no hace falta elegir; con varios, pregunta cuál', async () => {
    base([LIBRO], [fila(2, '2')]);
    await expect(consultar(U, '¿Qué dice la página 2?')).resolves.toMatchObject({ fuentes: [{ etiqueta: 'l.pdf · p. 2' }] });
    m.responder.mockClear();
    base([LIBRO, { id: 'otro', nombre: 'o.pdf', paginas: 9 }]);
    await expect(consultar(U, '¿Qué dice la página 2?')).resolves.toEqual({ respuesta: '¿En qué documento? Elígelo en "Buscar en".', fuentes: [] });
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('documento anterior: pide reindexar; ajeno o a medias: no existe', async () => {
    base([{ id: D, nombre: 'v.pdf', paginas: null }]);
    await expect(consultar(U, '¿Qué dice la página 2?', [], { documentoId: D })).resolves.toMatchObject({ respuesta: 'Vuelve a indexar este documento para ver páginas y capítulos.' });
    base([]);
    await expect(consultar(U, '¿Qué dice la página 2?', [], { documentoId: D })).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
  });

  it('solo mira documentos del usuario', async () => {
    base([LIBRO], [fila(2, '2')]);
    await consultar(U, '¿Qué dice la página 2?', [], { documentoId: D });
    for (const [sql, valores] of m.bd.mock.calls) {
      expect(String(sql)).toMatch(/usuario_id = \$[12]/);
      expect(valores).toContain(U);
    }
  });
});

describe('capítulo (RB-40)', () => {
  it('usa los fragmentos del capítulo y cita sus páginas', async () => {
    base([LIBRO], [fila(1, '1'), fila(2, '2'), fila(3, '3')]);
    const r = await consultar(U, 'Resume el capítulo 1', [], { documentoId: D });
    expect(contextoDe()).toContain('texto 1');
    expect(contextoDe()).toContain('texto 2');
    expect(contextoDe()).not.toContain('texto 3');
    expect(m.responder.mock.calls[0]?.[0].pregunta).toContain('son del capítulo «Capítulo 1: A»');
    expect(r.fuentes).toEqual([{ tipo: 'pdf', etiqueta: 'l.pdf · pp. 1–2' }]);
    expect(r.contexto?.continuacion).toBeUndefined();
  });

  it('sin ese capítulo o sin capítulos, lo dice sin llamar a Gemini', async () => {
    base([LIBRO], []);
    await expect(consultar(U, 'Resume el capítulo 9', [], { documentoId: D })).resolves.toMatchObject({ respuesta: 'No encontré el capítulo 9 en este documento.' });
    m.capitulos.mockResolvedValue({ documento: {}, capitulos: [] });
    await expect(consultar(U, 'Resume el capítulo 1', [], { documentoId: D })).resolves.toMatchObject({ respuesta: 'No encontré capítulos en este PDF. Puedes preguntar por página.' });
    expect(m.responder).not.toHaveBeenCalled();
  });

  const largo = Array.from({ length: 150 }, (_, i) => fila(i + 1, String(i + 3), i + 3, i + 3));

  it('un capítulo largo va por partes de 60, con el aviso, y "sigue" continúa', async () => {
    base([LIBRO], largo);
    const r = await consultar(U, 'Resume el capítulo 2', [], { documentoId: D });
    expect(m.responder.mock.calls[0]?.[0].contexto).not.toContain('texto 61');
    expect(r.respuesta).toContain('El capítulo es largo: resumí las páginas 3–62. Escribe "sigue con el resto" para continuar.');
    expect(r.fuentes).toEqual([{ tipo: 'pdf', etiqueta: 'l.pdf · pp. 3–62' }]);
    expect(r.contexto?.continuacion).toEqual({ documentoId: D, orden: 2, desde: 60 });

    m.responder.mockClear();
    const dos = await consultar(U, 'sigue con el resto', [], { continuacion: r.contexto?.continuacion });
    expect(contextoDe()).toContain('texto 61');
    expect(contextoDe()).not.toContain('texto 60\n');
    expect(dos.contexto?.continuacion?.desde).toBe(120);

    m.responder.mockClear();
    const tres = await consultar(U, 'sigue con el resto', [], { continuacion: dos.contexto?.continuacion });
    expect(tres.respuesta).not.toContain('El capítulo es largo');
    expect(tres.contexto?.continuacion).toBeUndefined();
  });

  it('"sigue" sin capítulo en curso es una consulta normal', async () => {
    base([]);
    m.bd.mockResolvedValue([]);
    m.responder.mockResolvedValue('No encontré esto en tus documentos');
    await expect(consultar(U, 'sigue con el resto')).resolves.toMatchObject({ respuesta: 'No encontré esto en tus documentos' });
    expect(m.capitulos).not.toHaveBeenCalled();
  });
});

describe('Buscar en: un solo documento', () => {
  it('la búsqueda normal se limita a ese documento y a su dueño', async () => {
    m.bd.mockResolvedValue([{ ...fila(1, '1'), distancia: 0.1 }]);
    m.responder.mockResolvedValue('Dice algo [l.pdf · p. 1].');
    const r = await consultar(U, '¿Qué dice sobre el tema?', [], { documentoId: D });
    const [sql, valores] = m.bd.mock.calls.find((c) => String(c[0]).includes('<=>')) ?? [];
    expect(String(sql)).toContain('d.id = $3');
    expect(String(sql)).toContain('d.usuario_id = $4');
    expect(valores?.slice(2)).toEqual([D, U]);
    expect(r.contexto).toEqual({ fragmentos: ['f1'] });
  });

  it('una respuesta sin citas de documentos no es explicable', async () => {
    m.bd.mockResolvedValue([]);
    m.responder.mockResolvedValue('No encontré esto en tus documentos');
    const r = await consultar(U, '¿Qué dice sobre el tema?');
    expect(r.contexto).toBeUndefined();
  });
});

describe('Explicar de otra manera (RB-41)', () => {
  const CONV = '33333333-3333-4333-8333-333333333333';
  const FUENTES = [{ tipo: 'pdf', etiqueta: 'l.pdf · p. 2' }];
  function conMensaje(mensaje: unknown, fragmentos: unknown[]) {
    m.bd.mockImplementation(async (sql: string) => {
      if (sql.includes("autor = 'asistente'")) return mensaje ? [mensaje] : [];
      if (sql.includes("autor = 'usuario'")) return [{ texto: 'La pregunta original' }];
      if (sql.includes('ANY($1')) return fragmentos;
      return [];
    });
    m.txQuery.mockResolvedValue({ rows: [{ id: 77 }] });
  }
  const original = { id: 5, conversacion_id: CONV, texto: 'La respuesta', fuentes: FUENTES, contexto: { fragmentos: ['f2'], continuacion: { documentoId: D, orden: 1, desde: 60 } } };

  it('usa los mismos fragmentos, sin buscar otra vez, conserva las citas y queda en el historial', async () => {
    conMensaje(original, [fila(2, '2')]);
    m.responder.mockResolvedValue('Dicho más fácil.');
    const r = await explicarRespuesta(U, 5, 'simple');
    expect(r).toEqual({ respuesta: 'Dicho más fácil.', fuentes: FUENTES, conversacionId: CONV, guardada: true, mensajeId: 77, explicable: true });
    const llamada = m.responder.mock.calls[0]?.[0];
    expect(llamada.contexto).toContain('[l.pdf · p. 2]\ntexto 2');
    expect(llamada.pregunta).toContain('palabras más simples');
    expect(llamada.historial).toEqual([{ autor: 'usuario', texto: 'La pregunta original' }, { autor: 'asistente', texto: 'La respuesta' }]);
    expect(m.txQuery.mock.calls[0]?.[1]).toEqual([CONV, U, 'usuario', 'Explícalo: Más simple', '[]', null]);
    const guardado = m.txQuery.mock.calls[1]?.[1] as unknown[];
    expect(JSON.parse(guardado[4] as string)).toEqual(FUENTES);
    expect(JSON.parse(guardado[5] as string)).toEqual({ fragmentos: ['f2'] }); // sin continuación
  });

  it('solo mensajes propios; sin fragmentos o ya borrados, no disponible', async () => {
    conMensaje(null, []);
    await expect(explicarRespuesta(U, 5, 'simple')).rejects.toMatchObject({ codigo: 'MENSAJE_NO_ENCONTRADO' });
    expect(m.bd.mock.calls[0]?.[1]).toEqual([5, U]);
    conMensaje({ ...original, contexto: null }, []);
    await expect(explicarRespuesta(U, 5, 'simple')).rejects.toMatchObject({ codigo: 'MENSAJE_NO_ENCONTRADO' });
    conMensaje(original, []);
    await expect(explicarRespuesta(U, 5, 'simple')).rejects.toMatchObject({ codigo: 'MENSAJE_NO_ENCONTRADO' });
    expect(m.responder).not.toHaveBeenCalled();
  });
});
