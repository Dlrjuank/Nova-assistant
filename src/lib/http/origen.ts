// E21: la dirección pública de un pedido. Detrás de un proxy (Nova con `next start` y un túnel de Cloudflare),
// `peticion.url` trae el host del servidor (localhost) y no el que escribió la persona: las redirecciones armadas con
// él llevaban a localhost. Los encabezados del proxy solo valen si el host está permitido, para que un encabezado
// falso no pueda mandar a nadie a otro sitio.

/** Las direcciones de este proyecto en Vercel (`nova-assistant.vercel.app` NO es suya). */
const EN_VERCEL = /^(?:novaassistantjc|nova-assistantsm-kappa|nova-assistant-[a-z0-9-]+-dlrjuank)\.vercel\.app$/;
const EN_ESTE_PC = /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;
const TUNEL = /^[a-z0-9-]+\.trycloudflare\.com$/;

const primero = (peticion: Request, nombre: string) => peticion.headers.get(nombre)?.split(',')[0]?.trim().toLowerCase();

function hostDeAppUrl(): string | null {
  try {
    return new URL(process.env.APP_URL?.trim() ?? '').host || null;
  } catch {
    return null;
  }
}

/**
 * `x-forwarded-host` (o `host`) y `x-forwarded-proto`, si el host es el de `APP_URL` o una dirección de Nova en
 * Vercel; fuera de Vercel, además, este PC o un túnel rápido de Cloudflare. En cualquier otro caso, el origen del
 * pedido, como siempre.
 */
export function origenPublico(peticion: Request): string {
  const propio = new URL(peticion.url);
  const host = primero(peticion, 'x-forwarded-host') || primero(peticion, 'host');
  if (!host) return propio.origin;
  // Fuera de Vercel (VERCEL no está definida) es donde Nova corre en un PC.
  const local = !process.env.VERCEL && EN_ESTE_PC.test(host);
  const permitido = host === hostDeAppUrl() || EN_VERCEL.test(host) || local || (!process.env.VERCEL && TUNEL.test(host));
  if (!permitido) return propio.origin;
  // Fuera de este PC, siempre https.
  const proto = !local ? 'https' : primero(peticion, 'x-forwarded-proto') === 'https' ? 'https' : 'http';
  return new URL(`${proto}://${host}`).origin;
}
