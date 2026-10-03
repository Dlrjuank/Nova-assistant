import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseConfig } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Supabase configuration', () => {
  it('accepts the existing project-prefixed URL and publishable key', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL',
      'https://project.supabase.co',
    );
    vi.stubEnv(
      'NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_test',
    );

    expect(getSupabaseConfig()).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
    });
  });

  it('prefers the standard Supabase variables when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://standard.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_standard');
    vi.stubEnv(
      'NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL',
      'https://legacy.supabase.co',
    );
    vi.stubEnv(
      'NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_PUBLISHABLE_KEY',
      'sb_publishable_legacy',
    );

    expect(getSupabaseConfig()).toEqual({
      url: 'https://standard.supabase.co',
      publishableKey: 'sb_publishable_standard',
    });
  });

  it('fails explicitly when Supabase config is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_NOVAASSISTANT_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_NOVAASSISTANT_NOVAASSISTANTSUPABASE_ANON_KEY', '');
    vi.stubEnv('NOVAASSISTANT_SUPABASE_ANON_KEY', '');

    expect(() => getSupabaseConfig()).toThrow('Falta configurar la URL o la clave pública');
  });
});
