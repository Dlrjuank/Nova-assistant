// @vitest-environment node
// E17 (6.8, 9.1; RB-01, RB-19, RB-21): temas del corte con la base y Gemini simulados, y sus rutas.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultar: vi.fn(), exigirSesion: vi.fn(), embedding: vi.fn(), json: vi.fn(), fragmentos: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar, conTransaccion: vi.fn(), aLiteralVector: (v: number[]) => `[${v.join(',')}]` }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbedding: m.embedding, generarJson: m.json } }));
vi.mock('@/lib/datos/fragmentos', () => ({ recuperarFragmentosDeDocumento: m.fragmentos }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/temas'));

import * as rutaProponer from '@/app/api/nova/cortes/[id]/temas/proponer/route';
import * as rutaTemas from '@/app/api/nova/cortes/[id]/temas/route';
import * as rutaTema from '@/app/api/nova/temas/[id]/route';
import { crearTema, editarTema, eliminarTema, proponerTemas } from '@/lib/datos/temas';

const U = '11111111-1111-4111-8111-111111111111';
const MAT = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333331';
const DOC = '55555555-5555-4555-8555-555555555555';
const T1 = '66666666-6666-4666-8666-666666666666';
const HOY = '2026-11-16';
const duplicado = Object.assign(new Error('duplicado'), { code: '23505', constraint: 'idx_temas_nombre' });

const corte = (fecha: string | null, usaCortes = true) => [{ nombre: 'Corte 1', fecha, materia_id: MAT, materia: 'Cálculo', usa_cortes: usaCortes }];
const fragmento = (numero: number, contenido: string) => ({ id: `f${numero}`, documento_id: DOC, numero, contenido, nombre_archivo: 'syllabus.pdf', distancia: 0.1, etiqueta_paginas: String(numero) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U });
  m.embedding.mockResolvedValue([0.1, 0.2]);
});

