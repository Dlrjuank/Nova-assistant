import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  actualizarContrasena,
  buscarTokenVigentePorHash,
  invalidarTokensPendientes,
  marcarTokenComoUsado,
} from '@/lib/dataService';
import { POST } from './route';

vi.mock('@/lib/dataService', () => ({
  actualizarContrasena: vi.fn(),
  buscarTokenVigentePorHash: vi.fn(),
  invalidarTokensPendientes: vi.fn(),
  marcarTokenComoUsado: vi.fn(),
}));
vi.mock('@/lib/tokenRecuperacion', () => ({
  calcularHashToken: vi.fn((token: string) => `hash-${token}`),
}));

const actualizarContrasenaMock = vi.mocked(actualizarContrasena);
const buscarTokenMock = vi.mocked(buscarTokenVigentePorHash);
const invalidarTokensMock = vi.mocked(invalidarTokensPendientes);
const marcarTokenMock = vi.mocked(marcarTokenComoUsado);
const tokenValido = 'b'.repeat(64);

function crearSolicitud(body: unknown) {
  return new Request('http://localhost/api/auth/restablecer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/restablecer', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza datos inválidos sin consultar tokens', async () => {
    const response = await POST(
      crearSolicitud({ token: 'invalido', contrasena: '12345678', confirmacion: 'no-coincide' }),
    );

    expect(response.status).toBe(400);
    expect(buscarTokenMock).not.toHaveBeenCalled();
  });

  it('rechaza enlaces inexistentes o vencidos', async () => {
    buscarTokenMock.mockResolvedValue(null);

    const response = await POST(
      crearSolicitud({
        token: tokenValido,
        contrasena: 'NuevaClave123',
        confirmacion: 'NuevaClave123',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('El enlace no es válido o ya venció.');
    expect(actualizarContrasenaMock).not.toHaveBeenCalled();
  });

  it('actualiza la contraseña y consume los enlaces pendientes', async () => {
    buscarTokenMock.mockResolvedValue({
      id: 'token-1',
      usuario_id: 'usuario-1',
      token_hash: `hash-${tokenValido}`,
      expira_en: '2026-10-17T12:30:00.000Z',
      usado_en: null,
      creado_en: '2026-10-17T12:00:00.000Z',
    });
    marcarTokenMock.mockResolvedValue(true);
    actualizarContrasenaMock.mockResolvedValue();
    invalidarTokensMock.mockResolvedValue();

    const response = await POST(
      crearSolicitud({
        token: tokenValido,
        contrasena: 'NuevaClave123',
        confirmacion: 'NuevaClave123',
      }),
    );

    expect(response.status).toBe(200);
    expect(buscarTokenMock).toHaveBeenCalledWith(`hash-${tokenValido}`);
    expect(marcarTokenMock).toHaveBeenCalledWith('token-1');
    expect(actualizarContrasenaMock).toHaveBeenCalledWith('usuario-1', 'NuevaClave123');
    expect(invalidarTokensMock).toHaveBeenCalledWith('usuario-1', 'token-1');
  });

  it('no cambia la contraseña si el token ya fue consumido', async () => {
    buscarTokenMock.mockResolvedValue({
      id: 'token-1',
      usuario_id: 'usuario-1',
      token_hash: `hash-${tokenValido}`,
      expira_en: '2026-10-17T12:30:00.000Z',
      usado_en: null,
      creado_en: '2026-10-17T12:00:00.000Z',
    });
    marcarTokenMock.mockResolvedValue(false);

    const response = await POST(
      crearSolicitud({
        token: tokenValido,
        contrasena: 'NuevaClave123',
        confirmacion: 'NuevaClave123',
      }),
    );

    expect(response.status).toBe(400);
    expect(actualizarContrasenaMock).not.toHaveBeenCalled();
  });
});
