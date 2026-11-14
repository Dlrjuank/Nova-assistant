// E11b (RB-62) y E11e: sin conexión, lo que se ve atenuado (globals.css) es exactamente lo que se bloquea
// (bloqueadoSinConexion). Antes de esta prueba el formulario de nueva tarea, sus campos, "Descartar" y el "+" se
// veían atenuados aunque funcionaban, o no funcionaban.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bloqueadoSinConexion } from '@/lib/reglas/sinConexion';

const ORIGEN = 'http://localhost';
const AHORA = new Date('2026-11-14T15:00:00Z');
const DOC = '22222222-2222-4222-8222-222222222222';

/** El selector de la regla que atenúa sin conexión, tal como está en globals.css. */
function selectorAtenuado(): string {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const inicio = css.indexOf('html[data-nova-sin-conexion]');
  const fin = css.indexOf('{', inicio);
  return css
    .slice(inicio, fin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-nova-sin-conexion');
});

describe('sin conexión: lo atenuado coincide con lo bloqueado', () => {
  const enlaces = [
    '/nova',
    '/nova/tareas',
    '/nova/tareas?vista=hoy',
    '/nova/calendario',
    '/nova/tareas/nueva',
    '/nova/tareas/nueva?fecha=2026-11-20',
    '/nova/tareas/nueva?corregir=abc',
    `/nova/fuentes/${DOC}/capitulos`,
    `/nova/tareas/${DOC}/editar`,
    '/nova/asistente',
    '/nova/fuentes',
    '/nova/fuentes?pestana=pdf',
    '/nova/productividad',
    '/nova/configuracion',
    '/nova/cuestionarios',
    '/nova/calendario?mes=2020-01',
  ];

  it.each(enlaces)('enlace %s', (href) => {
    document.documentElement.setAttribute('data-nova-sin-conexion', '');
    document.body.innerHTML = `<a href="${href}">ir</a>`;
    const a = document.querySelector('a') as Element;
    expect(a.matches(selectorAtenuado())).toBe(bloqueadoSinConexion(a, ORIGEN, AHORA));
  });

  it('el formulario de nueva tarea, una tarea pendiente y el "+" se ven normales; completar no', () => {
    document.documentElement.setAttribute('data-nova-sin-conexion', '');
    document.body.innerHTML = `
      <form data-sin-conexion="permitido"><input id="titulo"><select id="prioridad"></select><textarea></textarea><button id="guardar" type="submit">Guardar tarea</button></form>
      <div data-sin-conexion="permitido"><div><button id="descartar">Descartar</button></div></div>
      <button id="mas" data-sin-conexion="permitido">+</button>
      <button id="completar">Completar</button>
      <input id="casilla" type="checkbox">`;
    const selector = selectorAtenuado();
    for (const id of ['titulo', 'guardar', 'descartar', 'mas', 'completar', 'casilla']) {
      const e = document.getElementById(id) as Element;
      expect([id, e.matches(selector)]).toEqual([id, bloqueadoSinConexion(e, ORIGEN, AHORA)]);
    }
    expect((document.getElementById('guardar') as Element).matches(selector)).toBe(false);
    expect((document.getElementById('completar') as Element).matches(selector)).toBe(true);
  });

  it('con conexión no se atenúa nada', () => {
    document.body.innerHTML = '<button>Completar</button><a href="/nova/asistente">Asistente</a>';
    for (const e of document.body.children) expect(e.matches(selectorAtenuado())).toBe(false);
  });
});
