// @vitest-environment node
// E20c-1 (S-84, RB-77, RB-80): la API de la clave nunca devuelve la clave.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  infoClaveGemini: vi.fn(),
  guardarClaveGemini: vi.fn(),
  desvincularClaveGemini: vi.fn(),
}));
vi.mock('@/lib/dataService', () => m);

import * as ruta from '@/app/api/nova/clave-gemini/route';

const CLAVE = `AIza${'z'.repeat(31)}4321`;
const put = (cuerpo: unknown) => new Request('http://x', { method: 'PUT', body: JSON.stringify(cuerpo) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: 'u1', email: 'persona@ejemplo.com' });
});

describe('/api/nova/clave-gemini', () => {
  it('sin sesión: 401 y no toca nada', async () => {
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await ruta.GET()).status).toBe(401);
    expect((await ruta.PUT(put({ clave: CLAVE }))).status).toBe(401);
    expect((await ruta.DELETE()).status).toBe(401);
    expect(m.guardarClaveGemini).not.toHaveBeenCalled();
  });

  it('GET y PUT responden solo los últimos 4, nunca la clave', async () => {
    const info = { vinculada: true, ultimos4: '4321', estado: 'activa', verificadaEn: '2026-11-25' };
    m.infoClaveGemini.mockResolvedValue(info);
    m.guardarClaveGemini.mockResolvedValue({ ...info, mensaje: 'Clave verificada y guardada.' });
    const leida = await (await ruta.GET()).text();
    const guardada = await (await ruta.PUT(put({ clave: CLAVE }))).text();
    expect(m.guardarClaveGemini).toHaveBeenCalledWith('u1', CLAVE);
    for (const texto of [leida, guardada]) {
      expect(texto).not.toContain(CLAVE);
      expect(texto).toContain('"ultimos4":"4321"');
    }
  });

  it('el error de la verificación sale con su mensaje exacto (RB-77) y sin la clave', async () => {
    m.guardarClaveGemini.mockRejectedValue(new ErrorDeNegocio('CLAVE_GEMINI_INVALIDA', 'Google no aceptó esta clave. Revisa que la copiaste completa o crea una nueva.'));
    const r = await ruta.PUT(put({ clave: CLAVE }));
    expect(r.status).toBe(422);
    const texto = await r.text();
    expect(texto).toContain('Google no aceptó esta clave.');
    expect(texto).not.toContain(CLAVE);
  });

  it('un cuerpo con otros campos o sin la clave es 400', async () => {
    expect((await ruta.PUT(put({}))).status).toBe(400);
    expect((await ruta.PUT(put({ clave: CLAVE, otra: 1 }))).status).toBe(400);
    expect(m.guardarClaveGemini).not.toHaveBeenCalled();
  });

  it('DELETE desvincula', async () => {
    const r = await ruta.DELETE();
    expect(r.status).toBe(200);
    expect(m.desvincularClaveGemini).toHaveBeenCalledWith('u1');
  });
});
