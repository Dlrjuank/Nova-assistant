import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: m.upload }));

import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { PDF_MAX_BYTES } from '@/lib/config/nova';

const URL_BLOB = 'https://abc.public.blob.vercel-storage.com/a-x.pdf';

function archivoDe(nombre: string, bytes = 10, tipo = 'application/pdf'): File {
  const archivo = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(archivo, 'size', { value: bytes });
  return archivo;
}
const elegir = (archivo: File) =>
  fireEvent.change(screen.getByLabelText('Archivo PDF'), { target: { files: [archivo] } });
const botonIndexar = () => screen.getByRole('button', { name: 'Indexar PDF' });

describe('SubidorPdf', () => {
  beforeEach(() => {
    m.refresh.mockReset();
    m.upload.mockReset();
    m.upload.mockResolvedValue({ url: URL_BLOB });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sin archivo no se puede enviar', () => {
    render(<SubidorPdf />);
    expect(botonIndexar().hasAttribute('disabled')).toBe(true);
  });

  it('RN-01: un byte de más se rechaza con el mensaje exacto y sin subir', () => {
    render(<SubidorPdf />);
    elegir(archivoDe('grande.pdf', PDF_MAX_BYTES + 1));
    expect(screen.getByText('El documento supera el límite permitido de 15 MB')).toBeTruthy();
    expect(botonIndexar().hasAttribute('disabled')).toBe(true);
    expect(m.upload).not.toHaveBeenCalled();
  });

  it('RN-01: exactamente el límite se acepta', () => {
    render(<SubidorPdf />);
    elegir(archivoDe('justo.pdf', PDF_MAX_BYTES));
    expect(botonIndexar().hasAttribute('disabled')).toBe(false);
  });

  it('un archivo que no es PDF se rechaza', () => {
    render(<SubidorPdf />);
    elegir(archivoDe('notas.txt', 10, 'text/plain'));
    expect(screen.getByText('El archivo no es un PDF válido.')).toBeTruthy();
    expect(botonIndexar().hasAttribute('disabled')).toBe(true);
  });

  it('sube con una ruta segura, indexa con el nombre original y muestra los fragmentos', async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, datos: { documentoId: 'd', numFragmentos: 7 } }), { status: 201 }),
    );
    vi.stubGlobal('fetch', f);
    render(<SubidorPdf />);
    elegir(archivoDe('Factura #3 (año).PDF'));
    fireEvent.click(botonIndexar());

    expect(await screen.findByText(/Documento indexado: 7 fragmentos/)).toBeTruthy();
    expect(m.upload.mock.calls[0]?.[0]).toBe('Factura-3-ano.pdf');
    expect(m.upload.mock.calls[0]?.[2]).toMatchObject({
      access: 'public',
      handleUploadUrl: '/api/nova/documentos/subida',
    });
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({
      urlBlob: URL_BLOB,
      nombreArchivo: 'Factura #3 (año).PDF',
      categoria: 'General',
    });
    expect(m.refresh).toHaveBeenCalled();
  });

  it('muestra el mensaje exacto de un PDF sin texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: { mensaje: 'El documento no contiene texto seleccionable (no se admite OCR)' },
          }),
          { status: 422 },
        ),
      ),
    );
    render(<SubidorPdf />);
    elegir(archivoDe('escaneado.pdf'));
    fireEvent.click(botonIndexar());
    expect(await screen.findByText('El documento no contiene texto seleccionable (no se admite OCR)')).toBeTruthy();
    await waitFor(() => expect(botonIndexar().hasAttribute('disabled')).toBe(false));
  });

  it('una respuesta que no es JSON (tiempo agotado en Vercel) da un aviso claro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('An error occurred', { status: 504 })));
    render(<SubidorPdf />);
    elegir(archivoDe('largo.pdf'));
    fireEvent.click(botonIndexar());
    expect(await screen.findByText(/La indexación no terminó/)).toBeTruthy();
  });

  it('si falla la subida no intenta indexar', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    m.upload.mockRejectedValue(new Error('red'));
    render(<SubidorPdf />);
    elegir(archivoDe('a.pdf'));
    fireEvent.click(botonIndexar());
    expect(await screen.findByText('No se pudo subir el archivo. Intente de nuevo.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });
});
