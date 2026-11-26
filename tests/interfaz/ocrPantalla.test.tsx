// E20d-3 y E20d-4: la pregunta "¿Leerlas?" en Fuentes y subir varias fotos como un documento.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ refresh: vi.fn(), upload: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: m.upload }));

import { IndexacionPendiente } from '@/components/nova/IndexacionPendiente';
import { TablaDocumentos } from '@/components/nova/TablaDocumentos';

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

beforeEach(() => {
  pedidos.length = 0;
  m.refresh.mockReset();
  m.upload.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('la pregunta del OCR', () => {
  const pendiente = { id: 'd1', nombreArchivo: 'Libro.pdf', progreso: 0, ocr: { estado: 'pregunta' as const, fuente: 'pdf' as const, total: 180, leidas: 0 } };

  it('dice cuántas páginas y cuántas consultas, y no empieza a indexar sola', () => {
    servidor({});
    render(<IndexacionPendiente pendientes={[pendiente]} />);
    expect(screen.getByText('Este PDF tiene 180 páginas escaneadas. Leerlas usa unas 18 consultas de tu clave de Gemini (unos 6 minutos). ¿Leerlas?')).toBeTruthy();
    expect(screen.getByText(/se toma como «Ahora no»/)).toBeTruthy();
    expect(pedidos).toHaveLength(0);
  });

  it('"Leerlas" y "Ahora no" envían la respuesta', async () => {
    servidor({ progreso: 0 });
    render(<IndexacionPendiente pendientes={[pendiente]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Leerlas' }));
    await waitFor(() => expect(pedidos[0]).toEqual({ url: '/api/nova/documentos/d1/ocr', cuerpo: { leer: true } }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    cleanup();
    pedidos.length = 0;
    servidor({ progreso: null, eliminado: true });
    render(<IndexacionPendiente pendientes={[{ ...pendiente, ocr: { ...pendiente.ocr, fuente: 'fotos', total: 1 } }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    await waitFor(() => expect(pedidos[0]?.cuerpo).toEqual({ leer: false }));
  });

  it('mientras se lee, el avance cuenta páginas y la fila de la lista lo dice', async () => {
    // Una respuesta y después espera: en la vida real cada parte tarda; aquí el ciclo no debe girar sin fin.
    let llamadas = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        llamadas += 1;
        if (llamadas > 1) return new Promise<Response>(() => {});
        return new Response(JSON.stringify({ ok: true, datos: { progreso: 0, ocr: { estado: 'leyendo', fuente: 'pdf', total: 20, leidas: 10 } } }), { status: 200 });
      }),
    );
    render(<IndexacionPendiente pendientes={[{ ...pendiente, ocr: { estado: 'leyendo', fuente: 'pdf', total: 20, leidas: 0 } }]} />);
    expect(await screen.findByText('Leyendo con OCR «Libro.pdf»… 10 de 20 páginas')).toBeTruthy();
    expect(screen.getByText('Leer con OCR (10 de 20 páginas)')).toBeTruthy();
    cleanup();
    render(
      <TablaDocumentos
        documentos={[{ id: 'd', nombreArchivo: 'b.pdf', categoria: 'General', numFragmentos: 0, fechaGuardado: '2026-11-26', paginas: 3, progreso: 0, tipo: 'pdf', unidad: 'pagina', ocr: { estado: 'pregunta', fuente: 'pdf', total: 2, leidas: 0 } } as never]}
      />,
    );
    expect(screen.getAllByText('Espera tu respuesta').length).toBe(2);
  });
});
