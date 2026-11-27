// E21, adelantada (2026-11-26): la página pública de privacidad y su enlace en el inicio de sesión.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));

import PrivacidadPage from '@/app/privacidad/page';
import { LoginForm } from '@/components/login/LoginForm';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config as configMiddleware } from '@/middleware';

afterEach(cleanup);

describe('/privacidad', () => {
  it('explica los datos, Gemini y Google, cómo eliminar la cuenta y el contacto', () => {
    render(<PrivacidadPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacidad' })).toBeTruthy();
    for (const t of ['Qué guarda Nova', 'Qué se envía a Gemini y a Google', 'Cómo eliminar tu cuenta', 'Contacto']) {
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeTruthy();
    }
    const correos = screen.getAllByRole('link', { name: 'nova.asistente.app@gmail.com' });
    expect(correos[0]?.getAttribute('href')).toBe('mailto:nova.asistente.app@gmail.com');
  });

  it('se ve sin iniciar sesión (el middleware no corre en ella)', () => {
    expect(unstable_doesMiddlewareMatch({ config: configMiddleware, url: '/privacidad' })).toBe(false);
  });

  it('el inicio de sesión la enlaza', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe('/privacidad');
  });
});