describe('temas manuales (6.8)', () => {
  it('crear: nace confirmado en un corte del usuario; repetido responde 409; corte ajeno, inexistente', async () => {
    m.consultar.mockResolvedValueOnce([{ id: C1 }]).mockResolvedValueOnce([{ id: T1, corteId: C1, nombre: 'Límites', origen: 'manual', estado: 'confirmado', fuente: null }]);
    await expect(crearTema(U, C1, '  Límites ')).resolves.toMatchObject({ estado: 'confirmado' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([C1, U]);
    expect(String(m.consultar.mock.calls[1]?.[0])).toContain("'manual', 'confirmado'");
    expect(m.consultar.mock.calls[1]?.[1]).toEqual([U, C1, 'Límites']);
    m.consultar.mockResolvedValueOnce([{ id: C1 }]).mockRejectedValueOnce(duplicado);
    await expect(crearTema(U, C1, 'límites')).rejects.toMatchObject({ codigo: 'TEMA_DUPLICADO', message: 'Ese tema ya está en este corte.' });
    m.consultar.mockResolvedValueOnce([]);
    await expect(crearTema(U, C1, 'Series')).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
  });

  it('editar el nombre o confirmar; uno ajeno responde como inexistente; eliminar', async () => {
    m.consultar.mockResolvedValueOnce([{ id: T1, estado: 'confirmado' }]);
    await editarTema(U, T1, { confirmar: true });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([T1, U, null, true]);
    m.consultar.mockResolvedValueOnce([]);
    await expect(editarTema(U, T1, { nombre: 'Otro' })).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' });
    await expect(editarTema(U, T1, {})).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    m.consultar.mockResolvedValueOnce([{ id: T1 }]);
    await expect(eliminarTema(U, T1)).resolves.toEqual({ id: T1 });
    m.consultar.mockResolvedValueOnce([]);
    await expect(eliminarTema(U, T1)).rejects.toMatchObject({ codigo: 'TEMA_NO_ENCONTRADO' });
  });
});

describe('proponer temas (9.1)', () => {
  it('RB-19: sin fecha futura no gasta cuota; con texto según tenga cortes o no', async () => {
    m.consultar.mockResolvedValueOnce(corte(null));
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ codigo: 'PLAN_SIN_FECHA', message: 'Pon una fecha futura al corte para proponer temas.' });
    m.consultar.mockResolvedValueOnce(corte(HOY, false));
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ message: 'Pon una fecha final futura a la materia para proponer temas.' });
    expect(m.embedding).not.toHaveBeenCalled();
    expect(m.json).not.toHaveBeenCalled();
  });

  it('RB-21: un PDF de otra materia no sirve; uno ajeno no existe; uno a medio indexar espera', async () => {
    m.consultar.mockResolvedValueOnce(corte('2026-12-01')).mockResolvedValueOnce([{ materia_id: null, progreso: null }]);
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ codigo: 'SIN_SYLLABUS', message: 'Sube un PDF de esta materia (por ejemplo, el syllabus) para proponer temas.' });
    m.consultar.mockResolvedValueOnce(corte('2026-12-01')).mockResolvedValueOnce([]);
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
    m.consultar.mockResolvedValueOnce(corte('2026-12-01')).mockResolvedValueOnce([{ materia_id: MAT, progreso: 40 }]);
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ codigo: 'DOCUMENTO_INDEXANDO' });
    expect(m.json).not.toHaveBeenCalled();
  });

  it('busca en ese PDF (6 fragmentos), etiqueta F1…, y guarda como propuestos solo los válidos con la etiqueta legible', async () => {
    m.consultar
      .mockResolvedValueOnce(corte('2026-12-01'))
      .mockResolvedValueOnce([{ materia_id: MAT, progreso: null }])
      .mockResolvedValueOnce([{ nombre: 'Series' }]) // ya en el corte
      .mockResolvedValueOnce([{ id: 'n1' }, { id: 'n2' }]);
    m.fragmentos.mockResolvedValueOnce([fragmento(1, 'Corte 1: Límites y continuidad'), fragmento(2, 'Corte 1: Derivadas')]);
    m.json.mockResolvedValueOnce([
      { nombre: 'Límites y continuidad', fuente: 'F1' },
      { nombre: 'Derivadas', fuente: 'F2' },
      { nombre: 'Series', fuente: 'F2' },
      { nombre: 'Inventado', fuente: 'F7' },
    ]);
    await expect(proponerTemas(U, C1, DOC, HOY)).resolves.toHaveLength(2);
    expect(m.embedding).toHaveBeenCalledWith('Temas, contenidos y unidades del Corte 1 de Cálculo');
    expect(m.fragmentos).toHaveBeenCalledWith(U, [0.1, 0.2], 6, DOC);
    expect(String(m.json.mock.calls[0]?.[0]?.contenido)).toContain('[F2]\nCorte 1: Derivadas');
    expect(String(m.json.mock.calls[0]?.[0]?.contenido)).toContain('no los propongas otra vez, ni con otras palabras:\n- Series');
    const insertar = m.consultar.mock.calls[3];
    expect(String(insertar?.[0])).toContain("'asistente', 'propuesto'");
    expect(insertar?.[1]).toEqual([U, C1, ['Límites y continuidad', 'Derivadas'], ['syllabus.pdf · p. 1', 'syllabus.pdf · p. 2']]);
  });

  it('sin temas válidos no guarda nada y lo dice', async () => {
    m.consultar.mockResolvedValueOnce(corte('2026-12-01')).mockResolvedValueOnce([{ materia_id: MAT, progreso: null }]).mockResolvedValueOnce([]);
    m.fragmentos.mockResolvedValueOnce([fragmento(1, 'x')]);
    m.json.mockResolvedValueOnce([{ nombre: 'Algo', fuente: 'F3' }]);
    await expect(proponerTemas(U, C1, DOC, HOY)).rejects.toMatchObject({ codigo: 'SIN_TEMAS_PROPUESTOS' });
    expect(m.consultar).toHaveBeenCalledTimes(3);
  });
});

describe('rutas de temas', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const json = (cuerpo: unknown, metodo = 'POST') => new Request('http://x', { method: metodo, body: JSON.stringify(cuerpo) });

  it('sin sesión 401 y fuera de la lista 403, sin tocar la base ni Gemini', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await rutaTemas.POST(json({ nombre: 'x' }), ctx(C1))).status).toBe(estado);
      expect((await rutaProponer.POST(json({ documentoId: DOC }), ctx(C1))).status).toBe(estado);
      expect((await rutaTema.PATCH(json({ confirmar: true }, 'PATCH'), ctx(T1))).status).toBe(estado);
      expect((await rutaTema.DELETE(new Request('http://x', { method: 'DELETE' }), ctx(T1))).status).toBe(estado);
    }
    expect(m.consultar).not.toHaveBeenCalled();
    expect(m.json).not.toHaveBeenCalled();
  });

  it('crear 201; nombre vacío 422; un campo de más o un id que no es uuid, 400', async () => {
    m.consultar.mockResolvedValueOnce([{ id: C1 }]).mockResolvedValueOnce([{ id: T1 }]);
    expect((await rutaTemas.POST(json({ nombre: 'Límites' }), ctx(C1))).status).toBe(201);
    const vacio = await rutaTemas.POST(json({ nombre: ' ' }), ctx(C1));
    expect(vacio.status).toBe(422);
    expect((await vacio.json()).error.mensaje).toBe('Escribe un tema de 1 a 200 caracteres.');
    expect((await rutaTema.PATCH(json({ estado: 'confirmado' }, 'PATCH'), ctx(T1))).status).toBe(400);
    expect((await rutaProponer.POST(json({ documentoId: 'x' }), ctx(C1))).status).toBe(400);
  });
});
