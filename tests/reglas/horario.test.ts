// @vitest-environment node
// RB-34 (E06b): horario opcional de una tarea, en 24 horas.
import { describe, expect, it } from 'vitest';
import { MENSAJES } from '@/lib/reglas/errores';
import { compararPorHorario, formatearHora, formatearHorario, validarHorario } from '@/lib/reglas/horario';
import { tareasPorDia } from '@/lib/reglas/semana';
import { esperarCodigo } from './ayudas';

describe('RB-34: horario', () => {
  it('ambas vacías → sin horario; solo inicio vale; inicio y fin valen', () => {
    expect(validarHorario('', '')).toEqual({ horaInicio: null, horaFin: null });
    expect(validarHorario(undefined, null)).toEqual({ horaInicio: null, horaFin: null });
    expect(validarHorario('08:00', '')).toEqual({ horaInicio: '08:00', horaFin: null });
    expect(validarHorario('08:00', '09:30')).toEqual({ horaInicio: '08:00', horaFin: '09:30' });
  });

  it('acepta horas sin cero y con segundos (como las devuelve Postgres)', () => {
    expect(validarHorario('8:5', '08:30:00')).toEqual({ horaInicio: '08:05', horaFin: '08:30' });
  });

  it('fin sin inicio, fin antes o igual al inicio y horas imposibles: mensajes exactos', () => {
    esperarCodigo(() => validarHorario('', '09:00'), 'HORA_FIN_SIN_INICIO');
    esperarCodigo(() => validarHorario('10:00', '09:30'), 'HORA_FIN_ANTES');
    esperarCodigo(() => validarHorario('10:00', '10:00'), 'HORA_FIN_ANTES');
    esperarCodigo(() => validarHorario('25:00', ''), 'HORA_INVALIDA');
    esperarCodigo(() => validarHorario('08:60', ''), 'HORA_INVALIDA');
    esperarCodigo(() => validarHorario('ocho', ''), 'HORA_INVALIDA');
    expect(MENSAJES.HORA_FIN_SIN_INICIO).toBe('La hora de fin necesita una hora de inicio.');
    expect(MENSAJES.HORA_FIN_ANTES).toBe('La hora de fin debe ser después de la de inicio.');
    expect(MENSAJES.HORA_INVALIDA).toBe('La hora debe tener formato HH:MM de 24 horas.');
  });

  it('formato de 24 horas, sin cero a la izquierda en la hora', () => {
    expect(formatearHora('08:00')).toBe('8:00');
    expect(formatearHora('14:30')).toBe('14:30');
    expect(formatearHorario({ horaInicio: '08:00', horaFin: '09:30' })).toBe('8:00 – 9:30');
    expect(formatearHorario({ horaInicio: '21:00', horaFin: null })).toBe('21:00');
    expect(formatearHorario({ horaInicio: null, horaFin: null })).toBe('');
  });

  it('orden del día: primero con hora (por inicio y fin), después sin hora (por prioridad y título)', () => {
    const t = (titulo: string, prioridad: number, horaInicio: string | null = null, horaFin: string | null = null) => ({
      titulo, prioridad, horaInicio, horaFin, fechaLimite: '2026-11-07', id: titulo, estado: 'Pendiente',
    });
    const lista = [t('sin hora baja', 1), t('tarde', 1, '15:00'), t('sin hora alta', 3), t('mañana larga', 2, '08:00', '10:00'), t('mañana corta', 2, '08:00', '08:30')];
    expect([...lista].sort(compararPorHorario).map((x) => x.titulo)).toEqual(['mañana corta', 'mañana larga', 'tarde', 'sin hora alta', 'sin hora baja']);
    expect(tareasPorDia(lista, ['2026-11-07'])['2026-11-07']?.map((x) => x.titulo)).toEqual([
      'mañana corta', 'mañana larga', 'tarde', 'sin hora alta', 'sin hora baja',
    ]);
  });
});
