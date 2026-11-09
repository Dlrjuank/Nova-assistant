import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BuscadorWeb } from '@/components/nova/BuscadorWeb';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const responder = (cuerpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), { status }));
const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const boton = () => screen.getByRole('button', { name: 'Buscar en Wikipedia' });
const RESULTADO = {
  resumen: 'La Sierra Nevada es una cordillera.',
  url: 'https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta',
  guardada: true,
  categoria: 'Viajes',
  articulos: [{ titulo: 'Sierra Nevada de Santa Marta', url: 'https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta' }],
  fuentesEnCategoria: 5,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BuscadorWeb', () => {
  it('RN-02: deshabilita buscar con una consulta corta y muestra el mensaje exacto', () => {
    render(<BuscadorWeb />);
    expect((screen.getByLabelText('Categoría') as HTMLInputElement).value).toBe('General');
    expect(boton().hasAttribute('disabled')).toBe(true);
    escribir('¿Qué quieres buscar?', 'Colombia');
    expect(boton().hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Escribe al menos 2 palabras y 8 caracteres. Por ejemplo: qué es la fotosíntesis.')).toBeTruthy();
    expect((screen.getByLabelText('¿Qué quieres buscar?') as HTMLInputElement).placeholder).toBe('Ej.: qué es la fotosíntesis');
    escribir('¿Qué quieres buscar?', 'Sierra Nevada');
    expect(boton().hasAttribute('disabled')).toBe(false);
  });

  it('envía consulta normalizada y categoría; muestra resumen, artículos y la fuente guardada', async () => {
    const f = vi.fn().mockImplementation(() => responder({ ok: true, datos: RESULTADO }));
    vi.stubGlobal('fetch', f);
    render(<BuscadorWeb />);
    escribir('¿Qué quieres buscar?', '  Sierra   Nevada ');
    escribir('Categoría', 'Viajes');
    fireEvent.click(boton());

    expect(await screen.findByText('La Sierra Nevada es una cordillera.')).toBeTruthy();
    expect(JSON.parse(f.mock.calls[0]?.[1].body)).toEqual({ consulta: 'Sierra Nevada', categoria: 'Viajes' });
    const enlace = screen.getByRole('link', { name: 'Sierra Nevada de Santa Marta' });
    expect(enlace.getAttribute('href')).toBe(RESULTADO.url);
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/Fuente guardada en «Viajes».*5 de 20/)).toBeTruthy();
  });

  it('RN-05: LIMITE_FUENTES muestra el mensaje del servidor como advertencia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        responder(
          {
            ok: false,
            error: { codigo: 'LIMITE_FUENTES', mensaje: 'Alcanzó el máximo de 20 fuentes en esta categoría; archive o elimine una.' },
          },
          409,
        ),
      ),
    );
    render(<BuscadorWeb />);
    escribir('¿Qué quieres buscar?', 'Sierra Nevada');
    fireEvent.click(boton());
    expect(await screen.findByText(/Alcanzó el máximo de 20 fuentes/)).toBeTruthy();
    expect(screen.getByText('Atención:')).toBeTruthy();
  });

  it('sin resultados muestra el aviso y no dice que guardó', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        responder({
          ok: true,
          datos: { ...RESULTADO, guardada: false, url: '', articulos: [], resumen: 'Wikipedia no encontró artículos para esta consulta. Pruebe con otras palabras.' },
        }),
      ),
    );
    render(<BuscadorWeb />);
    escribir('¿Qué quieres buscar?', 'qwerty asdfgh');
    fireEvent.click(boton());
    expect(await screen.findByText(/Wikipedia no encontró artículos/)).toBeTruthy();
    expect(screen.queryByText(/Fuente guardada/)).toBeNull();
  });

  it('sin conexión muestra un aviso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    render(<BuscadorWeb />);
    escribir('¿Qué quieres buscar?', 'Sierra Nevada');
    fireEvent.click(boton());
    expect(await screen.findByText('No se pudo conectar con el servidor. Intente de nuevo.')).toBeTruthy();
  });
});
