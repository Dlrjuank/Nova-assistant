// E12 (PLAN_AMPLIACION 7.2 a 7.4, RB-05 a RB-10, RB-13, RB-35): S-01 a S-12b.
import { describe, expect, it } from 'vitest';
import {
  aNumero,
  aprueba,
  avisoDeComponentes,
  avisoDeCortes,
  calcularCorte,
  calcularMateria,
  cortesAlDividir,
  estadoDe,
  fraccion,
  maximoAlcanzable,
  mostrar,
  puedeQuitarCortes,
  textoNota,
  validarCreditos,
  validarNombreMateria,
  validarNota,
  validarPorcentaje,
  type ComponenteEntrada,
  type MateriaEntrada,
} from '@/lib/reglas/notas';

describe('S-01 a S-06: nota mostrada y aprobar (7.2)', () => {
  it.each([
    ['S-01: 2,96 truncar → 2,9, no aprueba con 3,0', 296, 'truncar', 29, false],
    ['S-02: 2,95 redondear → 3,0, aprueba', 295, 'redondear', 30, true],
    ['S-03: 3,04 truncar → 3,0, aprueba', 304, 'truncar', 30, true],
    ['S-04: 2,94 redondear → 2,9', 294, 'redondear', 29, false],
    ['S-05: 5,0 → 5,0', 500, 'truncar', 50, true],
    ['S-06: 0 → 0,0', 0, 'redondear', 0, false],
  ] as const)('%s', (_, x, redondeo, decimas, apruebaCon3) => {
    expect(mostrar(x, redondeo)).toBe(decimas);
    expect(aprueba(x, 300, redondeo)).toBe(apruebaCon3);
  });

  it('con fracciones exactas: 2,999… truncar sigue siendo 2,9; 2,95 exacto redondea a 3,0', () => {
    expect(mostrar(fraccion(2999, 10), 'truncar')).toBe(29);
    expect(mostrar(fraccion(590, 2), 'redondear')).toBe(30);
    expect(mostrar(fraccion(2949, 10), 'redondear')).toBe(29);
    expect(textoNota(fraccion(256 * 100, 68), 'truncar')).toBe('3,7');
  });

  it('una nota para aprobar con centésimas se compara con lo mostrado', () => {
    expect(aprueba(330, 325, 'truncar')).toBe(true);
    expect(aprueba(329, 325, 'truncar')).toBe(false); // se ve 3,2
  });
});

const comp = (nombre: string, porcentaje: number, notas: Array<number | null>): ComponenteEntrada => ({ nombre, porcentaje, notas });
const sinCortes = (componentes: ComponenteEntrada[]): MateriaEntrada => ({ usaCortes: false, cortes: [{ nombre: 'Corte único', porcentaje: 10000, componentes }] });

/** El ejemplo hecho a mano de 7.4. */
const EJEMPLO = sinCortes([
  comp('Parcial', 4000, [350]),
  comp('Talleres', 2000, [400, 440]),
  comp('Quizzes', 2000, [300, 500, null, null, null]),
  comp('Actividades', 2000, []),
]);

