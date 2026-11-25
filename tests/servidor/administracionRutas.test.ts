// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

/** S-85 (RB-83): cada ruta de "Administración" exige un administrador; a los demás, 403 sin ningún dato. */
const m = vi.hoisted(() => ({
  exigirAdministrador: vi.fn(),
  panelAdministracion: vi.fn(),
  cambiarTopes: vi.fn(),
  accionSobreCuenta: vi.fn(),
  eliminarCuenta: vi.fn(),
}));
vi.mock('@/lib/dataService', () => m);

import * as panel from '@/app/api/nova/administracion/route';
import * as cuenta from '@/app/api/nova/administracion/cuentas/[id]/route';

const ID = '33333333-3333-4333-8333-333333333333';
const ctx = { params: Promise.resolve({ id: ID }) };
const pedido = (metodo: string, cuerpo?: unknown) => new Request('http://x/api/nova/administracion', { method: metodo, ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) });

const rutas = () => [
  () => panel.GET(),
  () => panel.PATCH(pedido('PATCH', { cuentas: 10, mb: 20 })),
  () => cuenta.POST(pedido('POST', { accion: 'bloquear' }), ctx),
  () => cuenta.DELETE(pedido('DELETE', { correo: 'a@x.com' }), ctx),
];

describe('API de Administración', () => {
  beforeEach(() => {
    for (const f of Object.values(m)) f.mockReset();
  });

  it('una cuenta que no es administradora recibe 403 y ningún dato en cada ruta', async () => {
    m.exigirAdministrador.mockRejectedValue(new ErrorDeNegocio('ACCESO_DENEGADO'));
    for (const llamar of rutas()) {
      const r = await llamar();
      expect(r.status).toBe(403);
      const cuerpo = await r.json();
      expect(cuerpo).toEqual({ ok: false, error: { codigo: 'ACCESO_DENEGADO', mensaje: 'Tu cuenta no tiene acceso a Nova Assistant.', detalles: null } });
    }
    expect(m.panelAdministracion).not.toHaveBeenCalled();
    expect(m.accionSobreCuenta).not.toHaveBeenCalled();
    expect(m.eliminarCuenta).not.toHaveBeenCalled();
    expect(m.cambiarTopes).not.toHaveBeenCalled();
  });

  it('sin sesión, 401 en cada ruta', async () => {
    m.exigirAdministrador.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    for (const llamar of rutas()) expect((await llamar()).status).toBe(401);
  });

  it('con un administrador: valida el id, la acción y el cuerpo antes de llamar al servicio', async () => {
    const sesion = { id: 'a', email: 'a@x.com', nivel: 'admin' };
    m.exigirAdministrador.mockResolvedValue(sesion);
    m.accionSobreCuenta.mockResolvedValue({ estado: 'bloqueada', nivel: 'usuario', usaClaveProyecto: false });
    const ok = await cuenta.POST(pedido('POST', { accion: 'bloquear' }), ctx);
    expect(ok.status).toBe(200);
    expect(m.accionSobreCuenta).toHaveBeenCalledWith(sesion, ID, 'bloquear');
    expect((await cuenta.POST(pedido('POST', { accion: 'borrar_todo' }), ctx)).status).toBe(400);
    expect((await cuenta.POST(pedido('POST', { accion: 'bloquear' }), { params: Promise.resolve({ id: 'no-uuid' }) })).status).toBe(400);
    expect((await panel.PATCH(pedido('PATCH', { cuentas: '10', mb: 20 }))).status).toBe(400);
  });
});
