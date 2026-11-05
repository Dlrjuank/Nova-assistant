// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { conManejoDeErrores, leerCuerpo, responderError, responderOk } from '@/lib/http/respuestas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const errorPg = (code: string, constraint?: string) => Object.assign(new Error('pg'), { code, constraint });

describe('respuestas', () => {
  it('responderOk usa el formato del contrato y no-store', async () => {
    const r = responderOk({ a: 1 }, 201);
    expect(r.status).toBe(201);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(await r.json()).toEqual({ ok: true, datos: { a: 1 } });
  });

  it('ErrorDeNegocio usa su estado y mensaje exacto', async () => {
    const r = responderError(new ErrorDeNegocio('PRIORIDAD_INVALIDA'));
    expect(r.status).toBe(422);
    expect((await r.json()).error.mensaje).toBe('La prioridad debe ser 1, 2 o 3');
  });

  it('traduce los errores de Postgres (sección 8.4)', async () => {
    const prioridad = await responderError(errorPg('23514', 'tareas_prioridad_valida')).json();
    expect(prioridad.error.codigo).toBe('PRIORIDAD_INVALIDA');
    const otroCheck = await responderError(errorPg('23514', 'tareas_minutos_validos')).json();
    expect(otroCheck.error.codigo).toBe('DATOS_INVALIDOS');
  });

  it('un error inesperado no filtra detalles técnicos', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = responderError(new Error('contraseña en la URL'));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('contraseña');
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });

  it('conManejoDeErrores convierte NO_AUTORIZADO en 401', async () => {
    const handler = conManejoDeErrores(async () => {
      throw new ErrorDeNegocio('NO_AUTORIZADO');
    });
    expect((await handler()).status).toBe(401);
  });

  it('leerCuerpo rechaza JSON mal formado con DATOS_INVALIDOS', async () => {
    const peticion = new Request('http://x', { method: 'POST', body: 'no-json' });
    await expect(leerCuerpo(peticion, z.object({}))).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });
});
