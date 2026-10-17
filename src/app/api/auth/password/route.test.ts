import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
  }),
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-id', email: 'user@example.com' } },
    error: null,
  });
  mocks.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'user-id', email: 'user@example.com' } },
    error: null,
  });
  mocks.updateUser.mockResolvedValue({ error: null });
});

describe('POST /api/auth/password', () => {
  it('verifies the current password and changes it for the signed-in user', async () => {
    const response = await POST(makeRequest({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'old-password',
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
  });

  it('rejects an incorrect current password without updating the password', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid credentials'),
    });

    const response = await POST(makeRequest({
      currentPassword: 'wrong-password',
      newPassword: 'new-password-123',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'La contraseña actual es incorrecta.' });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a credential verification for a different account', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'different-user-id' } },
      error: null,
    });

    const response = await POST(makeRequest({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    }));

    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('requires an authenticated session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('missing session') });

    const response = await POST(makeRequest({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    }));

    expect(response.status).toBe(401);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('rejects short or unchanged new passwords', async () => {
    const shortResponse = await POST(makeRequest({
      currentPassword: 'old-password',
      newPassword: 'short',
    }));
    const unchangedResponse = await POST(makeRequest({
      currentPassword: 'same-password',
      newPassword: 'same-password',
    }));

    expect(shortResponse.status).toBe(400);
    expect(unchangedResponse.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
