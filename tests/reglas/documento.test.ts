// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import { validarTamanoPdf, validarTextoExtraido } from '@/lib/reglas/documento';
import { esperarCodigo } from './ayudas';

describe('documento', () => {
  it('T-01 acepta exactamente 15.728.640 bytes', () => {
    expect(() => validarTamanoPdf(15_728_640)).not.toThrow();
  });
  it('T-02 rechaza 15.728.641 bytes con el mensaje exacto', () => {
    esperarCodigo(() => validarTamanoPdf(15_728_641), 'ARCHIVO_MUY_GRANDE');
    expect(MENSAJES.ARCHIVO_MUY_GRANDE).toBe('El documento supera el límite permitido de 15 MB');
  });
  it('T-17 texto vacío → PDF_SIN_TEXTO', () => {
    esperarCodigo(() => validarTextoExtraido(''), 'PDF_SIN_TEXTO');
    expect(MENSAJES.PDF_SIN_TEXTO).toBe('El documento no contiene texto seleccionable (no se admite OCR)');
  });
  it('T-18 solo espacios y saltos → PDF_SIN_TEXTO', () => {
    esperarCodigo(() => validarTextoExtraido('   \n  '), 'PDF_SIN_TEXTO');
  });
});
