// @vitest-environment node
// E20b (commit 2): los datos nuevos del Inicio (hoy, vencida más antigua, minutos de la semana, promedio y
// próximo corte con lo que necesitas).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), listarMaterias: vi.fn(), listarMetasNota: vi.fn(), preferencias: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar }));
vi.mock('@/lib/datos/semestre', () => ({ listarMaterias: m.listarMaterias, listarMetasNota: m.listarMetasNota }));
vi.mock('@/lib/datos/configuracion', () => ({ obtenerPreferencias: m.preferencias }));

import { resumenInicio } from '@/lib/datos/inicio';

const HOY = '2026-11-19'; // jueves; la semana va del 16 al 22, la pasada del 9 al 15
const materia = (id: string, nombre: string, cortes: unknown[], usaCortes = true) => ({ id, nombre, creditos: 3, docente: null, usaCortes, fallasLimite: null, fallasRegistradas: 0, cortes });
const corte = (id: string, orden: number, porcentaje: number, fecha: string | null, notas: Array<number | null>) => ({
  id,
  orden,
  nombre: `Corte ${orden}`,
  porcentaje,
  fecha,
  componentes: [{ id: `k${id}`, orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: notas.map((nota, i) => ({ id: `n${id}${i}`, orden: i + 1, nombre: null, nota, fecha: null })) }],
});

beforeEach(() => {
  vi.resetAllMocks();
  m.preferencias.mockResolvedValue({ notaAprobar: 300, redondeo: 'truncar' });
});

describe('resumenInicio', () => {
  it('reúne hoy, la vencida más antigua, los minutos y el próximo corte con la meta de la materia', async () => {
    m.consultar
      .mockResolvedValueOnce([{ full_name: 'Valentina Ruiz' }])
      .mockResolvedValueOnce([{ total: '3', pendientes: '2', con_horario: '1' }])
      .mockResolvedValueOnce([{ titulo: 'Ensayo', fecha: '2026-11-18' }])
      .mockResolvedValueOnce([
        { dia: '2026-11-10', minutos: '60' }, // semana pasada, antes del mismo día: cuenta
        { dia: '2026-11-14', minutos: '500' }, // semana pasada, después del mismo día (jueves 12): no cuenta
        { dia: '2026-11-16', minutos: '30' },
        { dia: '2026-11-19', minutos: '45' },
      ]);
    m.listarMaterias.mockResolvedValue([
      materia('a', 'Física', [corte('a1', 1, 5000, '2026-11-10', [300]), corte('a2', 2, 5000, '2026-11-27', [null])]),
      materia('b', 'Cálculo', [corte('b1', 1, 5000, '2026-11-01', [400]), corte('b2', 2, 5000, '2026-11-24', [null])]),
    ]);
    m.listarMetasNota.mockResolvedValue([{ materiaId: 'b', corteId: null, meta: 400 }]);
    const r = await resumenInicio('u1', HOY);
    expect(r.nombre).toBe('Valentina Ruiz');
    expect(r.hoy).toEqual({ total: 3, pendientes: 2, conHorario: 1 });
    expect(r.vencidaMasAntigua).toEqual({ titulo: 'Ensayo', fecha: '2026-11-18' });
    expect(r.minutosPorDia).toEqual([30, 0, 0, 45, 0, 0, 0]);
    expect(r.minutosHastaHoy).toBe(75);
    expect(r.minutosSemanaPasada).toBe(60);
    expect(r.promedio).toEqual({ actual: 35, asegurado: 17, materias: 2, aprobar: 30 });
    // El más próximo desde hoy es el 24 (Cálculo); su meta es 4,0: con 4,0 asegurado a la mitad, necesita 4,0.
    expect(r.proximoCorte).toEqual({ materiaId: 'b', materia: 'Cálculo', corte: 'Corte 2', fecha: '2026-11-24', porcentaje: 5000, texto: 'Necesitas al menos 4,0 en lo que falta para llegar a 4,0.' });
    expect(m.listarMetasNota).toHaveBeenCalledWith('u1', 'b');
    for (const [, valores] of m.consultar.mock.calls) expect(valores[0]).toBe('u1');
  });

  it('sin materias ni cortes próximos: sin promedio ni próximo corte; sin meta, la nota para aprobar', async () => {
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0, pendientes: 0, con_horario: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.listarMaterias.mockResolvedValue([]);
    const r = await resumenInicio('u1', HOY);
    expect(r).toMatchObject({ nombre: '', vencidaMasAntigua: null, minutosHastaHoy: 0, minutosSemanaPasada: 0, promedio: { actual: null, asegurado: null, materias: 0 }, proximoCorte: null });

    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0, pendientes: 0, con_horario: 0 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    m.listarMaterias.mockResolvedValue([materia('c', 'Arte', [corte('c1', 1, 10000, '2026-11-20', [200, null])], false)]);
    m.listarMetasNota.mockResolvedValue([]);
    const s = await resumenInicio('u1', HOY);
    expect(s.proximoCorte).toMatchObject({ corte: 'Corte 1', porcentaje: null });
    expect(s.proximoCorte?.texto).toContain('para llegar a 3,0');
  });
});
