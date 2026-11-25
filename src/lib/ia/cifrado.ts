import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * E20c-1 (PLAN_AMPLIACION 7.15, cambios del 2026-11-25): la clave de Gemini de cada persona se guarda con
 * AES-256-GCM. Las llaves tienen versión: `NOVA_LLAVE_CLAVES_V{n}` (32 bytes en base64) y `NOVA_LLAVE_CLAVES_ACTUAL`
 * dice con cuál se cifra. Cada clave guarda la versión con la que se cifró, así una llave nueva no deja ilegibles
 * las anteriores (`npm run claves:recifrar` las pasa a la actual). Los datos asociados atan la clave a su dueño: una
 * fila copiada a otro usuario no se puede descifrar.
 * Solo lo importa src/lib/datos/claveGemini.ts, del servidor (sin `server-only`, que Next resuelve por dentro y
 * rompería los scripts de `npm run`; `node:crypto` tampoco compila para el navegador).
 */
export interface ClaveCifrada {
  cifrada: Buffer;
  iv: Buffer;
  etiqueta: Buffer;
  version: number;
}

export class LlaveNoDisponible extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'LlaveNoDisponible';
  }
}

const datosAsociados = (version: number, usuarioId: string) => Buffer.from(`nova-gemini:v${version}:${usuarioId}`, 'utf8');

/** La llave de una versión, o un error si falta o no mide 32 bytes (nunca dice su valor). */
export function llaveDeVersion(version: number): Buffer {
  const texto = process.env[`NOVA_LLAVE_CLAVES_V${version}`]?.trim();
  if (!texto) throw new LlaveNoDisponible(`Falta la llave de cifrado de la versión ${version}.`);
  const llave = Buffer.from(texto, 'base64');
  if (llave.length !== 32) throw new LlaveNoDisponible(`La llave de cifrado de la versión ${version} no mide 32 bytes.`);
  return llave;
}

/** La versión con la que se cifra ahora. */
export function versionActual(): number {
  const version = Number(process.env.NOVA_LLAVE_CLAVES_ACTUAL?.trim());
  if (!Number.isInteger(version) || version < 1 || version > 999) throw new LlaveNoDisponible('NOVA_LLAVE_CLAVES_ACTUAL no es una versión válida.');
  return version;
}

export function cifrarClave(clave: string, usuarioId: string, version = versionActual()): ClaveCifrada {
  const llave = llaveDeVersion(version);
  const iv = randomBytes(12);
  const cifrador = createCipheriv('aes-256-gcm', llave, iv);
  cifrador.setAAD(datosAsociados(version, usuarioId));
  const cifrada = Buffer.concat([cifrador.update(clave, 'utf8'), cifrador.final()]);
  return { cifrada, iv, etiqueta: cifrador.getAuthTag(), version };
}

/** Lanza si la llave de esa versión falta o si los datos no corresponden (otro usuario, otra llave, alterados). */
export function descifrarClave(c: ClaveCifrada, usuarioId: string): string {
  const descifrador = createDecipheriv('aes-256-gcm', llaveDeVersion(c.version), c.iv);
  descifrador.setAAD(datosAsociados(c.version, usuarioId));
  descifrador.setAuthTag(c.etiqueta);
  return Buffer.concat([descifrador.update(c.cifrada), descifrador.final()]).toString('utf8');
}
