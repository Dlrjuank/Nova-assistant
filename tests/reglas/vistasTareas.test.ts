// @vitest-environment node
// E08 (PLAN_AMPLIACION 5.4): vistas de Tareas y agrupación por categoría.
import { describe, expect, it } from 'vitest';
import { agruparPorCategoria, filtroDeVista, textoVacio, vistaDeParametros } from '@/lib/reglas/vistasTareas';

const CATEGORIAS = [
  { nombre: 'General', color: 'gris' },
  { nombre: 'Universidad', color: 'azul' },
  { nombre: 'Casa', color: 'verde' },
];
const t = (id: string, categoria: string, estado = 'Pendiente') => ({ id, categoria, estado });

describe('vistas de Tareas', () => {
  it('la vista sale de ?vista=; los enlaces viejos con ?estado= siguen sirviendo', () => {
    expect(vistaDeParametros()).toBe('todas');
    expect(vistaDeParametros('hoy')).toBe('hoy');
    expect(vistaDeParametros('importantes')).toBe('importantes');
    expect(vistaDeParametros('vencidas')).toBe('vencidas');
    expect(vistaDeParametros('cualquiera')).toBe('todas');
    expect(vistaDeParametros(undefined, 'Completada')).toBe('completadas');
    expect(vistaDeParametros(undefined, 'Pendiente')).toBe('vencidas'); // el enlace de Inicio antes de E08
    expect(vistaDeParametros('hoy', 'Completada')).toBe('hoy'); // ?vista= manda
  });

  it('cada vista pide al servicio lo que dice su nombre', () => {
    const hoy = '2026-11-07';
    expect(filtroDeVista('todas', hoy)).toEqual({});
    expect(filtroDeVista('hoy', hoy)).toEqual({ desde: hoy, hasta: hoy });
    expect(filtroDeVista('importantes', hoy)).toEqual({ soloPendientes: true, prioridad: 3 });
    expect(filtroDeVista('completadas', hoy)).toEqual({ estado: 'Completada' });
    expect(filtroDeVista('vencidas', hoy)).toEqual({ soloPendientes: true, hasta: '2026-11-06' });
    expect(filtroDeVista('vencidas', '2026-01-01').hasta).toBe('2025-12-31');
  });

  it('textos de vacío por vista y con categoría', () => {
    expect(textoVacio('todas', null)).toBe('Aún no tienes tareas');
    expect(textoVacio('todas', 'Casa')).toBe('No hay tareas en «Casa»');
    expect(textoVacio('hoy', 'Casa')).toBe('No tienes tareas para hoy en «Casa»');
    expect(textoVacio('vencidas', null)).toBe('No tienes tareas vencidas');
  });
});

describe('agruparPorCategoria', () => {
  it('General primero y luego alfabético; contador completadas/total; completadas al final del grupo', () => {
    const grupos = agruparPorCategoria(
      [t('1', 'Universidad', 'Completada'), t('2', 'Casa'), t('3', 'universidad '), t('4', 'General'), t('5', 'Universidad')],
      CATEGORIAS,
    );
    expect(grupos.map((g) => `${g.nombre} ${g.completadas}/${g.total}`)).toEqual(['General 0/1', 'Casa 0/1', 'Universidad 1/3']);
    expect(grupos[2]?.tareas.map((x) => x.id)).toEqual(['3', '5', '1']);
    expect(grupos[2]?.color).toBe('azul');
  });

  it('una categoría sin registrar se agrupa con su nombre (espacios unidos) y en gris; vacía cuenta como General', () => {
    const grupos = agruparPorCategoria([t('1', '  Viaje   largo '), t('2', 'viaje largo'), t('3', '')], CATEGORIAS);
    expect(grupos.map((g) => [g.nombre, g.total, g.color])).toEqual([
      ['General', 1, 'gris'],
      ['Viaje largo', 2, 'gris'],
    ]);
  });
});
