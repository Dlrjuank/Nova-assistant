// @vitest-environment node
// E05: servicio de categorías (base simulada) y sus rutas: aislamiento por usuario (RB-01), RB-02 a RB-04.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultarBd: vi.fn(), txQuery: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultarBd,
  conTransaccion: async (fn: (tx: { query: typeof m.txQuery }) => unknown) => fn({ query: m.txQuery }),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
// dataService solo carga dentro de Next (server-only): las rutas usan aquí el servicio real de categorías.
vi.mock('@/lib/dataService', async () => import('@/lib/datos/categorias'));

import * as rutaCategoria from '@/app/api/nova/categorias/[id]/route';
import * as rutaCategorias from '@/app/api/nova/categorias/route';
import { actualizarCategoria, crearCategoria, eliminarCategoria, listarCategorias } from '@/lib/datos/categorias';

const U = '11111111-1111-4111-8111-111111111111';
const ID = '55555555-5555-4555-8555-555555555555';
const duplicada = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'categorias_nombre_unico' });
const sqlDe = (llamadas: unknown[][]) => llamadas.map(([sql]) => String(sql));

beforeEach(() => {
  vi.resetAllMocks();
  m.consultarBd.mockResolvedValue([]);
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
});

describe('servicio de categorías', () => {
  it('listar asegura "General" y solo lee las del usuario', async () => {
    await listarCategorias(U);
    const [insertar, leer] = m.consultarBd.mock.calls;
    expect(insertar?.[0]).toContain('INSERT INTO categorias');
    expect(insertar?.[1]).toEqual([U, 'General', 'gris']);
    expect(leer?.[0]).toContain('WHERE c.usuario_id = $1');
    expect(leer?.[1]?.[0]).toBe(U);
  });

  it('crear sin color usa el siguiente libre de la paleta', async () => {
    m.consultarBd
      .mockResolvedValueOnce([]) // asegurar General
      .mockResolvedValueOnce([{ color: 'gris' }, { color: 'terracota' }]) // colores usados
      .mockResolvedValueOnce([{ id: ID }])
      .mockResolvedValueOnce([{ id: ID, nombre: 'Universidad', color: 'ambar', tareas: 0 }]);
    await expect(crearCategoria(U, { nombre: '  Universidad ' })).resolves.toMatchObject({ nombre: 'Universidad' });
    const insertar = m.consultarBd.mock.calls[2];
    expect(insertar?.[1]).toEqual([U, 'Universidad', 'ambar']);
  });

  it('RB-02: un nombre repetido (sin distinguir mayúsculas) responde el mensaje exacto', async () => {
    m.consultarBd.mockResolvedValueOnce([]).mockRejectedValueOnce(duplicada);
    await expect(crearCategoria(U, { nombre: 'CASA', color: 'azul' })).rejects.toMatchObject({
      codigo: 'CATEGORIA_DUPLICADA',
      message: 'Ya existe una categoría con ese nombre.',
    });
  });

  it('RB-03: un color fuera de la paleta no llega a la base', async () => {
    await expect(crearCategoria(U, { nombre: 'Casa', color: 'negro' })).rejects.toMatchObject({ codigo: 'COLOR_INVALIDO' });
    expect(m.consultarBd).not.toHaveBeenCalled();
  });

  it('renombrar actualiza las tareas del usuario en la misma transacción', async () => {
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'Casa' }] }).mockResolvedValue({ rows: [], rowCount: 2 });
    m.consultarBd.mockResolvedValueOnce([{ id: ID, nombre: 'Hogar', color: 'verde', tareas: 2 }]);
    await expect(actualizarCategoria(U, ID, { nombre: 'Hogar', color: 'verde' })).resolves.toMatchObject({ nombre: 'Hogar' });
    const sql = sqlDe(m.txQuery.mock.calls);
    expect(sql[0]).toContain('FOR UPDATE');
    expect(m.txQuery.mock.calls[0]?.[1]).toEqual([ID, U]);
    expect(sql[2]).toContain('UPDATE tareas_personales SET categoria');
    expect(m.txQuery.mock.calls[2]?.[1]).toEqual([U, 'Casa', 'Hogar']);
  });

  it('cambiar solo el color no toca las tareas', async () => {
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'Casa' }] }).mockResolvedValue({ rows: [] });
    m.consultarBd.mockResolvedValueOnce([{ id: ID, nombre: 'Casa', color: 'rosa', tareas: 0 }]);
    await actualizarCategoria(U, ID, { color: 'rosa' });
    expect(sqlDe(m.txQuery.mock.calls).some((s) => s.includes('tareas_personales'))).toBe(false);
  });

  it('General no se renombra (sí cambia de color); renombrar a un nombre existente responde RB-02', async () => {
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'General' }] });
    await expect(actualizarCategoria(U, ID, { nombre: 'Otra' })).rejects.toMatchObject({
      codigo: 'CATEGORIA_GENERAL',
      message: 'La categoría General no se puede renombrar.',
    });
    m.txQuery.mockReset();
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'Casa' }] }).mockRejectedValueOnce(duplicada);
    await expect(actualizarCategoria(U, ID, { nombre: 'Universidad' })).rejects.toMatchObject({ codigo: 'CATEGORIA_DUPLICADA' });
  });

  it('RB-01: la categoría de otro usuario responde como inexistente al editar y al eliminar', async () => {
    m.txQuery.mockResolvedValue({ rows: [] });
    await expect(actualizarCategoria(U, ID, { color: 'azul' })).rejects.toMatchObject({ codigo: 'CATEGORIA_NO_ENCONTRADA' });
    await expect(eliminarCategoria(U, ID)).rejects.toMatchObject({ codigo: 'CATEGORIA_NO_ENCONTRADA' });
  });

  it('RB-04: General no se elimina; otra pasa sus tareas a General y se borra', async () => {
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'General' }] });
    await expect(eliminarCategoria(U, ID)).rejects.toMatchObject({ message: 'La categoría General no se puede eliminar.' });
    m.txQuery.mockReset();
    m.txQuery
      .mockResolvedValueOnce({ rows: [{ nombre: 'Casa' }] })
      .mockResolvedValueOnce({ rows: [] }) // asegurar General
      .mockResolvedValueOnce({ rows: [], rowCount: 3 }) // mover tareas
      .mockResolvedValueOnce({ rows: [] }); // borrar
    await expect(eliminarCategoria(U, ID)).resolves.toEqual({ id: ID, tareasMovidas: 3 });
    expect(m.txQuery.mock.calls[2]?.[1]).toEqual([U, 'Casa', 'General']);
    expect(sqlDe(m.txQuery.mock.calls)[3]).toContain('DELETE FROM categorias WHERE id = $1 AND usuario_id = $2');
  });
});

