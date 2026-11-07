// @vitest-environment node
// PLAN_AMPLIACION 3.1 y 11.1: todo par texto/fondo de los tokens tiene contraste ≥ 4,5:1 (WCAG AA),
// en claro y oscuro, incluidos los 8 colores de categoría y las insignias tintadas.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** Variables --nova-* (con valor hexadecimal) del primer bloque que empieza con `selector {`. */
function bloque(selector: string): Record<string, string> {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio === -1) throw new Error(`No está el bloque ${selector}`);
  const cuerpo = css.slice(inicio, css.indexOf('}', inicio));
  return Object.fromEntries([...cuerpo.matchAll(/--nova-([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

type Rgb = [number, number, number];
const rgb = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const lineal = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminancia = ([r, g, b]: Rgb) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Color con opacidad p sobre un fondo, como bg-peligro/12 sobre una tarjeta. */
const sobre = (color: Rgb, fondo: Rgb, p: number): Rgb => color.map((v, i) => Math.round(v * p + fondo[i]! * (1 - p))) as Rgb;

const CATEGORIAS = ['terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa', 'gris'];
const FONDOS = ['fondo', 'superficie', 'superficie-2'];
const TINTE_INSIGNIA = 0.12; // Insignia usa bg-<tono>/12

const MODOS = {
  claro: bloque(':root'),
  oscuro: bloque(":root[data-tema='oscuro']"),
  automatico: bloque(":root:not([data-tema='claro'])"),
};

describe('sin colores sueltos en Nova', () => {
  // Las pantallas y componentes de Nova solo usan los tokens. /home y el panel de administración quedan fuera.
  const CARPETAS = ['src/components/ui', 'src/components/nova', 'src/app/nova'];
  // E04: el acceso (login, registro y recuperación) también usa solo tokens.
  const ACCESO = [
    'src/components/login/TarjetaAcceso.tsx',
    'src/components/login/LoginForm.tsx',
    'src/components/login/RegisterForm.tsx',
    'src/components/login/RecoveryRequestForm.tsx',
    'src/components/login/PasswordResetForm.tsx',
    'src/app/login/page.tsx',
    'src/app/register/page.tsx',
    'src/app/recuperar-contrasena/page.tsx',
    'src/app/restablecer-contrasena/page.tsx',
  ];
  const PALETA_TAILWIND =
    /\b(?:bg|text|border|outline|ring|fill|stroke|divide|accent|from|to|via|decoration|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/;

  it('ningún archivo usa colores de la paleta de Tailwind ni literales', () => {
    const archivos = CARPETAS.flatMap((c) =>
      (readdirSync(join(process.cwd(), c), { recursive: true }) as string[])
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => join(c, f)),
    ).concat(ACCESO);
    expect(archivos.length).toBeGreaterThan(10);
    const conColor = archivos.filter((f) => {
      const texto = readFileSync(join(process.cwd(), f), 'utf8');
      return PALETA_TAILWIND.test(texto) || LITERAL.test(texto);
    });
    expect(conColor).toEqual([]);
  });
});

describe('contraste de los tokens de color', () => {
  it('el modo automático oscuro usa exactamente los valores del modo oscuro', () => {
    expect(MODOS.automatico).toEqual(MODOS.oscuro);
  });

  for (const [modo, t] of Object.entries(MODOS)) {
    const c = (n: string) => {
      const v = t[n];
      if (!v) throw new Error(`Falta --nova-${n} en ${modo}`);
      return rgb(v);
    };
    const pares: Array<[string, Rgb, Rgb]> = [];
    for (const f of FONDOS) for (const x of ['texto', 'texto-suave', 'acento', 'exito', 'aviso', 'peligro']) pares.push([`${x} / ${f}`, c(x), c(f)]);
    pares.push(['acento-texto / acento', c('acento-texto'), c('acento')]);
    pares.push(['acento-texto / peligro (botón de peligro)', c('acento-texto'), c('peligro')]);
    pares.push(['texto / acento-suave', c('texto'), c('acento-suave')]);
    pares.push(['acento / acento-suave', c('acento'), c('acento-suave')]);
    for (const x of ['exito', 'aviso', 'peligro', 'acento']) {
      pares.push([`insignia ${x}`, c(x), sobre(c(x), c('superficie'), TINTE_INSIGNIA)]);
    }
    // Avisos del acceso y de Aviso: texto normal sobre el tinte del estado.
    for (const x of ['exito', 'aviso', 'peligro']) {
      pares.push([`texto / tinte ${x}`, c('texto'), sobre(c(x), c('superficie'), TINTE_INSIGNIA)]);
    }
    for (const cat of CATEGORIAS) for (const f of FONDOS) pares.push([`categoría ${cat} / ${f}`, c(`cat-${cat}`), c(f)]);

    it(`${modo}: todos los pares tienen contraste ≥ 4,5:1`, () => {
      const fallan = pares
        .map(([nombre, a, b]) => [nombre, contraste(a, b)] as const)
        .filter(([, r]) => r < 4.5)
        .map(([nombre, r]) => `${nombre}: ${r.toFixed(2)}`);
      expect(fallan).toEqual([]);
    });
  }
});
