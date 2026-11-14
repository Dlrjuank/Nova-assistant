// @vitest-environment node
// E11b (5.10, RB-62, RB-63): qué se guarda sin conexión (S-68) y cuándo se borra (S-69).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rutaConCopia, textoSinConexion } from '@/lib/reglas/sinConexion';

interface Reglas {
  SIETE_DIAS_MS: number;
  mesActual: (ahora: Date) => string;
  esEstatico: (url: URL) => boolean;
  esRsc: (url: URL, h?: Headers) => boolean;
  paginaGuardable: (url: URL, ahora: Date) => boolean;
  clavePagina: (url: URL) => string;
  debeBorrar: (r: { url: URL; metodo: string; estado: number; tipo: string; usuario?: string | null; usuarioGuardado?: string | null }) => string | null;
  vencida: (ultima: number | undefined, ahora: Date) => boolean;
  marcarCopia: (html: string, guardadoEn: number) => string;
}

/** El script del service worker, evaluado con un `self` falso (como lo carga importScripts). */
function cargarReglas(): Reglas {
  const falso: { NovaReglas?: Reglas } = {};
  new Function('self', readFileSync(join(process.cwd(), 'public/sw-reglas.js'), 'utf8'))(falso);
  return falso.NovaReglas as Reglas;
}

const R = cargarReglas();
const u = (ruta: string) => new URL(ruta, 'https://nova.ejemplo');
// 15 de noviembre de 2026 a las 23:30 en Bogotá: en UTC ya es el 16. El 30 a las 22:00 en Bogotá, UTC ya es diciembre.
const AHORA = new Date('2026-11-16T04:30:00Z');
const FIN_DE_MES = new Date('2026-12-01T03:00:00Z');
const DOC = '22222222-2222-4222-8222-222222222222';

describe('S-68: qué se puede guardar (RB-62)', () => {
  const guardables = ['/nova', '/nova?semana=2026-11-09', '/nova/tareas', '/nova/tareas?vista=hoy&categoria=Casa', '/nova/calendario', '/nova/calendario?mes=2026-11', `/nova/fuentes/${DOC}/capitulos`, '/nova/tareas/nueva', '/nova/tareas/nueva?fecha=2026-11-20']; // E11e: el formulario de nueva tarea
  const nunca = [
    '/nova/asistente',
    '/nova/calendario?mes=2026-10',
    `/nova/tareas/${DOC}/editar`,
    '/nova/fuentes',
    '/nova/fuentes?pestana=web',
    '/nova/cuestionarios',
    `/nova/cuestionarios/${DOC}`,
    '/nova/configuracion',
    '/nova/productividad',
    `/nova/fuentes/${DOC}`,
    '/api/nova/tareas',
    '/api/nova/documentos',
    '/login',
  ];

  it.each(guardables)('%s se guarda', (ruta) => {
    expect(R.paginaGuardable(u(ruta), AHORA)).toBe(true);
  });

  it.each(nunca)('%s nunca se guarda (Asistente, API, texto de documentos, acciones)', (ruta) => {
    expect(R.paginaGuardable(u(ruta), AHORA)).toBe(false);
  });

  it('el mes actual se calcula en Bogotá, no en UTC', () => {
    expect(R.mesActual(FIN_DE_MES)).toBe('2026-11');
    expect(R.paginaGuardable(u('/nova/calendario?mes=2026-11'), FIN_DE_MES)).toBe(true);
    expect(R.paginaGuardable(u('/nova/calendario?mes=2026-12'), FIN_DE_MES)).toBe(false);
  });

  it('el navegador y el service worker deciden lo mismo', () => {
    for (const ruta of [...guardables, ...nunca]) expect(rutaConCopia(u(ruta), AHORA)).toBe(R.paginaGuardable(u(ruta), AHORA));
    expect(rutaConCopia(u('/nova/calendario?mes=2026-12'), FIN_DE_MES)).toBe(false);
  });

  it('los archivos estáticos se guardan; los pedidos internos de navegación (RSC), nunca', () => {
    expect(R.esEstatico(u('/_next/static/chunks/app.js'))).toBe(true);
    expect(R.esEstatico(u('/icons/icono-192.png'))).toBe(true);
    expect(R.esEstatico(u('/manifest.webmanifest'))).toBe(true);
    expect(R.esEstatico(u('/api/nova/tareas'))).toBe(false);
    expect(R.esRsc(u('/nova/tareas?_rsc=abc'))).toBe(true);
    expect(R.esRsc(u('/nova/tareas'), new Headers({ RSC: '1' }))).toBe(true);
    expect(R.esRsc(u('/nova/tareas'), new Headers())).toBe(false);
  });

  it('la clave de la copia ignora el ancla, "?pregunta=" y el orden de los parámetros', () => {
    expect(R.clavePagina(u('/nova?pregunta=hola#arriba'))).toBe('/nova');
    expect(R.clavePagina(u('/nova/tareas?vista=hoy&categoria=Casa'))).toBe(R.clavePagina(u('/nova/tareas?categoria=Casa&vista=hoy')));
  });

  it('la copia lleva la hora en que se guardó', () => {
    const html = R.marcarCopia('<html><head><title>x</title></head><body></body></html>', Date.parse('2026-11-13T18:05:00Z'));
    expect(html).toContain('<meta name="nova-copia" content="2026-11-13T18:05:00.000Z"></head>');
    expect(textoSinConexion(new Date('2026-11-13T18:05:00Z'))).toBe('Sin conexión · datos de las 13:05');
  });
});

