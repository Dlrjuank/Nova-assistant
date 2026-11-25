// @vitest-environment node
// E20c-1 (S-82, S-83, S-84; RB-76 a RB-80, RB-90): guardar, verificar y usar la clave de Gemini de cada persona.
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock('@/lib/db/conexion', () => ({ consultar: m.consultar }));

import { cifrarClave } from '@/lib/ia/cifrado';
import {
  desvincularClaveGemini,
  estadoIa,
  guardarClaveGemini,
  infoClaveGemini,
  olvidarClaveEnMemoria,
  registrarUsoIa,
  resolverClave,
} from '@/lib/datos/claveGemini';
import { TEXTO_CLAVE_NO_ACEPTADA, TEXTO_CLAVE_SIN_CUOTA } from '@/lib/reglas/claveGemini';
import { CORREO_DUENO } from '@/modules/auth/admin';

const U = '11111111-1111-4111-8111-111111111111';
const CLAVE = `AIza${'k'.repeat(31)}1234`;
const fetchFalso = vi.fn();

/** La base simulada: la fila de la clave (o ninguna) y el correo de la cuenta. */
function base({ fila, correo = 'otra@ejemplo.com' }: { fila?: Record<string, unknown> | undefined; correo?: string } = {}) {
  m.consultar.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM auth.users')) return [{ email: correo }];
    if (sql.includes('FROM claves_gemini')) return fila ? [fila] : [];
    if (sql.includes('INSERT INTO claves_gemini')) return [{ verificada_en: '2026-11-25' }];
    return [];
  });
}
const filaDe = (estado: string, clave = CLAVE) => {
  const c = cifrarClave(clave, U);
  return { cifrada: c.cifrada, iv: c.iv, etiqueta: c.etiqueta, version_llave: c.version, ultimos4: clave.slice(-4), estado, verificada_en: '2026-11-25' };
};

