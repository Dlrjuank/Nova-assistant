// E20b (commit 5): Asistente con burbujas, tres puntos mientras responde, cita desplegable y preguntas sugeridas.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Chat } from '@/components/nova/Chat';
import { ListaFuentes } from '@/components/nova/ListaFuentes';
import { MensajeChat } from '@/components/nova/MensajeChat';
import { conExtractos, extractoCita, sugerenciasAsistente } from '@/lib/reglas/asistente';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('reglas del Asistente', () => {
  it('extracto de la cita: en una línea y cortado en una palabra', () => {
    expect(extractoCita('  La  célula\n es la unidad ')).toBe('La célula es la unidad');
    const largo = 'palabra '.repeat(80);
    const corto = extractoCita(largo, 50);
    expect(corto.endsWith('palabra…')).toBe(true);
    expect(corto.length).toBeLessThanOrEqual(51);
  });

  it('cada fuente de PDF lleva el extracto del primer fragmento con su etiqueta; las tareas no', () => {
    const r = conExtractos(
      [{ tipo: 'pdf', etiqueta: 'a.pdf · p. 2' }, { tipo: 'tarea', etiqueta: 'Tarea 1' }],
      [{ contenido: 'primero', e: 'a.pdf · p. 2' }, { contenido: 'segundo', e: 'a.pdf · p. 2' }],
      (f) => f.e,
    );
    expect(r).toEqual([{ tipo: 'pdf', etiqueta: 'a.pdf · p. 2', fragmento: 'primero' }, { tipo: 'tarea', etiqueta: 'Tarea 1' }]);
  });

  it('sugerencias según lo que tiene la persona', () => {
    expect(sugerenciasAsistente({ hayTareas: true, documentos: [{ nombre: 'Biología.pdf' }] })).toEqual([
      '¿Qué tengo esta semana?',
      '¿Qué tareas tengo vencidas?',
      'Resume las ideas principales de «Biología»',
      '¿Qué temas trata «Biología»?',
    ]);
    expect(sugerenciasAsistente({ hayTareas: false, documentos: [] })).toEqual(['¿Qué tareas tengo pendientes?']);
  });
});

describe('pantalla del Asistente', () => {
  it('la cita de PDF con extracto se despliega en cursiva al tocarla y se pliega otra vez', () => {
    render(<ListaFuentes fuentes={[{ tipo: 'pdf', etiqueta: 'a.pdf · p. 4', fragmento: 'La mitosis tiene cuatro fases.' }, { tipo: 'pdf', etiqueta: 'b.pdf · p. 1' }]} />);
    const chip = screen.getByRole('button', { name: /a\.pdf · p\. 4/ });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/mitosis/)).toBeNull();
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const cita = screen.getByText(/La mitosis tiene cuatro fases/).closest('blockquote') as HTMLElement;
    expect(cita.className).toContain('italic');
    expect(cita.className).toContain('border-acento');
    expect(chip.getAttribute('aria-controls')).toBe(cita.id);
    fireEvent.click(chip);
    expect(screen.queryByText(/mitosis/)).toBeNull();
    // Sin extracto (respuestas guardadas antes), la cita es solo un chip.
    expect(screen.queryByRole('button', { name: /b\.pdf/ })).toBeNull();
    expect(screen.getByText('b.pdf · p. 1')).toBeTruthy();
  });

  it('la pregunta va en una burbuja de acento y la respuesta en un panel', () => {
    const { container } = render(
      <ul>
        <MensajeChat autor="usuario" texto="hola" nuevo />
        <MensajeChat autor="asistente" texto="qué tal" />
      </ul>,
    );
    const [yo, nova] = container.querySelectorAll('li');
    expect(yo?.className).toContain('nova-subir');
    expect(yo?.querySelector('div')?.className).toContain('bg-acento');
    expect(nova?.className).not.toContain('nova-subir');
    expect(nova?.querySelector('div')?.className).toContain('border-borde');
  });

  it('mientras responde: tres puntos (y "Pensando…" para lectores de pantalla); una sugerencia se envía al tocarla', async () => {
    let soltar: (r: Response) => void = () => {};
    const fetchFalso = vi.fn(() => new Promise<Response>((res) => (soltar = res)));
    vi.stubGlobal('fetch', fetchFalso);
    render(<Chat sugerencias={['¿Qué tengo esta semana?']} />);
    const grupo = screen.getByRole('group', { name: 'Preguntas sugeridas' });
    fireEvent.click(within(grupo).getByRole('button', { name: '¿Qué tengo esta semana?' }));
    expect(JSON.parse(String((fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ pregunta: '¿Qué tengo esta semana?' });
    const estado = screen.getByRole('status');
    expect(estado.textContent).toContain('Pensando…');
    expect(estado.querySelectorAll('.nova-punto')).toHaveLength(3);
    // Mientras piensa no se ofrecen sugerencias.
    expect(screen.queryByRole('group', { name: 'Preguntas sugeridas' })).toBeNull();
    soltar(new Response(JSON.stringify({ ok: true, datos: { respuesta: 'Tienes 2 tareas.', fuentes: [], conversacionId: 'c1', guardada: true } })));
    await waitFor(() => expect(screen.getByText('Tienes 2 tareas.')).toBeTruthy());
    expect(screen.getByRole('group', { name: 'Preguntas sugeridas' })).toBeTruthy();
  });

  it('una respuesta guardada antes con "[Tarea 397a5717]" no muestra la marca ni el chip del identificador', () => {
    const { container } = render(
      <ul>
        <MensajeChat autor="asistente" texto="Tienes el Taller de cálculo para el 2026-11-25 [tarea 397a5717]." fuentes={[{ tipo: 'tarea', etiqueta: 'Tarea 397a5717' }]} />
      </ul>,
    );
    expect(container.textContent).not.toMatch(/397a5717/);
    expect(screen.getByText('Tienes el Taller de cálculo para el 2026-11-25.')).toBeTruthy();
    // La cita nueva de una tarea se ve como las demás, con su título.
    cleanup();
    render(<ListaFuentes fuentes={[{ tipo: 'tarea', etiqueta: 'Taller de cálculo' }]} />);
    expect(screen.getByText('Taller de cálculo')).toBeTruthy();
  });

  it('con otro "Buscar en" (por ejemplo Wikipedia) no hay sugerencias', () => {
    render(<Chat sugerencias={['¿Qué tengo esta semana?']} />);
    fireEvent.change(screen.getByLabelText('Buscar en'), { target: { value: 'wikipedia' } });
    expect(screen.queryByRole('group', { name: 'Preguntas sugeridas' })).toBeNull();
  });
});
