// E20c-3 (RB-81, RB-91, plan 5.14): "Entrar con Google", el registro, "¿Olvidaste tu contraseña?", la contraseña
// nueva y la contraseña temporal en "Administración".
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: nav.refresh }), usePathname: () => '/nova/administracion' }));

import { LoginForm } from '@/components/login/LoginForm';
import { FormularioContrasenaNueva } from '@/components/login/FormularioContrasenaNueva';
import { BloqueSesion } from '@/components/nova/configuracion/BloqueSesion';
import { CuentasAdministracion } from '@/components/nova/administracion/CuentasAdministracion';
import RegisterPage from '@/app/register/page';
import RecuperarContrasenaPage from '@/app/recuperar-contrasena/page';
import type { CuentaAdmin } from '@/lib/datos/administracion';

const pedidos: Array<{ url: string; metodo: string; cuerpo: unknown }> = [];
function responder(datos: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      pedidos.push({ url, metodo: init.method ?? 'GET', cuerpo: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(ok ? { ok: true, datos } : { ok: false, error: { mensaje: datos } }), { status });
    }),
  );
}

beforeEach(() => {
  pedidos.length = 0;
  nav.replace.mockReset();
  nav.refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('entrar y crear cuenta con Google (RB-81)', () => {
  it('el inicio de sesión tiene "Entrar con Google" arriba del correo, y muestra el aviso al volver de Google', () => {
    render(<LoginForm errorInicial="Nova llegó al máximo de cuentas por ahora. Escríbele al administrador." />);
    const google = screen.getByRole('link', { name: 'Entrar con Google' });
    expect(google.getAttribute('href')).toBe('/auth/google');
    expect(google.compareDocumentPosition(screen.getByLabelText('Correo electrónico')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Nova llegó al máximo de cuentas por ahora. Escríbele al administrador.');
  });

  it('el registro ya no tiene formulario: dice que se usa Google y lo ofrece', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Para crear tu cuenta, usa "Entrar con Google".')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entrar con Google' }).getAttribute('href')).toBe('/auth/google');
    expect(screen.queryByLabelText(/Contraseña/)).toBeNull();
  });

  it('"¿Olvidaste tu contraseña?" explica las dos salidas en lugar de prometer un correo', () => {
    render(<RecuperarContrasenaPage />);
    const salidas = document.querySelector('[data-salidas-contrasena]') as HTMLElement;
    expect(within(salidas).getByText('Con Google.')).toBeTruthy();
    expect(within(salidas).getByText('Con el administrador.')).toBeTruthy();
    expect(within(salidas).getByRole('link', { name: 'Entrar con Google' })).toBeTruthy();
    expect(screen.queryByLabelText(/Correo/)).toBeNull();
  });
});

describe('contraseña nueva', () => {
  it('valida antes de llamar al servidor; tras la temporal no pide la anterior y al terminar entra a Nova', async () => {
    responder({ listo: true });
    render(<FormularioContrasenaNueva pideActual={false} alTerminar="nova" />);
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'corta' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert').textContent).toBe('La contraseña debe tener entre 8 y 128 caracteres.');
    expect(pedidos).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'mi-clave-nueva' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), { target: { value: 'mi-clave-nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/nova'));
    expect(pedidos[0]).toEqual({ url: '/api/cuenta/contrasena', metodo: 'POST', cuerpo: { nueva: 'mi-clave-nueva', confirmar: 'mi-clave-nueva' } });
  });

  it('Configuración → Sesión: pide la anterior, salvo si se entró con Google', () => {
    render(<BloqueSesion />);
    expect(screen.getByLabelText('Contraseña actual')).toBeTruthy();
    cleanup();
    render(<BloqueSesion pideActual={false} />);
    expect(screen.queryByLabelText('Contraseña actual')).toBeNull();
    expect(screen.getByText('Entraste con Google: no hace falta la contraseña anterior.')).toBeTruthy();
  });
});

describe('contraseña temporal en Administración (RB-91)', () => {
  const ana: CuentaAdmin = { id: 'u1', correo: 'ana@x.com', nombre: 'Ana', registro: '2026-11-20T10:00:00Z', ultimoAcceso: null, bytes: 0, consultas: 0, conClave: false, estado: 'activa', nivel: 'usuario', usaClaveProyecto: false };

  it('pide confirmación, la muestra una sola vez con el texto exacto y al cerrar desaparece', async () => {
    responder({ correo: 'ana@x.com', contrasena: 'AbCdEfGh23456789', venceEn: '2026-11-26T20:00:00Z' });
    render(<CuentasAdministracion cuentas={[ana]} yo={{ id: 'a', nivel: 'admin' }} topeMb={30} ahora="2026-11-25T20:00:00Z" />);
    const tabla = screen.getByRole('table', { name: 'Cuentas de Nova' });
    fireEvent.click(within(tabla).getByRole('button', { name: 'Contraseña temporal: ana@x.com' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText(/¿Dar una contraseña temporal a ana@x.com\?/)).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Dar contraseña temporal' }));
    await waitFor(() => expect(screen.getByText('Contraseña temporal para ana@x.com: AbCdEfGh23456789. Cópiala ahora: no se vuelve a mostrar. Vence en 24 horas.')).toBeTruthy());
    expect(pedidos[0]).toMatchObject({ url: '/api/nova/administracion/cuentas/u1/contrasena-temporal', metodo: 'POST' });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Listo' }));
    expect(screen.queryByText(/AbCdEfGh23456789/)).toBeNull();
  });
});
