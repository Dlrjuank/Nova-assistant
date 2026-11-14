// E10g (PLAN_AMPLIACION 7.12, 7.13, 9.7, RB-64 a RB-67): S-70 a S-73.
import { describe, expect, it } from 'vitest';
import { barajarMultiple, calcularPuntaje, validarPreguntas } from '@/lib/reglas/cuestionarios';
import {
  armarFraseCompletar,
  completarCorrecta,
  esFallada,
  faltanPorTipo,
  formatearPuntos,
  intercalarPorTipo,
  normalizarRespuesta,
  puntajeIntento,
  puntosMultiple,
  repartoPorTipo,
  respuestaCompletarValida,
  totalReparto,
  type TipoPregunta,
} from '@/lib/reglas/tiposPregunta';

describe('S-70: puntos de la múltiple y puntaje del intento (7.12)', () => {
  it.each([
    ['k = 2, las 2 bien sin errores', [0, 2], [0, 2], 100],
    ['k = 2, 1 bien', [0, 2], [2], 50],
    ['k = 2, las 2 bien y 1 mal', [0, 2], [0, 1, 2], 50],
    ['k = 2, 1 bien y 1 mal', [0, 2], [0, 3], 0],
    ['k = 2, marcar todas', [0, 2], [0, 1, 2, 3], 0],
    ['k = 2, solo incorrectas: nunca menos de 0', [0, 2], [1, 3], 0],
    ['k = 3, 2 bien', [0, 1, 3], [0, 3], 66],
    ['k = 3, las 3 bien y 1 mal', [0, 1, 3], [0, 1, 2, 3], 66],
    ['k = 3, las 3 bien', [0, 1, 3], [3, 1, 0], 100],
  ])('%s → %i', (_, correctas, elegidas, puntos) => {
    expect(puntosMultiple(correctas, elegidas)).toBe(puntos);
  });

  it('el puntaje con parciales y abiertas: trunc(Σ × 5 / total)', () => {
    // única bien, múltiple a medias, verdadero o falso mal, completar bien, abierta "A medias"
    expect(puntajeIntento([100, 50, 0, 100, 50], 5)).toBe(300);
    expect(puntajeIntento([66, 100, 100], 3)).toBe(443); // 266 × 5 / 3 = 443,3
    expect(puntajeIntento([], 0)).toBe(0);
  });

  it.each([
    [7, 10],
    [2, 3],
    [20, 20],
    [0, 5],
    [1, 3],
  ])('en selección única da lo mismo que 7.11 (%i de %i)', (aciertos, total) => {
    const puntos = Array.from({ length: total }, (_, i) => (i < aciertos ? 100 : 0));
    expect(puntajeIntento(puntos, total)).toBe(calcularPuntaje(aciertos, total));
  });

  it('fallada es toda pregunta con menos de 1 punto; una abierta sin calificar aún no cuenta', () => {
    expect([100, 66, 50, 0].map(esFallada)).toEqual([false, true, true, true]);
    expect(esFallada(null)).toBe(false);
  });

  it('los puntos se muestran con coma y sin ceros de más', () => {
    expect([100, 50, 66, 0, 5].map(formatearPuntos)).toEqual(['1', '0,5', '0,66', '0', '0,05']);
  });
});

describe('S-71: comparar una respuesta de completar (7.13)', () => {
  it.each([
    ['  FOTOSINTESIS ', true],
    ['fotosintesis.', true],
    ['Fotosíntesis', true],
    ['¡fotosíntesis!', true],
    ['fotosíntesis y respiración', false],
    ['fotosíntesis respiración', false],
    ['', false],
    ['   ', false],
  ])('«%s» contra «fotosíntesis» → %s', (escrita, acierta) => {
    expect(completarCorrecta(escrita, 'fotosíntesis')).toBe(acierta);
  });

  it('la diéresis se quita y la ñ no se confunde con la n', () => {
    expect(completarCorrecta('pinguino', 'pingüino')).toBe(true);
    expect(completarCorrecta('cana', 'caña')).toBe(false);
    expect(completarCorrecta('CAÑA', 'caña')).toBe(true);
  });

  it('los espacios seguidos se dejan en uno; la puntuación de en medio se conserva', () => {
    expect(completarCorrecta('dióxido    de   carbono', 'dióxido de carbono')).toBe(true);
    expect(normalizarRespuesta(' «Ciclo de Calvin», ')).toBe('ciclo de calvin');
    expect(completarCorrecta('agua luz', 'agua, luz')).toBe(false);
  });
});

