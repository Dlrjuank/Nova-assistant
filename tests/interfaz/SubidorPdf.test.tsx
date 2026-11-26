import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: m.upload }));

import { SubidorPdf, tituloPorDefecto } from '@/components/nova/SubidorPdf';
import { PDF_MAX_BYTES } from '@/lib/config/nova';

const URL_BLOB = 'https://abc.public.blob.vercel-storage.com/a-x.pdf';

function archivoDe(nombre: string, bytes = 10, tipo = 'application/pdf'): File {
  const archivo = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(archivo, 'size', { value: bytes });
  return archivo;
}
const elegir = (archivo: File) =>
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [archivo] } });
const botonIndexar = () => screen.getByRole('button', { name: 'Indexar' });

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

  it('E20d: un archivo que no es PDF, Markdown ni texto se rechaza; un .txt y un .md se aceptan', () => {
    render(<SubidorPdf />);
    elegir(archivoDe('notas.txt', 10, 'text/plain'));
    expect(botonIndexar().hasAttribute('disabled')).toBe(false);
    elegir(archivoDe('apuntes.md', 10, ''));
    expect(botonIndexar().hasAttribute('disabled')).toBe(false);
    elegir(archivoDe('clase.pptx', 10, ''));
    expect(botonIndexar().hasAttribute('disabled')).toBe(false);
    elegir(archivoDe('viejo.doc', 10, 'application/msword'));
    expect(botonIndexar().hasAttribute('disabled')).toBe(true);
    elegir(archivoDe('foto.heic', 10, 'image/heic'));
    expect(screen.getByText('Ese tipo de archivo no se admite. Sube un PDF, un Word (.docx), un PowerPoint (.pptx), un Markdown (.md), un texto (.txt) o fotos (.jpg, .png).')).toBeTruthy();
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
    expect(await screen.findByText('No se pudo subir el archivo. Intenta de nuevo.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it("E13 (B-21): con una materia elegida, su nombre es la categoría y se envía su id", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, datos: { documentoId: "d", numFragmentos: 3 } }), { status: 201 }));
    vi.stubGlobal("fetch", f);
    render(<SubidorPdf materias={[{ id: "m1", nombre: "Cálculo" }]} />);
    fireEvent.change(screen.getByLabelText("Materia (opcional)"), { target: { value: "m1" } });
    const categoria = screen.getByLabelText("Categoría") as HTMLInputElement;
    expect(categoria.value).toBe("Cálculo");
    expect(categoria.disabled).toBe(true);
    elegir(archivoDe("guia.pdf"));
    fireEvent.click(botonIndexar());
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toMatchObject({ categoria: "Cálculo", materiaId: "m1" });
  });

  it("sin materias no aparece el selector", () => {
    render(<SubidorPdf />);
    expect(screen.queryByLabelText("Materia (opcional)")).toBeNull();
  });

  it('ajuste E20d-4: con una sola foto también se pide el título; un PDF no lo pide', () => {
    render(<SubidorPdf />);
    elegir(archivoDe('pizarra.jpg', 10, 'image/jpeg'));
    expect((screen.getByLabelText('Título del documento') as HTMLInputElement).value).toBe('pizarra');
    expect(screen.getByText('La foto queda como la página 1 del documento.')).toBeTruthy();
    elegir(archivoDe('libro.pdf'));
    expect(screen.queryByLabelText('Título del documento')).toBeNull();
  });
});

describe('tituloPorDefecto (ajuste E20d-4)', () => {
  const hoy = new Date('2026-11-26T22:00:00Z'); // 26 de noviembre en Bogotá
  const foto = (nombre: string) => new File(['x'], nombre, { type: 'image/jpeg' });

  it('el código al azar del iPhone o de la cámara se cambia por la fecha', () => {
    expect(tituloPorDefecto([foto('6dcfab87-40bf-4f29-92ad-4851a54c8703.jpeg')], hoy)).toBe('Foto del 26 de noviembre');
    expect(tituloPorDefecto([foto('IMG_1234.JPG'), foto('IMG_1235.JPG')], hoy)).toBe('Fotos del 26 de noviembre');
    expect(tituloPorDefecto([foto('20261126_101500.jpg')], hoy)).toBe('Foto del 26 de noviembre');
  });

  it('un nombre puesto por la persona se respeta, y los demás tipos no cambian', () => {
    expect(tituloPorDefecto([foto('Apuntes de cálculo.jpg')], hoy)).toBe('Apuntes de cálculo');
    expect(tituloPorDefecto([new File(['x'], 'IMG_1234.pdf')], hoy)).toBe('IMG_1234');
    expect(tituloPorDefecto([], hoy)).toBe('');
  });
});
