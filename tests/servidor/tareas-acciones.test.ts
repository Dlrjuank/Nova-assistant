// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  completarTarea: vi.fn(),
  eliminarTarea: vi.fn(),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({ completarTarea: m.completarTarea, eliminarTarea: m.eliminarTarea }));

import * as completarRuta from '@/app/api/nova/tareas/[id]/completar/route';
import * as tareaRuta from '@/app/api/nova/tareas/[id]/route';

const ID = '11111111-1111-4111-8111-111111111111';
const contexto = (id = ID) => ({ params: Promise.resolve({ id }) });
const post = (cuerpo: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(cuerpo) });
const borrar = () => new Request('http://x', { method: 'DELETE' });

describe('completar y eliminar tareas', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.exigirSesion.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
  });

  it('sin sesión o fuera de la lista no tocan datos', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await completarRuta.POST(post({ minutos: 1 }), contexto())).status).toBe(estado);
      expect((await tareaRuta.DELETE(borrar(), contexto())).status).toBe(estado);
    }
    expect(m.completarTarea).not.toHaveBeenCalled();
    expect(m.eliminarTarea).not.toHaveBeenCalled();
  });

  it('completar: pasa el usuario de la sesión, el id y los minutos', async () => {
    m.completarTarea.mockResolvedValue({ id: ID, estado: 'Completada' });
    const r = await completarRuta.POST(post({ minutos: 30 }), contexto());
    expect(r.status).toBe(200);
    expect(m.completarTarea).toHaveBeenCalledWith('u1', ID, 30);
  });

  it('completar: RN-17, minutos negativos, decimales o enormes son 400', async () => {
    for (const minutos of [-1, 1.5, '10', 3_000_000_000]) {
      const r = await completarRuta.POST(post({ minutos }), contexto());
      expect(r.status).toBe(400);
    }
    expect(m.completarTarea).not.toHaveBeenCalled();
  });

  it('completar: RN-16, ya completada es 409 e inexistente es 404', async () => {
    m.completarTarea.mockRejectedValueOnce(new ErrorDeNegocio('TAREA_YA_COMPLETADA'));
    const ya = await completarRuta.POST(post({ minutos: 1 }), contexto());
    expect(ya.status).toBe(409);
    expect((await ya.json()).error.mensaje).toBe('La tarea ya está completada.');

    m.completarTarea.mockRejectedValueOnce(new ErrorDeNegocio('TAREA_NO_ENCONTRADA'));
    expect((await completarRuta.POST(post({ minutos: 1 }), contexto())).status).toBe(404);
  });

  it('un id que no es UUID es 400 y no llega a la base', async () => {
    expect((await completarRuta.POST(post({ minutos: 1 }), contexto('abc'))).status).toBe(400);
    expect((await tareaRuta.DELETE(borrar(), contexto("1' OR '1'='1"))).status).toBe(400);
    expect(m.completarTarea).not.toHaveBeenCalled();
    expect(m.eliminarTarea).not.toHaveBeenCalled();
  });

  it('eliminar: borra por id; inexistente es 404', async () => {
    m.eliminarTarea.mockResolvedValueOnce(undefined);
    const r = await tareaRuta.DELETE(borrar(), contexto());
    expect(r.status).toBe(200);
    expect(m.eliminarTarea).toHaveBeenCalledWith('u1', ID);

    m.eliminarTarea.mockRejectedValueOnce(new ErrorDeNegocio('TAREA_NO_ENCONTRADA'));
    expect((await tareaRuta.DELETE(borrar(), contexto())).status).toBe(404);
  });
});
