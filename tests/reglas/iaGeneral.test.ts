// S-67 (E10c3, RB-60): "Preguntarle a la IA" solo bajo un "No encontré" de documentos.
import { describe, expect, it } from 'vitest';
import { SIN_RESPUESTA, SIN_RESPUESTA_FUENTES_WEB, sinRespuestaEnDocumento } from '@/lib/llm/prompts';
import { MARCA_IA, ofrecePreguntarIa } from '@/lib/reglas/iaGeneral';

const asistente = (texto: string, origen: string | null = null) => ({ autor: 'asistente', texto, origen });

describe('ofrecePreguntarIa', () => {
  it.each([
    ['el "No encontré" de RN-13', SIN_RESPUESTA],
    ['el de un documento elegido', sinRespuestaEnDocumento('libro de biología.pdf')],
  ])('aparece bajo %s', (_, texto) => {
    expect(ofrecePreguntarIa(asistente(texto))).toBe(true);
  });

  it.each([
    ['una respuesta con citas', 'La garantía dura 24 meses [manual.pdf · p. 3].'],
    ['una respuesta que solo empieza igual', `${SIN_RESPUESTA}, pero sí encontré otra cosa.`],
    ['el capítulo inexistente', 'No encontré el capítulo 9 en este documento.'],
  ])('no aparece bajo %s', (_, texto) => {
    expect(ofrecePreguntarIa(asistente(texto))).toBe(false);
  });

  it('no aparece bajo otros orígenes ni bajo el usuario', () => {
    expect(ofrecePreguntarIa(asistente(SIN_RESPUESTA_FUENTES_WEB, 'web'))).toBe(false);
    expect(ofrecePreguntarIa(asistente(SIN_RESPUESTA, 'ia'))).toBe(false);
    expect(ofrecePreguntarIa({ autor: 'usuario', texto: SIN_RESPUESTA, origen: null })).toBe(false);
  });

  it('la marca es la exacta del plan', () => {
    expect(MARCA_IA).toBe('Respuesta general de la IA, sin fuentes. Compruébala si es importante.');
  });
});
