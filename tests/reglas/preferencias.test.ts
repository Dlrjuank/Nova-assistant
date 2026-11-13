// E11 (5.8, 6.3; RB-11, RB-26, RB-10, RB-07): preferencias y formato de 12 horas.
import { describe, expect, it } from 'vitest';
import { formatearHora, formatearHorario } from '@/lib/reglas/horario';
import {
  aCentesimas,
  formatearNota,
  formatearPorcentaje,
  mensajeCortesNoSuman,
  validarCortesDefecto,
  validarNombrePerfil,
  validarNotaAprobar,
} from '@/lib/reglas/preferencias';

describe('números con coma', () => {
  it('aCentesimas acepta coma o punto y hasta dos decimales', () => {
    expect(aCentesimas('3')).toBe(300);
    expect(aCentesimas('3,5')).toBe(350);
    expect(aCentesimas(' 3.25 ')).toBe(325);
    expect(aCentesimas('33,33')).toBe(3333);
    expect(aCentesimas('100')).toBe(10000);
    expect(aCentesimas('3,255')).toBeNull();
    expect(aCentesimas('')).toBeNull();
    expect(aCentesimas('-1')).toBeNull();
    expect(aCentesimas('tres')).toBeNull();
  });

  it('formatea notas y porcentajes en español', () => {
    expect(formatearNota(300)).toBe('3,0');
    expect(formatearNota(325)).toBe('3,25');
    expect(formatearNota(350)).toBe('3,5');
    expect(formatearPorcentaje(3000)).toBe('30');
    expect(formatearPorcentaje(3333)).toBe('33,33');
    expect(formatearPorcentaje(2550)).toBe('25,5');
  });
});

describe('RB-11 y RB-26', () => {
  it('nota para aprobar entre 0,0 y 5,0', () => {
    expect(validarNotaAprobar('3,0')).toBe(300);
    expect(validarNotaAprobar('0')).toBe(0);
    expect(validarNotaAprobar('5')).toBe(500);
    expect(validarNotaAprobar(450)).toBe(450);
    for (const mala of ['5,1', '6', 'x', '', 3.5]) {
      expect(() => validarNotaAprobar(mala)).toThrow('La nota para aprobar debe estar entre 0,0 y 5,0.');
    }
  });

  it('nombre recortado de 1 a 80 caracteres', () => {
    expect(validarNombrePerfil('  Ana María ')).toBe('Ana María');
    expect(() => validarNombrePerfil('   ')).toThrow('Escribe tu nombre.');
    expect(() => validarNombrePerfil('a'.repeat(81))).toThrow('Escribe tu nombre.');
  });
});

describe('cortes por defecto', () => {
  it('deben sumar 100 % para guardar', () => {
    expect(validarCortesDefecto(['30', '30', '40'])).toEqual([3000, 3000, 4000]);
    expect(validarCortesDefecto(['33,33', '33,33', '33,34'])).toEqual([3333, 3333, 3334]);
    expect(validarCortesDefecto([10000])).toEqual([10000]);
    expect(() => validarCortesDefecto(['30', '30'])).toThrow('Los porcentajes de los cortes suman 60 %; deben sumar 100 %.');
    expect(mensajeCortesNoSuman(9950)).toBe('Los porcentajes de los cortes suman 99,5 %; deben sumar 100 %.');
  });

  it('cada corte mayor que 0 y como máximo 100 (RB-10); de 1 a 6 cortes', () => {
    expect(() => validarCortesDefecto(['0', '100'])).toThrow('El porcentaje debe ser mayor que 0 y como máximo 100.');
    expect(() => validarCortesDefecto(['', '100'])).toThrow('El porcentaje debe ser mayor que 0 y como máximo 100.');
    expect(() => validarCortesDefecto(['150', '-50'])).toThrow('El porcentaje debe ser mayor que 0 y como máximo 100.');
    expect(() => validarCortesDefecto([])).toThrow();
    expect(() => validarCortesDefecto(Array(7).fill('10'))).toThrow();
  });
});

describe('formato de hora (E11)', () => {
  it('24 horas por defecto, sin cambios', () => {
    expect(formatearHora('08:00')).toBe('8:00');
    expect(formatearHorario({ horaInicio: '08:00', horaFin: '09:30' })).toBe('8:00 – 9:30');
  });

  it('12 horas con a. m. y p. m., incluidas medianoche y mediodía', () => {
    expect(formatearHora('08:05', '12')).toBe('8:05 a. m.');
    expect(formatearHora('13:30', '12')).toBe('1:30 p. m.');
    expect(formatearHora('00:15', '12')).toBe('12:15 a. m.');
    expect(formatearHora('12:00', '12')).toBe('12:00 p. m.');
    expect(formatearHora('23:59', '12')).toBe('11:59 p. m.');
    expect(formatearHorario({ horaInicio: '11:00', horaFin: '13:00' }, '12')).toBe('11:00 a. m. – 1:00 p. m.');
    expect(formatearHorario({ horaInicio: null }, '12')).toBe('');
  });
});
