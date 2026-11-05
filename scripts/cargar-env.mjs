// Carga .env.local en process.env sin imprimir valores (los scripts corren fuera de Next.js).
import { existsSync, readFileSync } from 'node:fs';

export function cargarEnv(archivo = '.env.local') {
  if (!existsSync(archivo)) return;
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// Opciones de conexión con verificación completa del certificado, usando la CA raíz de Supabase.
export function opcionesConexion(url) {
  return {
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, ''),
    ssl: { ca: readFileSync('supabase/prod-ca-2021.crt', 'utf8') },
  };
}
