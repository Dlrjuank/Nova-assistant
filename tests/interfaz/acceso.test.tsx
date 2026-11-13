// E04: login, registro y recuperación con el estilo de Nova. Comprueba que la lógica y los mensajes
// no cambiaron: validaciones, rutas a las que llaman y a dónde llevan.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }) }));

import { LoginForm } from '@/components/login/LoginForm';
import { PasswordResetForm } from '@/components/login/PasswordResetForm';
import { RecoveryRequestForm } from '@/components/login/RecoveryRequestForm';
import { RegisterForm } from '@/components/login/RegisterForm';
import { TarjetaAcceso } from '@/components/login/TarjetaAcceso';

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.replace.mockReset();
});

describe('TarjetaAcceso', () => {
  it('marca Nova, título como h1, subtítulo y pie', () => {
    render(
      <TarjetaAcceso titulo="Título" subtitulo="Sub" pie={<a href="/x">Pie</a>}>
        <p>Contenido</p>
      </TarjetaAcceso>,
    );
    expect(screen.getByText('Nova')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Título' })).toBeTruthy();
    expect(screen.getByText('Sub')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pie' })).toBeTruthy();
  });
});

describe('LoginForm', () => {
  it('valida correo y contraseña con los mensajes de siempre y no llama al servidor', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<LoginForm />);
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenido de nuevo' })).toBeTruthy();
    escribir('Correo electrónico', 'no-es-correo');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(screen.getByText('Ingresa un correo electrónico válido.')).toBeTruthy();
    expect(screen.getByText('Ingresa tu contraseña.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('con datos válidos llama a /api/auth/login y lleva a /nova (Inicio)', async () => {
    const f = vi.fn().mockResolvedValue(json({ success: true }));
    vi.stubGlobal('fetch', f);
    render(<LoginForm />);
    escribir('Correo electrónico', ' yo@ejemplo.com ');
    escribir('Contraseña', 'secreta123');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/nova'));
    expect(f.mock.calls[0]?.[0]).toBe('/api/auth/login');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ email: 'yo@ejemplo.com', password: 'secreta123' });
  });

  it('muestra el error del servidor (contraseña incorrecta) como alerta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Correo o contraseña incorrectos.' }, 401)));
    render(<LoginForm />);
    escribir('Correo electrónico', 'yo@ejemplo.com');
    escribir('Contraseña', 'mala');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos.');
  });

  it('mensaje de contraseña restablecida y enlaces a recuperar y a crear cuenta', () => {
    render(<LoginForm successMessage="Tu contraseña se restableció correctamente. Ya puedes iniciar sesión." />);
    expect(screen.getByRole('status').textContent).toBe('Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.');
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).getAttribute('href')).toBe('/recuperar-contrasena');
    expect(screen.getByRole('link', { name: 'Crear una cuenta' }).getAttribute('href')).toBe('/register');
  });
});

describe('RegisterForm', () => {
  it('contraseñas distintas o cortas: mensajes de siempre, sin llamar al servidor', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<RegisterForm />);
    escribir('Correo electrónico', 'yo@ejemplo.com');
    escribir('Contraseña', 'corta');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert').textContent).toBe('La contraseña debe tener entre 8 y 128 caracteres.');
    escribir('Contraseña', 'larga12345');
    escribir('Confirmar contraseña', 'otra12345');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden.');
    expect(f).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Inicia sesión' }).getAttribute('href')).toBe('/login');
  });

  it('cuenta creada con sesión: lleva a /home como antes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, data: { requiresLogin: false } })));
    render(<RegisterForm />);
    escribir('Correo electrónico', 'yo@ejemplo.com');
    escribir('Contraseña', 'larga12345');
    escribir('Confirmar contraseña', 'larga12345');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/home'));
  });
});

describe('RecoveryRequestForm', () => {
  it('envía el correo a /api/auth/recuperar y muestra la respuesta', async () => {
    const f = vi.fn().mockResolvedValue(json({ mensaje: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.' }));
    vi.stubGlobal('fetch', f);
    render(<RecoveryRequestForm />);
    escribir('Correo electrónico', ' yo@ejemplo.com ');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect((await screen.findByRole('status')).textContent).toBe(
      'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
    );
    expect(f.mock.calls[0]?.[0]).toBe('/api/auth/recuperar');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ email: 'yo@ejemplo.com' });
  });
});

describe('PasswordResetForm', () => {
  it('contraseñas distintas: mensaje de siempre; iguales: restablece y lleva al login', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', f);
    render(<PasswordResetForm token={'a'.repeat(64)} />);
    escribir('Nueva contraseña', 'nueva12345');
    escribir('Confirmar contraseña', 'otra12345');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    expect(screen.getByRole('alert').textContent).toBe('Las contraseñas no coinciden.');
    expect(f).not.toHaveBeenCalled();
    escribir('Confirmar contraseña', 'nueva12345');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login?restablecida=1'));
    expect(f.mock.calls[0]?.[0]).toBe('/api/auth/restablecer');
  });
});

describe('sin conexión (corrección de E11b)', () => {
  const entrar = () => {
    render(<LoginForm />);
    escribir('Correo electrónico', 'yo@ejemplo.com');
    escribir('Contraseña', 'secreta123');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  };

  it('al iniciar sesión sin internet dice "Necesitas conexión para esto."', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    entrar();
    expect((await screen.findByRole('alert')).textContent).toBe('Necesitas conexión para esto.');
  });

  it('el mensaje de configuración queda solo para una respuesta que no se puede leer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>', { status: 500 })));
    entrar();
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo conectar con Supabase. Revisa la configuración del proyecto.');
  });

  it('al crear cuenta sin internet, igual', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<RegisterForm />);
    escribir('Correo electrónico', 'yo@ejemplo.com');
    escribir('Contraseña', 'larga12345');
    escribir('Confirmar contraseña', 'larga12345');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Necesitas conexión para esto.')).toBeTruthy();
  });
});
