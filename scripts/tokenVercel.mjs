import { execSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const archivoTemporal = '.env.vercel.local';
const aviso =
  'Aviso: no se pudo renovar la conexión con Vercel. El envío de correos no funcionará en local.';
let fallo = false;

try {
  execSync('npx vercel env pull .env.vercel.local --yes', { stdio: 'ignore' });

  const variablesVercel = readFileSync(archivoTemporal, 'utf8');
  const lineaToken = variablesVercel
    .split(/\r?\n/)
    .find((linea) => /^VERCEL_OIDC_TOKEN=.+$/.test(linea));

  if (!lineaToken) {
    throw new Error('No se encontró VERCEL_OIDC_TOKEN.');
  }

  const archivoLocal = '.env.local';
  const contenidoLocal = readFileSync(archivoLocal, 'utf8');
  const salto = contenidoLocal.includes('\r\n') ? '\r\n' : '\n';
  const nuevoContenido = /^VERCEL_OIDC_TOKEN=.*$/m.test(contenidoLocal)
    ? contenidoLocal.replace(/^VERCEL_OIDC_TOKEN=.*$/m, lineaToken)
    : `${contenidoLocal}${contenidoLocal.endsWith('\n') ? '' : salto}${lineaToken}`;

  writeFileSync(archivoLocal, nuevoContenido);
} catch {
  fallo = true;
} finally {
  try {
    rmSync(archivoTemporal, { force: true });
  } catch {
    fallo = true;
  }
}

if (fallo) {
  console.warn(aviso);
}
