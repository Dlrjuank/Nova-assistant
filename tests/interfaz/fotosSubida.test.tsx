// E20d-4: subir varias fotos como un documento.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: m.upload }));

import { SubidorPdf } from '@/components/nova/SubidorPdf';

const pedidos: Array<{ url: string; cuerpo: unknown }> = [];
function servidor(datos: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      pedidos.push({ url, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({ ok: true, datos }), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
}
const foto = (nombre: string, tipo = 'image/jpeg') => new File(['x'], nombre, { type: tipo });

beforeEach(() => {
  pedidos.length = 0;
  m.refresh.mockReset();
  m.upload.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('varias fotos', () => {
  it('se suben juntas como un documento con su título', async () => {
    m.upload.mockImplementation(async (ruta: string) => ({ url: `https://x.public.blob.vercel-storage.com/${ruta}` }));
    servidor({ documentoId: 'd2', numFragmentos: 0, progreso: 0 });
    render(<SubidorPdf />);
    fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [foto('IMG_1.jpg'), foto('IMG_2.png', 'image/png'), foto('IMG_3.jpg')] } });
    expect(screen.getByText('3 fotos')).toBeTruthy();
    const titulo = screen.getByLabelText('Título del documento') as HTMLInputElement;
    // Ajuste E20d-4: el nombre que pone la cámara se cambia por la fecha.
    expect(titulo.value).toMatch(/^Fotos del \d{1,2} de [a-z]+$/);
    fireEvent.change(titulo, { target: { value: 'Apuntes de clase' } });
    fireEvent.click(screen.getByRole('button', { name: 'Indexar' }));
    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(m.upload).toHaveBeenCalledTimes(3);
    expect(m.upload.mock.calls[1]?.[2]).toMatchObject({ contentType: 'image/png' });
    expect(pedidos[0]?.cuerpo).toMatchObject({
      urlBlob: 'https://x.public.blob.vercel-storage.com/IMG_1.jpg',
      masUrls: ['https://x.public.blob.vercel-storage.com/IMG_2.png', 'https://x.public.blob.vercel-storage.com/IMG_3.jpg'],
      nombreArchivo: 'Apuntes de clase',
    });
  });

  it('un PDF con una foto no se puede subir junto', () => {
    render(<SubidorPdf />);
    fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [foto('a.jpg'), new File(['x'], 'b.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText('Para subir varios archivos juntos, deben ser fotos (.jpg o .png).')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Indexar' }).hasAttribute('disabled')).toBe(true);
  });
});
