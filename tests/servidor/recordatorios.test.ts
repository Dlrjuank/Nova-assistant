// @vitest-environment node
// E11c (6.12, 7.10; RB-44, RB-45, RB-57): el aviso de cada minuto, el envío push y la indexación en segundo plano.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultar: vi.fn(),
  conTransaccion: vi.fn(),
  tx: { query: vi.fn() },
  enviar: vi.fn(),
  setVapid: vi.fn(),
  generarEmbeddings: vi.fn(),
}));
vi.mock('web-push', () => ({ default: { sendNotification: m.enviar, setVapidDetails: m.setVapid } }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.generarEmbeddings } }));
vi.mock('@vercel/blob', () => ({ del: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  aLiteralVector: (v: number[]) => `[${v.join(',')}]`,
  conTransaccion: m.conTransaccion,
  consultar: m.consultar,
}));

import { avanzarLibroEnSegundoPlano } from '@/lib/datos/documentos';
import { enviarAUsuario, enviarPrueba, guardarSuscripcion, procesarRecordatorios, procesarResumenes } from '@/lib/datos/notificaciones';

const U = '11111111-1111-4111-8111-111111111111';
const AHORA = new Date('2026-11-20T15:00:00Z');
const sentencias = () => m.tx.query.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VAPID_PUBLIC_KEY', 'publica');
  vi.stubEnv('VAPID_PRIVATE_KEY', 'privada');
  m.conTransaccion.mockImplementation((trabajo: (tx: typeof m.tx) => unknown) => trabajo(m.tx));
  m.consultar.mockResolvedValue([]);
  m.enviar.mockResolvedValue({ statusCode: 201 });
});

/** Un recordatorio vencido, como lo devuelve el SELECT del aviso. */
const vencido = (id: string, minutosTarde: number, extra: Record<string, unknown> = {}) => ({
  id,
  usuario_id: U,
  titulo: 'Clase',
  recordatorio: '15_min',
  recordatorio_en: new Date(AHORA.getTime() - minutosTarde * 60_000),
  hora_inicio: '10:00',
  hora_fin: '11:00',
  formato_hora: '24',
  suscripciones: 1,
  ...extra,
});

describe('S-48 · procesarRecordatorios: ventana de 30 min y sin envíos dobles', () => {
  function conVencidos(filas: unknown[]) {
    m.tx.query.mockImplementation(async (sql: string) => (String(sql).includes('SELECT t.id') ? { rows: filas } : { rows: [] }));
    m.consultar.mockImplementation(async (sql: string) =>
      String(sql).includes('FROM suscripciones_push') ? [{ id: 's1', endpoint: 'https://push.ejemplo/1', p256dh: 'p', auth: 'a' }] : [],
    );
  }

  it('toma los pendientes con FOR UPDATE SKIP LOCKED y los marca en la misma transacción, antes de enviar', async () => {
    conVencidos([vencido('t1', 0), vencido('t2', 31), vencido('t3', 5, { suscripciones: 0 })]);
    const r = await procesarRecordatorios(AHORA);
    expect(r).toEqual({ enviados: 1, omitidos: 2, sinDispositivo: 1 });
    const seleccion = sentencias().find((s) => s.includes('SELECT t.id')) ?? '';
    expect(seleccion).toContain("t.recordatorio_estado = 'pendiente'");
    expect(seleccion).toContain("t.estado <> 'Completada'");
    expect(seleccion).toContain('FOR UPDATE OF t SKIP LOCKED');
    const marcas = m.tx.query.mock.calls.filter((c) => String(c[0]).includes('ANY($1::uuid[])'));
    expect(marcas.map((c) => [String(c[0]).includes("'omitido'") ? 'omitido' : 'enviado', c[1]?.[0]])).toEqual([
      ['omitido', ['t2', 't3']], // 31 min tarde (7.10) y sin ningún dispositivo (RB-45)
      ['enviado', ['t1']],
    ]);
    // El envío sale después de confirmar la transacción.
    expect(m.conTransaccion.mock.invocationCallOrder[0]).toBeLessThan(m.enviar.mock.invocationCallOrder[0] ?? 0);
  });

  it('las tareas completadas desde master (que no conoce el recordatorio) ya no avisan', async () => {
    conVencidos([]);
    await procesarRecordatorios(AHORA);
    expect(sentencias()[0]).toContain("SET recordatorio_estado = 'omitido'");
    expect(sentencias()[0]).toContain("estado = 'Completada'");
  });

  it('RB-44: la notificación lleva el título "Nova", el texto exacto y abre la tarea resaltada', async () => {
    conVencidos([vencido('t1', 0)]);
    await procesarRecordatorios(AHORA);
    const [suscripcion, carga, opciones] = m.enviar.mock.calls[0] ?? [];
    expect(suscripcion).toEqual({ endpoint: 'https://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' } });
    expect(JSON.parse(String(carga))).toEqual({ titulo: 'Nova', cuerpo: 'En 15 min: Clase (10:00 – 11:00)', url: '/nova/tareas?tarea=t1', etiqueta: 'tarea-t1' });
    expect(opciones).toMatchObject({ TTL: 1800, urgency: 'high' });
  });

  it('en 12 horas si así está Configuración', async () => {
    conVencidos([vencido('t1', 0, { formato_hora: '12' })]);
    await procesarRecordatorios(AHORA);
    expect(JSON.parse(String(m.enviar.mock.calls[0]?.[1])).cuerpo).toBe('En 15 min: Clase (10:00 a. m. – 11:00 a. m.)');
  });

  it('sin nada vencido no envía nada', async () => {
    conVencidos([]);
    await expect(procesarRecordatorios(AHORA)).resolves.toEqual({ enviados: 0, omitidos: 0, sinDispositivo: 0 });
    expect(m.enviar).not.toHaveBeenCalled();
  });
});

