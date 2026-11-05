// Humo rápido de las reglas puras, sin base de datos ni red. Ejecutar: npm run probar:reglas
import { validarConsulta, mencionaTareas } from '@/lib/reglas/consulta';
import { validarTamanoPdf } from '@/lib/reglas/documento';
import { esFechaISOValida } from '@/lib/reglas/fechas';
import { fragmentar } from '@/lib/reglas/fragmentacion';
import { calcularIndice } from '@/lib/reglas/productividad';
import { resolverPrioridad } from '@/lib/reglas/tarea';

const lanza = (fn: () => unknown, codigo: string): boolean => {
  try {
    fn();
    return false;
  } catch (e) {
    return (e as { codigo?: string }).codigo === codigo;
  }
};
const mil = Array.from({ length: 1200 }, (_, i) => `p${i}`).join(' ');

const casos: Array<[string, boolean]> = [
  ['T-01 PDF de 15.728.640 bytes pasa', !lanza(() => validarTamanoPdf(15_728_640), 'ARCHIVO_MUY_GRANDE')],
  ['T-02 PDF de 15.728.641 bytes se rechaza', lanza(() => validarTamanoPdf(15_728_641), 'ARCHIVO_MUY_GRANDE')],
  ['T-03 "Mi agenda" pasa', !lanza(() => validarConsulta('Mi agenda'), 'CONSULTA_MUY_CORTA')],
  ['T-04 "Agenda" se rechaza', lanza(() => validarConsulta('Agenda'), 'CONSULTA_MUY_CORTA')],
  ['T-05 "Hola tú" se rechaza', lanza(() => validarConsulta('Hola tú'), 'CONSULTA_MUY_CORTA')],
  ['T-08 prioridad por defecto 2', resolverPrioridad(undefined) === 2],
  ['T-10 prioridad 5 se rechaza', lanza(() => resolverPrioridad(5), 'PRIORIDAD_INVALIDA')],
  ['T-13 fecha 2026-02-30 inválida', !esFechaISOValida('2026-02-30')],
  ['T-19 menciona tareas', mencionaTareas('¿Qué tareas tengo pendientes?')],
  ['T-21 1200 palabras → 3 fragmentos', fragmentar(mil).length === 3],
  ['T-24 índice 86.0 Excelente', calcularIndice({ completadas: 4, totales: 5, minutos: 120 }).nivel === 'Excelente'],
  ['T-27 79.93 → 79.9 Aceptable', calcularIndice({ completadas: 999, totales: 1000, minutos: 40 }).puntos === 79.9],
];

let fallas = 0;
for (const [nombre, ok] of casos) {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}`);
}
console.log(`\n${casos.length - fallas}/${casos.length} correctos`);
process.exit(fallas ? 1 : 0);
