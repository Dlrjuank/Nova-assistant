// E20 (5.7, 7.4, 7.7; B-40): los datos de Estadísticas.
import { describe, expect, it } from 'vitest';
import { calcularEstadisticas, esPerdida, textoEnRiesgo, type MateriaParaEstadisticas } from '@/lib/reglas/estadisticas';

const comp = (porcentaje: number, notas: Array<number | null>) => ({ nombre: `C${porcentaje}`, porcentaje, notas });
const corte = (nombre: string, porcentaje: number, componentes: ReturnType<typeof comp>[]) => ({ nombre, porcentaje, componentes });
const materia = (id: string, o: Partial<MateriaParaEstadisticas> & { cortes: ReturnType<typeof corte>[]; usaCortes?: boolean }): MateriaParaEstadisticas => ({
  id,
  nombre: o.nombre ?? id,
  creditos: o.creditos ?? 3,
  fallasLimite: o.fallasLimite ?? null,
  fallasRegistradas: o.fallasRegistradas ?? 0,
  entrada: { usaCortes: o.usaCortes ?? true, cortes: o.cortes },
});

const calculo = materia('calculo', {
  nombre: 'Cálculo',
  cortes: [corte('Corte 1', 3000, [comp(10000, [420])]), corte('Corte 2', 3000, [comp(10000, [360])]), corte('Corte 3', 4000, [comp(10000, [null])])],
});
const fisica = materia('fisica', { nombre: 'Física', cortes: [corte('Corte 1', 5000, [comp(10000, [200])]), corte('Corte 2', 5000, [comp(10000, [null])])] }); // 2,0 y falta la mitad: en riesgo
const quimica = materia('quimica', { nombre: 'Química', cortes: [corte('Corte 1', 8000, [comp(10000, [100])]), corte('Corte 2', 2000, [comp(10000, [null])])] }); // máximo 1,8: no alcanza
const etica = materia('etica', { nombre: 'Ética', usaCortes: false, fallasLimite: 6, fallasRegistradas: 6, cortes: [corte('Corte único', 10000, [comp(10000, [450])])] });
const ingles = materia('ingles', { nombre: 'Inglés', usaCortes: false, fallasLimite: 5, fallasRegistradas: 4, cortes: [corte('Corte único', 10000, [comp(10000, [400, null])])] });
const arte = materia('arte', { nombre: 'Arte', usaCortes: false, cortes: [corte('Corte único', 10000, [])] });

describe('calcularEstadisticas (5.7)', () => {
  const d = calcularEstadisticas([calculo, fisica, quimica, etica, ingles, arte], 300, 'truncar');

  it('evolución: la nota de cada corte en décimas; un corte sin notas queda vacío, no en 0', () => {
    const c = d.materias.find((m) => m.id === 'calculo');
    expect(c?.cortes).toEqual([
      { nombre: 'Corte 1', porcentaje: 3000, nota: 42 },
      { nombre: 'Corte 2', porcentaje: 3000, nota: 36 },
      { nombre: 'Corte 3', porcentaje: 4000, nota: null },
    ]);
    expect(c?.actual).toBe(39);
    expect(d.materias.find((m) => m.id === 'etica')?.cortes).toEqual([]); // sin cortes: solo su nota actual
  });

  it('comparación: la nota actual de cada materia; sin notas, null; la línea de aprobar en décimas', () => {
    expect(d.materias.map((m) => [m.id, m.actual])).toEqual([
      ['calculo', 39],
      ['fisica', 20],
      ['quimica', 10],
      ['etica', 45],
      ['ingles', 40],
      ['arte', null],
    ]);
    expect(d.aprobar).toBe(30);
  });

  it('riesgo por nota (en riesgo, perdida) y por fallas (alerta, perdida), de la más grave a la menos grave', () => {
    expect(d.enRiesgo.map((m) => [m.nombre, m.estado])).toEqual([
      ['Ética', 'Perdida'], // perdida por fallas aunque aprueba por nota: primero
      ['Química', 'Perdida'],
      ['Física', 'En riesgo'],
      ['Inglés', 'Aprueba'], // le queda 1 falla
    ]);
    expect(d.enRiesgo.find((m) => m.id === 'etica')?.riesgo).toEqual([{ motivo: 'fallas', texto: 'Perdida por fallas: 6 de 6.' }]);
    expect(d.enRiesgo.find((m) => m.id === 'fisica')?.riesgo).toEqual([{ motivo: 'nota', texto: 'Por nota: hoy tienes 2,0 y aún puedes llegar a 3,0.' }]);
    expect(d.enRiesgo.find((m) => m.id === 'quimica')?.riesgo[0]?.texto).toBe('Perdida por nota: aunque saques 5,0 en lo que falta, llegas a 1,8 y necesitas 3,0.');
    expect(d.enRiesgo.find((m) => m.id === 'ingles')?.riesgo[0]?.texto).toBe('Por fallas: te queda 1 falla antes de perder la materia.');
    expect(d.enRiesgo.some((m) => m.id === 'calculo' || m.id === 'arte')).toBe(false);
  });

  it('una materia reprobada con todo calificado; el promedio por créditos; el redondeo de Configuración', () => {
    const reprobada = materia('r', { nombre: 'Reprobada', usaCortes: false, cortes: [corte('Corte único', 10000, [comp(10000, [250])])] });
    const r = calcularEstadisticas([reprobada], 300, 'truncar');
    expect(r.enRiesgo[0]).toMatchObject({ estado: 'Reprobada', riesgo: [{ motivo: 'nota', texto: 'Por nota: terminó con 2,5, por debajo de 3,0.' }] });
    const casi = materia('c', { usaCortes: false, cortes: [corte('Corte único', 10000, [comp(10000, [296])])] });
    expect(calcularEstadisticas([casi], 300, 'truncar').materias[0]?.actual).toBe(29);
    expect(calcularEstadisticas([casi], 300, 'redondear').materias[0]?.actual).toBe(30);
    expect(calcularEstadisticas([calculo, materia('x', { creditos: 1, usaCortes: false, cortes: [corte('Corte único', 10000, [comp(10000, [100])])] })], 300, 'truncar').promedio).toBe(31); // (3,9×3 + 1×1) / 4 = 3,175
  });

  it('textos del resumen', () => {
    expect([textoEnRiesgo(0, 0), textoEnRiesgo(1, 2), textoEnRiesgo(2, 0), textoEnRiesgo(0, 1)]).toEqual(['Ninguna materia en riesgo', '1 perdida · 2 en riesgo', '2 perdidas', '1 en riesgo']);
    expect(d.enRiesgo.filter(esPerdida).map((m) => m.nombre)).toEqual(['Ética', 'Química']);
  });
});
