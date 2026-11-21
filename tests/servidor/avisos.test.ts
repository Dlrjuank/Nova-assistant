// @vitest-environment node
// E20b (commit 1): GET /api/nova/avisos con la sesión del usuario: nombre, vencidas y próximo corte.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ exigirSesion: vi.fn(), consultar: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/avisos'));

import { GET } from '@/app/api/nova/avisos/route';
import { avisosNavegacion } from '@/lib/datos/avisos';

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: 'u1' });
});

describe('avisos de la navegación', () => {
  it('tres consultas del usuario, con la fecha de hoy; el corte más próximo desde hoy', async () => {
    m.consultar
      .mockResolvedValueOnce([{ full_name: 'Juan' }])
      .mockResolvedValueOnce([{ n: '2' }])
      .mockResolvedValueOnce([{ materia_id: 'm1', materia: 'Cálculo', corte: 'Corte 2', fecha: '2026-11-20' }]);
    await expect(avisosNavegacion('u1', '2026-11-17')).resolves.toEqual({
      nombre: 'Juan',
      vencidas: 2,
      proximoCorte: { materiaId: 'm1', materia: 'Cálculo', corte: 'Corte 2', fecha: '2026-11-20' },
    });
    for (const [, valores] of m.consultar.mock.calls) expect(valores[0]).toBe('u1');
    expect(m.consultar.mock.calls[1]?.[1]).toEqual(['u1', '2026-11-17']);
    expect(String(m.consultar.mock.calls[2]?.[0])).toContain('c.fecha >= $2');
  });

  it('sin nombre, sin vencidas y sin cortes', async () => {
    m.consultar.mockResolvedValueOnce([]).mockResolvedValueOnce([{ n: 0 }]).mockResolvedValueOnce([]);
    await expect(avisosNavegacion('u1', '2026-11-17')).resolves.toEqual({ nombre: '', vencidas: 0, proximoCorte: null });
  });

  it('la ruta usa la sesión; sin sesión, 401', async () => {
    m.consultar.mockResolvedValue([]);
    const r = await GET();
    expect(r.status).toBe(200);
    expect((await r.json()).datos.vencidas).toBe(0);
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await GET()).status).toBe(401);
  });
});
