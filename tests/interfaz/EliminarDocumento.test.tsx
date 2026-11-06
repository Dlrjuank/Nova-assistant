import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

import { EliminarDocumento } from '@/components/nova/EliminarDocumento';

const ID = '44444444-4444-4444-8444-444444444444';
const responder = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));

describe('EliminarDocumento', () => {
  beforeEach(() => nav.refresh.mockReset());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('pide confirmación y Cancelar no borra', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<EliminarDocumento id={ID} nombre="manual.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar documento: manual.pdf' }));
    expect(screen.getByText(/¿Eliminar este documento\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(f).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Eliminar documento: manual.pdf' })).toBeTruthy();
  });

  it('al confirmar llama a DELETE y refresca la lista', async () => {
    const f = vi.fn().mockImplementation(() => responder({ ok: true, datos: { id: ID } }));
    vi.stubGlobal('fetch', f);
    render(<EliminarDocumento id={ID} nombre="manual.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar documento: manual.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f).toHaveBeenCalledWith(`/api/nova/documentos/${ID}`, { method: 'DELETE' });
  });

  it('muestra el mensaje del servidor si falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        responder({ ok: false, error: { codigo: 'DOCUMENTO_NO_ENCONTRADO', mensaje: 'El documento no existe.' } }, 404),
      ),
    );
    render(<EliminarDocumento id={ID} nombre="manual.pdf" />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar documento: manual.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(await screen.findByText('El documento no existe.')).toBeTruthy();
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
