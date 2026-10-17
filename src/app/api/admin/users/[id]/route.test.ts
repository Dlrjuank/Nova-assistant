import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  select: vi.fn(),
  lookupMaybeSingle: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { updateUserById: mocks.updateUserById } },
    from: (table: string) => {
      expect(table).toBe('users');
      return {
        select: mocks.select,
        update: mocks.update,
      };
    },
  }),
}));

import { PATCH } from './route';

const userId = '123e4567-e89b-42d3-a456-426614174000';

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'admin@example.com');
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'admin-id', email: 'admin@example.com' } },
    error: null,
  });
  mocks.select.mockReturnValue({
    eq: () => ({
      maybeSingle: mocks.lookupMaybeSingle,
    }),
  });
  mocks.lookupMaybeSingle.mockResolvedValue({
    data: { id: userId, email: 'user@example.com' },
    error: null,
  });
  mocks.updateUserById.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({
    eq: () => ({
      select: () => ({
        maybeSingle: mocks.maybeSingle,
      }),
    }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PATCH /api/admin/users/[id]', () => {
  it('updates profile details and credentials for an administrator', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: userId,
        email: 'changed@example.com',
        full_name: 'Ada Lovelace',
        phone: '+1 555 0100',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const response = await PATCH(makeRequest({
      email: 'changed@example.com',
      full_name: 'Ada Lovelace',
      phone: '+1 555 0100',
      password: 'new-secure-pass',
      is_admin: true,
    }), { params: Promise.resolve({ id: userId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { email: 'changed@example.com', full_name: 'Ada Lovelace', phone: '+1 555 0100' },
    });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, {
      email: 'changed@example.com',
      password: 'new-secure-pass',
    });
    expect(mocks.update).toHaveBeenCalledWith({
      full_name: 'Ada Lovelace',
      phone: '+1 555 0100',
      updated_at: expect.any(String),
    });
  });

  it('rejects users who are not administrators', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-id', email: 'user@example.com' } },
      error: null,
    });

    const response = await PATCH(makeRequest({ email: 'user@example.com', full_name: 'Name', phone: '' }), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('validates credential and profile fields before updating', async () => {
    const response = await PATCH(makeRequest({
      email: 'user@example.com',
      full_name: 'a'.repeat(121),
      phone: '',
      password: 'short',
    }), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('does not replace a password when the optional password is omitted', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: userId,
        email: 'user@example.com',
        full_name: 'User',
        phone: '',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const response = await PATCH(makeRequest({
      email: 'user@example.com',
      full_name: 'User',
      phone: '',
    }), { params: Promise.resolve({ id: userId }) });

    expect(response.status).toBe(200);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it('does not save profile fields when Supabase rejects a credential update', async () => {
    mocks.updateUserById.mockResolvedValue({ error: { message: 'Update rejected' } });

    const response = await PATCH(makeRequest({
      email: 'user@example.com',
      full_name: 'User',
      phone: '',
      password: 'new-secure-pass',
    }), { params: Promise.resolve({ id: userId }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Supabase no pudo actualizar las credenciales del usuario.',
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps the administrator allowlisted when changing their own email', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId, email: 'admin@example.com' } },
      error: null,
    });
    mocks.lookupMaybeSingle.mockResolvedValue({
      data: { id: userId, email: 'admin@example.com' },
      error: null,
    });

    const response = await PATCH(makeRequest({
      email: 'new-admin@example.com',
      full_name: 'Admin',
      phone: '',
    }), { params: Promise.resolve({ id: userId }) });

    expect(response.status).toBe(400);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
