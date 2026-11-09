import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chat } from '@/components/nova/Chat';
import { ListaFuentes } from '@/components/nova/ListaFuentes';
import { MensajeChat } from '@/components/nova/MensajeChat';

const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });
const campo = () => screen.getByLabelText('Tu pregunta') as HTMLTextAreaElement;
const boton = () => screen.getByRole('button', { name: 'Preguntar' });
const escribir = (valor: string) => fireEvent.change(campo(), { target: { value: valor } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ListaFuentes y MensajeChat', () => {
  it('sin fuentes no muestra nada', () => {
    const { container } = render(<ListaFuentes fuentes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra las fuentes como chips', () => {
    render(<ListaFuentes fuentes={[{ tipo: 'pdf', etiqueta: 'a.pdf · fragmento 3' }, { tipo: 'tarea', etiqueta: 'Tarea 1a2b' }]} />);
    expect(screen.getByText('a.pdf · fragmento 3')).toBeTruthy();
    expect(screen.getByText('Tarea 1a2b')).toBeTruthy();
  });

  it('el autor se distingue por rótulo y alineación, no solo por color', () => {
    const { container } = render(
      <ul>
        <MensajeChat autor="usuario" texto="hola" />
        <MensajeChat autor="asistente" texto="qué tal" />
      </ul>,
    );
    expect(screen.getByText('Tú')).toBeTruthy();
    expect(screen.getByText('Nova')).toBeTruthy();
    const [yo, nova] = container.querySelectorAll('li');
    expect(yo?.className).toContain('items-end');
    expect(nova?.className).toContain('items-start');
  });
});

describe('Chat', () => {
  it('RN-02: habilita enviar solo con 2 palabras y 8 caracteres, con el mensaje exacto', () => {
    render(<Chat />);
    expect(boton().hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('La instrucción es demasiado corta')).toBeNull();
    for (const corta of ['Agenda', 'Hola tú']) {
      escribir(corta);
      expect(boton().hasAttribute('disabled')).toBe(true);
      expect(screen.getByText('La instrucción es demasiado corta')).toBeTruthy();
    }
    escribir('  Mi   agenda  ');
    expect(boton().hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('La instrucción es demasiado corta')).toBeNull();
  });

  it('Enter con texto corto no envía', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<Chat />);
    escribir('Agenda');
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(f).not.toHaveBeenCalled();
  });

  it('agrega la pregunta, muestra Pensando… y luego la respuesta con sus fuentes', async () => {
    let resolver: (r: Response) => void = () => {};
    const f = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolver = r)));
    vi.stubGlobal('fetch', f);
    render(<Chat />);
    escribir('  ¿Cuánto dura   la garantía? ');
    fireEvent.keyDown(campo(), { key: 'Enter' });

    expect(screen.getByText('¿Cuánto dura la garantía?')).toBeTruthy();
    expect(screen.getByText('Pensando…')).toBeTruthy();
    expect(campo().value).toBe('');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ pregunta: '¿Cuánto dura la garantía?' });

    resolver(
      responder({
        ok: true,
        datos: { respuesta: 'Dura 24 meses.', fuentes: [{ tipo: 'pdf', etiqueta: 'm.pdf · fragmento 1' }] },
      }),
    );
    expect(await screen.findByText('Dura 24 meses.')).toBeTruthy();
    expect(screen.getByText('m.pdf · fragmento 1')).toBeTruthy();
    expect(screen.queryByText('Pensando…')).toBeNull();
  });

  it('Shift+Enter no envía: sirve para escribir varias líneas', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<Chat />);
    escribir('Una pregunta larga');
    fireEvent.keyDown(campo(), { key: 'Enter', shiftKey: true });
    expect(f).not.toHaveBeenCalled();
  });

  it('SIN_DOCUMENTOS muestra un aviso con enlace para indexar y sin reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        responder({ ok: false, error: { codigo: 'SIN_DOCUMENTOS', mensaje: 'Aún no hay documentos indexados.' } }, 409),
      ),
    );
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    const enlace = await screen.findByRole('link', { name: 'Indexar un PDF' });
    expect(enlace.getAttribute('href')).toBe('/nova/fuentes?pestana=pdf');
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('ERROR_LLM ofrece reintentar la misma pregunta sin duplicar la burbuja', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responder({ ok: false, error: { codigo: 'ERROR_LLM', mensaje: 'No se pudo obtener respuesta.' } }, 502))
      .mockResolvedValueOnce(responder({ ok: true, datos: { respuesta: 'Ahora sí.', fuentes: [] } }));
    vi.stubGlobal('fetch', f);
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Ahora sí.')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({ pregunta: 'Mi agenda de hoy' });
    expect(screen.getAllByText('Mi agenda de hoy')).toHaveLength(1);
    expect(screen.queryByText('No se pudo obtener respuesta.')).toBeNull();
  });

  it('una respuesta que no es JSON (tiempo agotado) no rompe el chat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('An error occurred', { status: 504 })));
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    expect(await screen.findByText('No se pudo obtener respuesta del asistente. Intente de nuevo.')).toBeTruthy();
  });

  it('RN-20: muestra el historial guardado y continúa en esa conversación', async () => {
    const f = vi.fn().mockResolvedValue(
      responder({ ok: true, datos: { respuesta: 'El segundo es secar.', fuentes: [], conversacionId: 'c1', guardada: true } }),
    );
    vi.stubGlobal('fetch', f);
    render(
      <Chat
        conversacionId="c1"
        historial={[
          { id: 1, autor: 'usuario', texto: '¿Cuáles son los pasos?', fuentes: [] },
          { id: 2, autor: 'asistente', texto: 'Retirar y secar.', fuentes: [{ tipo: 'pdf', etiqueta: 'h.pdf · fragmento 1' }] },
        ]}
      />,
    );
    expect(screen.getByText('¿Cuáles son los pasos?')).toBeTruthy();
    expect(screen.getByText('h.pdf · fragmento 1')).toBeTruthy();
    expect(screen.queryByText(/Pregúntale algo/)).toBeNull();

    escribir('¿y el segundo?');
    fireEvent.click(boton());
    expect(await screen.findByText('El segundo es secar.')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ pregunta: '¿y el segundo?', conversacionId: 'c1' });
  });

  it('sin conversación previa no envía id y usa el que devuelve el servidor en la siguiente pregunta', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(responder({ ok: true, datos: { respuesta: 'Sí.', fuentes: [], conversacionId: 'c9', guardada: true } }));
    vi.stubGlobal('fetch', f);
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    await screen.findByText('Sí.');
    escribir('¿y la de mañana?');
    fireEvent.click(boton());
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ pregunta: 'Mi agenda de hoy' });
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({ pregunta: '¿y la de mañana?', conversacionId: 'c9' });
  });

  it('"Conversación nueva" crea otra en el servidor, vacía la pantalla y pregunta en la nueva', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responder({ ok: true, datos: { id: 'c2' } }, 201))
      .mockResolvedValueOnce(responder({ ok: true, datos: { respuesta: 'Hola.', fuentes: [], conversacionId: 'c2', guardada: true } }));
    vi.stubGlobal('fetch', f);
    render(<Chat conversacionId="c1" historial={[{ id: 1, autor: 'usuario', texto: 'Pregunta vieja', fuentes: [] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conversación nueva' }));

    await waitFor(() => expect(screen.queryByText('Pregunta vieja')).toBeNull());
    expect(f).toHaveBeenCalledWith('/api/nova/conversaciones', { method: 'POST' });
    expect(screen.queryByRole('button', { name: 'Conversación nueva' })).toBeNull();
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    await screen.findByText('Hola.');
    expect(JSON.parse(f.mock.calls[1]?.[1].body).conversacionId).toBe('c2');
  });

  it('si no se puede crear la conversación nueva, conserva la actual y avisa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<Chat conversacionId="c1" historial={[{ id: 1, autor: 'usuario', texto: 'Pregunta vieja', fuentes: [] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conversación nueva' }));
    expect(await screen.findByText('No se pudo conectar con el servidor. Intente de nuevo.')).toBeTruthy();
    expect(screen.getByText('Pregunta vieja')).toBeTruthy();
  });

  it('avisa si la respuesta no se pudo guardar en el historial', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(responder({ ok: true, datos: { respuesta: 'Sí.', fuentes: [], conversacionId: 'c1', guardada: false } })),
    );
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    expect(await screen.findByText(/no se pudo guardar en el historial/)).toBeTruthy();
  });

  it('CONVERSACION_NO_ENCONTRADA no ofrece reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        responder({ ok: false, error: { codigo: 'CONVERSACION_NO_ENCONTRADA', mensaje: 'La conversación no existe. Recargue la página.' } }, 404),
      ),
    );
    render(<Chat conversacionId="c1" />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    expect(await screen.findByText('La conversación no existe. Recargue la página.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('sin conexión muestra un aviso y se puede reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<Chat />);
    escribir('Mi agenda de hoy');
    fireEvent.click(boton());
    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' }).hasAttribute('disabled')).toBe(false));
  });
});
