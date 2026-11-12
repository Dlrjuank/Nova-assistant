// E10e (5.11): responder un cuestionario y crearlo.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cuestionario } from '@/components/nova/cuestionarios/Cuestionario';
import { FormularioCuestionario } from '@/components/nova/cuestionarios/FormularioCuestionario';
import type { CuestionarioVista } from '@/lib/dataService';

const m = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => m }));

const ok = (datos: unknown, status = 200) => new Response(JSON.stringify({ ok: true, datos }), { status });
const vista = (preguntas: CuestionarioVista['intento']['preguntas'], extra: Partial<CuestionarioVista['intento']> = {}): CuestionarioVista => ({
  id: 'q1',
  documento: { id: 'd1', nombre: 'libro.pdf', categoria: 'Biología' },
  alcance: 'Páginas 2–4',
  dificultad: 'media',
  pedidas: 2,
  intento: { id: 'i1', repaso: false, terminado: false, aciertos: null, total: preguntas.length, puntaje: null, preguntas, sugerencias: [], ...extra },
});
const P = (id: string, respuesta?: NonNullable<CuestionarioVista['intento']['preguntas'][number]['respuesta']>) => ({
  id,
  enunciado: `¿Pregunta ${id}?`,
  opciones: [`a${id}`, `b${id}`, `c${id}`, `d${id}`],
  ...(respuesta ? { respuesta } : {}),
});
const RESPUESTA = { elegida: 0, acierto: false, correcta: 2, explicacion: 'Lo dice la página 3.', cita: 'una cita del texto', fuente: 'libro.pdf · p. 3' };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Cuestionario', () => {
  it('una pregunta por pantalla, con "Pregunta 1 de 2" y 4 opciones grandes', () => {
    render(<Cuestionario datos={vista([P('1'), P('2')])} />);
    expect(screen.getByText('Pregunta 1 de 2')).toBeTruthy();
    const opciones = within(screen.getByRole('list', { name: 'Opciones' })).getAllByRole('button');
    expect(opciones).toHaveLength(4);
    expect(opciones[0]?.className).toContain('min-h-14');
    expect(opciones[0]?.className).toContain('text-base');
  });

  it('al responder: si acertó con ícono y texto, la correcta, la explicación y la cita; la respuesta queda fija', async () => {
    const f = vi.fn().mockResolvedValue(ok(RESPUESTA));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={vista([P('1'), P('2')])} />);
    fireEvent.click(screen.getByRole('button', { name: /a1/ }));
    expect(await screen.findByText('No acertaste')).toBeTruthy();
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/intentos/i1/respuestas');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ preguntaId: '1', elegida: 0 });
    expect(screen.getByRole('button', { name: /c1.*Correcta/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /a1.*Tu respuesta/ })).toBeTruthy();
    expect(screen.getByText('Lo dice la página 3.')).toBeTruthy();
    expect(screen.getByText('«una cita del texto»')).toBeTruthy();
    expect(screen.getByText('libro.pdf · p. 3')).toBeTruthy();
    for (const b of within(screen.getByRole('list', { name: 'Opciones' })).getAllByRole('button')) expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente pregunta' }));
    expect(screen.getByText('Pregunta 2 de 2')).toBeTruthy();
  });

  it('al volver, sigue en la primera sin responder (B-63)', () => {
    render(<Cuestionario datos={vista([P('1', RESPUESTA), P('2')])} />);
    expect(screen.getByText('Pregunta 2 de 2')).toBeTruthy();
  });

  it('con la última, la explicación primero y luego el resultado con el puntaje y las falladas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ ...RESPUESTA, elegida: 2, acierto: true, resultado: { aciertos: 1, total: 2, puntaje: 250, sugerencias: [] } })));
    render(<Cuestionario datos={vista([P('1', RESPUESTA), P('2')])} />);
    fireEvent.click(screen.getByRole('button', { name: /c2/ }));
    expect(await screen.findByText('¡Acertaste!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(screen.getByText('2,5')).toBeTruthy();
    expect(screen.getByText('1 de 2 aciertos')).toBeTruthy();
    expect(screen.getByText('¿Pregunta 1?')).toBeTruthy(); // la fallada
    expect(screen.getByText('Respuesta correcta: c1')).toBeTruthy();
  });

  it('"Repetir solo las que fallé" y "Hacer de nuevo" no llaman a Gemini: solo crean un intento', async () => {
    const f = vi.fn().mockImplementation(async () => ok({ id: 'i2' }, 201));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={vista([P('1', RESPUESTA), P('2', { ...RESPUESTA, acierto: true })], { terminado: true, aciertos: 1, puntaje: 250 })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Repetir solo las que fallé' }));
    await vi.waitFor(() => expect(m.refresh).toHaveBeenCalledTimes(1));
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/cuestionarios/q1/intentos');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ repasoDe: 'i1' });
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'Hacer de nuevo' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Hacer de nuevo' }));
    await vi.waitFor(() => expect(m.refresh).toHaveBeenCalledTimes(2));
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({});
  });

  it('sin falladas no ofrece repetirlas; un repaso lo dice', () => {
    render(<Cuestionario datos={vista([P('1', { ...RESPUESTA, acierto: true })], { terminado: true, aciertos: 1, puntaje: 500, repaso: true })} />);
    expect(screen.queryByRole('button', { name: 'Repetir solo las que fallé' })).toBeNull();
    expect(screen.getByText('Resultado del repaso')).toBeTruthy();
    expect(screen.getByText('5,0')).toBeTruthy();
  });

  it('el aviso de RB-49 se muestra si se crearon menos de las pedidas', () => {
    render(<Cuestionario datos={vista([P('1')])} aviso="Solo pude sacar 3 de 5 preguntas de este contenido." />);
    expect(screen.getByText('Solo pude sacar 3 de 5 preguntas de este contenido.')).toBeTruthy();
  });
});

