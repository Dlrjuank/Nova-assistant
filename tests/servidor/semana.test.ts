// @vitest-environment node
// E06: servicio de la semana de Inicio (base simulada) y GET /api/nova/semana.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultarBd: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultarBd, conTransaccion: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/semana'));

import * as rutaSemana from '@/app/api/nova/semana/route';
import { semanaDeTareas } from '@/lib/datos/semana';
import { hoyBogota } from '@/lib/reglas/fechas';

const U = '11111111-1111-4111-8111-111111111111';
const tarea = (id: string, fechaLimite: string, estado = 'Pendiente') => ({
  id, titulo: id, categoria: 'General', prioridad: 2, estado, minutosInvertidos: 0, fechaLimite, fechaCreacion: '2026-11-01', fechaCierre: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
});

describe('semanaDeTareas', () => {
  it('lee la semana pedida, las pendientes de hoy y las vencidas, solo del usuario', async () => {
    m.consultarBd.mockImplementation(async (sql: string, valores: unknown[]) => {
      if (String(sql).includes('COUNT(*)')) return [{ n: 2 }];
      if (valores.includes('Pendiente')) return [tarea('hoy', hoyBogota())];
      return [tarea('lun', '2026-11-02', 'Completada'), tarea('vie', '2026-11-06')];
    });
    const s = await semanaDeTareas(U, '2026-11-04');
    expect(s.lunes).toBe('2026-11-02');
    expect(s.domingo).toBe('2026-11-08');
    expect(s.dias).toHaveLength(7);
    expect(s.porDia['2026-11-02']?.map((t) => t.id)).toEqual(['lun']);
    expect(s.progreso).toEqual({ total: 2, completadas: 1, pendientes: 1, porcentaje: 50 });
    expect(s.hoyPendientes.map((t) => t.id)).toEqual(['hoy']);
    expect(s.vencidas).toBe(2);
    for (const [sql, valores] of m.consultarBd.mock.calls) {
      expect(String(sql)).toContain('usuario_id');
      expect(valores?.[0]).toBe(U);
    }
    const rango = m.consultarBd.mock.calls.find(([sql]) => String(sql).includes('fecha_limite >='));
    expect(rango?.[1]).toEqual([U, '2026-11-02', '2026-11-08', 500]);
  });

  it('sin fecha o con una inválida, muestra la semana actual', async () => {
    m.consultarBd.mockResolvedValue([]);
    const s = await semanaDeTareas(U, '2026-02-30');
    expect(s.dias).toContain(hoyBogota());
  });
});

describe('GET /api/nova/semana', () => {
  it('sin sesión 401; una fecha inválida 422 con el mensaje de siempre', async () => {
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaSemana.GET(new Request('http://x/api/nova/semana'))).status).toBe(401);
    const r = await rutaSemana.GET(new Request('http://x/api/nova/semana?inicio=2026-02-30'));
    expect(r.status).toBe(422);
    expect((await r.json()).error.mensaje).toBe('La fecha debe tener formato AAAA-MM-DD y ser una fecha real.');
    expect(m.consultarBd).not.toHaveBeenCalled();
  });

  it('con una fecha válida responde la semana', async () => {
    m.consultarBd.mockResolvedValue([]);
    const r = await rutaSemana.GET(new Request('http://x/api/nova/semana?inicio=2026-11-04'));
    expect(r.status).toBe(200);
    expect((await r.json()).datos.lunes).toBe('2026-11-02');
  });
});
