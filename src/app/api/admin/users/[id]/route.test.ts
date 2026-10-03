import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      expect(table).toBe('users');
      return {
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
  it('updates only the allowed profile fields for an administrator', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: userId,
        email: 'user@example.com',
        full_name: 'Ada Lovelace',
        phone: '+1 555 0100',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    const response = await PATCH(makeRequest({
      full_name: 'Ada Lovelace',
      phone: '+1 555 0100',
      email: 'changed@example.com',
      is_admin: true,
    }), { params: Promise.resolve({ id: userId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { email: 'user@example.com', full_name: 'Ada Lovelace', phone: '+1 555 0100' },
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

    const response = await PATCH(makeRequest({ full_name: 'Name', phone: '' }), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('validates profile field lengths before updating', async () => {
    const response = await PATCH(makeRequest({ full_name: 'a'.repeat(121), phone: '' }), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
