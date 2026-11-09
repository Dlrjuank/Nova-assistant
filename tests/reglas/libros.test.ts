// @vitest-environment node
// E10b (S-33 a S-36): páginas de cada fragmento y capítulos.
import { describe, expect, it } from 'vitest';
import { FRAGMENTO_PALABRAS, FRAGMENTO_SOLAPAMIENTO, PDF_MAX_PAGINAS } from '@/lib/config/nova';
import { fragmentar } from '@/lib/reglas/fragmentacion';
import {
  capitulosDesdeEncabezados,
  capitulosDesdeIndice,
  citaDePaginas,
  detectarCapitulos,
  etiquetaDePaginas,
  fragmentarPaginas,
  validarPaginas,
} from '@/lib/reglas/libros';

const palabras = (n: number, p = 'x') => Array.from({ length: n }, (_, i) => `${p}${i}`).join(' ');

describe('fragmentos por página', () => {
  it('son los mismos trozos de RN-10 que sin páginas', () => {
    const paginas = [palabras(300, 'a'), palabras(400, 'b'), palabras(350, 'c')];
    expect(fragmentarPaginas(paginas).map((f) => f.contenido)).toEqual(fragmentar(paginas.join(' ')).map((f) => f.contenido));
  });

  it('cada fragmento sabe qué páginas toca su texto', () => {
    // Con 500 palabras y 50 de solapamiento, el segundo trozo empieza en la palabra 450: página 2.
    expect(FRAGMENTO_PALABRAS - FRAGMENTO_SOLAPAMIENTO).toBe(450);
    const [uno, dos] = fragmentarPaginas([palabras(300), palabras(300), palabras(300)]);
    expect([uno?.paginaInicio, uno?.paginaFin]).toEqual([1, 2]);
    expect(uno?.etiquetaPaginas).toBe('1–2');
    expect([dos?.paginaInicio, dos?.paginaFin]).toEqual([2, 3]);
  });

  it('una página en blanco no cuenta y un fragmento en una sola página no es un rango', () => {
    const [f] = fragmentarPaginas(['', '  ', palabras(10)]);
    expect([f?.paginaInicio, f?.paginaFin, f?.etiquetaPaginas]).toEqual([3, 3, '3']);
    expect(fragmentarPaginas(['', ' '])).toEqual([]);
  });

  it('usa el número impreso; sin él, el de la página del PDF', () => {
    expect(etiquetaDePaginas(3, 3, ['i', 'ii', '1'])).toBe('1');
    expect(etiquetaDePaginas(2, 3, ['i', 'ii', '1'])).toBe('ii–1');
    expect(etiquetaDePaginas(4, 5)).toBe('4–5');
    expect(etiquetaDePaginas(2, 2, ['a', '', 'c'])).toBe('2');
    expect(fragmentarPaginas([palabras(5)], ['xi'])[0]?.etiquetaPaginas).toBe('xi');
  });

  it('cita "p." y "pp."', () => {
    expect(citaDePaginas('45')).toBe('p. 45');
    expect(citaDePaginas('45–46')).toBe('pp. 45–46');
  });

  it('RB-38: hasta 800 páginas, con el número en el mensaje', () => {
    expect(() => validarPaginas(PDF_MAX_PAGINAS)).not.toThrow();
    expect(() => validarPaginas(801)).toThrow('El PDF tiene 801 páginas; el máximo es 800.');
  });
});

