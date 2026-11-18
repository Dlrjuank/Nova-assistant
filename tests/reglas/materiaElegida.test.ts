// E17, ajuste del usuario (2026-11-17): qué materia muestra "Objetivos y plan".
import { describe, expect, it } from 'vitest';
import { elegirMateria, textoCookieMateria } from '@/lib/reglas/materiaElegida';

const IDS = ['a', 'b', 'c'];

describe('elegirMateria', () => {
  it('primero la de la dirección, luego la recordada, luego la más reciente', () => {
    expect(elegirMateria(IDS, 'b', 'c', 'a')).toBe('b');
    expect(elegirMateria(IDS, undefined, 'c', 'a')).toBe('c');
    expect(elegirMateria(IDS, undefined, undefined, 'a')).toBe('a');
  });

  it('una materia ajena o borrada no se muestra: pasa a la siguiente opción', () => {
    expect(elegirMateria(IDS, 'de-otro', 'borrada', 'c')).toBe('c');
    expect(elegirMateria(IDS, 'x', undefined, null)).toBe('a');
    expect(elegirMateria([], 'x', 'y', null)).toBeNull();
  });

  it('la cookie es solo de Nova, por un año', () => {
    expect(textoCookieMateria('a')).toBe('nova-materia=a; path=/nova; max-age=31536000; samesite=lax');
  });
});
