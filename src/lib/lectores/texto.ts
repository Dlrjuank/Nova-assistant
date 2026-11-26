import { PDF_MAX_PAGINAS } from '@/lib/config/nova';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { conPaginaFinal } from '@/lib/reglas/libros';
import { contarUnidades, nombreUnidad, type EstructuraDocumento, type GrupoDocumento, type TipoGrupo, type Unidad } from '@/lib/reglas/tiposDocumento';

/**
 * E20d-1: leer Markdown (.md) y texto (.txt). Funciones puras.
 * - Markdown: secciones por encabezado (`#` a `###`, sin contar los bloques de código). Se corta en los dos niveles
 *   más altos que use el archivo; los más bajos quedan dentro de su sección. Sin encabezados, se lee como texto.
 * - Texto: partes de unas 1.500 palabras, cortadas en un párrafo.
 */

export const PARTE_PALABRAS = 1500;
export const TITULO_INICIO = 'Inicio';

const contarPalabras = (t: string) => t.split(/\s+/).filter((p) => p !== '').length;

/** UTF-8; si no lo es, Latin-1 (Windows-1252, el de los bloc de notas viejos). Sin BOM, NUL ni retornos de carro. */
export function decodificarTexto(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder('windows-1252').decode(bytes);
  }
  return texto.replace(/^﻿/, '').replaceAll('\u0000', ' ').replace(/\r\n?/g, '\n');
}

function validarUnidades(unidades: readonly string[], unidad: Unidad): void {
  if (unidades.join(' ').trim() === '') throw new ErrorDeNegocio('PDF_SIN_TEXTO', 'El archivo no tiene texto.');
  if (unidades.length > PDF_MAX_PAGINAS) {
    throw new ErrorDeNegocio('PDF_MUY_LARGO', `El archivo tiene ${contarUnidades(unidades.length, unidad)}; el máximo es ${PDF_MAX_PAGINAS}.`);
  }
}

function grupos(entradas: ReadonlyArray<{ titulo: string; pagina: number; nivel: number }>, total: number, tipo: TipoGrupo): GrupoDocumento[] {
  return conPaginaFinal(entradas, total, null).map((g) => ({ ...g, tipo }));
}

/** Partes de unas PARTE_PALABRAS palabras: se corta antes del párrafo que la pasaría; un párrafo enorme se corta solo. */
export function partesDeTexto(texto: string): EstructuraDocumento {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const unidades: string[] = [];
  let actual: string[] = [];
  let palabras = 0;
  const cerrar = () => {
    if (actual.length > 0) unidades.push(actual.join('\n\n'));
    actual = [];
    palabras = 0;
  };
  for (const parrafo of parrafos) {
    const n = contarPalabras(parrafo);
    if (n > PARTE_PALABRAS) {
      cerrar();
      const sueltas = parrafo.split(/\s+/).filter((p) => p !== '');
      for (let i = 0; i < sueltas.length; i += PARTE_PALABRAS) unidades.push(sueltas.slice(i, i + PARTE_PALABRAS).join(' '));
      continue;
    }
    if (palabras > 0 && palabras + n > PARTE_PALABRAS) cerrar();
    actual.push(parrafo);
    palabras += n;
  }
  cerrar();
  validarUnidades(unidades, 'parte');
  const entradas = unidades.map((_, i) => ({ titulo: `${nombreUnidad('parte', false, true)} ${i + 1}`, pagina: i + 1, nivel: 1 }));
  return { unidad: 'parte', unidades, etiquetas: null, grupos: grupos(entradas, unidades.length, 'parte') };
}

/** Quita lo más común del formato en línea de un título: énfasis, código y enlaces. */
export function limpiarTitulo(titulo: string): string {
  return titulo
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

const CERCA = /^\s{0,3}(`{3,}|~{3,})/;
const ENCABEZADO = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;

/** Secciones de un Markdown; sin encabezados de `#` a `###`, sus partes como un texto. */
export function seccionesMarkdown(texto: string): EstructuraDocumento {
  const lineas = texto.split('\n');
  const limpias: string[] = [];
  const encabezados: Array<{ linea: number; nivel: number; titulo: string }> = [];
  let cerca: string | null = null;
  lineas.forEach((linea, i) => {
    const marca = CERCA.exec(linea);
    if (marca) {
      const tipo = (marca[1] as string).charAt(0);
      if (cerca === null) cerca = tipo;
      else if (cerca === tipo) cerca = null;
      limpias.push(linea);
      return;
    }
    const m = cerca === null ? ENCABEZADO.exec(linea) : null;
    if (!m) {
      limpias.push(linea);
      return;
    }
    const titulo = limpiarTitulo(m[2] as string);
    limpias.push(titulo);
    const nivel = (m[1] as string).length;
    if (nivel <= 3 && titulo !== '') encabezados.push({ linea: i, nivel, titulo });
  });
  return seccionesPorTitulos(limpias, encabezados, '\n');
}

/**
 * E20d: las secciones de un documento a partir de sus líneas (o párrafos) y de sus títulos de nivel 1 a 3. Se corta
 * en los dos niveles más altos; lo de antes del primer título es "Inicio". Sin títulos, por partes. `separador`
 * une las líneas: en un Word cada línea es un párrafo.
 */
export function seccionesPorTitulos(
  limpias: readonly string[],
  todos: ReadonlyArray<{ linea: number; nivel: number; titulo: string }>,
  separador: string,
): EstructuraDocumento {
  const encabezados = todos.filter((e) => e.nivel >= 1 && e.nivel <= 3 && e.titulo !== '');
  const niveles = [...new Set(encabezados.map((e) => e.nivel))].sort((a, b) => a - b);
  if (niveles.length === 0) return partesDeTexto(limpias.join(separador));
  const [alto, segundo] = niveles as [number, number | undefined];
  const cortes = encabezados.filter((e) => e.nivel === alto || e.nivel === segundo);

  const unidades: string[] = [];
  const entradas: Array<{ titulo: string; pagina: number; nivel: number }> = [];
  const previo = limpias.slice(0, (cortes[0] as { linea: number }).linea).join(separador).trim();
  if (previo !== '') {
    unidades.push(previo);
    entradas.push({ titulo: TITULO_INICIO, pagina: 1, nivel: 1 });
  }
  cortes.forEach((corte, k) => {
    const hasta = cortes[k + 1]?.linea ?? limpias.length;
    unidades.push(limpias.slice(corte.linea, hasta).join(separador).trim());
    entradas.push({ titulo: corte.titulo, pagina: unidades.length, nivel: corte.nivel === alto ? 1 : 2 });
  });
  validarUnidades(unidades, 'seccion');
  return { unidad: 'seccion', unidades, etiquetas: null, grupos: grupos(entradas, unidades.length, 'seccion') };
}
