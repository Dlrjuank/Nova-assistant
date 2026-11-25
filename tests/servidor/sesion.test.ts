// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// E20b (tiempo de carga): la sesión sale de getClaims (verificada con la clave pública, sin ir a Supabase Auth).
const getClaims = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims } }) }));
const conSesion = (u: { id?: string; email?: string } | null) =>
  getClaims.mockResolvedValue(u ? { data: { claims: { sub: u.id ?? 'u0', email: u.email } }, error: null } : { data: null, error: null });

// E20c-2: la fila de `cuentas` de cada usuario (y las consultas que se hicieron).
const filas = vi.hoisted(() => new Map<string, { estado: string; nivel: string }>());
const consultas = vi.hoisted(() => [] as Array<{ sql: string; valores: unknown[] }>);
vi.mock('@/lib/db/conexion', () => ({
  consultar: async (sql: string, valores: unknown[]) => {
    consultas.push({ sql, valores });
    const fila = filas.get(valores[0] as string);
    return fila ? [fila] : [];
  },
}));

import { exigirAdministrador, exigirDueno, exigirSesion, obtenerSesion } from '@/lib/auth/sesion';
import { CORREO_DUENO } from '@/modules/auth/admin';

describe('acceso a Nova con la tabla cuentas (E20c-2, RB-92, RB-93)', () => {
  beforeEach(() => {
    getClaims.mockReset();
    filas.clear();
    consultas.length = 0;
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'Emergencia@Ejemplo.com, otro@ejemplo.com');
  });

  it('sin sesión: obtenerSesion es null y exigirSesion lanza NO_AUTORIZADO sin consultar la base', async () => {
    conSesion(null);
    await expect(obtenerSesion()).resolves.toBeNull();
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' });
    expect(consultas).toHaveLength(0);
  });

  it('una cuenta activa entra con su nivel, y la consulta anota el último acceso como mucho una vez por hora', async () => {
    filas.set('u1', { estado: 'activa', nivel: 'usuario' });
    conSesion({ id: 'u1', email: 'persona@ejemplo.com' });
    await expect(exigirSesion()).resolves.toEqual({ id: 'u1', email: 'persona@ejemplo.com', nivel: 'usuario' });
    expect(consultas[0]?.sql).toMatch(/UPDATE cuentas SET ultimo_acceso = now\(\)/);
    expect(consultas[0]?.sql).toMatch(/interval '1 hour'/);
  });

  it('S-92: pendiente o sin fila no entra (CUENTA_PENDIENTE, 403): la regla falla cerrada', async () => {
    filas.set('u2', { estado: 'pendiente', nivel: 'usuario' });
    conSesion({ id: 'u2', email: 'nueva@ejemplo.com' });
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'CUENTA_PENDIENTE', message: 'Tu cuenta está esperando que el administrador la habilite.' });
    conSesion({ id: 'sin-fila', email: 'sin-fila@ejemplo.com' });
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'CUENTA_PENDIENTE' });
  });

  it('RB-82: bloqueada no entra, también con la sesión ya abierta (se revisa la base en cada pedido)', async () => {
    filas.set('u3', { estado: 'activa', nivel: 'usuario' });
    conSesion({ id: 'u3', email: 'x@ejemplo.com' });
    await expect(exigirSesion()).resolves.toMatchObject({ nivel: 'usuario' });
    filas.set('u3', { estado: 'bloqueada', nivel: 'usuario' });
    await expect(exigirSesion()).rejects.toMatchObject({ codigo: 'CUENTA_BLOQUEADA', message: 'Tu cuenta está bloqueada. Escríbele al administrador.' });
  });

  it('el correo incorporado siempre entra como dueño; SUPABASE_ADMIN_EMAILS, como administrador (nunca dueño)', async () => {
    conSesion({ id: 'd', email: CORREO_DUENO.toUpperCase() });
    await expect(exigirSesion()).resolves.toMatchObject({ nivel: 'dueno' });
    filas.set('e', { estado: 'bloqueada', nivel: 'usuario' });
    conSesion({ id: 'e', email: ' emergencia@ejemplo.com ' });
    await expect(exigirSesion()).resolves.toMatchObject({ nivel: 'admin' });
  });

  it('RB-83: exigirAdministrador deja pasar a administradores y al dueño; a un usuario, ACCESO_DENEGADO', async () => {
    filas.set('a', { estado: 'activa', nivel: 'admin' });
    conSesion({ id: 'a', email: 'admin@ejemplo.com' });
    await expect(exigirAdministrador()).resolves.toMatchObject({ nivel: 'admin' });
    filas.set('u', { estado: 'activa', nivel: 'usuario' });
    conSesion({ id: 'u', email: 'u@ejemplo.com' });
    await expect(exigirAdministrador()).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO', message: 'Tu cuenta no tiene acceso a Nova Assistant.' });
  });

  it('RB-93: exigirDueno rechaza a un administrador con "No tienes permiso para esto."', () => {
    expect(() => exigirDueno({ id: 'a', email: 'a@x.com', nivel: 'admin' })).toThrow('No tienes permiso para esto.');
    expect(() => exigirDueno({ id: 'd', email: CORREO_DUENO, nivel: 'dueno' })).not.toThrow();
  });

  it('una fila que dijera dueño para otro correo cuenta solo como administrador', async () => {
    filas.set('f', { estado: 'activa', nivel: 'dueno' });
    conSesion({ id: 'f', email: 'falso@ejemplo.com' });
    await expect(exigirSesion()).resolves.toMatchObject({ nivel: 'admin' });
  });

  it('token inválido: sin sesión; otro error de Supabase se propaga', async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: 'AuthInvalidJwtError', status: 400 } });
    await expect(obtenerSesion()).resolves.toBeNull();
    getClaims.mockResolvedValue({ data: null, error: { name: 'AuthRetryableFetchError', status: 0 } });
    await expect(obtenerSesion()).rejects.toThrow('No se pudo verificar la sesión con Supabase.');
  });
});