describe('FormularioCuestionario', () => {
  const CAPS = [
    { orden: 0, nivel: 1, titulo: 'Uno', etiquetaPaginas: '1–9' },
    { orden: 1, nivel: 2, titulo: 'Uno punto uno', etiquetaPaginas: '3–5' },
  ];

  it('envía alcance, cantidad y dificultad, y abre el cuestionario', async () => {
    const f = vi.fn().mockResolvedValue(ok({ id: 'q9', creadas: 10, pedidas: 10 }, 201));
    vi.stubGlobal('fetch', f);
    render(<FormularioCuestionario documento={{ id: 'd1', paginas: 40 }} capitulos={CAPS} capituloInicial={1} />);
    expect((screen.getByLabelText('Un capítulo') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('10'));
    fireEvent.click(screen.getByLabelText('Difícil'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuestionario' }));
    expect(await screen.findByText('Creando el cuestionario. Puede tardar hasta un par de minutos.')).toBeTruthy();
    await vi.waitFor(() => expect(m.push).toHaveBeenCalledWith('/nova/cuestionarios/q9'));
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ documentoId: 'd1', pedidas: 10, dificultad: 'dificil', alcance: 'capitulo', capitulo: 1 });
  });

  it('un rango que no existe muestra el mensaje exacto y no deja crear', () => {
    render(<FormularioCuestionario documento={{ id: 'd1', paginas: 40 }} capitulos={[]} />);
    expect(screen.queryByLabelText('Un capítulo')).toBeNull();
    fireEvent.click(screen.getByLabelText('Un rango de páginas'));
    fireEvent.change(screen.getByLabelText('Desde la página'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Hasta la página'), { target: { value: '45' } });
    expect(screen.getByText('El rango de páginas no es válido: este documento tiene 40 páginas.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Crear cuestionario' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con parte de las pedidas, lo avisa al abrir; un error se muestra con su mensaje', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { mensaje: 'Este contenido no alcanza para un cuestionario. Elige más páginas o menos preguntas.' } }), { status: 422 }))
      .mockResolvedValueOnce(ok({ id: 'q9', creadas: 3, pedidas: 5 }, 201));
    vi.stubGlobal('fetch', f);
    render(<FormularioCuestionario documento={{ id: 'd1', paginas: 40 }} capitulos={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuestionario' }));
    expect(await screen.findByText('Este contenido no alcanza para un cuestionario. Elige más páginas o menos preguntas.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuestionario' }));
    await vi.waitFor(() => expect(m.push).toHaveBeenCalledWith('/nova/cuestionarios/q9?obtenidas=3&pedidas=5'));
  });
});