const FRAGMENTO =
  'La fotosíntesis ocurre en los cloroplastos de las hojas. Las plantas usan la luz solar para convertir el agua y el dióxido de carbono en glucosa, y liberan oxígeno.';
const FRAGMENTOS = new Map([['F1', { contenido: FRAGMENTO }]]);
const CITA = 'Las plantas usan la luz solar para convertir el agua y el dióxido de carbono en glucosa';
const comun = { explicacion: 'Lo dice el texto.', fuente: 'F1', cita_textual: CITA };
const UNICA = { tipo: 'unica', enunciado: '¿Qué usan las plantas?', opciones: ['Luz solar', 'Viento', 'Arena', 'Sal'], correcta: 0, ...comun };
const MULTIPLE = { tipo: 'multiple', enunciado: '¿Qué convierten las plantas?', opciones: ['Agua', 'Dióxido de carbono', 'Arena', 'Sal'], correctas: [1, 0], ...comun };
const VF = { tipo: 'vf', enunciado: 'Las plantas convierten arena en glucosa.', verdadero: false, ...comun };
const COMPLETAR = { tipo: 'completar', respuesta: 'luz solar', ...comun };
const ABIERTA = { tipo: 'abierta', enunciado: '¿Para qué usan las plantas la luz solar?', respuesta: 'Para convertir el agua y el dióxido de carbono en glucosa.', ...comun };
const TODOS = { unica: 9, multiple: 9, vf: 9, completar: 9, abierta: 9 };

describe('S-72: validación de cada tipo y frase de completar (9.7.2)', () => {
  it('una válida de cada tipo pasa con los campos de su tipo', () => {
    const v = validarPreguntas([UNICA, MULTIPLE, VF, COMPLETAR, ABIERTA], FRAGMENTOS, [], TODOS);
    expect(v.map((p) => p.tipo)).toEqual(['unica', 'multiple', 'vf', 'completar', 'abierta']);
    expect(v[1]).toMatchObject({ correctas: [0, 1] });
    expect(v[2]).toMatchObject({ verdadero: false });
    expect(v[3]).toMatchObject({ respuesta: 'luz solar', enunciado: 'Las plantas usan la _____ para convertir el agua y el dióxido de carbono en glucosa' });
    expect(v[4]).toMatchObject({ respuesta: ABIERTA.respuesta });
  });

  it.each([
    ['múltiple con 1 correcta', { ...MULTIPLE, correctas: [1] }],
    ['múltiple con 4 correctas', { ...MULTIPLE, correctas: [0, 1, 2, 3] }],
    ['múltiple con correctas repetidas', { ...MULTIPLE, correctas: [1, 1] }],
    ['múltiple con una posición fuera de 0 a 3', { ...MULTIPLE, correctas: [1, 4] }],
    ['múltiple con opciones repetidas', { ...MULTIPLE, opciones: ['Agua', 'agua', 'Arena', 'Sal'] }],
    ['verdadero o falso sin booleano', { ...VF, verdadero: 'false' }],
    ['verdadero o falso sin explicación', { ...VF, explicacion: '' }],
    ['completar con una respuesta que no está en la cita', { ...COMPLETAR, respuesta: 'luz lunar' }],
    ['completar que corta una palabra', { ...COMPLETAR, respuesta: 'luz sol' }],
    ['completar de más de 4 palabras', { ...COMPLETAR, respuesta: 'el agua y el dióxido' }],
    ['completar de menos de 3 caracteres', { ...COMPLETAR, respuesta: 'el' }],
    ['abierta con respuesta modelo corta', { ...ABIERTA, respuesta: 'Para vivir.' }],
    ['abierta sin enunciado', { ...ABIERTA, enunciado: '' }],
    ['un tipo que no existe', { ...UNICA, tipo: 'ensayo' }],
  ])('se descarta: %s', (_, cruda) => {
    expect(validarPreguntas([cruda], FRAGMENTOS, [], TODOS)).toEqual([]);
  });

  it('la frase la arma el servidor con la cita, respetando las palabras y la puntuación de alrededor', () => {
    expect(armarFraseCompletar('ocurre en los cloroplastos de las hojas.', 'hojas')).toBe('ocurre en los cloroplastos de las _____.');
    expect(armarFraseCompletar('en glucosa, y liberan oxígeno', 'GLUCOSA')).toBe('en _____, y liberan oxígeno');
    expect(armarFraseCompletar('el dióxido de carbono en glucosa', 'dioxido de carbono')).toBe('el _____ en glucosa');
    expect(armarFraseCompletar('la luz solar', 'sol')).toBeNull(); // cortaría «solar»
    expect(armarFraseCompletar('la luz solar', 'luna')).toBeNull();
  });

  it('lo que falta tiene de 1 a 4 palabras y de 3 a 40 caracteres', () => {
    expect(['sol', 'luz solar', 'ciclo de la vida', 'x'.repeat(40)].every(respuestaCompletarValida)).toBe(true);
    expect(['', 'el', 'una dos tres cuatro cinco', 'x'.repeat(41)].some(respuestaCompletarValida)).toBe(false);
  });

  it('barajar la múltiple conserva cuáles son correctas', () => {
    for (let n = 0; n < 30; n++) {
      const r = barajarMultiple(MULTIPLE.opciones, [0, 1]);
      expect(r.correctas.map((i) => r.opciones[i]).sort()).toEqual(['Agua', 'Dióxido de carbono']);
    }
  });

  it('sin tipo, si se pidió uno solo, es ese (los cuestionarios de selección única)', () => {
    const sinTipo = Object.fromEntries(Object.entries(UNICA).filter(([clave]) => clave !== 'tipo'));
    expect(validarPreguntas([sinTipo], FRAGMENTOS)).toHaveLength(1);
    expect(validarPreguntas([sinTipo], FRAGMENTOS, [], TODOS)).toEqual([]);
  });
});

