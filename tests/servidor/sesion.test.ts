// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/modules/auth/session', () => ({ getCurrentUser }));

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

  it('con sesión en la lista devuelve el id y el correo', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
    await expect(exigirSesion()).resolves.toEqual({ id: 'u1', email: 'dueno@ejemplo.com' });
  });
});
