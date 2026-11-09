// @vitest-environment node
// E10b2 (RB-54): ver y eliminar las fuentes web guardadas.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({ consultar: vi.fn(), exigirSesion: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar, conTransaccion: vi.fn() }));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/llm/gemini', () => ({ llm: {} }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/wikipedia'));

import * as rutaLista from '@/app/api/nova/web/fuentes/route';
import * as rutaFuente from '@/app/api/nova/web/fuentes/[id]/route';
import { eliminarFuenteWeb, listarFuentesWeb } from '@/lib/datos/wikipedia';
import { agruparFuentes, tituloDeArticulo } from '@/lib/reglas/fuentesWeb';

const U = '11111111-1111-4111-8111-111111111111';
const F = '22222222-2222-4222-8222-222222222222';
const borrar = (id = F) => rutaFuente.DELETE(new Request(`http://x/api/nova/web/fuentes/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.exigirSesion.mockResolvedValue({ id: U, email: 'dueno@ejemplo.com' });
});

describe('reglas', () => {
  it('el título sale de la dirección del artículo', () => {
    expect(tituloDeArticulo('https://es.wikipedia.org/wiki/Fotos%C3%ADntesis')).toBe('Fotosíntesis');
    expect(tituloDeArticulo('https://es.wikipedia.org/wiki/Sierra_Nevada_de_Santa_Marta')).toBe('Sierra Nevada de Santa Marta');
    expect(tituloDeArticulo('no es una url')).toBe('no es una url');
    expect(tituloDeArticulo('https://es.wikipedia.org/wiki/%E0%A4%A')).toBe('https://es.wikipedia.org/wiki/%E0%A4%A');
  });

  it('agrupa con General primero y luego alfabético', () => {
    const grupos = agruparFuentes([{ categoria: 'Viajes' }, { categoria: 'General' }, { categoria: 'Ciencia' }, { categoria: 'Viajes' }]);
    expect(grupos.map((g) => [g.categoria, g.fuentes.length])).toEqual([['General', 1], ['Ciencia', 1], ['Viajes', 2]]);
  });
});

describe('servicio', () => {
  it('lista solo las del usuario', async () => {
    m.consultar.mockResolvedValue([]);
    await listarFuentesWeb(U);
    const [sql, valores] = m.consultar.mock.calls[0] ?? [];
    expect(String(sql)).toContain('WHERE usuario_id = $1');
    expect(valores?.[0]).toBe(U);
  });

  it('elimina solo si es del usuario; si no, no existe', async () => {
    m.consultar.mockResolvedValueOnce([{ id: F }]);
    await expect(eliminarFuenteWeb(U, F)).resolves.toBeUndefined();
    expect(String(m.consultar.mock.calls[0]?.[0])).toContain('id = $1 AND usuario_id = $2');
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([F, U]);
    m.consultar.mockResolvedValueOnce([]);
    await expect(eliminarFuenteWeb(U, F)).rejects.toMatchObject({ codigo: 'FUENTE_NO_ENCONTRADA', message: 'La fuente no existe.' });
  });
});

describe('rutas', () => {
  it('sin sesión 401, en las dos', async () => {
    m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaLista.GET()).status).toBe(401);
    expect((await borrar()).status).toBe(401);
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('eliminar: 200; ajena 404; id inválido no toca la base', async () => {
    m.consultar.mockResolvedValueOnce([{ id: F }]);
    expect((await borrar()).status).toBe(200);
    m.consultar.mockResolvedValueOnce([]);
    expect((await borrar()).status).toBe(404);
    m.consultar.mockClear();
    expect((await borrar('no-es-uuid')).status).toBeGreaterThanOrEqual(400);
    expect(m.consultar).not.toHaveBeenCalled();
  });
});
