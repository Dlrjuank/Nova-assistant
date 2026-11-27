// @vitest-environment node
// E21 (ahorro de CPU): el middleware corre solo en las páginas que leen la sesión.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';
import { config } from '@/middleware';

const corre = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe('dónde corre el middleware', () => {
  it.each(['/', '/cuenta', '/cambiar-contrasena', '/nova', '/nova?semana=2026-11-23', '/nova/tareas', '/nova/semestre/abc', '/nova/administracion'])('corre en %s', (url) => {
    expect(corre(url)).toBe(true);
  });

  it.each([
    '/api/nova', '/api/nova/tareas', '/api/nova/recordatorios/tick', '/api/nova/salud', '/api/auth/login', '/api/auth/password', '/api/cuenta/contrasena', '/api/health',
    '/auth/google', '/auth/callback', '/sw.js', '/sw-reglas.js', '/manifest.webmanifest', '/icons/icono-192.png', '/favicon.ico', '/_next/static/chunks/a.js',
    '/login', '/register', '/recuperar-contrasena', '/restablecer-contrasena', '/privacidad', '/novaX',
  ])('no corre en %s', (url) => {
    expect(corre(url)).toBe(false);
  });

  // Un componente de servidor no puede guardar las cookies de una sesión renovada: sin el middleware, se perdería.
  it('corre en todas las páginas que leen la sesión', () => {
    const raiz = join('src', 'app');
    const paginas = (readdirSync(raiz, { recursive: true }) as string[])
      .map((r) => r.replaceAll('\\', '/'))
      .filter((r) => /(^|\/)(page|layout)\.tsx$/.test(r))
      .filter((r) => /\b(obtenerSesion|exigirSesionDePagina|createSupabaseServerClient)\b/.test(readFileSync(join(raiz, r), 'utf8')));
    expect(paginas.length).toBeGreaterThan(18);
    const direccion = (r: string) =>
      `/${r.replace(/(^|\/)(page|layout)\.tsx$/, '')}`.replace(/\/\([^)]*\)/g, '').replace(/\[[^\]]+\]/g, 'abc') || '/';
    expect(paginas.filter((r) => !corre(direccion(r)))).toEqual([]);
  });
});
