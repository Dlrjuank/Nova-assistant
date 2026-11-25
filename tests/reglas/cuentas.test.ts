import { describe, expect, it } from 'vitest';
import {
  avisoDeUso,
  correoConfirmado,
  estadoAviso,
  filtrarCuentas,
  haceCuanto,
  margenTopes,
  nivelDeUso,
  resolverAcceso,
  resumenCuentas,
  revisarAccion,
  textoAccion,
  textoVariacion,
  validarTopes,
  type AccionCuenta,
  type Nivel,
} from '@/lib/reglas/cuentas';

const DUENO = 'dueno@ejemplo.com';

describe('resolverAcceso (RB-92, RB-93)', () => {
  it('decide la fila de cuentas: activa entra, pendiente o sin fila no, bloqueada no', () => {
    expect(resolverAcceso('a@x.com', { estado: 'activa', nivel: 'usuario' }, DUENO, [])).toEqual({ permitido: true, nivel: 'usuario' });
    expect(resolverAcceso('a@x.com', { estado: 'activa', nivel: 'admin' }, DUENO, [])).toEqual({ permitido: true, nivel: 'admin' });
    expect(resolverAcceso('a@x.com', { estado: 'pendiente', nivel: 'usuario' }, DUENO, [])).toEqual({ permitido: false, codigo: 'CUENTA_PENDIENTE' });
    expect(resolverAcceso('a@x.com', null, DUENO, [])).toEqual({ permitido: false, codigo: 'CUENTA_PENDIENTE' });
    expect(resolverAcceso('a@x.com', { estado: 'bloqueada', nivel: 'usuario' }, DUENO, [])).toEqual({ permitido: false, codigo: 'CUENTA_BLOQUEADA' });
  });

  it('el dueño es solo el correo incorporado; los de emergencia entran como administradores', () => {
    expect(resolverAcceso(' Dueno@Ejemplo.com ', null, DUENO, [])).toEqual({ permitido: true, nivel: 'dueno' });
    expect(resolverAcceso('e@x.com', { estado: 'bloqueada', nivel: 'usuario' }, DUENO, ['e@x.com'])).toEqual({ permitido: true, nivel: 'admin' });
    expect(resolverAcceso('otro@x.com', { estado: 'activa', nivel: 'dueno' }, DUENO, [])).toEqual({ permitido: true, nivel: 'admin' });
    expect(resolverAcceso('', null, DUENO, [''])).toEqual({ permitido: false, codigo: 'CUENTA_PENDIENTE' });
  });
});

