// E20b (commit 6): Fuentes con las etapas de indexación visibles, la zona para el PDF y el botón con "listo".
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: m.upload }));

import { EtapasIndexacion } from '@/components/nova/EtapasIndexacion';
import { SubidorPdf } from '@/components/nova/SubidorPdf';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';
import { TIPO_ETAPAS } from '@/lib/reglas/etapasIndexacion';

const elegir = (nombre = 'guia.pdf') =>
  fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [new File(['x'], nombre, { type: 'application/pdf' })] } });
const estados = () => Object.fromEntries([...document.querySelectorAll('[data-etapa]')].map((li) => [li.getAttribute('data-etapa'), li.getAttribute('data-estado')]));

/** Una respuesta con etapas que se suelta línea por línea desde la prueba. */
function respuestaConEtapas() {
  let control!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (control = c) });
  const enviar = (o: unknown) => control.enqueue(new TextEncoder().encode(`${JSON.stringify(o)}\n`));
  return { respuesta: new Response(body, { headers: { 'Content-Type': TIPO_ETAPAS } }), enviar, cerrar: () => control.close() };
}

beforeEach(() => {
  m.refresh.mockReset();
  m.upload.mockReset();
  m.upload.mockImplementation(async (_r: string, _a: File, o: { onUploadProgress: (p: { percentage: number }) => void }) => {
    o.onUploadProgress({ percentage: 60 });
    return { url: 'https://x.public.blob.vercel-storage.com/a.pdf' };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('etapas de indexación', () => {
  it('se encienden en orden con lo que avisa el servidor; al terminar, todas hechas y el botón dice "Indexado"', async () => {
    const r = respuestaConEtapas();
    const f = vi.fn().mockResolvedValue(r.respuesta);
    vi.stubGlobal('fetch', f);
    render(<SubidorPdf />);
    elegir();
    fireEvent.click(screen.getByRole('button', { name: 'Indexar' }));
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect((f.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Accept: expect.stringContaining(TIPO_ETAPAS) });
    await waitFor(() => expect(estados()).toMatchObject({ subir: 'hecha', leer: 'ahora', dividir: 'pendiente' }));

    await act(async () => {
      r.enviar({ etapa: 'leer' });
      r.enviar({ etapa: 'dividir' });
      r.enviar({ etapa: 'vectores' });
    });
    await waitFor(() => expect(estados()).toMatchObject({ leer: 'hecha', dividir: 'hecha', vectores: 'ahora', guardar: 'pendiente' }));
    expect(screen.getByRole('status').textContent).toContain('Etapa 4 de 5: Crear los vectores con Gemini');

    await act(async () => {
      r.enviar({ etapa: 'guardar' });
      r.enviar({ ok: true, datos: { documentoId: 'd', numFragmentos: 6, progreso: null } });
      r.cerrar();
    });
    await waitFor(() => expect(Object.values(estados()).every((e) => e === 'hecha')).toBe(true));
    expect(screen.getByText(/Documento indexado: 6 fragmentos/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Indexado/ })).toBeTruthy();
    expect(m.refresh).toHaveBeenCalled();
  });

  it('un error en "Leer el texto" marca esa etapa y muestra el mensaje exacto', async () => {
    const r = respuestaConEtapas();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(r.respuesta));
    render(<SubidorPdf />);
    elegir('escaneado.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Indexar' }));
    await act(async () => {
      r.enviar({ etapa: 'leer' });
      r.enviar({ ok: false, error: { codigo: 'PDF_SIN_TEXTO', mensaje: 'El documento no contiene texto seleccionable (no se admite OCR)' } });
      r.cerrar();
    });
    expect(await screen.findByText('El documento no contiene texto seleccionable (no se admite OCR)')).toBeTruthy();
    expect(estados()).toMatchObject({ subir: 'hecha', leer: 'fallo', dividir: 'pendiente' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Indexar' }).hasAttribute('disabled')).toBe(false));
  });

  it('un libro largo deja las etapas a IndexacionPendiente: "Crear los vectores" con su porcentaje', () => {
    render(<EtapasIndexacion actual="vectores" avance={40} />);
    expect(estados()).toMatchObject({ subir: 'hecha', leer: 'hecha', dividir: 'hecha', vectores: 'ahora', guardar: 'pendiente' });
    expect(document.querySelector('[data-etapa="vectores"]')?.textContent).toContain('40 %');
  });
});

describe('zona para el PDF y documentos', () => {
  it('muestra el archivo elegido con su tamaño; el campo sigue con su etiqueta', () => {
    render(<SubidorPdf />);
    expect(screen.getByText('Ningún archivo elegido')).toBeTruthy();
    elegir('apuntes.pdf');
    expect(screen.getByText('apuntes.pdf')).toBeTruthy();
    expect(screen.getByText(/1 KB · Toca o arrastra otro/)).toBeTruthy();
  });

  it('E20d: cada documento lleva el sello de su tipo (ícono oculto, nombre para lectores de pantalla)', () => {
    render(
      <TablaDocumentos
        documentos={[
          { id: 'd', nombreArchivo: 'a.pdf', categoria: 'General', numFragmentos: 3, fechaGuardado: '2026-11-24', paginas: 2, progreso: null, tipo: 'pdf', unidad: 'pagina' } as never,
          { id: 'e', nombreArchivo: 'b.md', categoria: 'General', numFragmentos: 1, fechaGuardado: '2026-11-24', paginas: 3, progreso: null, tipo: 'md', unidad: 'seccion' } as never,
        ]}
      />,
    );
    expect(document.querySelectorAll('[data-sello-documento="pdf"]').length).toBe(2); // tabla y tarjeta del teléfono
    const md = document.querySelector('[data-sello-documento="md"]');
    expect(md?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(md?.textContent).toBe('Markdown');
    expect(screen.getAllByText('3 secciones').length).toBe(2);
    expect(screen.getAllByRole('link', { name: 'Ver contenido de b.md' }).length).toBe(2);
  });
});
