// @vitest-environment node
// E11 (5.8, 6.3; RB-11, RB-25 a RB-27): configuración y borrar el historial.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn(), exigirSesion: vi.fn() }));
// La transacción usa el mismo doble: cada tx.query pasa por consultar.
vi.mock('@/lib/db/conexion', () => ({
  consultar: m.consultar,
  conTransaccion: async (trabajo: (tx: { query: (sql: string, v?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<unknown>) =>
    trabajo({ query: async (sql, v) => ({ rows: (await m.consultar(sql, v)) ?? [] }) }),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', async () => {
  const configuracion = await import('@/lib/datos/configuracion');
  return { ...configuracion, conversacionActual: vi.fn(), crearConversacion: vi.fn() };
});

import * as rutaConfiguracion from '@/app/api/nova/configuracion/route';
import * as rutaConversaciones from '@/app/api/nova/conversaciones/route';
import { actualizarConfiguracion, borrarHistorial, obtenerConfiguracion, obtenerPreferencias } from '@/lib/datos/configuracion';

const U = '11111111-1111-4111-8111-111111111111';
const FILA = { tema: 'oscuro', formato_hora: '12', nota_aprobar: '3.50', redondeo: 'redondear', cortes_defecto: [5000, 5000], hora_recordatorio: '07:30' };

function base(fila: Record<string, unknown> | null = null, nombre = 'Ana') {
  m.consultar.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM preferencias_usuario')) return fila ? [fila] : [];
    if (sql.includes('FROM public.users')) return [{ full_name: nombre }];
    if (sql.includes('DELETE FROM conversaciones')) return [{ id: 'c1' }, { id: 'c2' }];
    return [];
  });
}

const escrituras = () => m.consultar.mock.calls.filter(([sql]) => /INSERT|UPDATE|DELETE/.test(String(sql)));

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'yo@ejemplo.com' });
});

describe('leer', () => {
  it('sin fila, los valores por defecto (6.3)', async () => {
    base();
    await expect(obtenerPreferencias(U)).resolves.toEqual({ tema: 'automatico', formatoHora: '24', notaAprobar: 300, redondeo: 'truncar', cortesDefecto: [3000, 3000, 4000], horaRecordatorio: '08:00' });
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U]);
  });

  it('con fila, la nota en centésimas y el perfil con el correo de la sesión', async () => {
    base(FILA);
    await expect(obtenerConfiguracion(U, 'yo@ejemplo.com')).resolves.toEqual({
      perfil: { nombre: 'Ana', email: 'yo@ejemplo.com' },
      preferencias: { tema: 'oscuro', formatoHora: '12', notaAprobar: 350, redondeo: 'redondear', cortesDefecto: [5000, 5000], horaRecordatorio: '07:30' },
    });
  });
});

