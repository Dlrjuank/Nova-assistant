'use client';

import { BarraInferior } from './navegacion/BarraInferior';
import { BarraLateral } from './navegacion/BarraLateral';
import { BotonAgregar } from './navegacion/BotonAgregar';

/**
 * Navegación de Nova (PLAN_AMPLIACION 4, E03): barra lateral en computador (≥ 1024 px); barra inferior,
 * hoja "Más" y botón "+" en teléfono y tableta. Cuál se ve lo decide el CSS (lg:), no JavaScript.
 */
export function NavegacionNova({ email }: { email: string }) {
  return (
    <>
      <BarraLateral email={email} />
      <BarraInferior email={email} />
      <BotonAgregar />
    </>
  );
}