describe('enviarAUsuario', () => {
  it('borra las suscripciones vencidas (404 y 410) y anota otros errores', async () => {
    m.consultar.mockImplementation(async (sql: string) =>
      String(sql).startsWith('SELECT id, endpoint')
        ? [1, 2, 3, 4].map((n) => ({ id: `s${n}`, endpoint: `https://push.ejemplo/${n}`, p256dh: 'p', auth: 'a' }))
        : [],
    );
    m.enviar
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('Not found'), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('Too many'), { statusCode: 429 }));
    const r = await enviarAUsuario(U, { titulo: 'Nova', cuerpo: 'x', url: '/nova', etiqueta: 'e' });
    expect(r).toEqual({ enviadas: 1, fallidas: 3 });
    const borradas = m.consultar.mock.calls.filter((c) => String(c[0]).startsWith('DELETE FROM suscripciones_push')).map((c) => c[1]?.[0]);
    expect(borradas.sort()).toEqual(['s2', 's3']);
    const anotada = m.consultar.mock.calls.find((c) => String(c[0]).includes('ultimo_error = $2'));
    expect(anotada?.[1]).toEqual(['s4', '429 Too many']);
  });

  it('sin claves VAPID en el servidor no intenta enviar', async () => {
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    await expect(enviarAUsuario(U, { titulo: 'Nova', cuerpo: 'x', url: '/nova', etiqueta: 'e' })).rejects.toMatchObject({ codigo: 'NOTIFICACIONES_NO_CONFIGURADAS' });
  });
});

