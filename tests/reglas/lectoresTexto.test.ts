// E20d-1: leer Markdown y texto (secciones y partes), unidades y citas.
import { describe, expect, it } from 'vitest';
import { decodificarTexto, limpiarTitulo, partesDeTexto, PARTE_PALABRAS, seccionesMarkdown } from '@/lib/lectores/texto';
import { textoAlcance } from '@/lib/reglas/cuestionarios';
import { tituloTareaCapitulo } from '@/lib/reglas/planLectura';
import { detectarSeccionPorTitulo, detectarUnidad } from '@/lib/reglas/preguntasLibro';
import { citaDeUnidades, contarUnidades, mimeDeArchivo, tipoDeArchivo } from '@/lib/reglas/tiposDocumento';
import { etiquetaFragmento } from '@/lib/llm/prompts';

const palabras = (n: number, prefijo = 'w') => Array.from({ length: n }, (_, i) => `${prefijo}${i}`).join(' ');

describe('decodificarTexto', () => {
  it('UTF-8 sin BOM ni retornos de carro; si no es UTF-8, Latin-1', () => {
    expect(decodificarTexto(new TextEncoder().encode('﻿Acción\r\nlínea'))).toBe('Acción\nlínea');
    expect(decodificarTexto(new Uint8Array([0x41, 0x63, 0x63, 0x69, 0xf3, 0x6e]))).toBe('Acción'); // "Acción" en Latin-1
    expect(decodificarTexto(new TextEncoder().encode('a\u0000b'))).toBe('a b');
  });
});

describe('partesDeTexto', () => {
  it(`corta en un párrafo antes de pasar de ${PARTE_PALABRAS} palabras y numera las partes`, () => {
    const texto = [palabras(1000, 'a'), palabras(800, 'b'), palabras(100, 'c')].join('\n\n');
    const e = partesDeTexto(texto);
    expect(e.unidad).toBe('parte');
    expect(e.unidades).toHaveLength(2);
    expect(e.unidades[0]?.startsWith('a0 ')).toBe(true);
    expect(e.unidades[1]?.startsWith('b0 ')).toBe(true);
    expect(e.grupos.map((g) => [g.titulo, g.paginaInicio, g.paginaFin, g.tipo])).toEqual([
      ['Parte 1', 1, 1, 'parte'],
      ['Parte 2', 2, 2, 'parte'],
    ]);
  });

  it('un párrafo enorme se corta solo; sin texto, el mensaje', () => {
    expect(partesDeTexto(palabras(PARTE_PALABRAS * 2 + 10)).unidades).toHaveLength(3);
    expect(() => partesDeTexto(' \n\n ')).toThrow('El archivo no tiene texto.');
  });
});

describe('seccionesMarkdown', () => {
  const MD = [
    'Notas sueltas antes del primer título.',
    '',
    '# Unidad 1: **Límites**',
    'Qué es un límite.',
    '## Límites laterales',
    'Por la izquierda.',
    '### Ejemplo',
    'Un ejemplo.',
    '```python',
    '# esto es un comentario, no un título',
    '```',
    '# Unidad 2: [Derivadas](https://x.org)',
    'La derivada.',
  ].join('\n');

  it('secciones por los dos niveles más altos; lo de antes es "Inicio"; los bloques de código no cuentan', () => {
    const e = seccionesMarkdown(MD);
    expect(e.unidad).toBe('seccion');
    expect(e.unidades).toHaveLength(4);
    expect(e.unidades[2]).toContain('Ejemplo\nUn ejemplo.'); // el ### queda dentro, sin las almohadillas
    expect(e.unidades[2]).toContain('# esto es un comentario');
    expect(e.grupos.map((g) => [g.titulo, g.nivel, g.paginaInicio, g.paginaFin])).toEqual([
      ['Inicio', 1, 1, 1],
      ['Unidad 1: Límites', 1, 2, 3],
      ['Límites laterales', 2, 3, 3],
      ['Unidad 2: Derivadas', 1, 4, 4],
    ]);
    expect(e.grupos.every((g) => g.tipo === 'seccion')).toBe(true);
  });

  it('sin títulos de # a ###, se lee como texto por partes', () => {
    expect(seccionesMarkdown('Solo un párrafo.\n\nY otro.').unidad).toBe('parte');
    expect(seccionesMarkdown('#### Muy profundo\nTexto').unidad).toBe('parte');
  });

  it('limpia el formato de los títulos', () => {
    expect(limpiarTitulo('  *Hola* `código` [enlace](http://a)  ')).toBe('Hola código enlace');
  });
});

