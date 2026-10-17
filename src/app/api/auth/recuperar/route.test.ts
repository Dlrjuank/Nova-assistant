import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarCorreo } from '@/lib/correo';
import {
  buscarUsuarioPorEmail,
  contarSolicitudesDeUsuario,
  crearTokenRecuperacion,
  invalidarTokensPendientes,
} from '@/lib/dataService';
import { POST } from './route';

vi.mock('@/lib/correo', () => ({ enviarCorreo: vi.fn() }));
vi.mock('@/lib/dataService', () => ({
  buscarUsuarioPorEmail: vi.fn(),
  contarSolicitudesDeUsuario: vi.fn(),
  crearTokenRecuperacion: vi.fn(),
  invalidarTokensPendientes: vi.fn(),
}));
vi.mock('@/lib/tokenRecuperacion', () => ({
  calcularHashToken: vi.fn((token: string) => `hash-${token}`),
  generarToken: vi.fn(() => 'a'.repeat(64)),
}));
vi.mock('@/lib/urlBase', () => ({ obtenerUrlBase: vi.fn(() => 'https://nova.example') }));
vi.mock('@/lib/plantillasCorreo', () => ({
  plantillaRecuperacion: vi.fn((enlace: string) => `<a href="${enlace}">Recuperar</a>`),
}));

const buscarUsuarioMock = vi.mocked(buscarUsuarioPorEmail);
const contarSolicitudesMock = vi.mocked(contarSolicitudesDeUsuario);
const crearTokenMock = vi.mocked(crearTokenRecuperacion);
const invalidarTokensMock = vi.mocked(invalidarTokensPendientes);
const enviarCorreoMock = vi.mocked(enviarCorreo);

function crearSolicitud(body: unknown) {
  return new Request('http://localhost/api/auth/recuperar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/recuperar', () => {
  beforeEach(() => {
    buscarUsuarioMock.mockResolvedValue({ id: 'usuario-1', email: 'persona@example.com' });
    contarSolicitudesMock.mockResolvedValue(0);
    crearTokenMock.mockResolvedValue();
    invalidarTokensMock.mockResolvedValue();
    enviarCorreoMock.mockResolvedValue({ ok: true, id: 'correo-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('valida el correo antes de procesar la solicitud', async () => {
    const response = await POST(crearSolicitud({ email: 'no-es-correo' }));

    expect(response.status).toBe(400);
    expect(buscarUsuarioMock).not.toHaveBeenCalled();
  });

  it('devuelve el mismo mensaje aunque el correo no esté registrado', async () => {
    buscarUsuarioMock.mockResolvedValue(null);

    const response = await POST(crearSolicitud({ email: 'persona@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mensaje).toBe(
      'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
    );
    expect(enviarCorreoMock).not.toHaveBeenCalled();
  });

  it('crea solo un hash almacenado y envía un enlace temporal', async () => {
    const response = await POST(crearSolicitud({ email: 'persona@example.com' }));

    expect(response.status).toBe(200);
    expect(crearTokenMock).toHaveBeenCalledWith(
      'usuario-1',
      `hash-${'a'.repeat(64)}`,
      expect.any(String),
    );
    expect(enviarCorreoMock).toHaveBeenCalledWith({
      para: 'persona@example.com',
      asunto: 'Restablecer contraseña',
      html: expect.stringContaining(
        `https://nova.example/restablecer-contrasena?token=${'a'.repeat(64)}`,
      ),
    });
    expect(invalidarTokensMock).toHaveBeenCalledTimes(1);
  });

  it('no envía más de tres solicitudes en quince minutos', async () => {
    contarSolicitudesMock.mockResolvedValue(3);

    const response = await POST(crearSolicitud({ email: 'persona@example.com' }));

    expect(response.status).toBe(200);
    expect(enviarCorreoMock).not.toHaveBeenCalled();
    expect(crearTokenMock).not.toHaveBeenCalled();
  });

  it('mantiene la respuesta genérica si falla el envío', async () => {
    enviarCorreoMock.mockResolvedValue({ ok: false, error: 'Proveedor no disponible.' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(crearSolicitud({ email: 'persona@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mensaje).toContain('Si el correo está registrado');
    expect(invalidarTokensMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
