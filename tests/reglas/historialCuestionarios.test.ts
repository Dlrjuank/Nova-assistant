// E10f (5.11, RB-53): comparación entre intentos (S-58) y capítulos para repasar (S-59).
import { describe, expect, it } from 'vitest';
import { textoAlcance } from '@/lib/reglas/cuestionarios';
import { capitulosParaRepasar, compararIntentos } from '@/lib/reglas/historialCuestionarios';
import { tituloTareaCapitulo } from '@/lib/reglas/planLectura';

const I = (puntaje: number | null, repaso = false) => ({ puntaje, repaso });

describe('S-58: comparación entre intentos', () => {
  it('cada intento se compara con el anterior; el primero no tiene con qué', () => {
    expect(compararIntentos([I(300), I(400), I(400), I(200)])).toEqual([null, 'mejor', 'igual', 'peor']);
  });

  it('los repasos no se comparan ni sirven de referencia', () => {
    // 300, repaso 500, 400 → el 400 se compara con el 300, no con el repaso.
    expect(compararIntentos([I(300), I(500, true), I(400)])).toEqual([null, null, 'mejor']);
    expect(compararIntentos([I(500, true), I(200)])).toEqual([null, null]);
  });

  it('los intentos sin terminar se saltan', () => {
    expect(compararIntentos([I(300), I(null), I(250)])).toEqual([null, null, 'peor']);
  });

  it('sin intentos, nada', () => {
    expect(compararIntentos([])).toEqual([]);
  });
});

describe('S-59: capítulos con 2 o más falladas', () => {
  it('solo los que llegan a 2, con cuántas, en el orden en que aparecen', () => {
    const falladas = ['c2', 'c1', 'c2', null, 'c3', 'c1', 'c2', null].map((capituloId) => ({ capituloId }));
    expect(capitulosParaRepasar(falladas)).toEqual([
      { capituloId: 'c2', falladas: 3 },
      { capituloId: 'c1', falladas: 2 },
    ]);
  });

  it('una sola fallada por capítulo, o preguntas sin capítulo, no sugieren nada', () => {
    expect(capitulosParaRepasar([{ capituloId: 'c1' }, { capituloId: 'c2' }, { capituloId: null }, { capituloId: null }])).toEqual([]);
  });
});

describe('título de la tarea de repaso (RB-53)', () => {
  it('"Repasar cap. N: Título (pp. a–b)" sin repetir "Capítulo N"', () => {
    expect(tituloTareaCapitulo(3, 'Capítulo 3. Los ecosistemas', '45–67', 'Repasar')).toBe('Repasar cap. 3: Los ecosistemas (pp. 45–67)');
    expect(tituloTareaCapitulo(3, 'Los ecosistemas', '45–67')).toBe('Leer cap. 3: Los ecosistemas (pp. 45–67)');
  });
});

describe('texto del alcance', () => {
  it('documento, capítulo y páginas', () => {
    expect(textoAlcance('documento', null, null, null)).toBe('Todo el documento');
    expect(textoAlcance('capitulo', 'Uno', null, null)).toBe('Uno');
    expect(textoAlcance('capitulo', null, null, null)).toBe('Un capítulo');
    expect(textoAlcance('paginas', null, 2, 4)).toBe('Páginas 2–4');
    expect(textoAlcance('paginas', null, 5, 5)).toBe('Página 5');
  });
});
