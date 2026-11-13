// E11 (5.8; RB-11, RB-25 a RB-28; B-03, B-22, B-23): bloques de Configuración y formato de hora.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BloqueAcademico } from '@/components/nova/configuracion/BloqueAcademico';
import { BloqueApariencia } from '@/components/nova/configuracion/BloqueApariencia';
import { BloqueAsistente } from '@/components/nova/configuracion/BloqueAsistente';
import { BloquePerfil } from '@/components/nova/configuracion/BloquePerfil';
import { HorarioTarea, ProveedorPreferencias } from '@/components/nova/PreferenciasNova';
import { PREFERENCIAS_POR_DEFECTO } from '@/lib/reglas/preferencias';

const nav = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

const ok = (datos: unknown) => new Response(JSON.stringify({ ok: true, datos }), { status: 200 });
const falla = (mensaje: string, status = 422) => new Response(JSON.stringify({ ok: false, error: { codigo: 'X', mensaje } }), { status });
const config = (preferencias = {}, nombre = 'Ana') => ({ perfil: { nombre, email: 'yo@ejemplo.com' }, preferencias: { ...PREFERENCIAS_POR_DEFECTO, ...preferencias } });
const cuerpo = (f: ReturnType<typeof vi.fn>, n = 0) => JSON.parse(f.mock.calls[n]?.[1].body as string) as Record<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Apariencia (RB-27, B-03)', () => {
  it('el tema cambia toda la app al momento, se recuerda en el navegador y se guarda', async () => {
    const f = vi.fn().mockResolvedValue(ok(config({ tema: 'oscuro' })));
    vi.stubGlobal('fetch', f);
    render(<BloqueApariencia tema="automatico" formatoHora="24" />);
    fireEvent.click(screen.getByLabelText('Oscuro'));
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    expect(localStorage.getItem('nova-tema')).toBe('oscuro');
    await vi.waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/configuracion');
    expect(f.mock.calls[0]?.[1].method).toBe('PATCH');
    expect(cuerpo(f)).toEqual({ tema: 'oscuro' });
  });

  it('automático quita el atributo para seguir al sistema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(config())));
    document.documentElement.setAttribute('data-tema', 'claro');
    render(<BloqueApariencia tema="claro" formatoHora="24" />);
    fireEvent.click(screen.getByLabelText(/Automático/));
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
    expect(localStorage.getItem('nova-tema')).toBe('automatico');
    await vi.waitFor(() => expect(nav.refresh).toHaveBeenCalled());
  });

  it('si no se puede guardar, vuelve al tema anterior y lo dice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(falla('Ocurrió un error inesperado. Intente de nuevo.', 500)));
    render(<BloqueApariencia tema="claro" formatoHora="24" />);
    fireEvent.click(screen.getByLabelText('Oscuro'));
    expect(await screen.findByText('Ocurrió un error inesperado. Intente de nuevo.')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    expect((screen.getByLabelText('Claro') as HTMLInputElement).checked).toBe(true);
  });

  it('el formato de hora se guarda y la app se refresca', async () => {
    const f = vi.fn().mockResolvedValue(ok(config({ formatoHora: '12' })));
    vi.stubGlobal('fetch', f);
    render(<BloqueApariencia tema="automatico" formatoHora="24" />);
    fireEvent.click(screen.getByLabelText('12 horas (1:30 p. m.)'));
    await vi.waitFor(() => expect(nav.refresh).toHaveBeenCalled());
    expect(cuerpo(f)).toEqual({ formatoHora: '12' });
  });
});

