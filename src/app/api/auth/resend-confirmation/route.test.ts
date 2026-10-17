import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { resend: mocks.resend },
  }),
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/resend-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resend.mockResolvedValue({ error: null });
});

describe('POST /api/auth/resend-confirmation', () => {
  it('resends signup confirmation to a valid email with the current host callback', async () => {
    const response = await POST(makeRequest({ email: ' user@example.com ' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'user@example.com',
      options: { emailRedirectTo: 'http://localhost/auth/callback' },
    });
  });

  it('validates email before asking Supabase to resend', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email' }));

    expect(response.status).toBe(400);
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it('reports Supabase resend errors', async () => {
    mocks.resend.mockResolvedValue({ error: { message: 'rate limited' } });

    const response = await POST(makeRequest({ email: 'user@example.com' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'No se pudo reenviar el correo de confirmación. Verifica la cuenta y la configuración de Supabase.',
    });
  });
});
