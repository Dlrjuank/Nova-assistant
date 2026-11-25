// @vitest-environment node
// E20c-1 (S-81, 7.15 con los cambios del 2026-11-25): cifrado de la clave de Gemini con llaves con versión.
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cifrarClave, descifrarClave, LlaveNoDisponible, versionActual } from '@/lib/ia/cifrado';
import { errorSinClave, ocultarClave } from '@/lib/ia/ocultarClave';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const CLAVE = `AIza${'x'.repeat(35)}`;

beforeEach(() => {
  vi.stubEnv('NOVA_LLAVE_CLAVES_V1', randomBytes(32).toString('base64'));
  vi.stubEnv('NOVA_LLAVE_CLAVES_ACTUAL', '1');
});
afterEach(() => vi.unstubAllEnvs());

describe('S-81: cifrado de la clave de Gemini', () => {
  it('cifrar y descifrar dan la misma clave; el texto cifrado no la contiene; otro IV cada vez', () => {
    const a = cifrarClave(CLAVE, U1);
    const b = cifrarClave(CLAVE, U1);
    expect(descifrarClave(a, U1)).toBe(CLAVE);
    expect(a.cifrada.toString('utf8')).not.toContain('AIza');
    expect(a.iv).toHaveLength(12);
    expect(a.etiqueta).toHaveLength(16);
    expect(a.version).toBe(1);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.cifrada.equals(b.cifrada)).toBe(false);
  });

  it('con otro usuario (una fila copiada) o la etiqueta cambiada, descifrar falla', () => {
    const c = cifrarClave(CLAVE, U1);
    expect(() => descifrarClave(c, U2)).toThrow();
    const alterada = { ...c, etiqueta: Buffer.from(c.etiqueta.map((x) => x ^ 1)) };
    expect(() => descifrarClave(alterada, U1)).toThrow();
  });

  it('sin la llave de su versión, o con una llave que no mide 32 bytes, no cifra ni descifra (sin decir la llave)', () => {
    const c = cifrarClave(CLAVE, U1);
    vi.stubEnv('NOVA_LLAVE_CLAVES_V1', '');
    expect(() => descifrarClave(c, U1)).toThrow(LlaveNoDisponible);
    vi.stubEnv('NOVA_LLAVE_CLAVES_V1', randomBytes(16).toString('base64'));
    expect(() => cifrarClave(CLAVE, U1)).toThrow(/no mide 32 bytes/);
    vi.stubEnv('NOVA_LLAVE_CLAVES_ACTUAL', 'dos');
    expect(() => versionActual()).toThrow(LlaveNoDisponible);
  });

  it('cambiar la llave: con la V2 como actual, lo cifrado con la V1 se sigue leyendo con su versión', () => {
    const vieja = cifrarClave(CLAVE, U1);
    vi.stubEnv('NOVA_LLAVE_CLAVES_V2', randomBytes(32).toString('base64'));
    vi.stubEnv('NOVA_LLAVE_CLAVES_ACTUAL', '2');
    const nueva = cifrarClave(descifrarClave(vieja, U1), U1);
    expect(nueva.version).toBe(2);
    expect(descifrarClave(vieja, U1)).toBe(CLAVE);
    expect(descifrarClave(nueva, U1)).toBe(CLAVE);
    // La versión va en los datos asociados: no se puede hacer pasar una por otra.
    expect(() => descifrarClave({ ...vieja, version: 2 }, U1)).toThrow();
  });
});

describe('S-84: ninguna clave en los registros', () => {
  it('ocultarClave borra las claves con forma de Google, el parámetro key= y el encabezado', () => {
    const texto = `fallo en https://generativelanguage.googleapis.com/v1beta/models/x?key=${CLAVE}&alt=json con ${CLAVE} y {"x-goog-api-key":"otra-clave-secreta-123"}`;
    const limpio = ocultarClave(texto);
    expect(limpio).not.toContain(CLAVE);
    expect(limpio).not.toContain('otra-clave-secreta-123');
    expect(limpio).toContain('key=[clave oculta]');
  });

  it('también la clave exacta en uso aunque no tenga la forma de Google, y los errores con estado', () => {
    const rara = 'clave-sin-forma-conocida-0123456789';
    expect(ocultarClave(`no sirve ${rara}`, rara)).toBe('no sirve [clave oculta]');
    const error = Object.assign(new Error(`API key not valid: ${CLAVE}`), { status: 400 });
    expect(errorSinClave(error)).toBe('Error 400: API key not valid: [clave oculta]');
  });
});
