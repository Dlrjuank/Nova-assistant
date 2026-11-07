// @vitest-environment node
// E07: servicio del mes (base simulada) y GET /api/nova/calendario.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultarBd: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd, conTransaccion: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/calendario'));

import * as rutaCalendario from '@/app/api/nova/calendario/route';
import { mesDeTareas } from '@/lib/datos/calendario';
import { hoyBogota } from '@/lib/reglas/fechas';

const U = '11111111-1111-4111-8111-111111111111';
const tarea = (id: string, fechaLimite: string, estado = 'Pendiente', horaInicio: string | null = null) => ({
  id, titulo: id, categoria: 'General', prioridad: 2, estado, minutosInvertidos: 0, fechaLimite, fechaCreacion: '2026-11-01', fechaCierre: null, horaInicio, horaFin: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
});

describe('mesDeTareas', () => {
  it('lee solo las tareas del usuario en el rango de la cuadrícula y ordena cada día', async () => {
    m.consultarBd.mockResolvedValue([
      tarea('hecha', '2026-11-10', 'Completada', '07:00'),
      tarea('sin hora', '2026-11-10'),
      tarea('9am', '2026-11-10', 'Pendiente', '09:00'),
      tarea('vecino', '2026-10-27'),
    ]);
    const mes = await mesDeTareas(U, '2026-11');
    const [sql, valores] = m.consultarBd.mock.calls[0] ?? [];
    expect(String(sql)).toContain('usuario_id = $1');
    expect(valores).toEqual([U, '2026-10-26', '2026-12-06', 500]);
    expect(mes.semanas).toHaveLength(6);
    expect(mes.porDia['2026-11-10']?.map((t) => t.id)).toEqual(['9am', 'sin hora', 'hecha']);
    expect(mes.porDia['2026-10-27']?.map((t) => t.id)).toEqual(['vecino']); // días vecinos visibles
    expect(mes.eventos).toEqual({}); // Semestre llega en E13: sin datos falsos
  });

  it('sin mes o con uno inválido, el mes actual', async () => {
    m.consultarBd.mockResolvedValue([]);
    expect((await mesDeTareas(U, '2026-13')).mes).toBe(hoyBogota().slice(0, 7));
  });
});

describe('GET /api/nova/calendario', () => {
  it('sin sesión 401; un mes inválido 400 sin tocar la base; uno válido 200', async () => {
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaCalendario.GET(new Request('http://x/api/nova/calendario'))).status).toBe(401);
    expect((await rutaCalendario.GET(new Request('http://x/api/nova/calendario?mes=2026-13'))).status).toBe(400);
    expect(m.consultarBd).not.toHaveBeenCalled();
    m.consultarBd.mockResolvedValue([]);
    const r = await rutaCalendario.GET(new Request('http://x/api/nova/calendario?mes=2027-02'));
    expect(r.status).toBe(200);
    expect((await r.json()).datos.semanas).toHaveLength(4);
  });
});
