'use client';

import { ProveedorAvisos } from './navegacion/AvisosNavegacion';
import { BarraInferior } from './navegacion/BarraInferior';
import { BarraLateral } from './navegacion/BarraLateral';
import { BotonAgregar } from './navegacion/BotonAgregar';

/**
 * Navegación de Nova (PLAN_AMPLIACION 4, E03): barra lateral en computador (≥ 1024 px); barra inferior,
 * hoja "Más" y botón "+" en teléfono y tableta. Cuál se ve lo decide el CSS (lg:), no JavaScript. E20b: con los
 * avisos (perfil, vencidas y próximo corte) que piden las dos barras.
 */
export function NavegacionNova({ email }: { email: string }) {
  return (
    <ProveedorAvisos>
      <BarraLateral email={email} />
      <BarraInferior email={email} />
      <BotonAgregar />
    </ProveedorAvisos>
  );
}
