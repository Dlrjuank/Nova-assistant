import { describe, expect, it } from 'vitest';
import { calcularHashToken, generarToken } from './tokenRecuperacion';

describe('utilidades del token de recuperación', () => {
  it('genera tokens aleatorios de 32 bytes expresados como 64 caracteres hexadecimales', () => {
    const token = generarToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('calcula un hash SHA-256 hexadecimal del token', () => {
    expect(calcularHashToken('token')).toBe(
      '3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0',
    );
  });
});
