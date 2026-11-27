// @vitest-environment node
// E21 (revisión final): cada manejador de /api/nova exige sesión, y las únicas excepciones exigen su propio secreto.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join('src', 'app', 'api', 'nova');
/** Las llama una máquina sin sesión; cada una comprueba su secreto y el middleware las deja pasar. */
const CON_SECRETO = ['recordatorios/tick/route.ts', 'salud/route.ts'];

const rutas = (readdirSync(RAIZ, { recursive: true }) as string[])
  .map((r) => r.replaceAll('\\', '/'))
  .filter((r) => r.endsWith('route.ts'))
  .sort();

const MANEJADOR = /^export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/gm;

/** El texto de cada manejador exportado: desde su `export` hasta el siguiente `export`. */
function manejadores(texto: string): Array<[string, string]> {
  return [...texto.matchAll(MANEJADOR)].map((m) => {
    const resto = texto.slice(m.index + m[0].length);
    const fin = resto.search(/^export /m);
    return [m[1] as string, fin === -1 ? resto : resto.slice(0, fin)];
  });
}

// E21: en una página, exigirSesion le ganaba a la redirección del layout y salía "Algo salió mal".
describe('páginas de Nova', () => {
  const PAGINAS = join('src', 'app', 'nova');
  const paginas = (readdirSync(PAGINAS, { recursive: true }) as string[]).map((r) => r.replaceAll('\\', '/')).filter((r) => r.endsWith('page.tsx'));

  it('ninguna usa exigirSesion ni exigirAdministrador (lanzan un error en vez de redirigir)', () => {
    expect(paginas.length).toBeGreaterThan(15);
    expect(paginas.filter((p) => /\b(exigirSesion|exigirAdministrador)\b/.test(readFileSync(join(PAGINAS, p), 'utf8')))).toEqual([]);
  });
});

describe('rutas /api/nova', () => {
  it('hay rutas que revisar y las excepciones existen', () => {
    expect(rutas.length).toBeGreaterThan(50);
    expect(rutas).toEqual(expect.arrayContaining(CON_SECRETO));
  });

  it.each(rutas.filter((r) => !CON_SECRETO.includes(r)))('%s exige sesión en cada manejador', (ruta) => {
    const hallados = manejadores(readFileSync(join(RAIZ, ruta), 'utf8'));
    expect(hallados.length).toBeGreaterThan(0);
    for (const [metodo, cuerpo] of hallados) {
      expect(cuerpo, `${metodo} sin exigirSesion ni exigirAdministrador`).toMatch(/await (exigirSesion|exigirAdministrador)\(\)/);
    }
  });

  it.each(CON_SECRETO)('%s comprueba su secreto', (ruta) => {
    expect(readFileSync(join(RAIZ, ruta), 'utf8')).toMatch(/!secretoValido\(/);
  });
});
