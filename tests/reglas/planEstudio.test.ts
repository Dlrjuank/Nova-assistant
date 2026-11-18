// E18 (9.3, 9.4; RB-22, RB-23): reglas puras del plan de estudio. S-29 a S-32 y la edición manual.
import { describe, expect, it } from 'vitest';
import {
  armarSemanas,
  cambiosHuella,
  pasosDe,
  textoCambiosPlan,
  textoMinutos,
  textoSinFechaPlan,
  validarPlanGenerado,
  validarPlanManual,
  type Huella,
  type PasoConFecha,
} from '@/lib/reglas/planEstudio';

const HOY = '2026-11-17'; // martes
const CORTE = '2026-11-30';
const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const T3 = '33333333-3333-4333-8333-333333333333';

function contexto() {
  let n = 0;
  return {
    temas: new Map([
      ['T1', T1],
      ['T2', T2],
    ]),
    etiquetas: new Map([
      ['F1', 'syllabus.pdf · p. 2'],
      ['F2', 'libro.pdf · pp. 45–46'],
    ]),
    hoy: HOY,
    fechaCorte: CORTE,
    nuevoId: () => `id-${++n}`,
  };
}

const plan = (dias: unknown) => ({ dias });
const paso = (o: Record<string, unknown> = {}) => ({ titulo: 'Repasar límites', tema: 'T1', minutos: 45, fuentes: ['F1'], ...o });

describe('validar el plan del asistente (9.3, RB-22)', () => {
  it('S-32: un plan válido se acepta con ids del servidor, fuentes legibles y agrupado por semana (lunes a domingo)', () => {
    const r = validarPlanGenerado(
      plan([
        { fecha: '2026-11-24', pasos: [paso({ tema: 'T2', fuentes: ['F2', 'F1', 'F2'] })] },
        { fecha: '2026-11-17', pasos: [paso(), paso({ titulo: '  Ejercicios   de  límites ', minutos: 30, fuentes: [] })] },
        { fecha: CORTE, pasos: [paso({ titulo: 'Repaso general' })] },
      ]),
      contexto(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contenido.semanas.map((s) => s.inicio)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    expect(r.contenido.semanas[0]?.dias[0]?.pasos.map((p) => p.titulo)).toEqual(['Repasar límites', 'Ejercicios de límites']);
    const pasos = pasosDe(r.contenido);
    expect(pasos.map((p) => p.fecha)).toEqual(['2026-11-17', '2026-11-17', '2026-11-24', CORTE]);
    expect(new Set(pasos.map((p) => p.id)).size).toBe(4); // los pone el servidor, no el modelo
    expect(pasos[2]).toMatchObject({ tema_id: T2, fuentes: ['libro.pdf · pp. 45–46', 'syllabus.pdf · p. 2'] });
  });

  it('S-29: un tema que no es un confirmado entregado descarta el plan entero', () => {
    expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: [paso(), paso({ tema: 'T9' })] }]), contexto())).toMatchObject({ ok: false });
    expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: [paso({ tema: T1 })] }]), contexto())).toMatchObject({ ok: false }); // el id real no vale: solo las etiquetas
  });

  it('S-30: una fuente que no se entregó descarta el plan', () => {
    expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: [paso({ fuentes: ['F1', 'F7'] })] }]), contexto())).toMatchObject({ ok: false, motivo: expect.stringContaining('F7') });
  });

  it('S-31: una fecha antes de hoy, después del corte o mal escrita descarta el plan', () => {
    for (const fecha of ['2026-11-16', '2026-12-01', '2026-02-30', '17/11/2026', null]) {
      expect(validarPlanGenerado(plan([{ fecha, pasos: [paso()] }]), contexto()).ok).toBe(false);
    }
  });

  it('el esquema: título de 1 a 120, minutos enteros de 15 a 240, pasos y días; sin pasos o con más de 60, no', () => {
    const malos = [paso({ titulo: '   ' }), paso({ titulo: 'x'.repeat(121) }), paso({ minutos: 10 }), paso({ minutos: 241 }), paso({ minutos: 30.5 }), paso({ minutos: '30' }), paso({ fuentes: 'F1' })];
    for (const p of malos) expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: [p] }]), contexto()).ok).toBe(false);
    expect(validarPlanGenerado(plan([]), contexto()).ok).toBe(false);
    expect(validarPlanGenerado({ semanas: [] }, contexto()).ok).toBe(false);
    expect(validarPlanGenerado(null, contexto()).ok).toBe(false);
    expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: Array.from({ length: 61 }, () => paso()) }]), contexto()).ok).toBe(false);
    expect(validarPlanGenerado(plan([{ fecha: HOY, pasos: Array.from({ length: 60 }, () => paso()) }]), contexto()).ok).toBe(true);
  });
});

