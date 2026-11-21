// E20b (commit 2): textos del Inicio nuevo (saludo, fecha con semana y tarjetas de números).
import { describe, expect, it } from 'vitest';
import {
  diferenciaTiempo,
  fechaConSemana,
  horaBogota,
  partesTiempo,
  resumenDelDia,
  saludo,
  semanaIso,
  textoFaltan,
  textoTareasHoy,
  textoTiempo,
  textoVencida,
} from '@/lib/reglas/inicio';
import { coloresDelDia, diaInicialSemana } from '@/lib/reglas/semana';
import { detalleCelebracion } from '@/lib/celebracion';
import { descripcionVacio } from '@/lib/reglas/vistasTareas';

describe('Tareas (E20b, commit 3): textos', () => {
  it('la línea de la celebración', () => {
    expect(detalleCelebracion({ titulo: ' Ensayo ', minutos: 0 })).toBe('Ensayo');
    expect(detalleCelebracion({ titulo: 'Ensayo', minutos: 125 })).toBe('Ensayo · 2 h 5 min');
  });
  it('cada vista vacía tiene su línea amable', () => {
    expect(descripcionVacio('vencidas')).toBe('Vas al día con tus fechas límite.');
    expect(descripcionVacio('hoy')).toBe('Hoy no vence nada. Buen momento para adelantar algo.');
  });
});

describe('Inicio: saludo y fecha', () => {
  it('saludo según la hora de Bogotá', () => {
    expect([0, 11, 12, 18, 19, 23].map(saludo)).toEqual(['Buenos días', 'Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches', 'Buenas noches']);
    expect(horaBogota(new Date('2026-11-21T04:30:00Z'))).toBe(23); // en UTC ya es el 21 a las 4:30
  });

  it('semana ISO 8601 (la del primer jueves es la 1)', () => {
    expect(semanaIso('2026-11-21')).toBe(47);
    expect(semanaIso('2026-11-16')).toBe(47);
    expect(semanaIso('2026-01-01')).toBe(1);
    expect(semanaIso('2026-12-31')).toBe(53);
    expect(semanaIso('2027-01-03')).toBe(53);
    expect(semanaIso('2027-01-04')).toBe(1);
    expect(semanaIso('2021-01-03')).toBe(53);
  });

  it('la fecha larga con la semana', () => {
    expect(fechaConSemana('2026-11-21')).toBe('Sábado 21 de noviembre · semana 47');
  });

  it('un resumen corto del día', () => {
    expect(resumenDelDia(2, 1)).toBe('Hoy tienes 2 tareas pendientes y 1 vencida.');
    expect(resumenDelDia(1, 0)).toBe('Hoy tienes 1 tarea pendiente.');
    expect(resumenDelDia(0, 3)).toBe('Hoy no tienes tareas pendientes, pero tienes 3 vencidas.');
    expect(resumenDelDia(0, 0)).toBe('Hoy no tienes tareas pendientes.');
  });
});

describe('Mi semana: día inicial y puntos (pedido del usuario)', () => {
  const dias = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
  it('hoy en su semana; en otra, el primer día con tareas o el lunes', () => {
    expect(diaInicialSemana(dias, '2026-11-25', () => 0)).toBe('2026-11-25');
    expect(diaInicialSemana(dias, '2026-11-21', (d) => (d >= '2026-11-26' ? 1 : 0))).toBe('2026-11-26');
    expect(diaInicialSemana(dias, '2026-11-21', () => 0)).toBe('2026-11-23');
  });
  it('colores sin repetir, hasta 3', () => {
    expect(coloresDelDia(['azul', 'azul', 'verde', 'rosa', 'gris'])).toEqual(['azul', 'verde', 'rosa']);
    expect(coloresDelDia([])).toEqual([]);
  });
});

describe('Inicio: tarjetas de números', () => {
  it('tareas de hoy', () => {
    expect(textoTareasHoy(0, 0, 0)).toBe('Nada para hoy');
    expect(textoTareasHoy(3, 0, 0)).toBe('Todas completadas');
    expect(textoTareasHoy(3, 2, 1)).toBe('2 pendientes · 1 con horario');
    expect(textoTareasHoy(1, 1, 0)).toBe('1 pendiente');
  });

  it('la vencida más antigua y desde cuándo', () => {
    expect(textoVencida(null, '2026-11-21')).toBe('Ninguna, vas al día');
    expect(textoVencida({ titulo: 'Ensayo', fecha: '2026-11-20' }, '2026-11-21')).toBe('Ensayo, desde ayer');
    expect(textoVencida({ titulo: 'Ensayo', fecha: '2026-11-17' }, '2026-11-21')).toBe('Ensayo, desde el martes 17');
    expect(textoVencida({ titulo: 'Ensayo', fecha: '2026-11-02' }, '2026-11-21')).toBe('Ensayo, desde el 2 de noviembre');
  });

  it('tiempo en horas y minutos, y la diferencia con la semana pasada hasta el mismo día', () => {
    expect(partesTiempo(400)).toEqual({ horas: 6, minutos: 40 });
    expect([0, 45, 120, 400].map(textoTiempo)).toEqual(['0 min', '45 min', '2 h', '6 h 40 min']);
    expect(diferenciaTiempo(0, 0)).toBeNull();
    expect(diferenciaTiempo(400, 330)).toEqual({ texto: '+1 h 10 min', tono: 'sube' });
    expect(diferenciaTiempo(100, 120)).toEqual({ texto: '−20 min', tono: 'baja' });
    expect(diferenciaTiempo(60, 60)).toEqual({ texto: 'Igual', tono: 'igual' });
  });

  it('bajo el anillo: cuánto falta (cambio pedido en la presentación)', () => {
    expect(textoFaltan(0, 0)).toBeNull();
    expect(textoFaltan(4, 1)).toBe('Faltan 3');
    expect(textoFaltan(4, 3)).toBe('Falta 1');
    expect(textoFaltan(4, 4)).toBe('Semana completa');
  });
});

describe('Calendario (E20b, commit 4): próximos', () => {
  it('desde hoy, por fecha; el mismo día Semestre primero y las tareas por hora; sin completadas; hasta 5', async () => {
    const { proximosDelCalendario } = await import('@/lib/reglas/calendario');
    const t = (id: string, fechaLimite: string, extra: Record<string, unknown> = {}) => ({ id, titulo: id, categoria: 'Casa', estado: 'Pendiente', fechaLimite, horaInicio: null, ...extra });
    const r = proximosDelCalendario(
      [t('ayer', '2026-11-20'), t('tarde', '2026-11-21', { horaInicio: '18:00' }), t('mañana', '2026-11-21', { horaInicio: '08:00' }), t('hecha', '2026-11-22', { estado: 'Completada' }), t('d', '2026-11-23'), t('e', '2026-11-24'), t('f', '2026-11-25')],
      [{ id: 'c', tipo: 'corte', fecha: '2026-11-21', titulo: 'Corte', materiaId: 'm' }],
      '2026-11-21',
    );
    expect(r.map((p) => p.id)).toEqual(['c', 'mañana', 'tarde', 'd', 'e']);
  });
});