describe('S-07 a S-12b: componentes y cortes (7.3, 7.4)', () => {
  it('S-07: un componente con 2 de 5 notas calificadas: lo que falta no cuenta como 0', () => {
    const c = calcularMateria(sinCortes([comp('Quizzes', 10000, [300, 500, null, null, null])]));
    expect(textoNota(c.actual!, 'truncar')).toBe('4,0'); // (3 + 5) / 2
    expect(aNumero(c.calificado)).toBeCloseTo(0.4);
    expect(aNumero(c.pendiente)).toBeCloseTo(0.6);
    expect(c.definitiva).toBe(false);
  });

  it('S-08: un componente sin notas queda pendiente completo', () => {
    const c = calcularMateria(sinCortes([comp('Parcial', 6000, [400]), comp('Final', 4000, [])]));
    expect(aNumero(c.pendiente)).toBeCloseTo(0.4);
    expect(textoNota(c.actual!, 'truncar')).toBe('4,0');
    expect(textoNota(c.asegurado, 'truncar')).toBe('2,4');
  });

  it('S-09: sin notas, RB-13 (sin nota actual ni estado)', () => {
    const c = calcularMateria(sinCortes([comp('Parcial', 10000, [null, null])]));
    expect(c.actual).toBeNull();
    expect(estadoDe(c, 300, 'truncar')).toBeNull();
  });

  it('S-10: la materia completa da la definitiva: Aprobada o Reprobada', () => {
    const bien = calcularMateria(sinCortes([comp('Parcial', 5000, [300]), comp('Final', 5000, [310])]));
    expect(bien.definitiva).toBe(true);
    expect(textoNota(bien.actual!, 'truncar')).toBe('3,0'); // 3,05
    expect(estadoDe(bien, 300, 'truncar')).toBe('Aprobada');
    const mal = calcularMateria(sinCortes([comp('Parcial', 5000, [290]), comp('Final', 5000, [300])]));
    expect(estadoDe(mal, 300, 'truncar')).toBe('Reprobada'); // 2,95 truncado: 2,9
    expect(estadoDe(mal, 300, 'redondear')).toBe('Aprobada'); // redondeado: 3,0
  });

  it('S-11: con cortes, la nota de cada corte y la de la materia', () => {
    const m: MateriaEntrada = {
      usaCortes: true,
      cortes: [
        { nombre: 'Corte 1', porcentaje: 3000, componentes: [comp('Parcial', 10000, [400])] },
        { nombre: 'Corte 2', porcentaje: 3000, componentes: [comp('Parcial', 6000, [200]), comp('Taller', 4000, [500])] },
        { nombre: 'Corte 3', porcentaje: 4000, componentes: [comp('Final', 10000, [])] },
      ],
    };
    expect(textoNota(calcularCorte(m.cortes[0]!).actual!, 'truncar')).toBe('4,0');
    expect(textoNota(calcularCorte(m.cortes[1]!).actual!, 'truncar')).toBe('3,2'); // 2 × 0,6 + 5 × 0,4
    const c = calcularMateria(m);
    expect(textoNota(c.actual!, 'truncar')).toBe('3,6'); // (4 × 0,3 + 3,2 × 0,3) / 0,6
    expect(aNumero(c.pendiente)).toBeCloseTo(0.4);
    expect(estadoDe(c, 300, 'truncar')).toBe('Aprueba');
  });

  it('S-12: el ejemplo de 7.4: 3,7 actual y 2,5 asegurado, con un peso no exacto (20 % / 3) sin error', () => {
    const c = calcularMateria(EJEMPLO);
    expect(c.actual).toEqual(fraccion(25600, 68)); // 256 / 68 exacto
    expect(textoNota(c.actual!, 'truncar')).toBe('3,7');
    expect(textoNota(c.asegurado, 'truncar')).toBe('2,5');
    expect(c.pendiente).toEqual(fraccion(32, 100));
    expect(estadoDe(c, 300, 'truncar')).toBe('Aprueba');
    expect(textoNota(maximoAlcanzable(c), 'truncar')).toBe('4,1'); // 7.5: 2,56 + 5,0 × 0,32 = 4,16
    // Un tercio exacto: 3 notas en un componente de 20 %.
    const tercios = calcularMateria(sinCortes([comp('Talleres', 2000, [300, 400, null]), comp('Final', 8000, [])]));
    expect(tercios.calificado).toEqual(fraccion(2, 15)); // 2 × 20 % / 3
    expect(textoNota(tercios.actual!, 'truncar')).toBe('3,5');
  });

  it('En riesgo y No alcanza según lo que aún se puede ganar', () => {
    const riesgo = calcularMateria(sinCortes([comp('Parcial', 5000, [200]), comp('Final', 5000, [])]));
    expect(estadoDe(riesgo, 300, 'truncar')).toBe('En riesgo'); // con 4,0 en el final llega a 3,0
    const imposible = calcularMateria(sinCortes([comp('Parcial', 8000, [50]), comp('Final', 2000, [])]));
    expect(estadoDe(imposible, 300, 'truncar')).toBe('No alcanza'); // máximo 0,4 + 1,0 = 1,4
  });

  it('S-12b: porcentajes que no suman 100 % dan la nota actual con el aviso, sin estado', () => {
    const componentes90 = sinCortes([comp('Parcial', 5000, [400]), comp('Taller', 4000, [300])]);
    const c = calcularMateria(componentes90);
    expect(c.sumasOk).toBe(false);
    expect(textoNota(c.actual!, 'truncar')).toBe('3,5');
    expect(estadoDe(c, 300, 'truncar')).toBeNull();
    expect(avisoDeComponentes(componentes90.cortes[0]!, false)).toBe('Los porcentajes de los componentes suman 90 %; deben sumar 100 %.');

    const cortes90: MateriaEntrada = {
      usaCortes: true,
      cortes: [
        { nombre: 'Corte 1', porcentaje: 3000, componentes: [comp('Parcial', 10000, [400])] },
        { nombre: 'Corte 2', porcentaje: 6000, componentes: [comp('Parcial', 7550, [400])] },
      ],
    };
    expect(estadoDe(calcularMateria(cortes90), 300, 'truncar')).toBeNull();
    expect(avisoDeCortes(cortes90)).toBe('Los porcentajes de los cortes suman 90 %; deben sumar 100 %.');
    expect(avisoDeComponentes(cortes90.cortes[1]!, true)).toBe('Los porcentajes de los componentes de Corte 2 suman 75,5 %; deben sumar 100 %.');
    expect(avisoDeComponentes(cortes90.cortes[0]!, true)).toBeNull();
    expect(avisoDeCortes(EJEMPLO)).toBeNull(); // sin cortes no hay aviso de cortes
  });

  it('un corte sin componentes no da aviso, pero tampoco estado', () => {
    const m = sinCortes([]);
    expect(avisoDeComponentes(m.cortes[0]!, false)).toBeNull();
    expect(calcularMateria(m).sumasOk).toBe(false);
  });
});

