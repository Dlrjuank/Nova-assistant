// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  consultarBd: vi.fn(),
  responder: vi.fn(),
  exigirSesion: vi.fn(),
  calcularProductividad: vi.fn(),
}));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { responder: m.responder } }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({ calcularProductividad: m.calcularProductividad }));

import * as productividadRuta from '@/app/api/nova/productividad/route';
import { calcularProductividad } from '@/lib/datos/productividad';
import { hoyBogota } from '@/lib/reglas/fechas';

const conteo = (totales: number, completadas: number, minutos: number) =>
  m.consultarBd.mockResolvedValueOnce([{ totales, completadas, minutos }]);
const post = (cuerpo: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) });

describe('calcularProductividad (CU-05)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('RN-18: sin tareas en la fecha devuelve { sinTareas: true } y no llama a Gemini', async () => {
    conteo(0, 0, 0);
    await expect(calcularProductividad('2026-03-10')).resolves.toEqual({ sinTareas: true });
    expect(m.responder).not.toHaveBeenCalled();
  });

  it('ejemplo del plan: 4 de 5 con 120 min → 86,0 Excelente, con la recomendación de Gemini', async () => {
    conteo(5, 4, 120);
    m.responder.mockResolvedValue('Sigue así.');
    await expect(calcularProductividad('2026-03-10')).resolves.toEqual({
      fecha: '2026-03-10',
      totales: 5,
      completadas: 4,
      minutos: 120,
      puntos: 86,
      nivel: 'Excelente',
      recomendacion: 'Sigue así.',
      recomendacionDisponible: true,
    });
    expect(m.consultarBd.mock.calls[0]?.[1]).toEqual(['2026-03-10']);
    const { contexto } = m.responder.mock.calls[0]?.[0];
    expect(contexto).toContain('Tareas del día: 5');
    expect(contexto).toContain('Puntos: 86.0');
    expect(contexto).toContain('Nivel: Excelente');
  });

  it('cuenta los minutos sin tope y la regla aplica el tope de 120', async () => {
    conteo(5, 5, 500);
    m.responder.mockResolvedValue('Bien.');
    const r = await calcularProductividad('2026-03-10');
    expect(r).toMatchObject({ minutos: 500, puntos: 100, nivel: 'Excelente' });
  });

  it('si Gemini falla, entrega el índice con un texto fijo', async () => {
    conteo(5, 3, 30);
    m.responder.mockRejectedValue(new ErrorDeNegocio('ERROR_LLM'));
    await expect(calcularProductividad('2026-03-10')).resolves.toMatchObject({
      puntos: 49.5,
      nivel: 'Bajo',
      recomendacion: 'No se pudo generar la recomendación en este momento.',
      recomendacionDisponible: false,
    });
  });

  it('un error que no es de negocio (la base) no se oculta', async () => {
    conteo(5, 3, 30);
    m.responder.mockRejectedValue(new Error('inesperado'));
    await expect(calcularProductividad('2026-03-10')).rejects.toThrow('inesperado');
  });

  it('sin fecha usa hoy en Bogotá; una fecha irreal es FECHA_INVALIDA sin tocar la base', async () => {
    conteo(0, 0, 0);
    await calcularProductividad();
    expect(m.consultarBd.mock.calls[0]?.[1]).toEqual([hoyBogota()]);
    await expect(calcularProductividad('2026-02-30')).rejects.toMatchObject({ codigo: 'FECHA_INVALIDA' });
    expect(m.consultarBd).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/nova/productividad', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.exigirSesion.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
  });

  it('sin sesión o fuera de la lista no calcula', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await productividadRuta.POST(post({}))).status).toBe(estado);
    }
    expect(m.calcularProductividad).not.toHaveBeenCalled();
  });

  it('pasa la fecha del cuerpo, o ninguna para usar hoy', async () => {
    m.calcularProductividad.mockResolvedValue({ sinTareas: true });
    const r = await productividadRuta.POST(post({ fecha: '2026-03-10' }));
    expect(await r.json()).toEqual({ ok: true, datos: { sinTareas: true } });
    expect(m.calcularProductividad).toHaveBeenLastCalledWith('2026-03-10');
    await productividadRuta.POST(post({}));
    expect(m.calcularProductividad).toHaveBeenLastCalledWith(undefined);
  });

  it('una fecha irreal vuelve 422 con el mensaje de fecha', async () => {
    m.calcularProductividad.mockRejectedValue(new ErrorDeNegocio('FECHA_INVALIDA'));
    const r = await productividadRuta.POST(post({ fecha: '2026-02-30' }));
    expect(r.status).toBe(422);
    expect((await r.json()).error.mensaje).toBe('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.');
  });
});
