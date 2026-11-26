// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** E20c-3 (RB-91, plan 5.14): entrar con la contraseña temporal, ponerse una propia y la vuelta de Google. */
const m = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  from: vi.fn(),
  accesoDe: vi.fn(),
  obtenerSesion: vi.fn(),
  temporalDe: vi.fn(),
  temporalVencidaDe: vi.fn(),
  usarTemporal: vi.fn(),
  terminarCambioContrasena: vi.fn(),
  consultar: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: m.signInWithPassword, signOut: m.signOut, updateUser: m.updateUser, exchangeCodeForSession: m.exchangeCodeForSession },
    from: m.from,
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ auth: { admin: { deleteUser: m.deleteUser } } }) }));
vi.mock('@/lib/datos/cuentas', () => ({ accesoDe: m.accesoDe }));
vi.mock('@/lib/auth/sesion', () => ({ obtenerSesion: m.obtenerSesion }));
vi.mock('@/lib/datos/contrasenas', () => ({
  temporalDe: m.temporalDe,
  temporalVencidaDe: m.temporalVencidaDe,
  usarTemporal: m.usarTemporal,
  terminarCambioContrasena: m.terminarCambioContrasena,
}));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar }));

import { GET as callback } from '@/app/auth/callback/route';
import { POST as cambiar } from '@/app/api/cuenta/contrasena/route';
import { POST as login } from '@/app/api/auth/login/route';

const U = { id: 'u1', email: 'ana@x.com' };
const entrar = () =>
  login(new Request('http://x/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@x.com', password: 'Temporal123456AB' }) }));
const pedirCambio = (cuerpo: unknown) => cambiar(new Request('http://x/api/cuenta/contrasena', { method: 'POST', body: JSON.stringify(cuerpo) }));

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.signInWithPassword.mockResolvedValue({ data: { user: U }, error: null });
  m.signOut.mockResolvedValue({ error: null });
  m.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'u1', email: 'ana@x.com' }, error: null }) }) }) });
  m.accesoDe.mockResolvedValue({ permitido: false, codigo: 'DEBE_CAMBIAR_CONTRASENA' });
  m.temporalVencidaDe.mockResolvedValue(false);
});

describe('entrar con la contraseña temporal (RB-91)', () => {
  it('la primera vez entra y la marca como usada', async () => {
    m.temporalDe.mockResolvedValue('primera');
    m.usarTemporal.mockResolvedValue(true);
    const r = await entrar();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ success: true, data: { debeCambiar: true } });
    expect(m.usarTemporal).toHaveBeenCalledWith('u1');
    expect(m.signOut).not.toHaveBeenCalled();
  });

  it('la segunda vez se rechaza y se cierra la sesión que se abrió', async () => {
    m.temporalDe.mockResolvedValue('usada');
    const r = await entrar();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ success: false, error: 'Esta contraseña temporal ya se usó. Pide otra al administrador.' });
    // Solo la sesión de este pedido: un cierre global cortaría la sesión de quien está poniendo su contraseña.
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('si otro ingreso la usó en el mismo instante, también se rechaza', async () => {
    m.temporalDe.mockResolvedValue('primera');
    m.usarTemporal.mockResolvedValue(false);
    expect((await (await entrar()).json()).error).toBe('Esta contraseña temporal ya se usó. Pide otra al administrador.');
  });

  it('vencida: se rechaza; y si ya la reemplazó el aviso de cada minuto, el error de contraseña lo dice', async () => {
    m.temporalDe.mockResolvedValue('vencida');
    expect((await (await entrar()).json()).error).toBe('Esta contraseña temporal venció. Pide otra al administrador.');
    m.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } });
    m.temporalVencidaDe.mockResolvedValue(true);
    const r = await entrar();
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe('Esta contraseña temporal venció. Pide otra al administrador.');
  });
});

