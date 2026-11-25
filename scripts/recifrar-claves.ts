// E20c-1 (7.15, cambios del 2026-11-25): pasa todas las claves de Gemini guardadas a la llave actual.
// Para cambiar la llave: agregar NOVA_LLAVE_CLAVES_V{n+1} (32 bytes en base64) en Vercel (Production y Preview) y en
// .env.local, poner NOVA_LLAVE_CLAVES_ACTUAL={n+1}, desplegar y ejecutar este comando (con las dos llaves en .env.local).
// Cuando diga que ninguna clave usa la versión anterior, esa llave se puede borrar.
// Uso: npm run claves:recifrar -- --probar   → lo hace dentro de una transacción que se revierte (no cambia nada)
//      npm run claves:recifrar               → lo aplica
// Cada clave se descifra con su versión y se vuelve a cifrar con la actual, una fila a la vez y bloqueada. Una que
// no se puede descifrar queda `ilegible` (RB-90: su dueño la vuelve a vincular). Nunca imprime una clave.
import pg from 'pg';
import { cifrarClave, descifrarClave, LlaveNoDisponible, versionActual } from '@/lib/ia/cifrado';
import { cargarEnv, opcionesConexion } from './cargar-env.mjs';

cargarEnv();

async function main(): Promise<void> {
  const probar = process.argv.includes('--probar');
  const actual = versionActual();
  const sql = new pg.Client(opcionesConexion(process.env.NOVAASSISTANT_POSTGRES_URL_NON_POOLING as string));
  await sql.connect();
  let recifradas = 0;
  let ilegibles = 0;
  try {
    await sql.query('BEGIN');
    const { rows } = await sql.query(
      `SELECT usuario_id, cifrada, iv, etiqueta, version_llave FROM claves_gemini
       WHERE version_llave <> $1 AND estado <> 'ilegible' FOR UPDATE`,
      [actual],
    );
    for (const f of rows as Array<{ usuario_id: string; cifrada: Buffer; iv: Buffer; etiqueta: Buffer; version_llave: number }>) {
      let clave: string;
      try {
        clave = descifrarClave({ cifrada: f.cifrada, iv: f.iv, etiqueta: f.etiqueta, version: f.version_llave }, f.usuario_id);
      } catch (error) {
        // Sin la llave de esa versión no se toca nada: es un error de configuración, no de la clave.
        if (error instanceof LlaveNoDisponible) throw error;
        await sql.query("UPDATE claves_gemini SET estado = 'ilegible', actualizada_en = now() WHERE usuario_id = $1", [f.usuario_id]);
        ilegibles++;
        continue;
      }
      const c = cifrarClave(clave, f.usuario_id, actual);
      await sql.query('UPDATE claves_gemini SET cifrada = $2, iv = $3, etiqueta = $4, version_llave = $5, actualizada_en = now() WHERE usuario_id = $1', [
        f.usuario_id,
        c.cifrada,
        c.iv,
        c.etiqueta,
        c.version,
      ]);
      recifradas++;
    }
    const { rows: quedan } = await sql.query('SELECT version_llave, count(*)::int AS n FROM claves_gemini GROUP BY version_llave ORDER BY 1');
    await sql.query(probar ? 'ROLLBACK' : 'COMMIT');
    console.log(`Llave actual: versión ${actual}. Recifradas: ${recifradas}. Ilegibles: ${ilegibles}.`);
    console.log(`Claves por versión${probar ? ' (si se aplicara)' : ''}: ${quedan.map((q) => `v${q.version_llave}: ${q.n}`).join(', ') || 'ninguna guardada'}`);
    console.log(probar ? 'Simulacro: no se cambió nada.' : 'Listo.');
  } catch (error) {
    await sql.query('ROLLBACK').catch(() => {});
    console.error(`Error (no se cambió nada): ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