describe('S-69: cuándo se borra la copia (RB-63)', () => {
  const r = (o: Partial<Parameters<Reglas['debeBorrar']>[0]> & { ruta: string }) =>
    R.debeBorrar({ url: u(o.ruta), metodo: o.metodo ?? 'GET', estado: o.estado ?? 200, tipo: o.tipo ?? 'basic', usuario: o.usuario ?? null, usuarioGuardado: o.usuarioGuardado ?? null });

  it('al cerrar sesión (solo si salió bien)', () => {
    expect(r({ ruta: '/api/auth/logout', metodo: 'POST' })).toBe('cerro-sesion');
    expect(r({ ruta: '/api/auth/logout', metodo: 'POST', estado: 500 })).toBeNull();
  });

  it('si el servidor rechaza la sesión: 401 o 403 de la API, o una página de Nova que redirige', () => {
    expect(r({ ruta: '/api/nova/tareas', estado: 401 })).toBe('sesion-rechazada');
    expect(r({ ruta: '/api/nova/semana', estado: 403 })).toBe('sesion-rechazada');
    expect(r({ ruta: '/nova/tareas', tipo: 'opaqueredirect', estado: 0 })).toBe('sesion-rechazada');
    expect(r({ ruta: '/api/nova/tareas', estado: 404 })).toBeNull();
    expect(r({ ruta: '/api/nova/tareas', estado: 200 })).toBeNull();
  });

  it('si entra otro usuario', () => {
    expect(r({ ruta: '/nova', usuario: 'b', usuarioGuardado: 'a' })).toBe('otro-usuario');
    expect(r({ ruta: '/nova', usuario: 'a', usuarioGuardado: 'a' })).toBeNull();
    expect(r({ ruta: '/nova', usuario: 'a', usuarioGuardado: null })).toBeNull();
  });

  it('tras 7 días sin una respuesta válida del servidor', () => {
    const ahora = new Date('2026-11-20T12:00:00Z');
    expect(R.vencida(ahora.getTime() - R.SIETE_DIAS_MS, ahora)).toBe(false);
    expect(R.vencida(ahora.getTime() - R.SIETE_DIAS_MS - 1, ahora)).toBe(true);
    expect(R.vencida(ahora.getTime() - 6 * 24 * 3600 * 1000, ahora)).toBe(false);
    expect(R.vencida(undefined, ahora)).toBe(true);
  });
});