describe('formato de hora en toda la app', () => {
  it('el proveedor entrega 12 horas a los horarios, y aplica el tema guardado en la base', () => {
    render(
      <ProveedorPreferencias tema="oscuro" formatoHora="12">
        <HorarioTarea horaInicio="13:30" horaFin="15:00" />
      </ProveedorPreferencias>,
    );
    expect(screen.getByText('1:30 p. m. – 3:00 p. m.')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    expect(localStorage.getItem('nova-tema')).toBe('oscuro');
  });

  it('sin proveedor, 24 horas', () => {
    render(<HorarioTarea horaInicio="13:30" />);
    expect(screen.getByText('13:30')).toBeTruthy();
  });
});

describe('Académico (RB-11)', () => {
  const bloque = () => render(<BloqueAcademico notaAprobar={300} redondeo="truncar" cortesDefecto={[3000, 3000, 4000]} />);

  it('muestra la escala, la nota, el redondeo y los cortes con su suma', () => {
    bloque();
    expect(screen.getByText('De 0,0 a 5,0')).toBeTruthy();
    expect((screen.getByLabelText('Nota para aprobar') as HTMLInputElement).value).toBe('3,0');
    expect((screen.getByLabelText('Truncar (3,47 → 3,4)') as HTMLInputElement).checked).toBe(true);
    expect(['Corte 1', 'Corte 2', 'Corte 3'].map((c) => (screen.getByLabelText(c) as HTMLInputElement).value)).toEqual(['30', '30', '40']);
    expect(screen.getByText('Suman 100 %.')).toBeTruthy();
  });

  it('nota fuera de 0,0 a 5,0 o cortes que no suman 100 % no se envían', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    bloque();
    fireEvent.change(screen.getByLabelText('Nota para aprobar'), { target: { value: '5,5' } });
    fireEvent.change(screen.getByLabelText('Corte 3'), { target: { value: '30' } });
    expect(screen.getByText('Suman 90 %.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('La nota para aprobar debe estar entre 0,0 y 5,0.')).toBeTruthy();
    expect(screen.getByText('Los porcentajes de los cortes suman 90 %; deben sumar 100 %.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('agregar y quitar cortes; guarda la nota, el redondeo y los cortes', async () => {
    const f = vi.fn().mockResolvedValue(ok(config({ notaAprobar: 350, redondeo: 'redondear', cortesDefecto: [2500, 2500, 2500, 2500] })));
    vi.stubGlobal('fetch', f);
    bloque();
    fireEvent.change(screen.getByLabelText('Nota para aprobar'), { target: { value: '3,5' } });
    fireEvent.click(screen.getByLabelText('Redondear (3,47 → 3,5)'));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar corte' }));
    for (const c of ['Corte 1', 'Corte 2', 'Corte 3', 'Corte 4']) fireEvent.change(screen.getByLabelText(c), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Se guardaron tus preferencias académicas.')).toBeTruthy();
    expect(cuerpo(f)).toEqual({ notaAprobar: '3,5', redondeo: 'redondear', cortesDefecto: ['25', '25', '25', '25'] });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar el corte 4' }));
    expect(screen.queryByLabelText('Corte 4')).toBeNull();
  });
});

describe('Asistente (RB-25, B-23)', () => {
  it('avisa qué se envía a Gemini y que el plan gratuito puede usarlo', () => {
    render(<BloqueAsistente />);
    expect(screen.getByText(/Nova envía a Gemini, de Google, tus preguntas/)).toBeTruthy();
    expect(screen.getByText(/No escribas ni subas información sensible, confidencial o personal\./)).toBeTruthy();
  });

  it('pide confirmación con el texto exacto y borra solo al confirmar', async () => {
    const f = vi.fn().mockResolvedValue(ok({ borradas: 3 }));
    vi.stubGlobal('fetch', f);
    render(<BloqueAsistente />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar historial' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('Se borrará todo tu historial con el asistente. No se puede deshacer.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(f).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar historial' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Borrar historial' }));
    expect(await screen.findByText('Se borró tu historial con el asistente.')).toBeTruthy();
    expect(f.mock.calls[0]?.[0]).toBe('/api/nova/conversaciones');
    expect(f.mock.calls[0]?.[1].method).toBe('DELETE');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Perfil (RB-26, RB-28, B-22)', () => {
  it('el correo es de solo lectura; el nombre vacío no se envía', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<BloquePerfil nombre="Ana" email="yo@ejemplo.com" />);
    expect((screen.getByLabelText('Correo') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(screen.getByText('Escribe tu nombre.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it('guarda el nombre', async () => {
    const f = vi.fn().mockResolvedValue(ok(config({}, 'Ana María')));
    vi.stubGlobal('fetch', f);
    render(<BloquePerfil nombre="Ana" email="yo@ejemplo.com" />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana María ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(await screen.findByText('Se guardó tu nombre.')).toBeTruthy();
    expect(cuerpo(f)).toEqual({ nombre: 'Ana María ' });
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('cambiar contraseña: usa /api/auth/password y muestra sus mensajes', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'La contraseña actual es incorrecta.' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    render(<BloquePerfil nombre="Ana" email="yo@ejemplo.com" />);
    const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
    escribir('Contraseña actual', 'vieja-123');
    escribir('Contraseña nueva', 'nueva-1234');
    escribir('Repite la contraseña nueva', 'otra-1234');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByText('La confirmación no coincide con la nueva contraseña.')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    escribir('Repite la contraseña nueva', 'nueva-1234');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('La contraseña actual es incorrecta.')).toBeTruthy();
    expect(f.mock.calls[0]?.[0]).toBe('/api/auth/password');
    expect(cuerpo(f)).toEqual({ currentPassword: 'vieja-123', newPassword: 'nueva-1234' });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('Tu contraseña se actualizó correctamente.')).toBeTruthy();
    expect((screen.getByLabelText('Contraseña actual') as HTMLInputElement).value).toBe('');
  });
});
