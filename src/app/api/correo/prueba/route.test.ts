import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarCorreo } from '@/lib/correo';
import { POST } from './route';

vi.mock('@/lib/correo', () => ({
  enviarCorreo: vi.fn(),
}));

const enviarCorreoMock = vi.mocked(enviarCorreo);

function crearSolicitud(body: unknown) {
  return new Request('http://localhost/api/correo/prueba', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/correo/prueba', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('no permite el envío en producción', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = await POST(crearSolicitud({ para: 'persona@example.com' }));

    expect(response.status).toBe(404);
    expect(enviarCorreoMock).not.toHaveBeenCalled();
  });

  it('rechaza una dirección de correo no válida', async () => {
    const response = await POST(crearSolicitud({ para: 'no-es-correo' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
    expect(enviarCorreoMock).not.toHaveBeenCalled();
  });

  it('incluye el error del proveedor cuando falla el envío', async () => {
    enviarCorreoMock.mockResolvedValue({ ok: false, error: 'Resend no está disponible.' });

    const response = await POST(crearSolicitud({ para: 'persona@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Resend no está disponible.');
  });

  it('envía un correo de prueba y devuelve su identificador', async () => {
    enviarCorreoMock.mockResolvedValue({ ok: true, id: 'correo-123' });

    const response = await POST(crearSolicitud({ para: 'persona@example.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, id: 'correo-123' });
    expect(enviarCorreoMock).toHaveBeenCalledWith({
      para: 'persona@example.com',
      asunto: 'Prueba de correo',
      html: expect.any(String),
    });
  });
});
