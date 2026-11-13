import type { Tema } from '@/lib/tema';
import { ErrorDeNegocio } from './errores';

/**
 * E11 (PLAN_AMPLIACION 5.8, 6.3; RB-11, RB-26, RB-27): preferencias del usuario. Funciones puras, compartidas por
 * el servidor y el navegador. La nota y los porcentajes se guardan en centésimas para no arrastrar decimales
 * binarios: 3,00 → 300; 30 % → 3000.
 */

export type { Tema };
export type FormatoHora = '24' | '12';
export type Redondeo = 'truncar' | 'redondear';

export interface Preferencias {
  tema: Tema;
  formatoHora: FormatoHora;
  /** Centésimas: 300 = 3,00. */
  notaAprobar: number;
  redondeo: Redondeo;
  /** Centésimas de punto porcentual: 3000 = 30 %. */
  cortesDefecto: number[];
  /** E11c: "HH:MM", la hora de los recordatorios de las tareas sin horario. */
  horaRecordatorio: string;
  /** E11d (RB-46): resumen diario por notificación, apagado por defecto. */
  resumenDiario: boolean;
  /** E11d: "HH:MM", la hora del resumen. */
  horaResumen: string;
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  tema: 'automatico',
  formatoHora: '24',
  notaAprobar: 300,
  redondeo: 'truncar',
  cortesDefecto: [3000, 3000, 4000],
  horaRecordatorio: '08:00',
  resumenDiario: false,
  horaResumen: '07:00',
};

export const MAX_CORTES = 6;
export const MAX_NOMBRE = 80;

/** "3", "3,5", "3.25" o "100" → centésimas; null si no es un número con hasta dos decimales. */
export function aCentesimas(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpio)) return null;
  const [entero, decimales = ''] = limpio.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0'));
}

/** 300 → "3,0"; 325 → "3,25" (nota, con al menos un decimal). */
export function formatearNota(centesimas: number): string {
  const entero = Math.trunc(centesimas / 100);
  const resto = String(centesimas % 100).padStart(2, '0');
  return `${entero},${resto.endsWith('0') ? resto[0] : resto}`;
}

/** 3000 → "30"; 3333 → "33,33"; 2550 → "25,5" (porcentaje, sin decimales de más). */
export function formatearPorcentaje(centesimas: number): string {
  const entero = Math.trunc(centesimas / 100);
  const resto = centesimas % 100;
  if (resto === 0) return String(entero);
  const texto = String(resto).padStart(2, '0');
  return `${entero},${texto.endsWith('0') ? texto[0] : texto}`;
}

/** RB-26: nombre recortado, de 1 a 80 caracteres. */
export function validarNombrePerfil(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length < 1 || limpio.length > MAX_NOMBRE) throw new ErrorDeNegocio('NOMBRE_PERFIL_INVALIDO');
  return limpio;
}

/** RB-11: nota para aprobar de 0,0 a 5,0, con hasta dos decimales. Acepta el texto del campo o centésimas. */
export function validarNotaAprobar(valor: string | number): number {
  const centesimas = typeof valor === 'number' ? valor : aCentesimas(valor);
  if (centesimas === null || !Number.isInteger(centesimas) || centesimas < 0 || centesimas > 500) throw new ErrorDeNegocio('NOTA_APROBAR_INVALIDA');
  return centesimas;
}

/**
 * Cortes por defecto (5.8): de 1 a 6, cada porcentaje mayor que 0 y como máximo 100 (RB-10), y aquí sí deben
 * sumar 100 % para guardar (es la plantilla que se propone al dividir una materia en cortes).
 */
export function validarCortesDefecto(valores: ReadonlyArray<string | number>): number[] {
  if (valores.length < 1 || valores.length > MAX_CORTES) throw new ErrorDeNegocio('DATOS_INVALIDOS');
  const cortes = valores.map((v) => {
    const c = typeof v === 'number' ? v : aCentesimas(v);
    if (c === null || !Number.isInteger(c) || c <= 0 || c > 10000) throw new ErrorDeNegocio('PORCENTAJE_INVALIDO');
    return c;
  });
  const suma = cortes.reduce((a, b) => a + b, 0);
  if (suma !== 10000) throw new ErrorDeNegocio('CORTES_NO_SUMAN', mensajeCortesNoSuman(suma));
  return cortes;
}

/** El texto de RB-07, aquí como error porque la plantilla debe sumar 100 %. */
export function mensajeCortesNoSuman(sumaCentesimas: number): string {
  return `Los porcentajes de los cortes suman ${formatearPorcentaje(sumaCentesimas)} %; deben sumar 100 %.`;
}

/** RB-25: textos exactos de borrar el historial del asistente. */
export const CONFIRMAR_BORRAR_HISTORIAL = 'Se borrará todo tu historial con el asistente. No se puede deshacer.';
export const HISTORIAL_BORRADO = 'Se borró tu historial con el asistente.';