describe('tipos y unidades', () => {
  it('el tipo sale de la extensión', () => {
    expect([tipoDeArchivo('a.PDF'), tipoDeArchivo('b.md'), tipoDeArchivo('c.txt'), tipoDeArchivo('d.doc'), tipoDeArchivo('e')]).toEqual(['pdf', 'md', 'txt', null, null]);
    expect(mimeDeArchivo('b.md')).toBe('text/markdown');
  });

  it('citas por unidad: página, sección por su título, diapositiva y parte', () => {
    expect(citaDeUnidades('45')).toBe('p. 45');
    expect(citaDeUnidades('45–46', 'pagina')).toBe('pp. 45–46');
    expect(citaDeUnidades('2', 'seccion', 'Unidad 2')).toBe('Unidad 2');
    expect(citaDeUnidades('2', 'seccion')).toBe('sección 2');
    expect(citaDeUnidades('7', 'diapositiva')).toBe('diapositiva 7');
    expect(citaDeUnidades('3–4', 'parte')).toBe('partes 3–4');
    expect(contarUnidades(1, 'seccion')).toBe('1 sección');
    expect(contarUnidades(12, 'pagina')).toBe('12 páginas');
  });

  it('la etiqueta del fragmento para el modelo usa la unidad', () => {
    expect(etiquetaFragmento({ nombre_archivo: 'Apuntes.md', numero: 1, etiqueta_paginas: '2', unidad: 'seccion', titulo_unidad: 'Unidad 2' })).toBe('Apuntes.md · Unidad 2');
    expect(etiquetaFragmento({ nombre_archivo: 'Notas.txt', numero: 1, etiqueta_paginas: '3', unidad: 'parte' })).toBe('Notas.txt · parte 3');
    expect(etiquetaFragmento({ nombre_archivo: 'l.pdf', numero: 1, etiqueta_paginas: '4' })).toBe('l.pdf · p. 4');
  });

  it('alcance de un cuestionario y tarea de lectura con la unidad', () => {
    expect(textoAlcance('paginas', null, 2, 4, 'parte')).toBe('Partes 2–4');
    expect(textoAlcance('paginas', null, 3, 3, 'seccion')).toBe('Sección 3');
    expect(textoAlcance('paginas', null, 3, 5)).toBe('Páginas 3–5');
    expect(tituloTareaCapitulo(2, 'Derivadas', '4–6', 'Leer', 'seccion')).toBe('Leer: Derivadas');
    expect(tituloTareaCapitulo(1, 'Parte 3', '3', 'Repasar', 'parte')).toBe('Repasar: Parte 3');
    expect(tituloTareaCapitulo(3, 'Capítulo 3. Los ecosistemas', '45–67')).toBe('Leer cap. 3: Los ecosistemas (pp. 45–67)');
  });
});

describe('preguntas por unidad', () => {
  it('"diapositiva 7", "parte 3", "sección 2" y "página 4"', () => {
    expect(detectarUnidad('¿Qué dice la diapositiva 7?')).toEqual({ unidad: 'diapositiva', numero: 7 });
    expect(detectarUnidad('resume la parte 3')).toEqual({ unidad: 'parte', numero: 3 });
    expect(detectarUnidad('explica la seccion 2')).toEqual({ unidad: 'seccion', numero: 2 });
    expect(detectarUnidad('la página 4')).toEqual({ unidad: 'pagina', numero: 4 });
    expect(detectarUnidad('en parte tienes razón')).toBeNull();
  });

  it('la sección por su título', () => {
    expect(detectarSeccionPorTitulo('Explícame la sección sobre las derivadas')).toBe('derivadas');
    expect(detectarSeccionPorTitulo('¿qué es una derivada?')).toBeNull();
  });
});
