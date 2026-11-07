// @vitest-environment node
// E05: reglas puras de categorías (RB-02, RB-03 y paleta fija de PLAN_AMPLIACION 3.1).
import { describe, expect, it } from 'vitest';
import {
  colorDeCategoria,
  esGeneral,
  NOMBRE_COLOR,
  PALETA_CATEGORIAS,
  siguienteColorLibre,
  validarColorCategoria,
  validarNombreCategoria,
} from '@/lib/reglas/categorias';
import { MENSAJES } from '@/lib/reglas/errores';
import { esperarCodigo } from './ayudas';

describe('categorías', () => {
  it('la paleta tiene exactamente los 8 colores del plan, cada uno con nombre en español', () => {
    expect(PALETA_CATEGORIAS).toEqual(['terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa', 'gris']);
    expect(Object.values(NOMBRE_COLOR)).toEqual(['Terracota', 'Ámbar', 'Oliva', 'Verde', 'Azul', 'Violeta', 'Rosa', 'Gris']);
  });

  it('RB-02: el nombre se recorta y une espacios; vacío o de más de 80 caracteres se rechaza', () => {
    expect(validarNombreCategoria('  Mi   universidad ')).toBe('Mi universidad');
    expect(validarNombreCategoria('a'.repeat(80))).toHaveLength(80);
    esperarCodigo(() => validarNombreCategoria('   '), 'NOMBRE_CATEGORIA_INVALIDO');
    esperarCodigo(() => validarNombreCategoria('a'.repeat(81)), 'NOMBRE_CATEGORIA_INVALIDO');
  });

  it('RB-03: solo colores de la paleta, con el mensaje exacto', () => {
    expect(validarColorCategoria('azul')).toBe('azul');
    esperarCodigo(() => validarColorCategoria('negro'), 'COLOR_INVALIDO');
    esperarCodigo(() => validarColorCategoria('#ff0000'), 'COLOR_INVALIDO');
    expect(MENSAJES.COLOR_INVALIDO).toBe('Elige un color de la lista.');
    expect(MENSAJES.CATEGORIA_DUPLICADA).toBe('Ya existe una categoría con ese nombre.');
    expect(MENSAJES.CATEGORIA_GENERAL).toBe('La categoría General no se puede eliminar.');
  });

  it('siguiente color libre: en orden, sin gris; si se usaron todos, vuelve a empezar', () => {
    expect(siguienteColorLibre([])).toBe('terracota');
    expect(siguienteColorLibre(['gris'])).toBe('terracota');
    expect(siguienteColorLibre(['gris', 'terracota', 'ambar'])).toBe('oliva');
    const todos = ['terracota', 'ambar', 'oliva', 'verde', 'azul', 'violeta', 'rosa'];
    expect(siguienteColorLibre(todos)).toBe('terracota'); // 7 usados → 7 % 7 = 0
    expect(siguienteColorLibre([...todos, 'gris'])).toBe('ambar'); // 8 usados → 8 % 7 = 1
  });

  it('color de una tarea: por nombre sin distinguir mayúsculas; sin registro, gris', () => {
    const categorias = [
      { nombre: 'General', color: 'gris' },
      { nombre: 'Universidad', color: 'azul' },
    ];
    expect(colorDeCategoria('universidad', categorias)).toBe('azul');
    expect(colorDeCategoria(' UNIVERSIDAD ', categorias)).toBe('azul');
    expect(colorDeCategoria('Casa', categorias)).toBe('gris');
  });

  it('General se reconoce sin distinguir mayúsculas', () => {
    expect(esGeneral(' general ')).toBe(true);
    expect(esGeneral('Generales')).toBe(false);
  });
});
