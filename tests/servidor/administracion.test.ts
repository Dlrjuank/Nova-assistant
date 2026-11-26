// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * E20c-2: el servicio de "Administración" con una base simulada (cada consulta queda anotada) y Supabase Auth
 * simulado. El comportamiento real con la base se prueba en Edge y con db:verificar.
 */
const base = vi.hoisted(() => ({
  usuarios: new Map<string, string>(),
  cuentas: new Map<string, { estado: string; nivel: string }>(),
  topes: { cuentas: 15, mb: 30 },
  sql: [] as Array<{ sql: string; valores: unknown[] }>,
  vencidas: [] as string[],
}));
const auth = vi.hoisted(() => ({ updateUserById: vi.fn(), deleteUser: vi.fn() }));
const olvidar = vi.hoisted(() => vi.fn());

function responder(sql: string, valores: unknown[] = []) {
  base.sql.push({ sql, valores });
  if (sql.startsWith('SELECT email AS correo FROM auth.users')) {
    const correo = base.usuarios.get(valores[0] as string);
    return { rows: correo ? [{ correo }] : [] };
  }
  if (sql.startsWith('SELECT estado, nivel FROM cuentas')) return { rows: [base.cuentas.get(valores[0] as string)] };
  if (sql.startsWith('UPDATE cuentas SET debe_cambiar_contrasena = true')) return { rows: [{ venceEn: '2026-11-26T20:00:00Z' }] };
  if (sql.includes('FROM cuentas') && sql.includes('temporal_vence_en <= now()') && sql.trim().startsWith('SELECT usuario_id')) return { rows: base.vencidas.map((usuario_id) => ({ usuario_id })) };
  if (sql.startsWith('UPDATE cuentas SET')) {
    const c = base.cuentas.get(valores[0] as string)!;
    const estado = /estado = '(\w+)'/.exec(sql)?.[1];
    const nivel = /nivel = '(\w+)'/.exec(sql)?.[1];
    if (estado) c.estado = estado;
    if (nivel) c.nivel = nivel;
    return { rows: [{ ...c, usaClaveProyecto: /usa_clave_proyecto = true/.test(sql) }] };
  }
  if (sql.startsWith('SELECT tope_cuentas AS cuentas')) return { rows: [{ ...base.topes }] };
  return { rows: [] };
}

vi.mock('@/lib/db/conexion', () => ({
  consultar: async (sql: string, valores: unknown[]) => responder(sql, valores).rows,
  conTransaccion: async (trabajo: (tx: { query: typeof responder }) => Promise<unknown>) => trabajo({ query: async (s: string, v?: unknown[]) => responder(s, v) } as never),
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ auth: { admin: auth } }) }));
vi.mock('@/lib/datos/claveGemini', () => ({ olvidarClaveEnMemoria: olvidar }));

import { accionSobreCuenta, cambiarTopes, darContrasenaTemporal, eliminarCuenta } from '@/lib/datos/administracion';
import { vencerContrasenasTemporales } from '@/lib/datos/contrasenas';

const DUENO = { id: 'd', email: 'dueno@x.com', nivel: 'dueno' as const };
const ADMIN = { id: 'a', email: 'admin@x.com', nivel: 'admin' as const };
const U = 'u1';

const registros = () => base.sql.filter((q) => q.sql.includes('INSERT INTO acciones_admin'));

