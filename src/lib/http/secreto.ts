import { timingSafeEqual } from 'node:crypto';

/**
 * Para las rutas que llama una máquina sin sesión (el aviso de cada minuto y el cron diario). Compara sin revelar
 * por el tiempo cuántos caracteres coinciden. Sin el secreto configurado en el servidor, nadie entra.
 */
export function secretoValido(recibido: string | null, esperado: string | undefined): boolean {
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
