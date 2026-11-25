// E20c-1 (5.14, RB-77 a RB-80, RB-90): "Vincular mi clave de Gemini" y el aviso en lugar de los botones de IA.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

import { ClaveGemini } from '@/components/nova/configuracion/ClaveGemini';
import { RequiereIa } from '@/components/nova/ia/RequiereIa';
import { ProveedorPreferencias } from '@/components/nova/PreferenciasNova';
import type { EstadoIa } from '@/lib/reglas/claveGemini';

const CLAVE = `AIza${'q'.repeat(31)}9876`;
const SIN = { vinculada: false, ultimos4: null, estado: null, verificadaEn: null } as const;
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
  nav.refresh.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('Vincular mi clave de Gemini', () => {
  it('sin clave: campo de contraseña con "Mostrar", "Verificar y guardar" y el enlace a la guía', () => {
    render(<ClaveGemini inicial={SIN} />);
    const campo = screen.getByLabelText('Tu clave de Gemini');
    expect(campo).toHaveAttribute('type', 'password');
    expect(campo).toHaveAttribute('autocomplete', 'off');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar la clave' }));
    expect(campo).toHaveAttribute('type', 'text');
    expect(screen.getByRole('link', { name: 'Cómo crear tu clave' })).toHaveAttribute('href', '/nova/configuracion/gemini');
    expect(screen.getByRole('button', { name: 'Verificar y guardar' })).toBeDisabled();
  });

  it('al guardar: la clave va una vez al servidor, el campo se vacía y se ve solo ••••{últimos 4}', async () => {
    responder({ vinculada: true, ultimos4: '9876', estado: 'activa', verificadaEn: '2026-11-25', mensaje: 'Clave verificada y guardada.' });
    render(<ClaveGemini inicial={SIN} />);
    fireEvent.change(screen.getByLabelText('Tu clave de Gemini'), { target: { value: CLAVE } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y guardar' }));
    expect(await screen.findByText('Clave verificada y guardada.')).toBeInTheDocument();
    expect(pedidos).toEqual([{ url: '/api/nova/clave-gemini', metodo: 'PUT', cuerpo: { clave: CLAVE } }]);
    expect(screen.getByText('••••9876')).toBeInTheDocument();
    expect(screen.getByText('Funciona')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(CLAVE);
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('si Google no la acepta: el mensaje exacto y el campo también queda vacío', async () => {
    responder('Google no aceptó esta clave. Revisa que la copiaste completa o crea una nueva.', false, 422);
    render(<ClaveGemini inicial={SIN} />);
    const campo = screen.getByLabelText('Tu clave de Gemini');
    fireEvent.change(campo, { target: { value: CLAVE } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y guardar' }));
    expect(await screen.findByText(/Google no aceptó esta clave/)).toBeInTheDocument();
    expect(campo).toHaveValue('');
    expect(document.body.innerHTML).not.toContain(CLAVE);
  });

  it('vinculada: estado, "Cambiar clave" y "Desvincular" con confirmación (RB-80)', async () => {
    responder({ vinculada: false });
    render(<ClaveGemini inicial={{ vinculada: true, ultimos4: '9876', estado: 'rechazada', verificadaEn: '2026-11-20' }} />);
    expect(screen.getByText('No funciona: vincula una nueva')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
    expect(screen.getByText('¿Desvincular tu clave de Gemini? Nova no podrá usar la IA hasta que vincules otra.')).toBeInTheDocument();
    const botones = screen.getAllByRole('button', { name: 'Desvincular' });
    fireEvent.click(botones[botones.length - 1]!);
    expect(await screen.findByText('Clave desvinculada.')).toBeInTheDocument();
    expect(pedidos.at(-1)).toMatchObject({ metodo: 'DELETE' });
    await waitFor(() => expect(screen.getByLabelText('Tu clave de Gemini')).toBeInTheDocument());
  });
});

describe('RB-79: el aviso en lugar de los botones de IA', () => {
  const con = (estadoIa: EstadoIa) =>
    render(
      <ProveedorPreferencias tema="automatico" formatoHora="24" estadoIa={estadoIa}>
        <RequiereIa>
          <button type="button">Proponer temas</button>
        </RequiereIa>
      </ProveedorPreferencias>,
    );

  it('con una IA que sirve (propia, del proyecto o sin cuota por ahora) se ve el botón', () => {
    for (const estado of ['propia', 'proyecto', 'sin_cuota'] as const) {
      const { unmount } = con(estado);
      expect(screen.getByRole('button', { name: 'Proponer temas' })).toBeInTheDocument();
      unmount();
    }
  });

  it('sin clave, rechazada o ilegible: el aviso con su texto y los enlaces, sin el botón', () => {
    const casos = [
      ['sin_clave', 'Para usar la IA de Nova, vincula tu clave de Gemini.'],
      ['rechazada', /Tu clave de Gemini ya no funciona/],
      ['ilegible', 'No pudimos leer tu clave de Gemini guardada. Vincúlala de nuevo en Configuración → Asistente.'],
    ] as const;
    for (const [estado, texto] of casos) {
      const { unmount } = con(estado);
      expect(screen.queryByRole('button', { name: 'Proponer temas' })).toBeNull();
      expect(screen.getByText(texto)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Cómo crear tu clave' })).toHaveAttribute('href', '/nova/configuracion/gemini');
      expect(screen.getByRole('link', { name: 'Vincular en Configuración' })).toHaveAttribute('href', '/nova/configuracion#config-asistente');
      unmount();
    }
  });
});