describe('editar el plan (9.4)', () => {
  const anteriores: PasoConFecha[] = [
    { id: 'p1', fecha: '2026-11-10', titulo: 'Ya pasó', tema_id: T3, minutos: 30, fuentes: ['syllabus.pdf · p. 2'] },
    { id: 'p2', fecha: '2026-11-20', titulo: 'Derivadas', tema_id: T1, minutos: 60, fuentes: [] },
  ];
  const ctx = (o: Partial<Parameters<typeof validarPlanManual>[1]> = {}) => ({ anteriores, temasConfirmados: new Set([T1, T2]), hoy: HOY, fechaCorte: CORTE, nuevoId: () => 'nuevo', ...o });

  it('cambia título y minutos, borra pasos y agrega uno con un tema confirmado; conserva fuentes, ids y lo que no se movió', () => {
    const c = validarPlanManual(
      [
        { id: 'p1', titulo: 'Ya pasó (hecho)', fecha: '2026-11-10', minutos: '45', temaId: T3 },
        { titulo: 'Nuevo', fecha: CORTE, minutos: 20, temaId: T2 },
      ],
      ctx(),
    );
    expect(pasosDe(c)).toEqual([
      { id: 'p1', fecha: '2026-11-10', titulo: 'Ya pasó (hecho)', tema_id: T3, minutos: 45, fuentes: ['syllabus.pdf · p. 2'] },
      { id: 'nuevo', fecha: CORTE, titulo: 'Nuevo', tema_id: T2, minutos: 20, fuentes: [] },
    ]);
  });

  it('una fecha nueva o cambiada va de hoy a la fecha del corte', () => {
    expect(() => validarPlanManual([{ id: 'p2', titulo: 'Derivadas', fecha: '2026-11-16', minutos: 60, temaId: T1 }], ctx())).toThrow('La fecha del paso debe estar entre hoy y la fecha del corte.');
    expect(() => validarPlanManual([{ titulo: 'x', fecha: '2026-12-01', minutos: 60, temaId: T1 }], ctx())).toThrow('La fecha del paso');
    expect(() => validarPlanManual([{ titulo: 'x', fecha: HOY, minutos: 60, temaId: T1 }], ctx({ fechaCorte: null }))).toThrow('La fecha del paso');
  });

  it('un tema nuevo o cambiado debe estar confirmado; el de un paso que no cambió se respeta', () => {
    expect(() => validarPlanManual([{ titulo: 'x', fecha: HOY, minutos: 60, temaId: T3 }], ctx())).toThrow('Elige un tema confirmado del corte.');
    expect(() => validarPlanManual([{ id: 'p2', titulo: 'Derivadas', fecha: '2026-11-20', minutos: 60, temaId: T3 }], ctx())).toThrow('Elige un tema confirmado');
  });

  it('título, minutos, sin pasos, demasiados, un id que no es de la versión o repetido', () => {
    expect(() => validarPlanManual([{ titulo: ' ', fecha: HOY, minutos: 60, temaId: T1 }], ctx())).toThrow('Escribe un paso de 1 a 120 caracteres.');
    expect(() => validarPlanManual([{ titulo: 'x', fecha: HOY, minutos: '300', temaId: T1 }], ctx())).toThrow('Los minutos van de 15 a 240.');
    expect(() => validarPlanManual([{ titulo: 'x', fecha: HOY, minutos: 'diez', temaId: T1 }], ctx())).toThrow('Los minutos van de 15 a 240.');
    expect(() => validarPlanManual([], ctx())).toThrow('El plan debe tener al menos un paso.');
    expect(() => validarPlanManual(Array.from({ length: 61 }, () => ({ titulo: 'x', fecha: HOY, minutos: 30, temaId: T1 })), ctx())).toThrow('como máximo 60 pasos');
    expect(() => validarPlanManual([{ id: 'otro', titulo: 'x', fecha: HOY, minutos: 30, temaId: T1 }], ctx())).toThrow();
    const p2 = { id: 'p2', titulo: 'x', fecha: '2026-11-20', minutos: 30, temaId: T1 };
    expect(() => validarPlanManual([p2, p2], ctx())).toThrow();
  });
});

