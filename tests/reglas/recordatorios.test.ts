// @vitest-environment node
// E11c (7.10, RB-43, RB-44): S-42 a S-49.
import { describe, expect, it } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import {
  decisionEnvio,
  estadoInicial,
  momentoRecordatorio,
  opcionesRecordatorio,
  recordatorioCompatible,
  rutaDeTarea,
  textoNotificacion,
  validarHoraRecordatorio,
  validarRecordatorio,
} from '@/lib/reglas/recordatorios';

/** Hora de Bogotá de un instante, como "2026-11-20 09:45". */
const bogota = (d: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

describe('S-42 · las 4 opciones con horario (desde la hora de inicio)', () => {
  it.each([
    ['a_la_hora', '2026-11-20 10:00'],
    ['15_min', '2026-11-20 09:45'],
    ['1_hora', '2026-11-20 09:00'],
    ['1_dia', '2026-11-19 10:00'],
  ] as const)('%s → %s', (recordatorio, esperado) => {
    expect(bogota(momentoRecordatorio({ recordatorio, fechaLimite: '2026-11-20', horaInicio: '10:00', horaFija: '08:00' }))).toBe(esperado);
  });

  it('el instante es el de Bogotá (UTC−5)', () => {
    expect(momentoRecordatorio({ recordatorio: 'a_la_hora', fechaLimite: '2026-11-20', horaInicio: '10:00' }).toISOString()).toBe('2026-11-20T15:00:00.000Z');
  });
});

describe('S-43 · las 2 opciones sin horario, a la hora fija', () => {
  it('"El mismo día" y "El día anterior" a las 8:00 por defecto', () => {
    expect(bogota(momentoRecordatorio({ recordatorio: 'a_la_hora', fechaLimite: '2026-11-20' }))).toBe('2026-11-20 08:00');
    expect(bogota(momentoRecordatorio({ recordatorio: '1_dia', fechaLimite: '2026-11-20' }))).toBe('2026-11-19 08:00');
  });

  it('con otra hora fija de Configuración', () => {
    expect(bogota(momentoRecordatorio({ recordatorio: 'a_la_hora', fechaLimite: '2026-11-20', horaFija: '18:30' }))).toBe('2026-11-20 18:30');
  });

  it('"15 min" y "1 hora" sin horario no se aceptan (RB-43)', () => {
    expect(() => validarRecordatorio('15_min', null)).toThrow(ErrorDeNegocio);
    expect(() => validarRecordatorio('1_hora', '')).toThrow('Ese recordatorio necesita la hora de inicio de la tarea.');
    expect(validarRecordatorio('1_dia', null)).toBe('1_dia');
    expect(validarRecordatorio('', '10:00')).toBeNull();
    expect(validarRecordatorio(null, '10:00')).toBeNull();
    expect(() => validarRecordatorio('2_dias', '10:00')).toThrow(ErrorDeNegocio);
  });

  it('las opciones del campo dependen de si hay horario', () => {
    expect(opcionesRecordatorio(true).map((o) => o.texto)).toEqual(['A la hora', '15 min antes', '1 hora antes', '1 día antes']);
    expect(opcionesRecordatorio(false, '08:00').map((o) => o.texto)).toEqual(['El mismo día, a las 8:00', 'El día anterior, a las 8:00']);
    expect(opcionesRecordatorio(false, '19:00', '12').map((o) => o.texto)).toEqual(['El mismo día, a las 7:00 p. m.', 'El día anterior, a las 7:00 p. m.']);
  });

  it('al quitar el horario, "15 min" vuelve a "Sin recordatorio"; "1 día" se queda', () => {
    expect(recordatorioCompatible('15_min', false)).toBe('');
    expect(recordatorioCompatible('1_dia', false)).toBe('1_dia');
    expect(recordatorioCompatible('15_min', true)).toBe('15_min');
  });

  it('la hora fija es HH:MM de 24 horas', () => {
    expect(validarHoraRecordatorio('07:30')).toBe('07:30');
    for (const malo of ['7:30', '24:00', '12:60', '', null]) expect(() => validarHoraRecordatorio(malo)).toThrow(ErrorDeNegocio);
  });
});

describe('S-44 a S-46 · cruces de medianoche, de mes y de año', () => {
  it('S-44: 15 min antes de las 00:10 es 23:55 del día anterior', () => {
    expect(bogota(momentoRecordatorio({ recordatorio: '15_min', fechaLimite: '2026-11-20', horaInicio: '00:10' }))).toBe('2026-11-19 23:55');
  });

  it('S-45: 1 día antes del 1 de diciembre es el 30 de noviembre; sin horario, igual', () => {
    expect(bogota(momentoRecordatorio({ recordatorio: '1_dia', fechaLimite: '2026-12-01', horaInicio: '07:00' }))).toBe('2026-11-30 07:00');
    expect(bogota(momentoRecordatorio({ recordatorio: '1_dia', fechaLimite: '2026-03-01' }))).toBe('2026-02-28 08:00');
  });

  it('S-46: 1 hora antes de las 00:30 del 1 de enero es el 31 de diciembre del año anterior', () => {
    expect(bogota(momentoRecordatorio({ recordatorio: '1_hora', fechaLimite: '2027-01-01', horaInicio: '00:30' }))).toBe('2026-12-31 23:30');
    expect(bogota(momentoRecordatorio({ recordatorio: '1_dia', fechaLimite: '2027-01-01' }))).toBe('2026-12-31 08:00');
  });
});

describe('S-47 · hora ya pasada', () => {
  it('al guardar, un momento pasado (o justo ahora) queda omitido; uno futuro, pendiente', () => {
    const ahora = new Date('2026-11-20T15:00:00Z');
    expect(estadoInicial(new Date('2026-11-20T14:59:00Z'), ahora)).toBe('omitido');
    expect(estadoInicial(ahora, ahora)).toBe('omitido');
    expect(estadoInicial(new Date('2026-11-20T15:01:00Z'), ahora)).toBe('pendiente');
  });
});

describe('S-48 · ventana de 30 minutos', () => {
  const momento = new Date('2026-11-20T15:00:00Z');
  it.each([
    ['un minuto antes', '2026-11-20T14:59:00Z', 'esperar'],
    ['a la hora', '2026-11-20T15:00:00Z', 'enviar'],
    ['30 min tarde', '2026-11-20T15:30:00Z', 'enviar'],
    ['31 min tarde (base pausada)', '2026-11-20T15:31:00Z', 'omitir'],
  ] as const)('%s → %s', (_caso, ahora, esperado) => {
    expect(decisionEnvio(momento, new Date(ahora))).toBe(esperado);
  });
});

describe('S-49 · texto exacto de RB-44', () => {
  const clase = { titulo: 'Clase', horaInicio: '10:00', horaFin: '11:00' };
  it.each([
    ['a_la_hora', 'Ahora: Clase (10:00 – 11:00)'],
    ['15_min', 'En 15 min: Clase (10:00 – 11:00)'],
    ['1_hora', 'En 1 hora: Clase (10:00 – 11:00)'],
    ['1_dia', 'Mañana: Clase (10:00 – 11:00)'],
  ] as const)('con horario, %s', (recordatorio, texto) => {
    expect(textoNotificacion({ ...clase, recordatorio })).toBe(texto);
  });

  it('sin horario: "Hoy" y "Mañana"; con solo inicio, solo esa hora; en 12 horas si así está Configuración', () => {
    expect(textoNotificacion({ titulo: 'Pagar', recordatorio: 'a_la_hora' })).toBe('Hoy: Pagar');
    expect(textoNotificacion({ titulo: 'Pagar', recordatorio: '1_dia' })).toBe('Mañana: Pagar');
    expect(textoNotificacion({ titulo: 'Cita', recordatorio: '15_min', horaInicio: '15:30' })).toBe('En 15 min: Cita (15:30)');
    expect(textoNotificacion({ ...clase, recordatorio: '15_min' }, '12')).toBe('En 15 min: Clase (10:00 a. m. – 11:00 a. m.)');
  });

  it('al tocarla abre Tareas con esa tarea', () => {
    expect(rutaDeTarea('abc')).toBe('/nova/tareas?tarea=abc');
  });
});
