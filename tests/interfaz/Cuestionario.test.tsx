// E10e y E10g (5.11, 5.12): responder un cuestionario de cada tipo y crearlo.
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
  tipo: 'unica',
  documento: { id: 'd1', nombre: 'libro.pdf', categoria: 'Biología' },
  alcance: 'Páginas 2–4',
  dificultad: 'media',
  pedidas: 2,
  intento: { id: 'i1', repaso: false, terminado: false, aciertos: null, total: preguntas.length, puntaje: null, preguntas, sugerencias: [], ...extra },
});
const P = (id: string, respuesta?: NonNullable<CuestionarioVista['intento']['preguntas'][number]['respuesta']>) => ({
  id,
  tipo: 'unica' as const,
  enunciado: `¿Pregunta ${id}?`,
  opciones: [`a${id}`, `b${id}`, `c${id}`, `d${id}`],
  ...(respuesta ? { respuesta } : {}),
});
const RESPUESTA = { puntos: 0, elegida: 0, acierto: false, correcta: 2, explicacion: 'Lo dice la página 3.', cita: 'una cita del texto', fuente: 'libro.pdf · p. 3' };

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ ...RESPUESTA, puntos: 100, elegida: 2, acierto: true, resultado: { aciertos: 1, total: 2, puntaje: 250, sugerencias: [] } })));
    render(<Cuestionario datos={vista([P('1', RESPUESTA), P('2')])} />);
    fireEvent.click(screen.getByRole('button', { name: /c2/ }));
    expect(await screen.findByText('¡Acertaste!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(screen.getByText('2,5')).toBeTruthy();
    expect(screen.getByText('1 de 2 bien')).toBeTruthy(); // 7.12
    expect(screen.getByText('¿Pregunta 1?')).toBeTruthy(); // la fallada
    expect(screen.getByText('Respuesta correcta: c1')).toBeTruthy();
  });

  it('"Repetir solo las que fallé" y "Hacer de nuevo" no llaman a Gemini: solo crean un intento', async () => {
    const f = vi.fn().mockImplementation(async () => ok({ id: 'i2' }, 201));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={vista([P('1', RESPUESTA), P('2', { ...RESPUESTA, puntos: 100, acierto: true })], { terminado: true, aciertos: 1, puntaje: 250 })} />);
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
    render(<Cuestionario datos={vista([P('1', { ...RESPUESTA, puntos: 100, acierto: true })], { terminado: true, aciertos: 1, puntaje: 500, repaso: true })} />);
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
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ documentoId: 'd1', pedidas: 10, dificultad: 'dificil', tipo: 'mixto', alcance: 'capitulo', capitulo: 1 });
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

// ---------- E10g: una pantalla por tipo ----------

const SOLUCION = { explicacion: 'Lo dice el texto.', cita: 'una cita del texto', fuente: 'libro.pdf · p. 3' };
const mixto = (preguntas: CuestionarioVista['intento']['preguntas'], extra: Partial<CuestionarioVista['intento']> = {}): CuestionarioVista => ({ ...vista(preguntas, extra), tipo: 'mixto' });
const MULTIPLE = { id: 'm', tipo: 'multiple' as const, enunciado: '¿Cuáles?', opciones: ['Agua', 'Arena', 'Luz', 'Sal'], cuantasCorrectas: 2 };
const VF = { id: 'v', tipo: 'vf' as const, enunciado: 'Las plantas comen arena.' };
const COMPLETAR = { id: 'c', tipo: 'completar' as const, enunciado: 'La _____ ocurre en las hojas.' };
const ABIERTA = { id: 'a', tipo: 'abierta' as const, enunciado: '¿Para qué sirve la luz?' };

