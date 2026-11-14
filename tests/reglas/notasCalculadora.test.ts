// E13 (PLAN_AMPLIACION 7.5, 7.6, RB-12, RB-18): S-13 a S-21.
import { describe, expect, it } from 'vitest';
import {
  calcularMateria,
  cuantoNecesito,
  promedioSemestre,
  textoCuantoNecesito,
  textoNota,
  textoPeso,
  validarMeta,
  type ComponenteEntrada,
  type MateriaEntrada,
} from '@/lib/reglas/notas';

const comp = (nombre: string, porcentaje: number, notas: Array<number | null>): ComponenteEntrada => ({ nombre, porcentaje, notas });
const sinCortes = (componentes: ComponenteEntrada[]): MateriaEntrada => ({ usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes }] });
const EJEMPLO = calcularMateria(
  sinCortes([comp('Parcial', 4000, [350]), comp('Talleres', 2000, [400, 440]), comp('Quizzes', 2000, [300, 500, null, null, null]), comp('Actividades', 2000, [])]),
);
const texto = (objetivo: number, redondeo: 'truncar' | 'redondear' = 'truncar', c = EJEMPLO) => {
  const r = cuantoNecesito(c, objetivo, redondeo);
  return r ? textoCuantoNecesito(r, objetivo) : null;
};

describe('S-13 a S-18: "¿Cuánto necesito?" (7.5, RB-12)', () => {
  it('S-13: el ejemplo de 7.5: 1,4 para aprobar con 3,0 y 4,5 para la meta 4,0', () => {
    expect(texto(300)).toBe('Necesitas al menos 1,4 en lo que falta para llegar a 3,0.'); // 1,375 hacia arriba
    expect(texto(400)).toBe('Necesitas al menos 4,5 en lo que falta para llegar a 4,0.');
  });

  it('S-14: imposible: la meta 4,5 no se alcanza; lo máximo es 4,1', () => {
    expect(texto(450)).toBe('Con lo que falta no es posible llegar a 4,5. Lo máximo que puedes alcanzar es 4,1.');
  });

  it('S-15: ya asegurado', () => {
    expect(texto(250)).toBe('Ya aseguraste 2,5.'); // asegurado 2,56
    expect(texto(10)).toBe('Ya aseguraste 0,1.');
  });

  it('S-16: W = 0: se informa la definitiva', () => {
    const completa = calcularMateria(sinCortes([comp('Parcial', 5000, [300]), comp('Final', 5000, [410])]));
    expect(texto(300, 'truncar', completa)).toBe('Ya no queda nada por calificar: tu nota definitiva es 3,5.');
  });

  it('S-17: truncar frente a redondear con el mismo dato: el umbral baja 0,05', () => {
    expect(texto(300, 'truncar')).toBe('Necesitas al menos 1,4 en lo que falta para llegar a 3,0.'); // (3,00 − 2,56) / 0,32 = 1,375
    expect(texto(300, 'redondear')).toBe('Necesitas al menos 1,3 en lo que falta para llegar a 3,0.'); // (2,95 − 2,56) / 0,32 = 1,21875
  });

  it('S-18: el resultado se redondea hacia arriba (alcanzarlo garantiza el objetivo)', () => {
    // Parcial 50 % con 2,0; falta el final de 50 %: para 3,0 hace falta 4,0 exacto.
    const mitad = calcularMateria(sinCortes([comp('Parcial', 5000, [200]), comp('Final', 5000, [])]));
    expect(texto(300, 'truncar', mitad)).toBe('Necesitas al menos 4,0 en lo que falta para llegar a 3,0.');
    // Con 2,01 hace falta 3,99 → se muestra 4,0, nunca 3,9.
    const casi = calcularMateria(sinCortes([comp('Parcial', 5000, [201]), comp('Final', 5000, [])]));
    expect(texto(300, 'truncar', casi)).toBe('Necesitas al menos 4,0 en lo que falta para llegar a 3,0.');
    // Un peso no exacto: x = (3,00 − 1,215) / 0,55 = 3,2454… → 3,25 → 3,3.
    const tercio = calcularMateria(sinCortes([comp('Parcial', 4500, [270]), comp('Final', 5500, [])]));
    expect(texto(300, 'truncar', tercio)).toBe('Necesitas al menos 3,3 en lo que falta para llegar a 3,0.');
  });

  it('sin notas, lo que se necesita en todo; con porcentajes que no suman 100 %, nada (7.4)', () => {
    expect(texto(300, 'truncar', calcularMateria(sinCortes([comp('Final', 10000, [])])))).toBe('Necesitas al menos 3,0 en lo que falta para llegar a 3,0.');
    expect(cuantoNecesito(calcularMateria(sinCortes([comp('Parcial', 9000, [300])])), 300, 'truncar')).toBeNull();
  });

  it('RB-18: la meta de 0,1 a 5,0', () => {
    expect(validarMeta('4,5')).toBe(450);
    expect(validarMeta('0,1')).toBe(10);
    for (const malo of ['0', '0,05', '5,1', 'x', '']) expect(() => validarMeta(malo)).toThrow('La meta debe estar entre 0,1 y 5,0.');
  });
});

describe('S-19 a S-21: promedio del semestre (7.6)', () => {
  const materia = (creditos: number, notas: Array<number | null>) => ({ creditos, calculo: calcularMateria(sinCortes([comp('Todo', 10000, notas)])) });

  it('S-19: ponderado por créditos, coincide a mano (B-31)', () => {
    // (4,0 × 3 + 3,0 × 1) / 4 = 3,75
    const p = promedioSemestre([materia(3, [400]), materia(1, [300])]);
    expect(textoNota(p.actual!, 'truncar')).toBe('3,7');
    expect(textoNota(p.actual!, 'redondear')).toBe('3,8');
    expect(textoNota(p.asegurado!, 'truncar')).toBe('3,7');
  });

  it('S-20: el actual solo cuenta materias con nota; el asegurado, todas', () => {
    // Materia con 4,0 en la mitad (asegurado 2,0, 2 créditos) y otra sin notas (3 créditos).
    const p = promedioSemestre([materia(2, [400, null]), materia(3, [null])]);
    expect(textoNota(p.actual!, 'truncar')).toBe('4,0');
    expect(textoNota(p.asegurado!, 'truncar')).toBe('0,8'); // 2,0 × 2 / 5
  });

  it('S-21: sin materias o sin notas', () => {
    expect(promedioSemestre([])).toEqual({ actual: null, asegurado: null });
    expect(promedioSemestre([materia(3, [])]).actual).toBeNull();
  });

  it('el peso pendiente en porcentaje con hasta dos decimales', () => {
    expect(textoPeso(EJEMPLO.pendiente)).toBe('32');
    expect(textoPeso(calcularMateria(sinCortes([comp('Talleres', 2000, [300, null, null]), comp('Final', 8000, [])])).pendiente)).toBe('93,33');
  });
});
