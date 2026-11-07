// @vitest-environment node
// E08: filtros de las vistas de Tareas en el servicio (base simulada).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultarBd: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd, conTransaccion: vi.fn() }));

import { listarTareas } from '@/lib/datos/tareas';
import { filtroDeVista } from '@/lib/reglas/vistasTareas';

const U = '11111111-1111-4111-8111-111111111111';
const HOY = '2026-11-07';
const consulta = () => {
  const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
  return { sql: String(sql).replace(/\s+/g, ' '), valores };
};

beforeEach(() => {
  vi.resetAllMocks();
  m.consultarBd.mockResolvedValue([]);
});

describe('listarTareas con las vistas de E08', () => {
  it('Importantes: solo pendientes de prioridad Alta, del usuario', async () => {
    await listarTareas(U, filtroDeVista('importantes', HOY));
    const { sql, valores } = consulta();
    expect(sql).toContain("usuario_id = $1 AND estado <> 'Completada' AND prioridad = $2");
    expect(valores).toEqual([U, 3, 500]);
  });

  it('Hoy: fecha límite hoy, pendientes y completadas', async () => {
    await listarTareas(U, filtroDeVista('hoy', HOY));
    const { sql, valores } = consulta();
    expect(sql).toContain('fecha_limite >= $2 AND fecha_limite <= $3');
    expect(sql.slice(sql.indexOf('WHERE'))).not.toContain('estado');
    expect(valores).toEqual([U, HOY, HOY, 500]);
  });

  it('Vencidas con categoría: pendientes hasta ayer, sin distinguir mayúsculas en la categoría', async () => {
    await listarTareas(U, { ...filtroDeVista('vencidas', HOY), categoria: 'Casa' });
    const { sql, valores } = consulta();
    expect(sql).toContain("estado <> 'Completada'");
    expect(sql).toContain('fecha_limite <= $2');
    expect(sql).toContain('lower(btrim(categoria)) = lower($3)');
    expect(valores).toEqual([U, '2026-11-06', 'Casa', 500]);
  });

  it('Completadas: estado Completada', async () => {
    await listarTareas(U, filtroDeVista('completadas', HOY));
    expect(consulta().valores).toEqual([U, 'Completada', 500]);
  });
});
