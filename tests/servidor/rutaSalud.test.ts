// @vitest-environment node
// E21: el cron diario de Vercel (GET /api/nova/salud con CRON_SECRET).
import { readFileSync } from 'node:fs';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { config as configMiddleware } from '@/middleware';

const m = vi.hoisted(() => ({ comprobarBase: vi.fn() }));
vi.mock('@/lib/dataService', () => m);

import * as ruta from '@/app/api/nova/salud/route';

const pedir = (autorizacion?: string) =>
  ruta.GET(new Request('http://x/api/nova/salud', { headers: autorizacion ? { authorization: autorizacion } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CRON_SECRET', 'secreto-del-cron-de-prueba');
  m.comprobarBase.mockResolvedValue(undefined);
});

describe('GET /api/nova/salud', () => {
  it('sin el secreto, con otro o sin "Bearer": 401 y no toca la base', async () => {
    for (const r of [await pedir(), await pedir('Bearer otro'), await pedir('secreto-del-cron-de-prueba'), await pedir('Bearer secreto-del-cron-de-pruebX')]) {
      expect(r.status).toBe(401);
      expect(r.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(m.comprobarBase).not.toHaveBeenCalled();
  });

  it('sin CRON_SECRET en el servidor, nadie entra', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await pedir('Bearer ')).status).toBe(401);
    expect((await pedir('Bearer undefined')).status).toBe(401);
    expect(m.comprobarBase).not.toHaveBeenCalled();
  });

  it('con el secreto consulta la base y no devuelve datos', async () => {
    const r = await pedir('Bearer secreto-del-cron-de-prueba');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, datos: { base: 'ok' } });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('si la base no responde, error interno', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    m.comprobarBase.mockRejectedValue(new Error('sin conexión'));
    expect((await pedir('Bearer secreto-del-cron-de-prueba')).status).toBe(500);
  });

  it('vercel.json lo llama una vez al día (el plan Hobby no admite más) y el middleware no corre en esa ruta', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: Array<{ path: string; schedule: string }> };
    expect(config.crons).toEqual([{ path: '/api/nova/salud', schedule: '0 13 * * *' }]);
    expect(unstable_doesMiddlewareMatch({ config: configMiddleware, url: '/api/nova/salud' })).toBe(false);
  });
});
