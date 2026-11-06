// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultar: vi.fn(),
  consultarBd: vi.fn(),
  txQuery: vi.fn(),
}));
vi.mock('@/lib/datos/consulta', () => ({ consultar: m.consultar }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultarBd,
  conTransaccion: async (trabajo: (tx: { query: typeof m.txQuery }) => Promise<unknown>) => trabajo({ query: m.txQuery }),
}));

import { consultarYRegistrar, conversacionActual, crearConversacion } from '@/lib/datos/conversacion';

const USUARIO = '22222222-2222-4222-8222-222222222222';
const CONV = '33333333-3333-4333-8333-333333333333';

/** Responde a cada SQL según su texto, para no depender del orden de las llamadas. */
function base(filas: { conversacion?: string | null; mensajes?: unknown[]; propia?: boolean }) {
  m.consultarBd.mockImplementation(async (sql: string) => {
    if (sql.includes('WHERE id = $1 AND usuario_id = $2')) return filas.propia ? [{ id: CONV }] : [];
    if (sql.includes('FROM mensajes_chat') && sql.includes('LIMIT $2')) return filas.mensajes ?? [];
    if (sql.includes('INSERT INTO conversaciones')) return [{ id: 'nueva' }];
    if (sql.includes('NOT EXISTS')) return [];
    if (sql.includes('FROM conversaciones')) return filas.conversacion ? [{ id: filas.conversacion }] : [];
    throw new Error(`SQL inesperado: ${sql}`);
  });
}

describe('historial del chat (RN-20 y RN-21)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.txQuery.mockResolvedValue({ rows: [] });
  });

  it('guarda la pregunta normalizada y la respuesta con sus fuentes en la conversación del usuario', async () => {
    base({ conversacion: CONV });
    const fuentes = [{ tipo: 'pdf', etiqueta: 'a.pdf · fragmento 1' }];
    m.consultar.mockResolvedValue({ respuesta: 'Dura 24 meses.', fuentes });

    await expect(consultarYRegistrar(USUARIO, '  ¿Cuánto   dura? ')).resolves.toEqual({
      respuesta: 'Dura 24 meses.',
      fuentes,
      conversacionId: CONV,
      guardada: true,
    });
    expect(m.txQuery.mock.calls[0]?.[1]).toEqual([CONV, USUARIO, 'usuario', '¿Cuánto dura?', '[]']);
    expect(m.txQuery.mock.calls[1]?.[1]).toEqual([CONV, USUARIO, 'asistente', 'Dura 24 meses.', JSON.stringify(fuentes)]);
    expect(m.txQuery.mock.calls[2]?.[0]).toContain('UPDATE conversaciones SET actualizada_en');
  });

  it('el modelo recibe los últimos 6 mensajes de la conversación, solo autor y texto', async () => {
    const previos = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      autor: i % 2 ? 'asistente' : 'usuario',
      texto: `m${i + 1}`,
      fuentes: [],
    }));
    base({ conversacion: CONV, mensajes: previos });
    m.consultar.mockResolvedValue({ respuesta: 'Sí.', fuentes: [] });
    await consultarYRegistrar(USUARIO, '¿y el segundo?');

    const limite = m.consultarBd.mock.calls.find(([sql]) => String(sql).includes('LIMIT $2'))?.[1];
    expect(limite).toEqual([CONV, 6]);
    expect(m.consultar).toHaveBeenCalledWith(
      USUARIO,
      '¿y el segundo?',
      previos.map(({ autor, texto }) => ({ autor, texto })),
    );
  });

  it('sin conversaciones crea una al preguntar', async () => {
    base({ conversacion: null });
    m.consultar.mockResolvedValue({ respuesta: 'Sí.', fuentes: [] });
    const r = await consultarYRegistrar(USUARIO, 'Mi agenda de hoy');
    expect(r.conversacionId).toBe('nueva');
    expect(m.consultar).toHaveBeenCalledWith(USUARIO, 'Mi agenda de hoy', []);
  });

  it('una conversación de otro usuario (o inexistente) es CONVERSACION_NO_ENCONTRADA y no llega a Gemini', async () => {
    base({ propia: false });
    await expect(consultarYRegistrar(USUARIO, 'Mi agenda de hoy', CONV)).rejects.toMatchObject({
      codigo: 'CONVERSACION_NO_ENCONTRADA',
    });
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('si la consulta falla no guarda nada y el error sigue su curso', async () => {
    base({ conversacion: CONV });
    m.consultar.mockRejectedValue(new ErrorDeNegocio('SIN_DOCUMENTOS'));
    await expect(consultarYRegistrar(USUARIO, 'Mi agenda de hoy')).rejects.toMatchObject({ codigo: 'SIN_DOCUMENTOS' });
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('si el guardado falla, entrega la respuesta igual con guardada: false', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    base({ conversacion: CONV });
    m.consultar.mockResolvedValue({ respuesta: 'Sí.', fuentes: [] });
    m.txQuery.mockRejectedValue(new Error('conexión perdida'));
    await expect(consultarYRegistrar(USUARIO, 'Mi agenda de hoy')).resolves.toMatchObject({
      respuesta: 'Sí.',
      guardada: false,
    });
  });

  it('conversacionActual: null sin conversaciones; con una, sus mensajes', async () => {
    base({ conversacion: null });
    await expect(conversacionActual(USUARIO)).resolves.toBeNull();
    const mensajes = [{ id: 1, autor: 'usuario', texto: 'hola', fuentes: [] }];
    base({ conversacion: CONV, mensajes });
    await expect(conversacionActual(USUARIO)).resolves.toEqual({ id: CONV, mensajes });
  });

  it('crearConversacion reutiliza la más reciente si sigue vacía', async () => {
    m.consultarBd.mockResolvedValueOnce([{ id: CONV }]);
    await expect(crearConversacion(USUARIO)).resolves.toEqual({ id: CONV });
    expect(m.consultarBd).toHaveBeenCalledTimes(1);

    m.consultarBd.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'nueva' }]);
    await expect(crearConversacion(USUARIO)).resolves.toEqual({ id: 'nueva' });
    expect(m.consultarBd.mock.calls[2]?.[1]).toEqual([USUARIO]);
  });
});
