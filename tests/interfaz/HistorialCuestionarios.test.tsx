// E10f (5.11, RB-53): historial de cuestionarios y sugerencia de repaso.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistorialCuestionarios } from '@/components/nova/cuestionarios/HistorialCuestionarios';
import { SugerenciasRepaso } from '@/components/nova/cuestionarios/SugerenciasRepaso';
import type { DocumentoHistorial, SugerenciaRepaso } from '@/lib/dataService';

const respuesta = (cuerpo: unknown, status: number) => new Response(JSON.stringify(cuerpo), { status });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const intento = (o: Partial<DocumentoHistorial['cuestionarios'][number]['intentos'][number]>) => ({
  id: 'i',
  fecha: '2026-11-12',
  repaso: false,
  terminado: true,
  aciertos: 3,
  total: 5,
  puntaje: 300,
  comparacion: null,
  ...o,
});

const DOCS: DocumentoHistorial[] = [
  {
    id: 'd1',
    nombre: 'biologia.pdf',
    cuestionarios: [
      {
        id: 'q1',
        alcance: 'La célula',
        dificultad: 'media',
        preguntas: 5,
        creadoEn: '2026-11-10',
        intentos: [
          intento({ id: 'c', puntaje: 400, aciertos: 4, comparacion: 'mejor' }),
          intento({ id: 'b', repaso: true, puntaje: 500, aciertos: 2, total: 2 }),
          intento({ id: 'a', puntaje: 300 }),
        ],
      },
      { id: 'q2', alcance: 'Páginas 3–4', dificultad: 'dificil', preguntas: 10, creadoEn: '2026-11-11', intentos: [intento({ id: 'x', terminado: false, aciertos: null, puntaje: null })] },
    ],
  },
];

describe('HistorialCuestionarios', () => {
  it('por documento, cada cuestionario con su alcance, dificultad e intentos con puntaje y si mejoraste', () => {
    render(<HistorialCuestionarios documentos={DOCS} />);
    expect(screen.getByRole('heading', { name: 'biologia.pdf' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'La célula' })).toBeTruthy();
    expect(screen.getByText(/Dificultad media · 5 preguntas/)).toBeTruthy();
    const intentos = within(screen.getAllByRole('list', { name: 'Intentos, del más reciente al más antiguo' })[0] as HTMLElement).getAllByRole('listitem');
    expect(intentos).toHaveLength(3);
    expect(intentos[0]?.textContent).toContain('Mejoraste');
    expect(intentos[0]?.textContent).toContain('4,0 de 5');
    expect(intentos[1]?.textContent).toContain('Repaso');
    expect(intentos[1]?.textContent).not.toContain('Mejoraste');
    expect(screen.getByRole('link', { name: 'Abrir el cuestionario La célula' }).getAttribute('href')).toBe('/nova/cuestionarios/q1');
  });

  it('un intento sin terminar dice "Sin terminar" y el botón es "Continuar"', () => {
    render(<HistorialCuestionarios documentos={DOCS} />);
    expect(screen.getByText('Sin terminar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir el cuestionario Páginas 3–4' }).textContent).toBe('Continuar');
  });
});

const SUG: SugerenciaRepaso[] = [{ capituloId: 'cap1', titulo: 'Repasar cap. 1: La célula (pp. 1–20)', falladas: 2, yaExiste: false }];

describe('SugerenciasRepaso (RB-53)', () => {
  it('no se crea sola: abre un diálogo con fecha y categoría, y crea al confirmar', async () => {
    const f = vi.fn().mockResolvedValue(respuesta({ ok: true, datos: { id: 't1', titulo: SUG[0]?.titulo, categoria: 'Biología' } }, 201));
    vi.stubGlobal('fetch', f);
    render(<SugerenciasRepaso intentoId="i1" sugerencias={SUG} categoriaInicial="Biología" categorias={[{ nombre: 'Biología', color: 'verde' }]} />);
    expect(screen.getByText('Fallaste 2 preguntas de este capítulo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea de repaso' }));
    expect(f).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Fecha límite'), { target: { value: '20261120' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear tarea' }));
    expect(await screen.findByText(/Se creó la tarea «Repasar cap. 1: La célula \(pp. 1–20\)» en «Biología»/)).toBeTruthy();
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/intentos/i1/tarea-repaso');
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ capituloId: 'cap1', fecha: '2026-11-20', categoria: 'Biología' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ya tienes esa tarea de repaso.')).toBeTruthy(); // no se ofrece otra vez
  });

  it('si ya existe, lo dice en vez del botón', () => {
    render(<SugerenciasRepaso intentoId="i1" sugerencias={[{ ...(SUG[0] as SugerenciaRepaso), yaExiste: true }]} categoriaInicial="Biología" categorias={[]} />);
    expect(screen.getByText('Ya tienes esa tarea de repaso.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Crear tarea de repaso' })).toBeNull();
  });

  it('el 409 del servidor se muestra en el diálogo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ ok: false, error: { codigo: 'TAREA_REPASO_EXISTENTE', mensaje: 'Ya tienes esa tarea de repaso.' } }, 409)));
    render(<SugerenciasRepaso intentoId="i1" sugerencias={SUG} categoriaInicial="Biología" categorias={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea de repaso' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear tarea' }));
    expect(await within(screen.getByRole('dialog')).findByText('Ya tienes esa tarea de repaso.')).toBeTruthy();
  });

  it('sin sugerencias no muestra nada', () => {
    const { container } = render(<SugerenciasRepaso intentoId="i1" sugerencias={[]} categoriaInicial="Biología" categorias={[]} />);
    expect(container.textContent).toBe('');
  });
});
