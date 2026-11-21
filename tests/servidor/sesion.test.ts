// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// E20b (tiempo de carga): la sesión sale de getClaims (verificada con la clave pública, sin ir a Supabase Auth).
const getClaims = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims } }) }));
const getCurrentUser = { mockResolvedValue: (u: { id?: string; email?: string } | null) => getClaims.mockResolvedValue(u ? { data: { claims: { sub: u.id ?? 'u0', email: u.email } }, error: null } : { data: null, error: null }), mockReset: () => getClaims.mockReset() };

import { tieneAccesoNova } from '@/lib/auth/acceso';
import { exigirSesion, obtenerSesion } from '@/lib/auth/sesion';

describe('acceso a Nova', () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'Dueno@Ejemplo.com, otro@ejemplo.com');
  });

  it('tieneAccesoNova ignora mayúsculas y espacios, y rechaza correos ajenos o vacíos', () => {
    expect(tieneAccesoNova('dueno@ejemplo.com')).toBe(true);
    expect(tieneAccesoNova(' OTRO@ejemplo.com ')).toBe(true);
    expect(tieneAccesoNova('intruso@ejemplo.com')).toBe(false);
    expect(tieneAccesoNova('')).toBe(false);
    expect(tieneAccesoNova(undefined)).toBe(false);
  });

  it('sin sesión: obtenerSesion es null y exigirSesion lanza NO_AUTORIZADO', async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(obtenerSesion()).resolves.toBeNull();
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
  });

  it('con sesión fuera de la lista lanza ACCESO_DENEGADO', async () => {
    getCurrentUser.mockResolvedValue({ email: 'intruso@ejemplo.com' });
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
  });

  it('token inválido: sin sesión; otro error de Supabase se propaga', async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: 'AuthInvalidJwtError', status: 400 } });
    await expect(obtenerSesion()).resolves.toBeNull();
    getClaims.mockResolvedValue({ data: null, error: { name: 'AuthRetryableFetchError', status: 0 } });
    await expect(obtenerSesion()).rejects.toThrow('No se pudo verificar la sesión con Supabase.');
  });

  it('con sesión en la lista devuelve el id y el correo', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
    await expect(exigirSesion()).resolves.toEqual({ id: 'u1', email: 'dueno@ejemplo.com' });
  });
});