describe('huella y aviso de cambios (9.4, RB-23)', () => {
  const base: Huella = { meta: 400, temas: [{ id: T1, nombre: 'Límites' }], notas: [{ id: 'n1', nota: 350 }, { id: 'n2', nota: null }], documentos: ['d1'] };

  it('sin cambios no avisa, aunque el orden sea otro', () => {
    expect(cambiosHuella({ ...base, notas: [...base.notas].reverse() }, base)).toEqual([]);
  });

  it('un PDF nuevo, notas nuevas, temas cambiados y meta cambiada, con el texto exacto', () => {
    const cambios = cambiosHuella(base, { meta: 450, temas: [{ id: T1, nombre: 'Límites y continuidad' }], notas: [...base.notas, { id: 'n3', nota: 420 }], documentos: ['d1', 'd2'] });
    expect(cambios).toEqual(['un PDF nuevo', 'notas nuevas', 'temas cambiados', 'meta cambiada']);
    expect(textoCambiosPlan(cambios)).toBe('Hay cambios desde la última versión del plan: un PDF nuevo, notas nuevas, temas cambiados y meta cambiada. ¿Quieres actualizarlo?');
  });

  it('una nota registrada donde no había cuenta como nueva; cambiar una, como cambiada; PDF eliminados', () => {
    expect(cambiosHuella(base, { ...base, notas: [{ id: 'n1', nota: 350 }, { id: 'n2', nota: 300 }] })).toEqual(['notas nuevas']);
    expect(cambiosHuella(base, { ...base, notas: [{ id: 'n1', nota: 200 }, { id: 'n2', nota: null }] })).toEqual(['notas cambiadas']);
    expect(cambiosHuella({ ...base, documentos: ['d1', 'd2', 'd3'] }, base)).toEqual(['2 PDF eliminados']);
  });

  it('una huella guardada vacía o rota no rompe: todo lo de ahora cuenta como cambio', () => {
    expect(cambiosHuella({}, base)).toEqual(['un PDF nuevo', 'notas nuevas', 'temas cambiados', 'meta cambiada']);
    expect(cambiosHuella(null, { meta: null, temas: [], notas: [], documentos: [] })).toEqual([]);
  });
});

describe('textos', () => {
  it('RB-19 del plan, minutos y semanas en orden', () => {
    expect(textoSinFechaPlan(true)).toBe('Pon una fecha futura al corte para generar el plan.');
    expect(textoSinFechaPlan(false)).toBe('Pon una fecha final futura a la materia para generar el plan.');
    expect([45, 60, 90, 135].map(textoMinutos)).toEqual(['45 min', '1 h', '1 h 30 min', '2 h 15 min']);
    const c = armarSemanas([
      { id: 'b', fecha: '2026-11-23', titulo: 'b', tema_id: T1, minutos: 30, fuentes: [] },
      { id: 'a', fecha: '2026-11-22', titulo: 'a', tema_id: T1, minutos: 30, fuentes: [] }, // domingo: semana anterior
    ]);
    expect(c.semanas.map((s) => [s.inicio, s.dias.map((d) => d.fecha)])).toEqual([
      ['2026-11-16', ['2026-11-22']],
      ['2026-11-23', ['2026-11-23']],
    ]);
  });
});