describe('S-73: reparto de mixto y segunda llamada (RB-64, 9.7)', () => {
  it.each([
    [5, 1],
    [10, 2],
    [20, 4],
  ])('mixto de %i: %i de cada tipo', (pedidas, cada) => {
    const r = repartoPorTipo('mixto', pedidas);
    expect(Object.values(r)).toEqual([cada, cada, cada, cada, cada]);
    expect(totalReparto(r)).toBe(pedidas);
  });

  it('un solo tipo lleva todas las pedidas', () => {
    expect(repartoPorTipo('vf', 10)).toEqual({ unica: 0, multiple: 0, vf: 10, completar: 0, abierta: 0 });
  });

  it('la segunda llamada pide solo lo que falta de cada tipo', () => {
    const reparto = repartoPorTipo('mixto', 10);
    const validas: Array<{ tipo: TipoPregunta }> = [{ tipo: 'unica' }, { tipo: 'unica' }, { tipo: 'vf' }, { tipo: 'abierta' }];
    expect(faltanPorTipo(reparto, validas)).toEqual({ unica: 0, multiple: 2, vf: 1, completar: 2, abierta: 1 });
  });

  it('un tipo de más, o uno que no se pidió, se descarta', () => {
    const otra = { ...UNICA, enunciado: '¿Qué usan las plantas para la glucosa?' };
    const v = validarPreguntas([UNICA, otra, VF], FRAGMENTOS, [], { unica: 1, multiple: 1 });
    expect(v.map((p) => p.tipo)).toEqual(['unica']);
  });

  it('las preguntas se intercalan por tipo, en su orden', () => {
    const p = (tipo: TipoPregunta, n: number) => ({ tipo, n });
    const mezcladas = [p('abierta', 1), p('unica', 1), p('unica', 2), p('vf', 1), p('completar', 1), p('multiple', 1), p('abierta', 2), p('multiple', 2), p('vf', 2), p('completar', 2)];
    expect(intercalarPorTipo(mezcladas).map((x) => `${x.tipo}${x.n}`)).toEqual([
      'unica1',
      'multiple1',
      'vf1',
      'completar1',
      'abierta1',
      'unica2',
      'multiple2',
      'vf2',
      'completar2',
      'abierta2',
    ]);
  });
});
