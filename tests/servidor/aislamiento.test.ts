// @vitest-environment node
// RB-01 (ampliación, E01): cada servicio filtra por el usuario de la sesión. Con la base simulada se
// comprueba que toda consulta lleva usuario_id y el id recibido, y que un registro de otro usuario
// (la base no devuelve filas) se comporta como inexistente.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultarBd: vi.fn(), txQuery: vi.fn(), responder: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({
  aLiteralVector: (v: number[]) => `[${v.join(',')}]`,
  consultar: m.consultarBd,
  conTransaccion: async (fn: (tx: { query: typeof m.txQuery }) => unknown) => fn({ query: m.txQuery }),
}));
vi.mock('@/lib/llm/gemini', () => ({ llm: { responder: m.responder, generarEmbeddings: vi.fn() } }));
vi.mock('@vercel/blob', () => ({ del: vi.fn() }));

import { eliminarDocumento, existenDocumentos, listarDocumentos } from '@/lib/datos/documentos';
import { recuperarFragmentos } from '@/lib/datos/fragmentos';
import { calcularProductividad } from '@/lib/datos/productividad';
import {
  completarTarea,
  crearTarea,
  eliminarTarea,
  hayTareasPendientes,
  listarTareas,
  tareasPendientesComoTexto,
} from '@/lib/datos/tareas';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ID = '44444444-4444-4444-8444-444444444444';

/** Cada llamada a la base debe filtrar por usuario_id y llevar el id del usuario indicado. */
function todasFiltranPor(usuario: string): void {
  expect(m.consultarBd).toHaveBeenCalled();
  for (const [sql, valores] of m.consultarBd.mock.calls) {
    expect(String(sql)).toMatch(/usuario_id|buscar_fragmentos_usuario/);
    expect(valores).toContain(usuario);
  }
}

describe('aislamiento por usuario (RB-01)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.consultarBd.mockResolvedValue([]);
  });

  it('crearTarea guarda el dueño', async () => {
    m.consultarBd.mockResolvedValue([{ id: ID }]);
    await crearTarea(A, { titulo: 'Pagar luz', fechaLimite: '2099-01-01' });
    const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
    expect(sql).toContain('usuario_id');
    expect(valores).toContain(A);
  });

  it('listarTareas y tareasPendientesComoTexto solo leen las del usuario', async () => {
    await listarTareas(A, { estado: 'Pendiente', fecha: '2026-03-10' });
    await tareasPendientesComoTexto(A);
    todasFiltranPor(A);
    expect(m.consultarBd.mock.calls[0]?.[1]?.[0]).toBe(A);
  });

  it('completar o eliminar la tarea de otro usuario responde TAREA_NO_ENCONTRADA', async () => {
    await expect(completarTarea(B, ID, 30)).rejects.toMatchObject({ codigo: 'TAREA_NO_ENCONTRADA' });
    await expect(eliminarTarea(B, ID)).rejects.toMatchObject({ codigo: 'TAREA_NO_ENCONTRADA' });
    todasFiltranPor(B);
  });

  it('documentos: listar, existir y eliminar filtran por usuario; el de otro no existe', async () => {
    await listarDocumentos(A);
    m.consultarBd.mockResolvedValueOnce([{ existe: false }]);
    await expect(existenDocumentos(A)).resolves.toBe(false);
    await expect(eliminarDocumento(A, ID)).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
    todasFiltranPor(A);
  });

  it('la búsqueda vectorial usa buscar_fragmentos_usuario con el usuario', async () => {
    await recuperarFragmentos(A, [0.1, 0.2], 4);
    const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
    expect(sql).toContain('buscar_fragmentos_usuario');
    expect(sql).not.toMatch(/buscar_fragmentos\(/);
    expect(valores).toEqual(['[0.1,0.2]', 4, A]);
  });

  it('el índice de productividad solo cuenta las tareas del usuario', async () => {
    m.consultarBd.mockResolvedValue([{ totales: 0, completadas: 0, minutos: 0 }]);
    await expect(calcularProductividad(A, '2026-03-10')).resolves.toEqual({ sinTareas: true });
    todasFiltranPor(A);
  });

  it('RB-30: al modelo van como máximo las 50 tareas pendientes de fecha límite más próxima', async () => {
    const muchas = Array.from({ length: 50 }, (_, i) => ({
      id: `${String(i).padStart(8, '0')}-0000`,
      titulo: `Tarea ${i}`,
      categoria: 'General',
      prioridad: 2,
      fechaLimite: '2099-01-01',
    }));
    m.consultarBd.mockResolvedValue(muchas);
    const tareas = await tareasPendientesComoTexto(A);
    const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
    expect(sql).toMatch(/ORDER BY fecha_limite/);
    expect(valores).toEqual([A, 'Pendiente', 50]);
    expect(tareas).toHaveLength(50);
  });

  it('hayTareasPendientes solo mira las pendientes del usuario', async () => {
    m.consultarBd.mockResolvedValue([{ existe: true }]);
    await expect(hayTareasPendientes(A)).resolves.toBe(true);
    const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
    expect(sql).toContain("estado = 'Pendiente'");
    expect(valores).toEqual([A]);
  });
});

