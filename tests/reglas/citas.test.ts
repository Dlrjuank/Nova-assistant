// @vitest-environment node
// RB-36: citas cortas, páginas seguidas unidas y límite del capítulo.
import { describe, expect, it } from 'vitest';
import { citaCorta, compactarCitas, recortarEtiqueta } from '@/lib/reglas/citas';

describe('compactarCitas', () => {
  it('quita el nombre del documento cuando la respuesta usa uno solo', () => {
    expect(compactarCitas('Las células [libro.pdf · p. 20]. La energía [libro.pdf · p. 40].')).toBe('Las células [p. 20]. La energía [p. 40].');
  });

  it('une las páginas seguidas en un solo rango, en el lugar de la última', () => {
    expect(compactarCitas('Uno [l.pdf · p. 20]. Dos [l.pdf · p. 21]. Tres [l.pdf · pp. 22–23].')).toBe('Uno. Dos. Tres [pp. 20–23].');
    expect(compactarCitas('Uno [l.pdf · pp. 19–20] [l.pdf · pp. 20–21].')).toBe('Uno [pp. 19–21].');
    expect(compactarCitas('Repetida [l.pdf · p. 5]. Otra vez [l.pdf · p. 5].')).toBe('Repetida. Otra vez [p. 5].');
  });

  it('no une páginas separadas ni entre párrafos', () => {
    expect(compactarCitas('Uno [l.pdf · p. 3]. Dos [l.pdf · p. 9].')).toBe('Uno [p. 3]. Dos [p. 9].');
    expect(compactarCitas('- Uno [l.pdf · p. 3]\n- Dos [l.pdf · p. 4]')).toBe('- Uno [p. 3]\n- Dos [p. 4]');
  });

  it('con varios documentos, cada cita conserva el suyo y no se mezclan', () => {
    expect(compactarCitas('Uno [a.pdf · p. 3]. Dos [b.pdf · p. 4]. Tres [b.pdf · p. 5].')).toBe('Uno [a.pdf · p. 3]. Dos. Tres [b.pdf · pp. 4–5].');
  });

  it('entiende varias citas en un corchete y el guion en lugar de la raya', () => {
    expect(compactarCitas('Uno [l.pdf · p. 3; l.pdf · p. 4].')).toBe('Uno [pp. 3–4].');
    expect(compactarCitas('Uno [l.pdf · pp. 3-4].')).toBe('Uno [pp. 3–4].');
    expect(compactarCitas('Uno [p. 3, p. 9].')).toBe('Uno [p. 3] [p. 9].');
  });

  it('no toca otras citas ni corchetes, y conserva números romanos', () => {
    const otras = 'Según [a.pdf · fragmento 3] y [Tarea 1a2b3c4d], ver [nota].';
    expect(compactarCitas(otras)).toBe(otras);
    expect(compactarCitas('Prólogo [l.pdf · p. xi]. Sigue [l.pdf · p. xii].')).toBe('Prólogo [p. xi]. Sigue [p. xii].');
  });

  it('con el capítulo, recorta las citas a sus páginas y quita las que quedan fuera', () => {
    expect(compactarCitas('Inicio [l.pdf · pp. 19–20].', { limite: '20–28' })).toBe('Inicio [p. 20].');
    expect(compactarCitas('Fin [l.pdf · pp. 28–29].', { limite: '20–28' })).toBe('Fin [p. 28].');
    expect(compactarCitas('Fuera [l.pdf · p. 40]. Dentro [l.pdf · p. 25].', { limite: '20–28' })).toBe('Fuera. Dentro [p. 25].');
  });
});

describe('recortarEtiqueta', () => {
  it('limita al rango; si no es numérica o no se cruzan, la deja', () => {
    expect(recortarEtiqueta('19–20', '20–28')).toBe('20');
    expect(recortarEtiqueta('28–29', '20–28')).toBe('28');
    expect(recortarEtiqueta('22–23', '20–28')).toBe('22–23');
    expect(recortarEtiqueta('ii–1', '1–10')).toBe('ii–1');
    expect(recortarEtiqueta('40', '20–28')).toBe('40');
  });
});

describe('citaCorta', () => {
  it('saca la parte de páginas de la etiqueta de una fuente', () => {
    expect(citaCorta('libro.pdf · pp. 20–21')).toBe('[pp. 20–21]');
    expect(citaCorta('libro.pdf · fragmento 3')).toBeNull();
  });
});
