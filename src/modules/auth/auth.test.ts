import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      getUser: mocks.getUser,
    },
  }),
}));

import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as register } from '@/app/api/auth/register/route';
import { GET as getSession } from '@/app/api/auth/session/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Supabase authentication routes', () => {
  it('registers accounts with Supabase Auth and requests email confirmation', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'auth-user-1', email: 'user@example.com' }, session: null },
      error: null,
    });

    const response = await register(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'secure-pass-123' }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { id: 'auth-user-1', requiresEmailConfirmation: true },
    });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secure-pass-123',
      options: { emailRedirectTo: 'http://localhost/auth/callback' },
    });
  });

  it('authenticates with Supabase and never returns access tokens', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'auth-user-1', email: 'user@example.com' },
        session: { access_token: 'private-token' },
      },
      error: null,
    });

    const response = await login(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'secure-pass-123' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: 'auth-user-1', email: 'user@example.com' });
    expect(JSON.stringify(body)).not.toContain('private-token');
  });

  it('rejects invalid Supabase credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('invalid credentials'),
    });

    const response = await login(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'wrong-password' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: 'Correo o contraseña incorrectos.' });
  });

  it('closes the Supabase Auth session', async () => {
    mocks.signOut.mockResolvedValue({ error: null });

    const response = await logout();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('reports an unauthenticated session without treating it as a server error', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error('No session'), {
        name: 'AuthSessionMissingError',
        status: 400,
      }),
    });

    const response = await getSession();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: null });
  });
});