describe('revisarAccion (RB-93)', () => {
  const dueno = { id: 'd', nivel: 'dueno' as Nivel };
  const admin = { id: 'a', nivel: 'admin' as Nivel };
  const usuario = { id: 'u', nivel: 'usuario' as Nivel };
  const obj = (nivel: Nivel, estado: 'activa' | 'pendiente' | 'bloqueada', id = 'x') => ({ id, nivel, estado });

  it('un usuario no puede nada', () => {
    for (const accion of ['habilitar', 'bloquear', 'desbloquear', 'eliminar'] as const) expect(revisarAccion(usuario, obj('usuario', 'activa'), accion)).toBe('permiso');
  });

  it('un administrador habilita, bloquea y desbloquea usuarios; no elimina, ni nombra, ni da el permiso de la clave', () => {
    expect(revisarAccion(admin, obj('usuario', 'pendiente'), 'habilitar')).toBeNull();
    expect(revisarAccion(admin, obj('usuario', 'activa'), 'bloquear')).toBeNull();
    expect(revisarAccion(admin, obj('usuario', 'bloqueada'), 'desbloquear')).toBeNull();
    for (const accion of ['eliminar', 'nombrar_admin', 'quitar_admin', 'permiso_clave_on', 'permiso_clave_off'] as const) {
      expect(revisarAccion(admin, obj('usuario', 'activa'), accion)).toBe('permiso');
    }
  });

  it('nadie bloquea a otro administrador, al dueño ni a sí mismo', () => {
    expect(revisarAccion(admin, obj('admin', 'activa'), 'bloquear')).toBe('permiso');
    expect(revisarAccion(dueno, obj('admin', 'activa'), 'bloquear')).toBe('permiso');
    expect(revisarAccion(admin, obj('dueno', 'activa', 'd'), 'bloquear')).toBe('permiso');
    expect(revisarAccion(admin, obj('usuario', 'activa', 'a'), 'bloquear')).toBe('permiso');
    expect(revisarAccion(dueno, obj('dueno', 'activa', 'd'), 'eliminar')).toBe('permiso');
  });

  it('el dueño además nombra y quita administradores, da el permiso de la clave y elimina usuarios', () => {
    const acciones: Array<[AccionCuenta | 'eliminar', Nivel, 'activa' | 'pendiente' | 'bloqueada']> = [
      ['nombrar_admin', 'usuario', 'activa'],
      ['quitar_admin', 'admin', 'activa'],
      ['permiso_clave_on', 'usuario', 'activa'],
      ['permiso_clave_off', 'admin', 'activa'],
      ['eliminar', 'usuario', 'bloqueada'],
    ];
    for (const [accion, nivel, estado] of acciones) expect(revisarAccion(dueno, obj(nivel, estado), accion)).toBeNull();
    expect(revisarAccion(dueno, obj('admin', 'activa'), 'eliminar')).toBe('permiso');
  });

  it('si la cuenta ya cambió de estado responde "estado" (409)', () => {
    expect(revisarAccion(admin, obj('usuario', 'activa'), 'habilitar')).toBe('estado');
    expect(revisarAccion(admin, obj('usuario', 'bloqueada'), 'bloquear')).toBe('estado');
    expect(revisarAccion(admin, obj('usuario', 'activa'), 'desbloquear')).toBe('estado');
    expect(revisarAccion(dueno, obj('usuario', 'pendiente'), 'nombrar_admin')).toBe('estado');
    expect(revisarAccion(dueno, obj('usuario', 'activa'), 'quitar_admin')).toBe('estado');
  });
});

describe('topes y uso (RB-85, RB-86, RB-88)', () => {
  it('validarTopes: enteros de 1 a 1000 cuentas y de 1 a 500 MB', () => {
    expect(validarTopes(15, 30)).toBeNull();
    expect(validarTopes(0, 30)).toBe('cuentas');
    expect(validarTopes(1001, 30)).toBe('cuentas');
    expect(validarTopes(2.5, 30)).toBe('cuentas');
    expect(validarTopes(10, 0)).toBe('espacio');
    expect(validarTopes(10, 501)).toBe('espacio');
    expect(validarTopes(10, '30')).toBe('espacio');
  });

  it('margenTopes: el peor caso frente a 300 MB; pasarlo solo avisa', () => {
    expect(margenTopes(10, 30)).toEqual({ total: 300, pasa: false, texto: '10 × 30 MB = 300 MB de 300 MB disponibles.' });
    expect(margenTopes(15, 30)).toEqual({ total: 450, pasa: true, texto: '15 × 30 MB = 450 MB: pasa de los 300 MB disponibles. Baja un tope o pasa a Supabase Pro.' });
  });

  it('avisos al 80 % y al 95 %', () => {
    expect(nivelDeUso(79)).toBe('normal');
    expect(nivelDeUso(80)).toBe('aviso');
    expect(nivelDeUso(95)).toBe('fuerte');
    expect(avisoDeUso('base', 50)).toBe('');
    expect(avisoDeUso('base', 82)).toBe('La base va en 82 % del plan gratuito.');
    expect(avisoDeUso('base', 96)).toBe('La base está casi llena (96 %). Elimina datos o pasa a Supabase Pro.');
    expect(avisoDeUso('blob', 96)).toBe('Blob está casi lleno (96 %). Elimina datos o pasa a Vercel Pro.');
  });
});