describe('accionSobreCuenta (RB-82, RB-92, RB-93, S-90)', () => {
  beforeEach(() => {
    base.usuarios = new Map([
      [U, 'ana@x.com'],
      ['a', 'admin@x.com'],
      ['d', 'dueno@x.com'],
    ]);
    base.cuentas = new Map([
      [U, { estado: 'pendiente', nivel: 'usuario' }],
      ['a', { estado: 'activa', nivel: 'admin' }],
      ['d', { estado: 'activa', nivel: 'dueno' }],
    ]);
    base.sql = [];
    auth.updateUserById.mockReset().mockResolvedValue({ error: null });
    auth.deleteUser.mockReset().mockResolvedValue({ error: null });
    olvidar.mockReset();
  });

  it('un administrador habilita una cuenta pendiente y queda en el registro con su id y el correo', async () => {
    await expect(accionSobreCuenta(ADMIN, U, 'habilitar')).resolves.toMatchObject({ estado: 'activa' });
    expect(registros()).toHaveLength(1);
    expect(registros()[0]?.valores).toEqual(['a', 'habilitar', 'ana@x.com']);
  });

  it('bloquear también prohíbe la cuenta en Supabase Auth; desbloquear lo quita', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    await accionSobreCuenta(ADMIN, U, 'bloquear');
    expect(auth.updateUserById).toHaveBeenLastCalledWith(U, { ban_duration: '876000h' });
    await accionSobreCuenta(ADMIN, U, 'desbloquear');
    expect(auth.updateUserById).toHaveBeenLastCalledWith(U, { ban_duration: 'none' });
    expect(registros().map((r) => r.valores[1])).toEqual(['bloquear', 'desbloquear']);
  });

  it('si Supabase Auth falla al bloquear, la cuenta igual queda bloqueada en la base', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    auth.updateUserById.mockRejectedValue(new Error('sin red'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(accionSobreCuenta(ADMIN, U, 'bloquear')).resolves.toMatchObject({ estado: 'bloqueada' });
    error.mockRestore();
  });

  it('un administrador no nombra administradores ni bloquea al dueño: 403 y nada en el registro', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    await expect(accionSobreCuenta(ADMIN, U, 'nombrar_admin')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO', message: 'No tienes permiso para esto.' });
    await expect(accionSobreCuenta(ADMIN, 'd', 'bloquear')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    await expect(accionSobreCuenta(ADMIN, 'a', 'bloquear')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    expect(registros()).toHaveLength(0);
    expect(base.sql.some((q) => q.sql.startsWith('UPDATE cuentas'))).toBe(false);
  });

  it('el dueño nombra administrador y da el permiso de la clave del proyecto (se olvida la clave resuelta)', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    await expect(accionSobreCuenta(DUENO, U, 'nombrar_admin')).resolves.toMatchObject({ nivel: 'admin' });
    await expect(accionSobreCuenta(DUENO, U, 'permiso_clave_on')).resolves.toMatchObject({ usaClaveProyecto: true });
    expect(olvidar).toHaveBeenCalledWith(U);
    expect(registros().map((r) => r.valores[1])).toEqual(['nombrar_admin', 'permiso_clave_on']);
  });

  it('una cuenta que ya cambió responde CUENTA_CAMBIO; una que no existe, CUENTA_NO_ENCONTRADA', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    await expect(accionSobreCuenta(ADMIN, U, 'habilitar')).rejects.toMatchObject({ codigo: 'CUENTA_CAMBIO' });
    await expect(accionSobreCuenta(ADMIN, 'no-existe', 'habilitar')).rejects.toMatchObject({ codigo: 'CUENTA_NO_ENCONTRADA' });
  });
});