describe('suscripciones y prueba', () => {
  it('guarda la suscripción del dispositivo (si era de otro usuario, pasa a este)', async () => {
    m.consultar.mockImplementation(async (sql: string) => (String(sql).includes('count(*)') ? [{ n: 2 }] : []));
    await expect(guardarSuscripcion(U, { endpoint: 'https://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' }, dispositivo: 'iPhone' })).resolves.toEqual({ suscripciones: 2 });
    const [sql, valores] = m.consultar.mock.calls[0] ?? [];
    expect(String(sql)).toContain('ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id');
    expect(valores).toEqual([U, 'https://push.ejemplo/1', 'p', 'a', 'iPhone']);
  });

  it('rechaza un endpoint que no es https', async () => {
    await expect(guardarSuscripcion(U, { endpoint: 'http://push.ejemplo/1', keys: { p256dh: 'p', auth: 'a' } })).rejects.toMatchObject({ codigo: 'SUSCRIPCION_INVALIDA' });
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('"Enviar una de prueba" sin dispositivos dice que hay que activarlas (RB-45)', async () => {
    m.consultar.mockImplementation(async (sql: string) => (String(sql).includes('count(*)') ? [{ n: 0 }] : []));
    await expect(enviarPrueba(U)).rejects.toMatchObject({ codigo: 'SIN_NOTIFICACIONES', message: 'Activa las notificaciones para recibir este aviso.' });
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it('la de prueba llega a cada dispositivo y queda registrada', async () => {
    m.consultar.mockImplementation(async (sql: string) => {
      if (String(sql).includes('count(*)')) return [{ n: 1 }];
      if (String(sql).startsWith('SELECT id, endpoint')) return [{ id: 's1', endpoint: 'https://push.ejemplo/1', p256dh: 'p', auth: 'a' }];
      return [];
    });
    await expect(enviarPrueba(U)).resolves.toEqual({ enviadas: 1, fallidas: 0 });
    expect(JSON.parse(String(m.enviar.mock.calls[0]?.[1]))).toMatchObject({ titulo: 'Nova', url: '/nova/configuracion', etiqueta: expect.stringMatching(/^prueba-\d+$/) }); // nueva cada vez: Windows no avisa al reemplazar
    expect(m.consultar.mock.calls.some((c) => String(c[0]).includes('INSERT INTO envios') && c[1]?.[2] === 'prueba')).toBe(true);
  });
});

describe('S-62 y S-63 · RB-57: indexación en segundo plano', () => {
  const pendientes = [{ numero: 3, contenido: 'texto', paginaInicio: 1, paginaFin: 2, etiquetaPaginas: '1–2' }];

  it('S-62: toma el libro a medias más antiguo que nadie esté indexando, con su bloqueo', async () => {
    m.consultar.mockImplementation(async (sql: string) => (String(sql).includes('RETURNING id, por_indexar') ? [{ id: 'd1', por_indexar: pendientes, progreso: 40 }] : []));
    m.generarEmbeddings.mockResolvedValue([[0.1]]);
    m.tx.query.mockResolvedValue({ rows: [{}] });
    await expect(avanzarLibroEnSegundoPlano()).resolves.toEqual({ documentoId: 'd1', progreso: null });
    const tomar = String(m.consultar.mock.calls[0]?.[0]);
    expect(tomar).toContain('ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED');
    expect(tomar).toContain('indexando_hasta IS NULL OR indexando_hasta < NOW()');
    expect(m.generarEmbeddings).toHaveBeenCalledWith(['texto'], { sinEsperarCuota: true });
    // Al terminar suelta el bloqueo, para que la pantalla (o el minuto siguiente) siga.
    expect(m.consultar.mock.calls.some((c) => String(c[0]).includes('SET indexando_hasta = NULL'))).toBe(true);
  });

  it('S-63: con la cuota agotada no espera: deja el libro como estaba para el minuto siguiente', async () => {
    m.consultar.mockImplementation(async (sql: string) => (String(sql).includes('RETURNING id, por_indexar') ? [{ id: 'd1', por_indexar: pendientes, progreso: 40 }] : []));
    m.generarEmbeddings.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await expect(avanzarLibroEnSegundoPlano()).resolves.toEqual({ documentoId: 'd1', progreso: 40, esperaCuota: true });
    expect(m.tx.query).not.toHaveBeenCalled();
    expect(m.consultar.mock.calls.some((c) => String(c[0]).includes('SET indexando_hasta = NULL'))).toBe(true);
  });

  it('sin libros a medias no hace nada', async () => {
    await expect(avanzarLibroEnSegundoPlano()).resolves.toBeNull();
    expect(m.generarEmbeddings).not.toHaveBeenCalled();
  });
});

describe('RB-46 · procesarResumenes: uno por día, solo con tareas de hoy o vencidas', () => {
  // 07:05 en Bogotá del 20 de noviembre.
  const A_LAS_7_05 = new Date('2026-11-20T12:05:00Z');
  const candidato = (extra: Record<string, unknown> = {}) => ({ usuario_id: U, hora_resumen: '07:00', hoy: 2, vencidas: 1, suscripciones: 1, ...extra });

  function conCandidatos(filas: unknown[], { reservado = true } = {}) {
    m.consultar.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes('FROM preferencias_usuario p')) return filas;
      if (s.includes('INSERT INTO envios')) return reservado ? [{ id: 'e1' }] : [];
      if (s.includes('FROM suscripciones_push')) return [{ id: 's1', endpoint: 'https://push.ejemplo/1', p256dh: 'p', auth: 'a' }];
      return [];
    });
  }
  const llamadas = (texto: string) => m.consultar.mock.calls.filter(([sql]) => String(sql).includes(texto));

  it('busca a quienes lo tienen activo, con la hora alcanzada y sin el de hoy; reserva el día antes de enviar', async () => {
    conCandidatos([candidato()]);
    await expect(procesarResumenes(A_LAS_7_05)).resolves.toEqual({ enviados: 1, sinTareas: 0, omitidos: 0, sinDispositivo: 0 });
    const [sql, valores] = llamadas('FROM preferencias_usuario p')[0] ?? [];
    expect(String(sql)).toContain('p.resumen_diario');
    expect(String(sql)).toContain("e.tipo = 'resumen' AND e.fecha = $1::date");
    expect(valores).toEqual(['2026-11-20', '07:05:00', null]);
    const reserva = llamadas('INSERT INTO envios')[0];
    expect(String(reserva?.[0])).toContain('ON CONFLICT (usuario_id, tipo, fecha) WHERE tipo = \'resumen\' DO NOTHING');
    expect(reserva?.[1]).toEqual([U, '2026-11-20', 'enviando']);
    const orden = m.consultar.mock.invocationCallOrder;
    const iReserva = m.consultar.mock.calls.findIndex(([s]) => String(s).includes('INSERT INTO envios'));
    expect(orden[iReserva]).toBeLessThan(m.enviar.mock.invocationCallOrder[0] as number);
    expect(JSON.parse(String(m.enviar.mock.calls[0]?.[1]))).toEqual({ titulo: 'Nova', cuerpo: 'Hoy: 2 tareas · 1 vencida', url: '/nova', etiqueta: 'resumen-2026-11-20' });
    expect(llamadas('UPDATE envios SET resultado')[0]?.[1]).toEqual(['e1', 'enviadas 1, fallidas 0']);
  });

  it('si otro aviso ya reservó el día, no envía (nunca dos resúmenes)', async () => {
    conCandidatos([candidato()], { reservado: false });
    await expect(procesarResumenes(A_LAS_7_05)).resolves.toEqual({ enviados: 0, sinTareas: 0, omitidos: 0, sinDispositivo: 0 });
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it('sin tareas de hoy ni vencidas, sin dispositivos o con más de 30 min de atraso: lo anota y no envía', async () => {
    conCandidatos([
      candidato({ hoy: 0, vencidas: 0 }),
      candidato({ usuario_id: 'u2', suscripciones: 0 }),
      candidato({ usuario_id: 'u3', hora_resumen: '06:30' }),
    ]);
    await expect(procesarResumenes(A_LAS_7_05)).resolves.toEqual({ enviados: 0, sinTareas: 1, omitidos: 1, sinDispositivo: 1 });
    expect(llamadas('INSERT INTO envios').map(([, v]) => (v as unknown[])[2])).toEqual(['sin tareas', 'sin dispositivo', 'omitido: atrasado']);
    expect(m.enviar).not.toHaveBeenCalled();
  });

  it('solo vencidas: "Hoy: 1 tarea vencida"', async () => {
    conCandidatos([candidato({ hoy: 0, vencidas: 1 })]);
    await procesarResumenes(A_LAS_7_05);
    expect(JSON.parse(String(m.enviar.mock.calls[0]?.[1])).cuerpo).toBe('Hoy: 1 tarea vencida');
  });

  it('un fallo al enviar queda anotado en el envío del día', async () => {
    conCandidatos([candidato()]);
    m.enviar.mockRejectedValue(Object.assign(new Error('caído'), { statusCode: 500 }));
    await expect(procesarResumenes(A_LAS_7_05)).resolves.toMatchObject({ enviados: 1 });
    expect(llamadas('UPDATE envios SET resultado')[0]?.[1]).toEqual(['e1', 'enviadas 0, fallidas 1']);
  });
});
