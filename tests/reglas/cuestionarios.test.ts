// S-51 a S-57 (E10e): contexto, mínimo de texto, validación de 9.6, barajar y puntaje de 7.11.
import { describe, expect, it } from 'vitest';
import {
  barajarOpciones,
  calcularPuntaje,
  elegirFragmentos,
  etiquetaDeCita,
  formatearPuntaje,
  recortarAPaginas,
  minimoFragmentos,
  minimoPreguntas,
  rangoValido,
  ubicarCita,
  validarPreguntas,
} from '@/lib/reglas/cuestionarios';

const conGrupo = (n: number, grupo: (i: number) => number = () => 0) => Array.from({ length: n }, (_, i) => ({ i, grupo: grupo(i) }));

describe('S-51: fragmentos por pregunta y reparto uniforme', () => {
  it('con pocos fragmentos los toma todos', () => {
    expect(elegirFragmentos(conGrupo(10), 15).map((f) => f.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('con más de los que caben, los reparte de manera uniforme y en orden', () => {
    const elegidos = elegirFragmentos(conGrupo(100), 15).map((f) => f.i);
    expect(elegidos).toHaveLength(15);
    expect([...elegidos].sort((a, b) => a - b)).toEqual(elegidos);
    expect(elegidos[0]).toBeLessThan(7);
    expect(elegidos.at(-1)).toBeGreaterThan(93);
  });

  it('en un libro completo, los reparte entre sus capítulos', () => {
    // 3 capítulos de 40, 10 y 2 fragmentos; caben 15.
    const libro = conGrupo(52, (i) => (i < 40 ? 1 : i < 50 ? 2 : 3));
    const porCapitulo = elegirFragmentos(libro, 15).reduce<Record<number, number>>((a, f) => ({ ...a, [f.grupo]: (a[f.grupo] ?? 0) + 1 }), {});
    expect(porCapitulo).toEqual({ 1: 7, 2: 6, 3: 2 });
  });
});

describe('S-52: mínimo de texto (RB-49)', () => {
  it('un fragmento por cada 2 preguntas', () => {
    expect([5, 10, 20].map(minimoFragmentos)).toEqual([3, 5, 10]);
  });

  it('se crea con al menos la mitad de las pedidas, y nunca con menos de 3', () => {
    expect([5, 10, 20].map(minimoPreguntas)).toEqual([3, 5, 10]);
  });
});

describe('S-53: rango de páginas (RB-48)', () => {
  it.each([
    [1, 10, 40, true],
    [5, 5, 40, true],
    [0, 3, 40, false],
    [8, 3, 40, false],
    [1, 41, 40, false],
    [1.5, 3, 40, false],
  ])('del %s al %s en un documento de %s páginas: %s', (desde, hasta, paginas, valido) => {
    expect(rangoValido(desde, hasta, paginas)).toBe(valido);
  });
});

const FRAGMENTO =
  'La fotosíntesis ocurre en los cloroplastos de las hojas. Las plantas usan la luz so- lar para convertir el agua y el dióxido de carbono en glucosa, y liberan oxígeno.';
const FRAGMENTOS = new Map([['F1', { contenido: FRAGMENTO }]]);
const buena = {
  enunciado: '¿Dónde ocurre la fotosíntesis?',
  opciones: ['En las raíces', 'En los cloroplastos', 'En el tallo', 'En las flores'],
  correcta: 1,
  explicacion: 'El texto dice que ocurre en los cloroplastos de las hojas.',
  fuente: 'F1',
  cita_textual: 'La fotosíntesis ocurre en los cloroplastos de las hojas',
};

describe('S-54 a S-56: validación de cada pregunta (9.6, RB-50)', () => {
  it('una pregunta correcta pasa, con dónde está su cita', () => {
    const [v] = validarPreguntas([buena], FRAGMENTOS);
    expect(v).toMatchObject({ enunciado: buena.enunciado, correcta: 1, fuente: 'F1', desde: 0, hasta: 8 });
  });

  it.each([
    ['la cita no está en el fragmento', { cita_textual: 'La fotosíntesis ocurre en las raíces de los árboles' }],
    ['la fuente es inventada', { fuente: 'F9' }],
    ['las opciones se repiten', { opciones: ['Hojas', 'hojas ', 'Tallo', 'Flor'] }],
    ['no son 4 opciones', { opciones: ['Hojas', 'Tallo', 'Flor'] }],
    ['correcta fuera de 0 a 3', { correcta: 4 }],
    ['correcta no entera', { correcta: 1.5 }],
    ['la cita es muy corta', { cita_textual: 'cloroplastos' }],
    ['la cita es muy larga', { cita_textual: FRAGMENTO.repeat(2) }],
    ['falta la explicación', { explicacion: '' }],
  ])('se descarta si %s', (_, cambio) => {
    expect(validarPreguntas([{ ...buena, ...cambio }], FRAGMENTOS)).toEqual([]);
  });

  it('un enunciado repetido (en la misma respuesta o en las previas) se descarta', () => {
    expect(validarPreguntas([buena, { ...buena, opciones: ['a', 'b', 'c', 'd'] }], FRAGMENTOS)).toHaveLength(1);
    expect(validarPreguntas([buena], FRAGMENTOS, ['¿dónde  ocurre la FOTOSÍNTESIS?'])).toEqual([]);
  });

  it('lo que no es una lista de preguntas no rompe', () => {
    expect(validarPreguntas({ preguntas: [] }, FRAGMENTOS)).toEqual([]);
    expect(validarPreguntas([null, 3, 'x'], FRAGMENTOS)).toEqual([]);
  });

  it('la cita vale a pesar de mayúsculas, espacios y guiones de fin de línea', () => {
    expect(ubicarCita(FRAGMENTO, 'usan la LUZ   SOLAR para convertir el agua')).toEqual({ desde: 11, hasta: 19 });
    expect(ubicarCita(FRAGMENTO, 'usan la luz so- lar para convertir')).not.toBeNull();
  });

  it('la cita puede cortar la puntuación de la primera y la última palabra', () => {
    expect(ubicarCita(FRAGMENTO, 'en glucosa, y liberan oxígeno')).not.toBeNull();
    expect(ubicarCita(FRAGMENTO, 'el dióxido de carbono en glucosa')).not.toBeNull();
  });

  it('barajar conserva cuál es la correcta', () => {
    const secuencia = [0.9, 0.1, 0.5];
    const r = barajarOpciones(buena.opciones, 1, () => secuencia.shift() ?? 0);
    expect([...r.opciones].sort()).toEqual([...buena.opciones].sort());
    expect(r.opciones[r.correcta]).toBe('En los cloroplastos');
    for (let n = 0; n < 50; n++) {
      const otra = barajarOpciones(buena.opciones, 2);
      expect(otra.opciones[otra.correcta]).toBe('En el tallo');
    }
  });
});

describe('página de la cita', () => {
  // Páginas del PDF que empiezan en las palabras 0, 450 y 900; el fragmento 2 empieza en la 450 (paso 450).
  const inicios = [0, 450, 900];
  it('con dónde empieza cada página, la página impresa exacta de la cita', () => {
    const f = { inicioPalabra: 450, pagina_inicio: 2, etiqueta_paginas: '12–13' };
    expect(etiquetaDeCita(f, { desde: 10, hasta: 20 }, inicios)).toBe('12');
    expect(etiquetaDeCita(f, { desde: 440, hasta: 460 }, inicios)).toBe('12–13');
  });

  it('sin ese dato, o con páginas no numéricas, no se inventa', () => {
    expect(etiquetaDeCita({ inicioPalabra: 0, pagina_inicio: 1, etiqueta_paginas: '1' }, { desde: 0, hasta: 3 }, null)).toBeNull();
    expect(etiquetaDeCita({ inicioPalabra: 0, pagina_inicio: 1, etiqueta_paginas: 'iv' }, { desde: 0, hasta: 3 }, inicios)).toBeNull();
  });

  it('B-60: el texto se recorta a las páginas del alcance, sin repetir el solapamiento', () => {
    // Páginas de 450 palabras; el fragmento n son las 450 de su página y 50 de la siguiente.
    const palabras = (p: number) => Array.from({ length: 450 }, (_, i) => `p${p}w${i}`);
    const frags = [1, 2, 3, 4].map((n) => ({ numero: n, contenido: [...palabras(n), ...palabras(n + 1).slice(0, 50)].join(' ') }));
    const recortados = recortarAPaginas(frags, 2, 3, [0, 450, 900, 1350, 1800]);
    const texto = recortados.map((f) => f.contenido).join(' ').split(' ');
    expect(texto).toHaveLength(900);
    expect(texto.every((w) => w.startsWith('p2') || w.startsWith('p3'))).toBe(true);
    expect(recortados.map((f) => [f.numero, f.inicioPalabra])).toEqual([
      [1, 450],
      [2, 500],
      [3, 950],
    ]);
  });
});

describe('S-57: puntaje de 7.11', () => {
  it.each([
    [7, 10, 350, '3,5'],
    [2, 3, 333, '3,3'],
    [20, 20, 500, '5,0'],
    [3, 5, 300, '3,0'],
    [0, 5, 0, '0,0'],
    [1, 3, 166, '1,6'],
  ])('%s de %s → %s centésimas → %s', (aciertos, total, centesimas, texto) => {
    expect(calcularPuntaje(aciertos, total)).toBe(centesimas);
    expect(formatearPuntaje(centesimas)).toBe(texto);
  });

  it('sin preguntas, 0', () => {
    expect(calcularPuntaje(0, 0)).toBe(0);
  });
});
