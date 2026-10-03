import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminEmail } from './admin';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin access', () => {
  it('allows only configured emails, ignoring case and surrounding whitespace', () => {
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'admin@example.com, second@example.com');

    expect(isAdminEmail(' Admin@Example.com ')).toBe(true);
    expect(isAdminEmail('second@example.com')).toBe(true);
    expect(isAdminEmail('user@example.com')).toBe(false);
  });

  it('denies access when the admin allowlist is empty', () => {
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', '');

    expect(isAdminEmail('admin@example.com')).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
