// @vitest-environment node
// E20 (sección 10): GET /api/nova/estadisticas con la sesión del usuario.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ exigirSesion: vi.fn(), listarMaterias: vi.fn(), preferencias: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/datos/semestre', () => ({ listarMaterias: m.listarMaterias }));
vi.mock('@/lib/datos/configuracion', () => ({ obtenerPreferencias: m.preferencias }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/estadisticas'));

import { GET } from '@/app/api/nova/estadisticas/route';

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: 'u1' });
  m.preferencias.mockResolvedValue({ notaAprobar: 300, redondeo: 'truncar' });
});

describe('GET /api/nova/estadisticas', () => {
  it('devuelve las materias del usuario con su nota y su riesgo', async () => {
    m.listarMaterias.mockResolvedValue([
      {
        id: 'm1',
        nombre: 'Física',
        creditos: 3,
        docente: null,
        usaCortes: false,
        fallasLimite: null,
        fallasRegistradas: 0,
        cortes: [{ id: 'c1', orden: 1, nombre: 'Corte único', porcentaje: 10000, fecha: null, componentes: [{ id: 'k', orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: [{ id: 'n', orden: 1, nombre: null, nota: 200, fecha: null }, { id: 'n2', orden: 2, nombre: null, nota: null, fecha: null }] }] }],
      },
    ]);
    const r = await GET();
    expect(r.status).toBe(200);
    const { datos } = (await r.json()) as { datos: { materias: Array<{ actual: number }>; enRiesgo: Array<{ estado: string }> } };
    expect(m.listarMaterias).toHaveBeenCalledWith('u1');
    expect(datos.materias[0]?.actual).toBe(20);
    expect(datos.enRiesgo[0]?.estado).toBe('En riesgo');
  });

  it('sin sesión, 401', async () => {
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await GET()).status).toBe(401);
  });
});