describe('Cuestionario con tipos (5.12)', () => {
  it('múltiple: dice cuántas son correctas, pide marcar al menos una y vale parcial (RB-65, B-78)', async () => {
    const f = vi.fn().mockResolvedValue(ok({ ...SOLUCION, puntos: 50, acierto: false, elegidas: [0, 1, 2], correctas: [0, 2] }));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={mixto([MULTIPLE, VF])} />);
    expect(screen.getByText('Pregunta 1 de 2 · Respuesta múltiple')).toBeTruthy();
    expect(screen.getByText('Hay 2 respuestas correctas.')).toBeTruthy();
    const casillas = screen.getAllByRole('checkbox');
    expect(casillas).toHaveLength(4);
    expect(casillas[0]?.closest('label')?.className).toContain('min-h-14');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(screen.getByText('Marca al menos una opción.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    for (const i of [0, 1, 2]) fireEvent.click(casillas[i] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByText('A medias: vale 0,5 de 1')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ preguntaId: 'm', elegidas: [0, 1, 2] });
    expect(screen.getByText('Arena').closest('label')?.textContent).toContain('Tu respuesta');
    expect(screen.getByText('Luz').closest('label')?.textContent).toContain('Correcta');
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).disabled)).toBe(true);
  });

  it('verdadero o falso: dos botones grandes; la falsa explica lo correcto (RB-66)', async () => {
    const f = vi.fn().mockResolvedValue(ok({ ...SOLUCION, puntos: 0, acierto: false, respondioVerdadero: true, verdadero: false }));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={mixto([VF])} />);
    const verdadero = screen.getByRole('button', { name: 'Verdadero' });
    expect(verdadero.className).toContain('min-h-16');
    fireEvent.click(verdadero);
    expect(await screen.findByText('No acertaste')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ preguntaId: 'v', verdadero: true });
    expect(screen.getByRole('button', { name: /Falso.*Correcta/ })).toBeTruthy();
    expect(screen.getByText('Lo dice el texto.')).toBeTruthy();
  });

  it('completar: la línea se lee como espacio en blanco, pide escribir y muestra lo que faltaba (RB-67)', async () => {
    const f = vi.fn().mockResolvedValue(ok({ ...SOLUCION, puntos: 100, acierto: true, texto: 'FOTOSINTESIS', respuestaCorrecta: 'fotosíntesis' }));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={mixto([COMPLETAR])} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('La _____(espacio en blanco) ocurre en las hojas.');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(screen.getByText('Escribe tu respuesta.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: '  FOTOSINTESIS ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByText('¡Acertaste!')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ preguntaId: 'c', texto: 'FOTOSINTESIS' });
    expect(screen.getByText('fotosíntesis')).toBeTruthy();
  });

  it('abierta: tras enviar, la respuesta modelo, la cita y los tres botones; con la calificación, el resultado (RB-68, B-80)', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(ok({ ...SOLUCION, puntos: null, acierto: null, texto: 'Para crecer.', respuestaCorrecta: 'Para hacer la fotosíntesis.', autoevaluacion: null }))
      .mockResolvedValueOnce(ok({ ...SOLUCION, puntos: 50, acierto: false, texto: 'Para crecer.', respuestaCorrecta: 'Para hacer la fotosíntesis.', autoevaluacion: 'medias', resultado: { aciertos: 0, total: 1, puntaje: 250, sugerencias: [] } }));
    vi.stubGlobal('fetch', f);
    render(<Cuestionario datos={mixto([ABIERTA])} />);
    const campo = screen.getByLabelText('Tu respuesta');
    expect(campo.tagName).toBe('TEXTAREA');
    fireEvent.change(campo, { target: { value: 'Para crecer.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(await screen.findByText('Compara tu respuesta con la respuesta modelo y califícate.')).toBeTruthy();
    expect(screen.getByText('Para hacer la fotosíntesis.')).toBeTruthy();
    expect(screen.getByText('«una cita del texto»')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver resultado' })).toBeNull(); // sin calificarse no sigue
    fireEvent.click(screen.getByRole('button', { name: 'A medias' }));
    expect(await screen.findByText('A medias: vale 0,5 de 1')).toBeTruthy();
    expect(f.mock.calls[1]?.[0]).toBe('/api/nova/intentos/i1/autoevaluacion');
    expect(JSON.parse(f.mock.calls[1]?.[1].body)).toEqual({ preguntaId: 'a', calificacion: 'medias' });
    expect(screen.queryByRole('button', { name: 'La tuve bien' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado' }));
    expect(screen.getByText('0 de 1 bien · 1 a medias')).toBeTruthy();
    expect(screen.getByText('Respuesta modelo: Para hacer la fotosíntesis.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Repetir solo las que fallé' })).toBeTruthy();
  });

  it('al volver con una abierta enviada sin calificar, se queda en ella con los tres botones', () => {
    const enviada = { ...ABIERTA, respuesta: { ...SOLUCION, puntos: null, acierto: null, texto: 'Para crecer.', respuestaCorrecta: 'Para hacer la fotosíntesis.', autoevaluacion: null } };
    render(<Cuestionario datos={mixto([enviada, VF])} />);
    expect(screen.getByText('Pregunta 1 de 2 · Pregunta abierta')).toBeTruthy();
    for (const nombre of ['La tuve bien', 'A medias', 'Mal']) expect(screen.getByRole('button', { name: nombre })).toBeTruthy();
  });

  it('el resultado cuenta las parciales como falladas y muestra la solución de cada tipo', () => {
    const preguntas = [
      { ...MULTIPLE, respuesta: { ...SOLUCION, puntos: 50, acierto: false, elegidas: [0], correctas: [0, 2] } },
      { ...VF, respuesta: { ...SOLUCION, puntos: 0, acierto: false, respondioVerdadero: true, verdadero: false } },
      { ...COMPLETAR, respuesta: { ...SOLUCION, puntos: 100, acierto: true, texto: 'x', respuestaCorrecta: 'fotosíntesis' } },
    ];
    render(<Cuestionario datos={mixto(preguntas, { terminado: true, aciertos: 1, puntaje: 250 })} />);
    expect(screen.getByText('1 de 3 bien · 1 a medias')).toBeTruthy();
    expect(screen.getByText('Respuestas correctas: Agua · Luz')).toBeTruthy();
    expect(screen.getByText('Respuesta correcta: Falso')).toBeTruthy();
    expect(screen.queryByText('Lo que faltaba: fotosíntesis')).toBeNull(); // la acertada no está entre las falladas
    expect(screen.getByText(/Mixto · Dificultad media/)).toBeTruthy();
  });
});

describe('FormularioCuestionario: tipo de preguntas (RB-64)', () => {
  it('Mixto viene marcado; se puede elegir otro tipo y se envía', async () => {
    const f = vi.fn().mockResolvedValue(ok({ id: 'q9', creadas: 5, pedidas: 5 }, 201));
    vi.stubGlobal('fetch', f);
    render(<FormularioCuestionario documento={{ id: 'd1', paginas: 40 }} capitulos={[]} />);
    const grupo = screen.getByRole('group', { name: 'Tipo de preguntas' });
    expect(within(grupo).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual([
      'Mixto',
      'Selección única',
      'Respuesta múltiple',
      'Verdadero o falso',
      'Completar',
      'Pregunta abierta',
    ]);
    expect((screen.getByLabelText('Mixto') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Verdadero o falso'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuestionario' }));
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toMatchObject({ tipo: 'vf' });
  });
});