beforeEach(() => {
  m.consultar.mockReset();
  fetchFalso.mockReset();
  vi.stubGlobal('fetch', fetchFalso);
  vi.stubEnv('NOVA_LLAVE_CLAVES_V1', randomBytes(32).toString('base64'));
  vi.stubEnv('NOVA_LLAVE_CLAVES_ACTUAL', '1');
  vi.stubEnv('GEMINI_API_KEY', 'clave-del-proyecto-0123456789-abcdef');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  olvidarClaveEnMemoria(U);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('S-82 · RB-76, RB-79: quién usa qué clave', () => {
  it('con clave propia usa la suya, aunque sea el dueño', async () => {
    base({ fila: filaDe('activa'), correo: CORREO_DUENO });
    await expect(resolverClave(U)).resolves.toMatchObject({ apiKey: CLAVE, origen: 'propia' });
  });

  it('el dueño sin clave propia usa la del proyecto, como hoy', async () => {
    base({ correo: CORREO_DUENO });
    await expect(resolverClave(U)).resolves.toMatchObject({ apiKey: 'clave-del-proyecto-0123456789-abcdef', origen: 'proyecto' });
  });

  it('cualquier otra cuenta sin clave: SIN_CLAVE_GEMINI, sin usar la del proyecto (un administrador tampoco, por serlo)', async () => {
    base({ correo: 'admin-de-emergencia@ejemplo.com' });
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'admin-de-emergencia@ejemplo.com');
    await expect(resolverClave(U)).rejects.toMatchObject({ codigo: 'SIN_CLAVE_GEMINI' });
  });

  it('con la clave rechazada nunca usa la del proyecto, aunque sea el dueño (RB-78)', async () => {
    base({ fila: filaDe('rechazada'), correo: CORREO_DUENO });
    await expect(resolverClave(U)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_RECHAZADA' });
  });

  it('RB-90: una clave que no se puede descifrar queda ilegible y se pide vincularla otra vez', async () => {
    const fila = filaDe('activa');
    vi.stubEnv('NOVA_LLAVE_CLAVES_V1', randomBytes(32).toString('base64')); // otra llave con la misma versión
    base({ fila, correo: CORREO_DUENO });
    await expect(resolverClave(U)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_ILEGIBLE' });
    expect(m.consultar.mock.calls.some(([sql, v]) => String(sql).includes('UPDATE claves_gemini SET estado') && (v as unknown[])[1] === 'ilegible')).toBe(true);
  });

  it('si falta configurar la llave (error de Nova), dice lo mismo pero no marca la clave: vuelve a servir al configurarla', async () => {
    const fila = filaDe('activa');
    vi.stubEnv('NOVA_LLAVE_CLAVES_V1', '');
    base({ fila });
    await expect(resolverClave(U)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_ILEGIBLE' });
    expect(m.consultar.mock.calls.some(([sql]) => String(sql).includes('UPDATE claves_gemini'))).toBe(false);
  });

  it('el estado de la IA para las pantallas, sin descifrar nada', async () => {
    base({ fila: filaDe('activa') });
    await expect(estadoIa(U)).resolves.toBe('propia');
    base({ fila: filaDe('sin_cuota') });
    await expect(estadoIa(U)).resolves.toBe('sin_cuota');
    base({ correo: CORREO_DUENO });
    await expect(estadoIa(U)).resolves.toBe('proyecto');
    base({});
    await expect(estadoIa(U)).resolves.toBe('sin_clave');
  });
});

describe('S-83 · RB-77: verificar y guardar', () => {
  const respuesta = (status: number) => new Response('{}', { status });

  it('vacía o con espacios: no llama a Google ni guarda', async () => {
    base({});
    for (const mala of ['', '   ', 'AIza con espacios por dentro 0123456789', 'corta']) {
      await expect(guardarClaveGemini(U, mala)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_INVALIDA' });
    }
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(m.consultar).not.toHaveBeenCalled();
  });

  it('válida: la verifica con una llamada que no gasta cuota, con la clave en el encabezado, y guarda solo el texto cifrado', async () => {
    base({});
    fetchFalso.mockResolvedValue(respuesta(200));
    const r = await guardarClaveGemini(U, `  ${CLAVE}  `);
    expect(r).toEqual({ vinculada: true, ultimos4: '1234', estado: 'activa', verificadaEn: '2026-11-25', mensaje: 'Clave verificada y guardada.' });
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1beta\/models\/[^?]+$/); // models.get, sin la clave en la dirección
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(CLAVE);
    const insert = m.consultar.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO claves_gemini'));
    const valores = insert?.[1] as unknown[];
    expect(valores.some((v) => typeof v === 'string' && v.includes('AIza'))).toBe(false);
    expect(valores.filter((v) => Buffer.isBuffer(v)).some((b) => (b as Buffer).toString('utf8').includes('AIza'))).toBe(false);
    expect(valores[6]).toBe('activa');
    expect(JSON.stringify(r)).not.toContain(CLAVE);
  });

  it('Google la rechaza (400, 401 o 403): no se guarda nada', async () => {
    for (const status of [400, 401, 403]) {
      base({});
      fetchFalso.mockResolvedValue(respuesta(status));
      await expect(guardarClaveGemini(U, CLAVE)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_INVALIDA', message: TEXTO_CLAVE_NO_ACEPTADA });
      expect(m.consultar.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
    }
  });

  it('sin cuota (429): la guarda como sin_cuota y lo avisa', async () => {
    base({});
    fetchFalso.mockResolvedValue(respuesta(429));
    await expect(guardarClaveGemini(U, CLAVE)).resolves.toMatchObject({ estado: 'sin_cuota', mensaje: TEXTO_CLAVE_SIN_CUOTA });
  });

  it('sin respuesta de Google (red o 5xx): no se guarda y se pide intentar de nuevo, sin la clave en el registro', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const falla of [() => Promise.reject(new TypeError(`fetch failed key=${CLAVE}`)), () => Promise.resolve(respuesta(503))]) {
      base({});
      fetchFalso.mockImplementation(falla);
      await expect(guardarClaveGemini(U, CLAVE)).rejects.toMatchObject({ codigo: 'CLAVE_GEMINI_NO_VERIFICADA' });
    }
    expect(m.consultar.mock.calls.some(([sql]) => String(sql).includes('INSERT'))).toBe(false);
    expect(JSON.stringify(error.mock.calls)).not.toContain(CLAVE);
  });

  it('la pantalla solo recibe los últimos 4; desvincular la borra', async () => {
    m.consultar.mockResolvedValue([{ ultimos4: '1234', estado: 'activa', verificada_en: '2026-11-25' }]);
    const info = await infoClaveGemini(U);
    expect(info).toEqual({ vinculada: true, ultimos4: '1234', estado: 'activa', verificadaEn: '2026-11-25' });
    expect(String(m.consultar.mock.calls[0]?.[0])).not.toMatch(/cifrada|iv|etiqueta/);
    await desvincularClaveGemini(U);
    expect(m.consultar).toHaveBeenLastCalledWith('DELETE FROM claves_gemini WHERE usuario_id = $1', [U]);
  });
});

describe('uso_ia_diario: solo conteos', () => {
  it('suma las llamadas del día de Bogotá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T03:30:00Z')); // aún 25 en Bogotá
    m.consultar.mockResolvedValue([]);
    await registrarUsoIa(U, 3);
    expect(m.consultar.mock.calls[0]?.[1]).toEqual([U, '2026-11-25', 3]);
    expect(String(m.consultar.mock.calls[0]?.[0])).toContain('consultas = uso_ia_diario.consultas + EXCLUDED.consultas');
    vi.useRealTimers();
  });
});