describe('eliminarCuenta (RB-84, S-87)', () => {
  beforeEach(() => {
    base.usuarios = new Map([[U, 'ana@x.com']]);
    base.cuentas = new Map([[U, { estado: 'bloqueada', nivel: 'usuario' }]]);
    base.sql = [];
    auth.deleteUser.mockReset().mockResolvedValue({ error: null });
  });

  it('solo el dueño, con el correo escrito igual: borra la cuenta en Supabase (y todo en cascada) y lo anota', async () => {
    await expect(eliminarCuenta(ADMIN, U, 'ana@x.com')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    await expect(eliminarCuenta(DUENO, U, 'otra@x.com')).rejects.toMatchObject({ codigo: 'CONFIRMACION_CORREO' });
    expect(auth.deleteUser).not.toHaveBeenCalled();
    await expect(eliminarCuenta(DUENO, U, ' ANA@x.com ')).resolves.toEqual({ correo: 'ana@x.com' });
    expect(auth.deleteUser).toHaveBeenCalledWith(U);
    expect(registros().at(-1)?.valores).toEqual(['d', 'eliminar', 'ana@x.com']);
  });

  it('no se puede eliminar a un administrador ni a uno mismo', async () => {
    base.cuentas.set(U, { estado: 'activa', nivel: 'admin' });
    await expect(eliminarCuenta(DUENO, U, 'ana@x.com')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    base.usuarios.set('d', 'dueno@x.com');
    base.cuentas.set('d', { estado: 'activa', nivel: 'dueno' });
    await expect(eliminarCuenta(DUENO, 'd', 'dueno@x.com')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it('si Supabase no la elimina, responde el error y no anota nada', async () => {
    auth.deleteUser.mockResolvedValue({ error: { message: 'no' } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(eliminarCuenta(DUENO, U, 'ana@x.com')).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' });
    expect(registros()).toHaveLength(0);
    error.mockRestore();
  });
});

describe('cambiarTopes (RB-85, RB-88, S-90)', () => {
  beforeEach(() => {
    base.sql = [];
    base.topes = { cuentas: 15, mb: 30 };
  });

  it('solo el dueño; fuera de rango se rechaza con el mensaje exacto', async () => {
    await expect(cambiarTopes(ADMIN, 10, 30)).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    await expect(cambiarTopes(DUENO, 0, 30)).rejects.toMatchObject({ message: 'Escribe un número entero de 1 a 1000.' });
    await expect(cambiarTopes(DUENO, 10, 501)).rejects.toMatchObject({ message: 'Escribe un número entero de 1 a 500.' });
    expect(base.sql).toHaveLength(0);
  });

  it('guarda y anota los topes anterior y nuevo', async () => {
    await expect(cambiarTopes(DUENO, 10, 25)).resolves.toEqual({ cuentas: 10, mb: 25 });
    const fila = registros()[0];
    expect(fila?.valores[0]).toBe('d');
    expect(JSON.parse(fila?.valores[1] as string)).toEqual({ cuentas: 10, mb: 25, antes: { cuentas: 15, mb: 30 } });
  });
});

describe('contraseña temporal (RB-91, E20c-3)', () => {
  beforeEach(() => {
    base.usuarios = new Map([[U, 'ana@x.com'], ['a', 'admin@x.com']]);
    base.cuentas = new Map([[U, { estado: 'activa', nivel: 'usuario' }], ['a', { estado: 'activa', nivel: 'admin' }]]);
    base.sql = [];
    base.vencidas = [];
    auth.updateUserById.mockReset().mockResolvedValue({ error: null });
  });

  it('un administrador la da a un usuario activo: 16 caracteres, en Supabase Auth, nunca en la base, y queda en el registro', async () => {
    const r = await darContrasenaTemporal(ADMIN, U);
    expect(r.correo).toBe('ana@x.com');
    expect(r.contrasena).toMatch(/^[A-Za-z2-9]{16}$/);
    expect(auth.updateUserById).toHaveBeenCalledWith(U, { password: r.contrasena });
    expect(base.sql.some((q) => JSON.stringify(q.valores).includes(r.contrasena))).toBe(false);
    expect(base.sql.find((q) => q.sql.startsWith('UPDATE cuentas SET debe_cambiar_contrasena = true'))?.valores).toEqual([U, 24]);
    expect(registros().at(-1)?.sql).toContain("'contrasena_temporal'");
    expect(registros().at(-1)?.valores).toEqual(['a', 'ana@x.com']);
  });

  it('no a otro administrador, ni a una cuenta bloqueada; si Supabase no la acepta, error', async () => {
    await expect(darContrasenaTemporal(ADMIN, 'a')).rejects.toMatchObject({ codigo: 'ACCESO_DENEGADO' });
    base.cuentas.set(U, { estado: 'bloqueada', nivel: 'usuario' });
    await expect(darContrasenaTemporal(ADMIN, U)).rejects.toMatchObject({ codigo: 'CUENTA_CAMBIO' });
    base.cuentas.set(U, { estado: 'activa', nivel: 'usuario' });
    auth.updateUserById.mockResolvedValue({ error: { message: 'no' } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(darContrasenaTemporal(ADMIN, U)).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' });
    error.mockRestore();
  });

  it('el aviso de cada minuto reemplaza las vencidas sin usar por una que nadie conoce', async () => {
    base.vencidas = [U];
    await expect(vencerContrasenasTemporales()).resolves.toBe(1);
    expect(auth.updateUserById).toHaveBeenCalledWith(U, { password: expect.stringMatching(/^[A-Za-z2-9]{16}$/) });
    expect(base.sql.some((q) => q.sql.startsWith('UPDATE cuentas SET debe_cambiar_contrasena = false'))).toBe(true);
  });
});
