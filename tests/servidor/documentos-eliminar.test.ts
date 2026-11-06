// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  eliminarDocumento: vi.fn(),
  consultarBd: vi.fn(),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({ eliminarDocumento: m.eliminarDocumento }));

import * as documentoRuta from '@/app/api/nova/documentos/[id]/route';

const ID = '44444444-4444-4444-8444-444444444444';
const contexto = (id = ID) => ({ params: Promise.resolve({ id }) });
const borrar = () => new Request('http://x', { method: 'DELETE' });

describe('DELETE /api/nova/documentos/[id] (RN-22)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.exigirSesion.mockResolvedValue({ id: 'u1', email: 'dueno@ejemplo.com' });
  });

  it('sin sesión o fuera de la lista no borra', async () => {
    for (const [codigo, estado] of [['NO_AUTORIZADO', 401], ['ACCESO_DENEGADO', 403]] as const) {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio(codigo));
      expect((await documentoRuta.DELETE(borrar(), contexto())).status).toBe(estado);
    }
    expect(m.eliminarDocumento).not.toHaveBeenCalled();
  });

  it('borra por id y responde { id }', async () => {
    m.eliminarDocumento.mockResolvedValue(undefined);
    const r = await documentoRuta.DELETE(borrar(), contexto());
    expect(await r.json()).toEqual({ ok: true, datos: { id: ID } });
    expect(m.eliminarDocumento).toHaveBeenCalledWith('u1', ID);
  });

  it('un id que no es UUID es 400 y no llega al servicio; uno inexistente es 404', async () => {
    expect((await documentoRuta.DELETE(borrar(), contexto('abc'))).status).toBe(400);
    expect(m.eliminarDocumento).not.toHaveBeenCalled();
    m.eliminarDocumento.mockRejectedValue(new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO'));
    const r = await documentoRuta.DELETE(borrar(), contexto());
    expect(r.status).toBe(404);
    expect((await r.json()).error.mensaje).toBe('El documento no existe.');
  });
});

describe('eliminarDocumento', () => {
  it('borra el documento (los fragmentos caen en cascada) o lanza DOCUMENTO_NO_ENCONTRADO', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db/conexion', () => ({ consultar: m.consultarBd, conTransaccion: vi.fn(), aLiteralVector: vi.fn() }));
    vi.doMock('@vercel/blob', () => ({ del: vi.fn() }));
    const { eliminarDocumento } = await import('@/lib/datos/documentos');

    m.consultarBd.mockResolvedValueOnce([{ id: ID }]);
    await expect(eliminarDocumento('u1', ID)).resolves.toBeUndefined();
    expect(m.consultarBd.mock.calls[0]?.[0]).toContain('DELETE FROM documentos WHERE id = $1 AND usuario_id = $2');
    expect(m.consultarBd.mock.calls[0]?.[1]).toEqual([ID, 'u1']);

    m.consultarBd.mockResolvedValueOnce([]);
    await expect(eliminarDocumento('u1', ID)).rejects.toMatchObject({ codigo: 'DOCUMENTO_NO_ENCONTRADO' });
  });
});
