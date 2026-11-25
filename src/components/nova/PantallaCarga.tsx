import { SCRIPT_CARGA } from '@/lib/pantallaCarga';

/** La estrella de la pantalla de carga (lienzo de 120): puntas rectas, como en el diseño del usuario. */
const ESTRELLA_CARGA = 'M60 18 L67 53 L102 60 L67 67 L60 102 L53 67 L18 60 L53 53 Z';

/**
 * E20b: pantalla de carga al abrir Nova en frío (ver src/lib/pantallaCarga.ts). Siempre oscura: un cometa dibuja el
 * anillo, la estrella se enciende con "Nova" y su frase, y al estar lista la app se abre como un portal.
 * El script va antes que la pantalla para que, en frío, ya se vea en el primer cuadro. El anillo empieza arriba
 * (rotate(-90)) y el cometa gira en el mismo sentido, con la misma curva.
 */
export function PantallaCarga() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_CARGA }} />
      <div className="nova-carga" role="status" aria-label="Cargando Nova" suppressHydrationWarning>
        <div className="nova-carga-centro">
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <g className="nova-carga-respira">
              <circle className="nova-carga-destello" cx="60" cy="60" r="44" />
              <g className="nova-carga-estrella">
                <circle cx="60" cy="60" r="58" fill="var(--nova-carga-anillo-1)" />
                <circle cx="60" cy="60" r="44" fill="var(--nova-carga-anillo-2)" />
                <circle cx="60" cy="60" r="31" fill="var(--nova-carga-anillo-3)" />
                <path d={ESTRELLA_CARGA} fill="var(--nova-carga-estrella)" />
                <circle cx="60" cy="60" r="7" fill="var(--nova-carga-centro)" />
              </g>
              <circle className="nova-carga-trazo" cx="60" cy="60" r="58" pathLength="100" transform="rotate(-90 60 60)" />
              <circle className="nova-carga-cola" cx="60" cy="60" r="58" pathLength="100" transform="rotate(-90 60 60)" />
            </g>
            <g className="nova-carga-cometa">
              <circle className="nova-carga-halo-cabeza" cx="60" cy="2" r="6.5" />
              <circle className="nova-carga-cabeza" cx="60" cy="2" r="3" />
            </g>
          </svg>
          <div className="nova-carga-texto">
            <p className="nova-carga-nombre">Nova</p>
            <p className="nova-carga-frase">Tu noche de estudio, en orden.</p>
          </div>
        </div>
      </div>
      {/* El aro de luz que acompaña el borde del portal (lo mueve el script). */}
      <div className="nova-carga-aro" aria-hidden="true" />
    </>
  );
}
