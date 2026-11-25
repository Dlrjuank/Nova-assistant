import { SCRIPT_CARGA } from '@/lib/pantallaCarga';

/** La estrella de la pantalla de carga (lienzo de 120): puntas rectas, como en el diseño del usuario. */
const ESTRELLA_CARGA = 'M60 18 L67 53 L102 60 L67 67 L60 102 L53 67 L18 60 L53 53 Z';

/**
 * E20b: pantalla de carga al abrir Nova en frío (ver src/lib/pantallaCarga.ts). Siempre oscura, con la Estrella
 * nova que late y dos ondas. El script va antes que la pantalla para que, en frío, ya se vea en el primer cuadro.
 */
export function PantallaCarga() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_CARGA }} />
      <div className="nova-carga" role="status" aria-label="Cargando Nova" suppressHydrationWarning>
        <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle className="nova-carga-onda" cx="60" cy="60" r="58" />
          <circle className="nova-carga-onda nova-carga-onda-2" cx="60" cy="60" r="58" />
          <g className="nova-carga-latido">
            <circle cx="60" cy="60" r="58" fill="var(--nova-carga-anillo-1)" />
            <circle cx="60" cy="60" r="44" fill="var(--nova-carga-anillo-2)" />
            <circle cx="60" cy="60" r="31" fill="var(--nova-carga-anillo-3)" />
            <path className="nova-carga-brillo" d={ESTRELLA_CARGA} fill="var(--nova-carga-estrella)" />
            <circle cx="60" cy="60" r="7" fill="var(--nova-carga-centro)" />
          </g>
        </svg>
      </div>
    </>
  );
}
