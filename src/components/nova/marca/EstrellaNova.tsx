/**
 * E20b (commit 1): el logo de Nova, la "Estrella nova" (variante A, elegida por el usuario el 2026-11-21). Estrella
 * de cuatro puntas con lados curvos, centro casi blanco y tres anillos de brillo. Dentro de la app va sin el fondo
 * cuadrado ni los destellos del ícono; los colores salen de los tokens (claro y oscuro).
 */

/** La estrella del ícono (lienzo de 1024): puntas a 300 del centro y lados curvos. */
export const TRAZO_ESTRELLA = 'M512 212Q572 452 812 512Q572 572 512 812Q452 572 212 512Q452 452 512 212Z';

export function EstrellaNova({ className = 'size-10', halo = false }: { className?: string; halo?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 rounded-full ${halo ? 'nova-halo' : ''} ${className}`}>
      <svg viewBox="112 112 800 800" className="size-full" focusable="false">
        <circle cx="512" cy="512" r="400" className="fill-anillo-1" />
        <circle cx="512" cy="512" r="300" className="fill-anillo-2" />
        <circle cx="512" cy="512" r="205" className="fill-anillo-3" />
        <path d={TRAZO_ESTRELLA} className="fill-estrella" />
        <circle cx="512" cy="512" r="36" className="fill-estrella-centro" />
      </svg>
    </span>
  );
}

/** La estrella con "nova" al lado, en Bricolage Grotesque 800 (como en la pantalla de arranque). */
export function LogoNova({ tamano = 'md', halo = true, soloEstrella = false }: { tamano?: 'md' | 'lg'; halo?: boolean; soloEstrella?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <EstrellaNova halo={halo} className={tamano === 'lg' ? 'size-12' : 'size-9'} />
      <span className={`font-display font-extrabold tracking-tight text-texto ${tamano === 'lg' ? 'text-3xl' : 'text-2xl'} ${soloEstrella ? 'nova-plegable' : ''}`}>nova</span>
    </span>
  );
}