describe('poner una contraseña propia (/api/cuenta/contrasena)', () => {
  it('tras la temporal: sin la anterior; al terminar la cuenta vuelve a la normalidad', async () => {
    m.obtenerSesion.mockResolvedValue(U);
    m.updateUser.mockResolvedValue({ error: null });
    const r = await pedirCambio({ nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' });
    expect(r.status).toBe(200);
    expect(m.signInWithPassword).not.toHaveBeenCalled();
    expect(m.updateUser).toHaveBeenCalledWith({ password: 'mi-clave-nueva' });
    expect(m.terminarCambioContrasena).toHaveBeenCalledWith('u1');
  });

  it('una cuenta normal que entró con contraseña debe dar la anterior, y se verifica', async () => {
    m.obtenerSesion.mockResolvedValue(U);
    m.accesoDe.mockResolvedValue({ permitido: true, nivel: 'usuario' });
    m.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } });
    const r = await pedirCambio({ actual: 'otra', nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' });
    expect(r.status).toBe(400);
    expect((await r.json()).error.mensaje).toBe('La contraseña actual es incorrecta.');
    expect(m.updateUser).not.toHaveBeenCalled();
  });

  it('si la sesión entró con Google no pide la anterior', async () => {
    m.obtenerSesion.mockResolvedValue({ ...U, conGoogle: true });
    m.accesoDe.mockResolvedValue({ permitido: true, nivel: 'usuario' });
    m.updateUser.mockResolvedValue({ error: null });
    expect((await pedirCambio({ nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' })).status).toBe(200);
    expect(m.signInWithPassword).not.toHaveBeenCalled();
  });

  it('valida la nueva, exige sesión y no deja a una cuenta bloqueada', async () => {
    m.obtenerSesion.mockResolvedValue(U);
    expect((await (await pedirCambio({ nueva: 'corta', confirmar: 'corta' })).json()).error.mensaje).toBe('La contraseña debe tener entre 8 y 128 caracteres.');
    expect((await (await pedirCambio({ nueva: 'mi-clave-nueva', confirmar: 'otra-clave-1' })).json()).error.mensaje).toBe('Las contraseñas no coinciden.');
    m.accesoDe.mockResolvedValue({ permitido: false, codigo: 'CUENTA_BLOQUEADA' });
    expect((await pedirCambio({ nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' })).status).toBe(403);
    m.obtenerSesion.mockResolvedValue(null);
    expect((await pedirCambio({ nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' })).status).toBe(401);
    expect(m.updateUser).not.toHaveBeenCalled();
  });
});

describe('vuelta de Google (/auth/callback)', () => {
  const volver = (q: string) => callback(new Request(`http://x/auth/callback${q}`));
  const destino = async (q: string) => new URL((await volver(q)).headers.get('location') ?? '').pathname + new URL((await volver(q)).headers.get('location') ?? '').search;

  it('sin código: el gancho del tope lleva a /login?error=tope; otro error, a /login?error=google', async () => {
    expect(await destino('?error=access_denied&error_description=Nova%20lleg%C3%B3%20al%20m%C3%A1ximo%20de%20cuentas%20por%20ahora.')).toBe('/login?error=tope');
    expect(await destino('?error=access_denied')).toBe('/login?error=google');
  });

  it('con la sesión va a Nova (solo destinos dentro de /nova)', async () => {
    m.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'u1', created_at: '2020-01-01T00:00:00Z', app_metadata: { provider: 'google' } } }, error: null });
    expect(await destino('?code=abc&next=/nova/tareas')).toBe('/nova/tareas');
    expect(await destino('?code=abc&next=https://otro.com')).toBe('/nova');
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('RB-81, por si acaso: una cuenta nueva de Google que pasó el tope se borra y se avisa', async () => {
    m.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: 'u9', created_at: new Date().toISOString(), app_metadata: { provider: 'google' } } }, error: null });
    m.consultar.mockResolvedValue([{ pasa: true, nivel: 'usuario' }]);
    m.deleteUser.mockResolvedValue({ error: null });
    const r = await volver('?code=abc');
    expect(new URL(r.headers.get('location') ?? '').search).toBe('?error=tope');
    expect(m.deleteUser).toHaveBeenCalledWith('u9');
    m.consultar.mockResolvedValue([{ pasa: false, nivel: 'usuario' }]);
    m.deleteUser.mockReset();
    expect(new URL((await volver('?code=abc')).headers.get('location') ?? '').pathname).toBe('/nova');
    expect(m.deleteUser).not.toHaveBeenCalled();
  });
});
