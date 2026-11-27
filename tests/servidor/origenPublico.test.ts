// @vitest-environment node
// E21: "Entrar con Google" detrás de un proxy (el túnel de Cloudflare) volvía a localhost.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock('@/lib/db/conexion', () => ({ consultar: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));

import { GET as callback } from '@/app/auth/callback/route';
import { GET as google } from '@/app/auth/google/route';
import { origenPublico } from '@/lib/http/origen';

const TUNEL = 'ejemplo-de-tunel.trycloudflare.com';
const pedido = (cabeceras: Record<string, string>, url = 'http://localhost:3100/auth/google') => new Request(url, { headers: cabeceras });

beforeEach(() => {
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('APP_URL', 'https://nova.ejemplo.com');
  auth.signInWithOAuth.mockReset().mockResolvedValue({ data: { url: 'https://supabase.ejemplo/authorize' }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('origenPublico', () => {
  it('sin encabezados, el origen del pedido', () => {
    expect(origenPublico(pedido({}))).toBe('http://localhost:3100');
  });

  it.each([
    [{ host: TUNEL, 'x-forwarded-proto': 'https' }, `https://${TUNEL}`],
    [{ host: 'localhost:3100', 'x-forwarded-host': TUNEL }, `https://${TUNEL}`],
    [{ 'x-forwarded-host': `${TUNEL}, otro.ejemplo` }, `https://${TUNEL}`],
    [{ host: 'localhost:3100' }, 'http://localhost:3100'],
    [{ host: '127.0.0.1:3100' }, 'http://127.0.0.1:3100'],
    [{ host: 'nova.ejemplo.com', 'x-forwarded-proto': 'http' }, 'https://nova.ejemplo.com'],
    [{ host: 'novaassistantjc.vercel.app' }, 'https://novaassistantjc.vercel.app'],
    [{ host: 'nova-assistant-git-ampliacion-dlrjuank.vercel.app' }, 'https://nova-assistant-git-ampliacion-dlrjuank.vercel.app'],
  ])('host permitido %o', (cabeceras, esperado) => {
    expect(origenPublico(pedido(cabeceras as Record<string, string>))).toBe(esperado);
  });

  it.each([
    'malo.ejemplo', 'nova-assistant.vercel.app', 'otro-proyecto.vercel.app', `${TUNEL}.malo.ejemplo`, `malo.ejemplo/${TUNEL}`,
    `malo.ejemplo@${TUNEL}`, `${TUNEL}@malo.ejemplo`, 'a.b.trycloudflare.com', 'trycloudflare.com', 'localhost.malo.ejemplo', 'nova.ejemplo.com.malo.ejemplo',
  ])('host no permitido %s: el origen de siempre', (host) => {
    expect(origenPublico(pedido({ 'x-forwarded-host': host }))).toBe('http://localhost:3100');
  });

  it('en Vercel no valen ni un túnel ni localhost', () => {
    vi.stubEnv('VERCEL', '1');
    for (const host of [TUNEL, 'localhost:3100']) {
      expect(origenPublico(pedido({ 'x-forwarded-host': host }, 'https://novaassistantjc.vercel.app/auth/google'))).toBe('https://novaassistantjc.vercel.app');
    }
  });
});

describe('Entrar con Google detrás del túnel', () => {
  it('/auth/google pide volver a la dirección del túnel', async () => {
    await google(pedido({ host: TUNEL, 'x-forwarded-proto': 'https' }));
    expect(auth.signInWithOAuth.mock.calls[0]?.[0].options.redirectTo).toBe(`https://${TUNEL}/auth/callback?next=/nova`);
  });

  it('/auth/callback redirige dentro del túnel, también al fallar', async () => {
    const cabeceras = { host: TUNEL, 'x-forwarded-proto': 'https' };
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'u', created_at: '2020-01-01T00:00:00Z' } }, error: null });
    const bien = await callback(pedido(cabeceras, 'http://localhost:3100/auth/callback?code=c&next=/nova/tareas'));
    expect(bien.headers.get('location')).toBe(`https://${TUNEL}/nova/tareas`);
    const mal = await callback(pedido(cabeceras, 'http://localhost:3100/auth/callback'));
    expect(mal.headers.get('location')).toBe(`https://${TUNEL}/login?error=google`);
  });
});