describe('tabla, resumen y registro', () => {
  const cuentas = [
    { correo: 'ana@x.com', nombre: 'Ana', estado: 'activa' as const, conClave: true },
    { correo: 'beto@x.com', nombre: 'Roberto', estado: 'bloqueada' as const, conClave: false },
    { correo: 'cami@x.com', nombre: '', estado: 'pendiente' as const, conClave: false },
  ];

  it('B-104: búsqueda por correo o nombre y filtros', () => {
    expect(filtrarCuentas(cuentas, 'ROBER', 'Todas').map((c) => c.correo)).toEqual(['beto@x.com']);
    expect(filtrarCuentas(cuentas, '', 'Bloqueadas').map((c) => c.correo)).toEqual(['beto@x.com']);
    expect(filtrarCuentas(cuentas, '', 'Sin clave').map((c) => c.correo)).toEqual(['beto@x.com', 'cami@x.com']);
    expect(filtrarCuentas(cuentas, '', 'Pendientes').map((c) => c.correo)).toEqual(['cami@x.com']);
    expect(filtrarCuentas(cuentas, 'zzz', 'Todas')).toEqual([]);
  });

  it('S-91: el resumen cuenta aparte a los administradores', () => {
    const ahora = new Date('2026-11-25T20:00:00Z');
    const r = resumenCuentas(
      [
        { nivel: 'dueno', estado: 'activa', registro: '2026-10-01T00:00:00Z', ultimoAcceso: '2026-11-25T19:00:00Z', conClave: false },
        { nivel: 'usuario', estado: 'activa', registro: '2026-11-24T10:00:00Z', ultimoAcceso: '2026-11-24T10:00:00Z', conClave: true },
        { nivel: 'usuario', estado: 'pendiente', registro: '2026-11-25T18:00:00Z', ultimoAcceso: null, conClave: false },
        { nivel: 'usuario', estado: 'activa', registro: '2026-11-15T10:00:00Z', ultimoAcceso: '2026-11-10T10:00:00Z', conClave: false },
      ],
      ahora,
    );
    expect(r).toMatchObject({ usuarios: 3, administradores: 1, pendientes: 1, activas7: 1, nuevas: 2, nuevasAntes: 1, conClave: 1 });
    expect(r.nuevasPorDia).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(textoVariacion(2, 1)).toBe('↑ 1');
    expect(textoVariacion(0, 3)).toBe('↓ 3');
    expect(textoVariacion(1, 1)).toBe('igual');
  });

  it('RB-89: el texto de cada acción, sin claves ni datos de la cuenta', () => {
    expect(textoAccion('yo@x.com', 'bloquear', 'ana@x.com', null)).toBe('yo@x.com bloqueó a ana@x.com');
    expect(textoAccion('yo@x.com', 'topes', null, { cuentas: 12, mb: 25 })).toBe('yo@x.com cambió los topes a 12 cuentas y 25 MB');
    expect(textoAccion('yo@x.com', 'habilitar', 'cami@x.com', null)).toBe('yo@x.com habilitó a cami@x.com');
  });

  it('RB-84: el correo de confirmación ignora mayúsculas y espacios a los lados', () => {
    expect(correoConfirmado('  Ana@X.com ', 'ana@x.com')).toBe(true);
    expect(correoConfirmado('ana@x.co', 'ana@x.com')).toBe(false);
  });

  it('hace cuánto y el estado del aviso de cada minuto', () => {
    const ahora = new Date('2026-11-25T20:00:00Z');
    expect(haceCuanto(null, ahora)).toBe('Nunca');
    expect(haceCuanto('2026-10-01T03:00:00Z', ahora)).toBe('30 sept.');
    expect(haceCuanto('2026-11-25T19:59:48Z', ahora)).toBe('hace 12 s');
    expect(haceCuanto('2026-11-25T18:00:00Z', ahora)).toBe('hace 2 h');
    expect(haceCuanto('2026-11-24T18:00:00Z', ahora)).toBe('ayer');
    expect(estadoAviso('2026-11-25T19:59:30Z', 0, ahora)).toBe('funciona');
    expect(estadoAviso('2026-11-25T19:59:30Z', 2, ahora)).toBe('errores');
    expect(estadoAviso('2026-11-25T19:50:00Z', 0, ahora)).toBe('detenido');
    expect(estadoAviso(null, 0, ahora)).toBe('detenido');
  });
});
