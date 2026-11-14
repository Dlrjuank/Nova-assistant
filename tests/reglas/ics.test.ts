// E11d (5.10; RB-46, RB-47, S-50): el texto del resumen diario y el .ics de "Agregar a mi calendario".
import { describe, expect, it } from 'vitest';
import { AVISO_COPIA_CALENDARIO, disparoAlarma, escaparTexto, generarIcs, nombreArchivoIcs, plegarLinea } from '@/lib/reglas/ics';
import { momentoResumen, resumenPuedeLlegarHoy, textoResumen, validarHoraResumen } from '@/lib/reglas/recordatorios';

const AHORA = new Date('2026-11-13T20:05:09.123Z');
const lineas = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n');

describe('RB-46 · texto del resumen diario', () => {
  it('en singular o plural, y la parte en cero no se dice', () => {
    expect(textoResumen(3, 1)).toBe('Hoy: 3 tareas · 1 vencida');
    expect(textoResumen(1, 2)).toBe('Hoy: 1 tarea · 2 vencidas');
    expect(textoResumen(2, 0)).toBe('Hoy: 2 tareas');
    expect(textoResumen(1, 0)).toBe('Hoy: 1 tarea');
    expect(textoResumen(0, 1)).toBe('Hoy: 1 tarea vencida');
    expect(textoResumen(0, 4)).toBe('Hoy: 4 tareas vencidas');
  });

  it('sin tareas de hoy ni vencidas, no hay resumen', () => {
    expect(textoResumen(0, 0)).toBeNull();
  });

  it('la hora se valida y el momento es esa hora en Bogotá', () => {
    expect(validarHoraResumen('06:45')).toBe('06:45');
    for (const malo of ['6:45', '24:00', '07:60', '', 7, null]) expect(() => validarHoraResumen(malo)).toThrow();
    expect(momentoResumen('2026-11-20', '07:00').toISOString()).toBe('2026-11-20T12:00:00.000Z');
  });

  it('al guardar: llega hoy si la hora no pasó o pasó hace 30 min o menos', () => {
    const a_las_18_50 = new Date('2026-11-20T23:50:00Z');
    expect(resumenPuedeLlegarHoy('19:00', a_las_18_50)).toBe(true);
    expect(resumenPuedeLlegarHoy('18:20', a_las_18_50)).toBe(true);
    expect(resumenPuedeLlegarHoy('18:19', a_las_18_50)).toBe(false);
    expect(resumenPuedeLlegarHoy('07:00', a_las_18_50)).toBe(false);
  });
});