describe('capítulos del índice interno', () => {
  const INDICE = [
    { titulo: 'Capítulo 1', pagina: 3, nivel: 1 },
    { titulo: '1.1 Inicio', pagina: 3, nivel: 2 },
    { titulo: '1.2 Más', pagina: 8, nivel: 2 },
    { titulo: 'Capítulo 2', pagina: 13, nivel: 1 },
  ];

  it('calcula la página final de capítulos y secciones', () => {
    const c = capitulosDesdeIndice(INDICE, 20);
    expect(c.map((x) => [x.orden, x.nivel, x.titulo, x.paginaInicio, x.paginaFin])).toEqual([
      [1, 1, 'Capítulo 1', 3, 12],
      [2, 2, '1.1 Inicio', 3, 7],
      [3, 2, '1.2 Más', 8, 12],
      [4, 1, 'Capítulo 2', 13, 20],
    ]);
  });

  it('con números impresos muestra esas páginas', () => {
    const etiquetas = ['i', 'ii', ...Array.from({ length: 18 }, (_, i) => String(i + 1))];
    expect(capitulosDesdeIndice(INDICE, 20, etiquetas)[0]?.etiquetaPaginas).toBe('1–10');
  });

  it('una sola raíz (el título del libro): sus hijos son los capítulos', () => {
    const c = capitulosDesdeIndice(
      [
        { titulo: 'Mi libro', pagina: 1, nivel: 1 },
        { titulo: 'Uno', pagina: 2, nivel: 2 },
        { titulo: 'Sub', pagina: 3, nivel: 3 },
        { titulo: 'Dos', pagina: 5, nivel: 2 },
      ],
      9,
    );
    expect(c.map((x) => [x.titulo, x.nivel])).toEqual([['Uno', 1], ['Sub', 2], ['Dos', 1]]);
  });

  it('ignora entradas vacías o fuera del libro, ordena por página y no da capítulos con menos de 2', () => {
    expect(capitulosDesdeIndice([{ titulo: 'Solo', pagina: 1, nivel: 1 }], 9)).toEqual([]);
    const c = capitulosDesdeIndice(
      [
        { titulo: 'B', pagina: 5, nivel: 1 },
        { titulo: 'A', pagina: 2, nivel: 1 },
        { titulo: '  ', pagina: 3, nivel: 1 },
        { titulo: 'Fuera', pagina: 99, nivel: 1 },
      ],
      9,
    );
    expect(c.map((x) => x.titulo)).toEqual(['A', 'B']);
  });
});

describe('capítulos por encabezados (respaldo)', () => {
  it('toma el encabezado y su título, de la misma línea o de la siguiente', () => {
    const c = capitulosDesdeEncabezados(['Portada', 'Capítulo 1\nLas células\nTexto', 'Texto', 'CAPÍTULO 2: La energía\nTexto', 'Chapter uno sin número']);
    expect(c.map((x) => [x.titulo, x.paginaInicio, x.paginaFin])).toEqual([
      ['Capítulo 1: Las células', 2, 3],
      ['Capítulo 2: La energía', 4, 5],
    ]);
  });

  it('admite romanos, y una cabecera repetida no crea capítulos', () => {
    const c = capitulosDesdeEncabezados(['Unidad I\nA', 'Unidad I\nsigue', 'Unidad II\nB']);
    expect(c.map((x) => [x.paginaInicio, x.paginaFin])).toEqual([[1, 2], [3, 3]]);
  });

  it('no confunde una página de índice ni una frase con un encabezado', () => {
    expect(capitulosDesdeEncabezados(['Capítulo 1 ........ 5\nCapítulo 2 ........ 9', 'Tema central de la obra\nTexto', 'El capítulo 3 dice'])).toEqual([]);
    expect(capitulosDesdeEncabezados(['Capítulo 1\nÍndice ..... 3', 'Capítulo 2\nTexto'])).toEqual([]);
  });

  it('no mezcla palabras: usa la más frecuente, y con un solo capítulo no inventa', () => {
    const c = capitulosDesdeEncabezados(['Unidad 1\nA', 'Tema 1\nB', 'Unidad 2\nC', 'Tema 9\nD', 'Unidad 3\nE']);
    expect(c.map((x) => x.titulo)).toEqual(['Unidad 1: A', 'Unidad 2: C', 'Unidad 3: E']);
    expect(capitulosDesdeEncabezados(['Capítulo 1\nTexto', 'Texto'])).toEqual([]);
  });

  it('el índice interno manda; si no sirve, se usan los encabezados', () => {
    const paginas = ['Capítulo 1\nA', 'Capítulo 2\nB', 'C'];
    expect(detectarCapitulos(paginas, [{ titulo: 'X', pagina: 1, nivel: 1 }, { titulo: 'Y', pagina: 3, nivel: 1 }]).map((c) => c.titulo)).toEqual(['X', 'Y']);
    expect(detectarCapitulos(paginas, []).map((c) => c.titulo)).toEqual(['Capítulo 1: A', 'Capítulo 2: B']);
  });
});
