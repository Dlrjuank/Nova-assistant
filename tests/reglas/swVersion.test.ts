// @vitest-environment node
// Ajuste de E20 (prueba 7 del usuario): sin conexión, en el iPhone, Semestre salió sin la pestaña "Estadísticas" y
// "Objetivos y plan" no abría. E20 solo había cambiado sw-reglas.js, y sw.js seguía igual byte a byte: un navegador
// que no compara los scripts importados se queda con el service worker anterior (y sus copias viejas).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pestanasSemestre } from '@/components/nova/semestre/pestanas';
import { rutaConCopia } from '@/lib/reglas/sinConexion';

interface Reglas {
  paginaGuardable: (url: URL, ahora: Date) => boolean;
  pestanasHermanas: (url: URL) => string[];
  PESTANAS_SEMESTRE: string[];
}

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');
const falso: { NovaReglas?: Reglas } = {};
new Function('self', leer('public/sw-reglas.js'))(falso);
const R = falso.NovaReglas as Reglas;
const u = (ruta: string) => new URL(ruta, 'https://nova.ejemplo');
const AHORA = new Date('2026-11-21T15:00:00Z');
const DOC = '22222222-2222-4222-8222-222222222222';

describe('el service worker se actualiza con cada cambio de sus reglas', () => {
  it('sw.js importa sw-reglas.js con la huella de su contenido (al cambiar las reglas, cambia sw.js)', () => {
    // Con finales de línea LF, como en el repositorio (en Windows, git puede dejarlo con CRLF).
    const reglas = leer('public/sw-reglas.js').replace(/\r\n/g, '\n');
    const huella = createHash('sha256').update(reglas, 'utf8').digest('hex').slice(0, 12);
    const importa = leer('public/sw.js').match(/importScripts\('([^']+)'\)/g) ?? [];
    expect(importa, `actualiza la huella en public/sw.js: /sw-reglas.js?v=${huella}`).toEqual([`importScripts('/sw-reglas.js?v=${huella}')`]);
  });
});

describe('las pestañas de Semestre funcionan sin conexión (E19b, E20)', () => {
  const pestanas = pestanasSemestre('notas').map((p) => p.href);

  it('el service worker conoce exactamente las pestañas que muestra la pantalla', () => {
    expect(R.PESTANAS_SEMESTRE).toEqual(pestanas);
  });

  it.each(pestanas)('%s tiene copia en el navegador y en el service worker', (href) => {
    expect(rutaConCopia(u(href), AHORA)).toBe(true);
    expect(R.paginaGuardable(u(href), AHORA)).toBe(true);
  });

  it('al guardar una pestaña se guardan las otras; una materia u otra pantalla no arrastra ninguna', () => {
    expect(R.pestanasHermanas(u('/nova/semestre'))).toEqual(['/nova/semestre/objetivos', '/nova/semestre/estadisticas']);
    expect(R.pestanasHermanas(u('/nova/semestre/estadisticas'))).toEqual(['/nova/semestre', '/nova/semestre/objetivos']);
    // Con ?materia= también se guarda la pestaña sin la materia, que es a la que lleva la fila de pestañas.
    expect(R.pestanasHermanas(u(`/nova/semestre/objetivos?materia=${DOC}`))).toEqual(pestanas);
    expect(R.pestanasHermanas(u(`/nova/semestre/${DOC}`))).toEqual([]);
    expect(R.pestanasHermanas(u('/nova/tareas'))).toEqual([]);
  });
});