describe('S-50 · .ics válido: zona horaria, todo el día y alarma', () => {
  const conHorario = { id: 't1', titulo: 'Clase de cálculo', fechaLimite: '2026-11-20', horaInicio: '10:00', horaFin: '11:30', recordatorio: '15_min' as const };

  it('estructura RFC 5545: CRLF, VCALENDAR con VERSION y PRODID, un VEVENT con UID y DTSTAMP en UTC', () => {
    const ics = generarIcs(conHorario, { ahora: AHORA, dominio: 'nova.ejemplo' });
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    const l = lineas(ics);
    expect(l[0]).toBe('BEGIN:VCALENDAR');
    expect(l).toContain('VERSION:2.0');
    expect(l).toContain('PRODID:-//Nova Assistant//Tareas//ES');
    expect(l).toContain('UID:tarea-t1@nova.ejemplo');
    expect(l).toContain('DTSTAMP:20261113T200509Z');
    expect(l.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(l.at(-2)).toBe('END:VCALENDAR');
  });

  it('con horario: inicio y fin en America/Bogota, con su VTIMEZONE fija en −05:00', () => {
    const l = lineas(generarIcs(conHorario, { ahora: AHORA }));
    expect(l).toContain('DTSTART;TZID=America/Bogota:20261120T100000');
    expect(l).toContain('DTEND;TZID=America/Bogota:20261120T113000');
    expect(l).toContain('TZID:America/Bogota');
    expect(l).toContain('TZOFFSETFROM:-0500');
    expect(l).toContain('TZOFFSETTO:-0500');
  });

  it('con hora de inicio y sin fin, no hay DTEND (el evento dura cero)', () => {
    const l = lineas(generarIcs({ ...conHorario, horaFin: null }, { ahora: AHORA }));
    expect(l.some((x) => x.startsWith('DTEND'))).toBe(false);
  });

  it('sin horario: evento de todo el día (fecha y día siguiente), sin VTIMEZONE y libre', () => {
    const l = lineas(generarIcs({ id: 't2', titulo: 'Pagar', fechaLimite: '2026-12-31', recordatorio: null }, { ahora: AHORA }));
    expect(l).toContain('DTSTART;VALUE=DATE:20261231');
    expect(l).toContain('DTEND;VALUE=DATE:20270101');
    expect(l).toContain('TRANSP:TRANSPARENT');
    expect(l).not.toContain('BEGIN:VTIMEZONE');
  });

  it('la alarma sigue al recordatorio; sin recordatorio, sin alarma', () => {
    const l = lineas(generarIcs(conHorario, { ahora: AHORA }));
    const i = l.indexOf('BEGIN:VALARM');
    expect(l.slice(i, i + 5)).toEqual(['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Clase de cálculo', 'TRIGGER:-PT15M', 'END:VALARM']);
    expect(generarIcs({ ...conHorario, recordatorio: null }, { ahora: AHORA })).not.toContain('VALARM');
  });

  it('disparo: con horario cuenta desde el inicio; sin horario, la hora fija desde la medianoche del día', () => {
    expect(disparoAlarma('a_la_hora', true)).toBe('PT0S');
    expect(disparoAlarma('15_min', true)).toBe('-PT15M');
    expect(disparoAlarma('1_hora', true)).toBe('-PT1H');
    expect(disparoAlarma('1_dia', true)).toBe('-P1D');
    expect(disparoAlarma('a_la_hora', false, '08:00')).toBe('PT8H');
    expect(disparoAlarma('a_la_hora', false, '07:30')).toBe('PT7H30M');
    expect(disparoAlarma('1_dia', false, '08:00')).toBe('-PT16H');
    expect(disparoAlarma('1_dia', false, '00:00')).toBe('-P1D');
    expect(disparoAlarma('a_la_hora', false, '00:00')).toBe('PT0S');
  });

  it('la descripción lleva el enlace a la tarea y el aviso de que es una copia (RB-47)', () => {
    const ics = generarIcs(conHorario, { ahora: AHORA, enlace: 'https://nova.ejemplo/nova/tareas?tarea=t1' });
    expect(lineas(ics)).toContain('URL:https://nova.ejemplo/nova/tareas?tarea=t1');
    expect(ics.replace(/\r\n /g, '')).toContain(`DESCRIPTION:Tarea de Nova: https://nova.ejemplo/nova/tareas?tarea=t1\\n${escaparTexto(AVISO_COPIA_CALENDARIO)}`);
  });

  it('el título se escapa: comas, punto y coma, barra invertida y saltos de línea', () => {
    expect(escaparTexto('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    expect(lineas(generarIcs({ ...conHorario, titulo: 'Leer; cap. 1, 2' }, { ahora: AHORA }))).toContain('SUMMARY:Leer\\; cap. 1\\, 2');
  });

  it('las líneas largas se pliegan a 75 bytes sin partir una letra con tilde', () => {
    const larga = `SUMMARY:${'á'.repeat(60)}`;
    const plegada = plegarLinea(larga);
    for (const parte of plegada.split('\r\n')) expect(new TextEncoder().encode(parte).length).toBeLessThanOrEqual(75);
    expect(plegada.replace(/\r\n /g, '')).toBe(larga);
    const ics = generarIcs({ ...conHorario, titulo: 'x'.repeat(200) }, { ahora: AHORA });
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });

  it('nombre de archivo legible y seguro', () => {
    expect(nombreArchivoIcs('Pagar matrícula')).toBe('pagar-matricula.ics');
    expect(nombreArchivoIcs('"Examen" / Cálculo #2')).toBe('examen-calculo-2.ics');
    expect(nombreArchivoIcs('¿¡!?')).toBe('tarea.ics');
  });
});