describe('validaciones (RB-05 a RB-10) y cortes (RB-35)', () => {
  it('RB-06: créditos enteros de 1 a 10', () => {
    expect(validarCreditos('3')).toBe(3);
    expect(validarCreditos(10)).toBe(10);
    for (const malo of ['0', '11', '2,5', 'tres', '', 2.5]) expect(() => validarCreditos(malo)).toThrow('Los créditos deben ser un número entero entre 1 y 10.');
  });

  it('RB-09: nota de 0,0 a 5,0 con hasta dos decimales; vacía es "sin nota"', () => {
    expect(validarNota('3,75')).toBe(375);
    expect(validarNota('4.5')).toBe(450);
    expect(validarNota('5')).toBe(500);
    expect(validarNota('')).toBeNull();
    expect(validarNota(null)).toBeNull();
    for (const malo of ['5,5', '5,01', '-1', '3,755', 'x', 501]) expect(() => validarNota(malo)).toThrow('La nota debe estar entre 0,0 y 5,0.');
  });

  it('RB-10: porcentaje mayor que 0 y hasta 100, con hasta dos decimales', () => {
    expect(validarPorcentaje('40')).toBe(4000);
    expect(validarPorcentaje('33,33')).toBe(3333);
    expect(validarPorcentaje('100')).toBe(10000);
    for (const malo of ['0', '100,01', '101', '-5', '1,234', '']) expect(() => validarPorcentaje(malo)).toThrow('El porcentaje debe ser mayor que 0 y como máximo 100.');
  });

  it('nombre de materia de 1 a 80 caracteres, sin espacios de más', () => {
    expect(validarNombreMateria('  Cálculo   I ')).toBe('Cálculo I');
    expect(() => validarNombreMateria('   ')).toThrow();
    expect(() => validarNombreMateria('x'.repeat(81))).toThrow();
  });

  it('dividir en cortes sigue la plantilla de Configuración; RB-35 solo con uno', () => {
    expect(cortesAlDividir([3000, 3000, 4000])).toEqual([
      { orden: 1, nombre: 'Corte 1', porcentaje: 3000 },
      { orden: 2, nombre: 'Corte 2', porcentaje: 3000 },
      { orden: 3, nombre: 'Corte 3', porcentaje: 4000 },
    ]);
    expect(cortesAlDividir([10000])).toHaveLength(2); // con una plantilla de un solo corte, se divide en 2 mitades
    expect(puedeQuitarCortes(1)).toBe(true);
    expect(puedeQuitarCortes(2)).toBe(false);
  });
});
