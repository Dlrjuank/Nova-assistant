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

describe('separadores al unir o quitar citas', () => {
  const pagina = (n: number) => `[libro-ejemplo-nova.pdf · p. ${n}]`;

  it('ejemplo real: muchas citas seguidas no dejan comas sueltas', () => {
    const citas = [20, 21, 22, 23, 24, 25, 26, 27, 28].map(pagina).join(', ');
    expect(compactarCitas(`Se centra en explicar el concepto de ecosistemas utilizando un lenguaje sencillo a lo largo de sus páginas ${citas}.`)).toBe(
      'Se centra en explicar el concepto de ecosistemas utilizando un lenguaje sencillo a lo largo de sus páginas [pp. 20–28].',
    );
    expect(compactarCitas(`A lo largo de sus páginas,,,,,,,,,,,, ${citas}.`)).toBe('A lo largo de sus páginas [pp. 20–28].');
  });

  it('ejemplo real: dos rangos separados quedan con una sola coma', () => {
    expect(compactarCitas('Ver [libro-ejemplo-nova.pdf · pp. 11–12],, [libro-ejemplo-nova.pdf · pp. 14–17].')).toBe('Ver [pp. 11–12], [pp. 14–17].');
    expect(compactarCitas('Ver [l.pdf · pp. 11–12], [l.pdf · p. 14], [l.pdf · pp. 15–17].')).toBe('Ver [pp. 11–12], [pp. 14–17].');
    expect(compactarCitas('Ver [a.pdf · pp. 11–12],, [a.pdf · pp. 14–17]. Y [b.pdf · p. 1].')).toBe('Ver [a.pdf · pp. 11–12], [a.pdf · pp. 14–17]. Y [b.pdf · p. 1].');
  });

  it('limpia punto y coma, "y", paréntesis vacíos y espacios dobles', () => {
    expect(compactarCitas('Uno [l.pdf · p. 3]; [l.pdf · p. 4].')).toBe('Uno [pp. 3–4].');
    expect(compactarCitas('Uno [l.pdf · p. 3] y [l.pdf · p. 4].')).toBe('Uno [pp. 3–4].');
    expect(compactarCitas('Uno ([l.pdf · p. 3], [l.pdf · p. 4]).')).toBe('Uno ([pp. 3–4]).');
    expect(compactarCitas('Fuera ([l.pdf · p. 40]) y dentro [l.pdf · p. 25].', { limite: '20–28' })).toBe('Fuera y dentro [p. 25].');
    expect(compactarCitas('Uno,  [l.pdf · p. 40], dos  tres [l.pdf · p. 25].', { limite: '20–28' })).toBe('Uno, dos tres [p. 25].');
    expect(compactarCitas('Fin, [l.pdf · p. 40].', { limite: '20–28' })).toBe('Fin.');
  });

  it('ejemplo real: varios rangos con un solo nombre', () => {
    expect(compactarCitas('Concluye [libro-ejemplo-nova.pdf · pp. 16–17, 18–19, 19].')).toBe('Concluye [pp. 16–19].');
    expect(compactarCitas('Ver [l.pdf · p. 3, 9].')).toBe('Ver [p. 3] [p. 9].');
  });

  it('ejemplo real: citas seguidas en desorden también se unen', () => {
    expect(compactarCitas('Trata [a.pdf · p. 24] [a.pdf · p. 22] [a.pdf · pp. 22–23]. Y [b.pdf · p. 1].')).toBe('Trata [a.pdf · pp. 22–24]. Y [b.pdf · p. 1].');
  });

  it('no daña la puntuación normal', () => {
    expect(compactarCitas('Hola, mundo; uno (dos), tres: cuatro... [l.pdf · p. 3]')).toBe('Hola, mundo; uno (dos), tres: cuatro... [p. 3]');
    expect(compactarCitas('Costó 1,5 y luego 2.000, etc., según [l.pdf · p. 3], y fin.')).toBe('Costó 1,5 y luego 2.000, etc., según [p. 3], y fin.');
    expect(compactarCitas('Blanco y negro [l.pdf · p. 3]. Rojo [l.pdf · p. 9].')).toBe('Blanco y negro [p. 3]. Rojo [p. 9].');
    const sinCitas = 'Sin citas,, aquí  hay ( ) cosas raras.';
    expect(compactarCitas(sinCitas)).toBe(sinCitas);
  });
});

describe('citas repetidas en listas', () => {
  const M = '[manual-laboratorio-quimica.pdf · pp. 1–3]';
  const OTRO = '[otro.pdf · p. 9]';

  it('ejemplo real: 6 puntos con la misma cita y varios documentos: una sola, al final de la lista', () => {
    const lista = ['Bata', 'Gafas', 'Guantes', 'Campana', 'Etiquetas', 'Residuos'].map((t) => `- ${t} ${M}.`).join('\n');
    expect(compactarCitas(`Normas:\n${lista}\nAdemás, revisa ${OTRO}.`)).toBe(
      `Normas:\n- Bata.\n- Gafas.\n- Guantes.\n- Campana.\n- Etiquetas.\n- Residuos ${M}.\nAdemás, revisa ${OTRO}.`,
    );
  });

  it('funciona con listas numeradas, asteriscos y citas cortas', () => {
    expect(compactarCitas('1. Uno [l.pdf · p. 3]\n2. Dos [l.pdf · p. 3]')).toBe('1. Uno\n2. Dos [p. 3]');
    expect(compactarCitas('*   **Uno** [l.pdf · p. 3].\n*   **Dos** [l.pdf · p. 3].')).toBe('*   **Uno**.\n*   **Dos** [p. 3].');
  });

  it('con citas distintas o algún punto sin cita, conserva cada una', () => {
    expect(compactarCitas('- Uno [l.pdf · p. 3]\n- Dos [l.pdf · p. 4]')).toBe('- Uno [p. 3]\n- Dos [p. 4]');
    expect(compactarCitas('- Uno [l.pdf · p. 3]\n- Dos')).toBe('- Uno [p. 3]\n- Dos');
    expect(compactarCitas('- Uno [l.pdf · p. 3]')).toBe('- Uno [p. 3]');
  });

  it('ejemplo real: un punto numerado con viñetas debajo: la lista de viñetas se une', () => {
    const v = (t: string) => `- ${t} ${M}.`;
    expect(compactarCitas(`1. Sobre las células ${OTRO}.\n2. Normas:\n${v('Bata')}\n${v('Gafas')}\n${v('Guantes')}`)).toBe(`1. Sobre las células ${OTRO}.\n2. Normas:\n- Bata.\n- Gafas.\n- Guantes ${M}.`);
  });

  it('dos listas separadas se tratan por separado', () => {
    expect(compactarCitas('- A [l.pdf · p. 3]\n- B [l.pdf · p. 3]\nTexto\n- C [l.pdf · p. 9]\n- D [l.pdf · p. 9]')).toBe('- A\n- B [p. 3]\nTexto\n- C\n- D [p. 9]');
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
