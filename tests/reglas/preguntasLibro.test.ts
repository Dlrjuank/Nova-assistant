// @vitest-environment node
// E10c (S-37 a S-39): reconocer preguntas por página o capítulo.
import { describe, expect, it } from 'vitest';
import { buscarCapitulo, detectarCapitulo, detectarPagina, esContinuacion, etiquetaIncluye, MODOS_EXPLICAR, paginaDelPdf } from '@/lib/reglas/preguntasLibro';

describe('página', () => {
  it('reconoce las formas de pedir una página', () => {
    expect(detectarPagina('¿Qué dice la página 45?')).toBe(45);
    expect(detectarPagina('que dice la pagina 7')).toBe(7);
    expect(detectarPagina('Explícame la pág. 120')).toBe(120);
    expect(detectarPagina('resume la pag 3')).toBe(3);
    expect(detectarPagina('lo de la p. 45 por favor')).toBe(45);
    expect(detectarPagina('página número 12')).toBe(12);
  });

  it('no confunde otras frases', () => {
    expect(detectarPagina('¿Cuántas páginas tiene? son 3 páginas')).toBeNull();
    expect(detectarPagina('la mejor página web de ciencia')).toBeNull();
    expect(detectarPagina('Empezamos en el paso 4')).toBeNull();
    expect(detectarPagina('tengo 12 tareas')).toBeNull();
  });

  it('la etiqueta incluye la página, con rangos y números romanos', () => {
    expect(etiquetaIncluye('45', 45)).toBe(true);
    expect(etiquetaIncluye('44–46', 45)).toBe(true);
    expect(etiquetaIncluye('44–46', 47)).toBe(false);
    expect(etiquetaIncluye('4', 45)).toBe(false);
    expect(etiquetaIncluye('ii–1', 1)).toBe(true);
    expect(etiquetaIncluye('ii', 2)).toBe(false);
  });
});

describe('página del PDF', () => {
  it('convierte el número impreso, también en rangos y con romanos', () => {
    expect(paginaDelPdf({ etiqueta_paginas: '10', pagina_inicio: 12, pagina_fin: 12 }, 10)).toBe(12);
    expect(paginaDelPdf({ etiqueta_paginas: '9–11', pagina_inicio: 11, pagina_fin: 13 }, 10)).toBe(12);
    expect(paginaDelPdf({ etiqueta_paginas: 'ii–1', pagina_inicio: 2, pagina_fin: 3 }, 1)).toBe(3);
    expect(paginaDelPdf({ etiqueta_paginas: null, pagina_inicio: null, pagina_fin: null }, 1)).toBeNull();
  });
});

describe('capítulo', () => {
  it('reconoce número, romano, unidad y título', () => {
    expect(detectarCapitulo('Resume el capítulo 3')).toEqual({ tipo: 'numero', numero: 3 });
    expect(detectarCapitulo('explica el capitulo IV.')).toEqual({ tipo: 'numero', numero: 4 });
    expect(detectarCapitulo('¿De qué trata la unidad 2?')).toEqual({ tipo: 'numero', numero: 2 });
    expect(detectarCapitulo('Explícame el capítulo de fotosíntesis')).toEqual({ tipo: 'titulo', titulo: 'fotosíntesis' });
    expect(detectarCapitulo('resume el capítulo sobre la energía?')).toEqual({ tipo: 'titulo', titulo: 'energía' });
  });

  it('no confunde otras frases', () => {
    expect(detectarCapitulo('¿Y el capítulo anterior?')).toBeNull();
    expect(detectarCapitulo('Vi un capítulo de una serie')).toEqual({ tipo: 'titulo', titulo: 'una serie' }); // se resuelve contra los capítulos reales
    expect(detectarCapitulo('un capítulo mi favorito')).toBeNull();
    expect(detectarCapitulo('Dime cuántos capítulos hay')).toBeNull();
  });

  const C = [
    { orden: 1, nivel: 1, titulo: 'Introducción' },
    { orden: 2, nivel: 1, titulo: 'Capítulo 1: Las células' },
    { orden: 3, nivel: 2, titulo: '1.1 Fotosíntesis y energía' },
    { orden: 4, nivel: 1, titulo: 'Capítulo 2: La energía' },
  ];

  it('busca por el número del título; si ninguno lo dice, el N-ésimo', () => {
    expect(buscarCapitulo(C, { tipo: 'numero', numero: 2 })?.orden).toBe(4);
    expect(buscarCapitulo([{ orden: 1, nivel: 1, titulo: 'Inicio' }, { orden: 2, nivel: 1, titulo: 'Final' }], { tipo: 'numero', numero: 2 })?.orden).toBe(2);
    expect(buscarCapitulo(C, { tipo: 'numero', numero: 9 })).toBeNull();
  });

  it('busca por título sin acentos: capítulos antes que secciones', () => {
    expect(buscarCapitulo(C, { tipo: 'titulo', titulo: 'energia' })?.orden).toBe(4);
    expect(buscarCapitulo(C, { tipo: 'titulo', titulo: 'fotosintesis' })?.orden).toBe(3);
    expect(buscarCapitulo(C, { tipo: 'titulo', titulo: 'genética' })).toBeNull();
  });
});

describe('otros', () => {
  it('seguir un capítulo', () => {
    expect(esContinuacion('sigue con el resto')).toBe(true);
    expect(esContinuacion('Continúa por favor')).toBe(true);
    expect(esContinuacion('¿qué sigue después?')).toBe(false);
  });

  it('los 5 modos de explicar', () => {
    expect(MODOS_EXPLICAR.map((m) => m.texto)).toEqual(['Más simple', 'Con un ejemplo', 'Paso a paso', 'Resumen corto', 'Con una analogía']);
  });
});
