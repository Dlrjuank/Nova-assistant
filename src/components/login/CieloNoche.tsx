import type { CSSProperties, Ref } from 'react';

export interface EstrellaCielo {
  x: number;
  y: number;
  tamano: number;
  duracion: number;
  retraso: number;
  brilloMin: number;
}

/** Generador con semilla (mulberry32): las mismas estrellas en el servidor y en el navegador, sin desajustes al hidratar. */
function aleatorio(semilla: number) {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cuántas estrellas tiene el cielo: pocas, para no gastar en teléfonos lentos. */
export const CANTIDAD_ESTRELLAS = 64;

/** E20b (commit 10): las estrellas del fondo, cada una con su ritmo de titilar. */
export function estrellasDelCielo(cantidad = CANTIDAD_ESTRELLAS, semilla = 20261125): EstrellaCielo[] {
  const r = aleatorio(semilla);
  return Array.from({ length: cantidad }, () => ({
    x: Math.round(r() * 1000) / 10,
    y: Math.round(r() * 1000) / 10,
    tamano: Math.round((1 + r() * 1.8) * 10) / 10,
    duracion: Math.round((2 + r() * 4) * 10) / 10,
    retraso: Math.round(r() * 50) / 10,
    brilloMin: Math.round((0.15 + r() * 0.35) * 100) / 100,
  }));
}

const ESTRELLAS = estrellasDelCielo();

/**
 * El fondo de la entrada: degradado de noche y estrellas que titilan. La capa de afuera se mueve un poco al lado
 * contrario del mouse (la mueve EntradaNova); la de adentro se desplaza muy despacio sola. Decorativo.
 */
export function CieloNoche({ capaRef }: { capaRef?: Ref<HTMLDivElement> }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-linear-to-b from-cielo-arriba to-cielo-abajo">
      <div ref={capaRef} className="absolute -inset-12 will-change-transform" data-capa-cielo>
        <div className="nova-cielo-deriva absolute inset-0">
          {ESTRELLAS.map((e, i) => (
            <span
              key={i}
              data-estrella-cielo
              className="nova-titilar absolute rounded-full bg-cielo-estrella"
              style={
                {
                  left: `${e.x}%`,
                  top: `${e.y}%`,
                  width: `${e.tamano}px`,
                  height: `${e.tamano}px`,
                  '--nova-dur': `${e.duracion}s`,
                  '--nova-ret': `-${e.retraso}s`,
                  '--nova-brillo-min': e.brilloMin,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
