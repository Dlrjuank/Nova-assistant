// @vitest-environment node
// Los respaldos incluyen todas las tablas de datos de Nova, con los padres antes que los hijos.
import { describe, expect, it } from 'vitest';
import { TABLAS_RESPALDO } from '../../scripts/tablas-respaldo.mjs';

const posicion = (tabla: string) => TABLAS_RESPALDO.indexOf(tabla);

describe('tablas del respaldo', () => {
  it('incluye categorias, capitulos y nova_config', () => {
    expect(TABLAS_RESPALDO).toEqual(expect.arrayContaining(['categorias', 'capitulos', 'nova_config']));
  });

  it('no repite tablas', () => {
    expect(new Set(TABLAS_RESPALDO).size).toBe(TABLAS_RESPALDO.length);
  });

  it.each([
    ['nova_config', 'tareas_personales'],
    ['nova_config', 'documentos'],
    ['nova_config', 'fuentes_web'],
    ['documentos', 'fragmentos_pdf'],
    ['documentos', 'capitulos'],
    ['tareas_personales', 'capitulos'],
    ['conversaciones', 'mensajes_chat'],
  ])('%s va antes que %s', (padre, hijo) => {
    expect(posicion(padre)).toBeGreaterThanOrEqual(0);
    expect(posicion(padre)).toBeLessThan(posicion(hijo));
  });
});