describe('rutas /api/nova/categorias', () => {
  const contexto = (id = ID) => ({ params: Promise.resolve({ id }) });
  const json = (cuerpo: unknown, metodo = 'POST') => new Request('http://x', { method: metodo, body: JSON.stringify(cuerpo) });

  it('sin sesión 401 y fuera de la lista 403, sin tocar la base', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await rutaCategorias.GET()).status).toBe(estado);
      expect((await rutaCategorias.POST(json({ nombre: 'X' }))).status).toBe(estado);
      expect((await rutaCategoria.PATCH(json({ color: 'azul' }, 'PATCH'), contexto())).status).toBe(estado);
      expect((await rutaCategoria.DELETE(new Request('http://x', { method: 'DELETE' }), contexto())).status).toBe(estado);
    }
    expect(m.consultarBd).not.toHaveBeenCalled();
    expect(m.txQuery).not.toHaveBeenCalled();
  });

  it('crear responde 201; un nombre repetido 409 con el mensaje exacto', async () => {
    m.consultarBd
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: ID }])
      .mockResolvedValueOnce([{ id: ID, nombre: 'Casa', color: 'azul', tareas: 0 }]);
    expect((await rutaCategorias.POST(json({ nombre: 'Casa', color: 'azul' }))).status).toBe(201);
    m.consultarBd.mockResolvedValueOnce([]).mockRejectedValueOnce(duplicada);
    const r = await rutaCategorias.POST(json({ nombre: 'casa', color: 'azul' }));
    expect(r.status).toBe(409);
    expect((await r.json()).error.mensaje).toBe('Ya existe una categoría con ese nombre.');
  });

  it('un id que no es UUID es 400; un PATCH sin cambios es 400; eliminar General es 409', async () => {
    expect((await rutaCategoria.PATCH(json({ color: 'azul' }, 'PATCH'), contexto('x'))).status).toBe(400);
    expect((await rutaCategoria.PATCH(json({}, 'PATCH'), contexto())).status).toBe(400);
    m.txQuery.mockResolvedValueOnce({ rows: [{ nombre: 'General' }] });
    const r = await rutaCategoria.DELETE(new Request('http://x', { method: 'DELETE' }), contexto());
    expect(r.status).toBe(409);
    expect((await r.json()).error.mensaje).toBe('La categoría General no se puede eliminar.');
  });
});