describe('guardar', () => {
  it('solo lo que llega: crea o actualiza la fila (upsert) del usuario', async () => {
    base();
    await actualizarConfiguracion(U, 'yo@ejemplo.com', { tema: 'oscuro', notaAprobar: '3,5', cortesDefecto: ['50', '50'] });
    const [sql, valores] = escrituras()[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO preferencias_usuario (usuario_id, tema, nota_aprobar, cortes_defecto)');
    expect(sql).toContain('ON CONFLICT (usuario_id) DO UPDATE SET tema = EXCLUDED.tema, nota_aprobar = EXCLUDED.nota_aprobar, cortes_defecto = EXCLUDED.cortes_defecto');
    expect(valores).toEqual([U, 'oscuro', '3.50', [5000, 5000]]);
    expect(escrituras()).toHaveLength(1);
  });

  it('E11c: la hora fija de los recordatorios se valida y recalcula los de las tareas sin horario', async () => {
    base();
    await actualizarConfiguracion(U, 'yo@ejemplo.com', { horaRecordatorio: '18:30' });
    const [insertar, recalcular] = escrituras() as Array<[string, unknown[]]>;
    expect(insertar?.[0]).toContain('INSERT INTO preferencias_usuario (usuario_id, hora_recordatorio)');
    expect(insertar?.[1]).toEqual([U, '18:30']);
    expect(recalcular?.[0]).toContain('hora_inicio IS NULL');
    expect(recalcular?.[0]).toContain("recordatorio_estado <> 'enviado'");
    expect(recalcular?.[1]).toEqual([U, '18:30']);
    await expect(actualizarConfiguracion(U, 'e', { horaRecordatorio: '25:00' })).rejects.toMatchObject({ codigo: 'HORA_RECORDATORIO_INVALIDA' });
  });

  it('el nombre va a public.users, recortado (RB-26)', async () => {
    base();
    await actualizarConfiguracion(U, 'yo@ejemplo.com', { nombre: '  Ana María ' });
    expect(escrituras()).toEqual([['UPDATE public.users SET full_name = $2 WHERE id = $1', [U, 'Ana María']]]);
  });

  it('valida todo antes de escribir: un dato malo no deja nada a medias', async () => {
    base();
    await expect(actualizarConfiguracion(U, 'e', { nombre: 'Ana', notaAprobar: '5,5' })).rejects.toMatchObject({ codigo: 'NOTA_APROBAR_INVALIDA' });
    await expect(actualizarConfiguracion(U, 'e', { nombre: ' ' })).rejects.toMatchObject({ codigo: 'NOMBRE_PERFIL_INVALIDO', message: 'Escribe tu nombre.' });
    await expect(actualizarConfiguracion(U, 'e', { tema: 'claro', cortesDefecto: ['30', '30'] })).rejects.toMatchObject({
      codigo: 'CORTES_NO_SUMAN',
      message: 'Los porcentajes de los cortes suman 60 %; deben sumar 100 %.',
    });
    await expect(actualizarConfiguracion(U, 'e', {})).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(escrituras()).toHaveLength(0);
  });

  it('borrar el historial borra solo las conversaciones del usuario (RB-25)', async () => {
    base();
    await expect(borrarHistorial(U)).resolves.toEqual({ borradas: 2 });
    expect(m.consultar.mock.calls[0]).toEqual(['DELETE FROM conversaciones WHERE usuario_id = $1 RETURNING id', [U]]);
  });
});

const peticion = (cuerpo: unknown) => new Request('http://x', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

describe('rutas', () => {
  it('GET y PATCH usan el dueño de la sesión', async () => {
    base(FILA);
    expect((await rutaConfiguracion.GET()).status).toBe(200);
    const r = await rutaConfiguracion.PATCH(peticion({ formatoHora: '24' }));
    expect(r.status).toBe(200);
    expect(escrituras()[0]?.[1]).toEqual([U, '24']);
  });

  it('PATCH rechaza campos desconocidos o valores fuera de la lista sin escribir', async () => {
    base();
    expect((await rutaConfiguracion.PATCH(peticion({ tema: 'azul' }))).status).toBe(400);
    expect((await rutaConfiguracion.PATCH(peticion({ usuario_id: 'otro', tema: 'claro' }))).status).toBe(400);
    expect((await rutaConfiguracion.PATCH(peticion({ formatoHora: '13' }))).status).toBe(400);
    const nota = await rutaConfiguracion.PATCH(peticion({ notaAprobar: '7' }));
    expect(nota.status).toBe(422);
    expect(((await nota.json()) as { error: { mensaje: string } }).error.mensaje).toBe('La nota para aprobar debe estar entre 0,0 y 5,0.');
    expect(escrituras()).toHaveLength(0);
  });

  it('DELETE /api/nova/conversaciones borra el historial de quien llama', async () => {
    base();
    const r = await rutaConversaciones.DELETE();
    expect(r.status).toBe(200);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U]);
  });

  it('sin sesión, 401 y nada se toca', async () => {
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaConversaciones.DELETE()).status).toBe(401);
    expect((await rutaConfiguracion.PATCH(peticion({ tema: 'claro' }))).status).toBe(401);
    expect(m.consultar).not.toHaveBeenCalled();
  });
});
