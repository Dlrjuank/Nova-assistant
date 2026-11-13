'use client';

import { LogOut } from 'lucide-react';
import { useCerrarSesion } from '@/components/nova/navegacion/useCerrarSesion';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';

/** E11 (5.8): cerrar sesión, con la misma ruta que la barra lateral y la hoja "Más". */
export function BloqueSesion() {
  const { cerrarSesion, error, saliendo } = useCerrarSesion();
  return (
    <Tarjeta className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-texto">Sesión</h2>
      <div>
        <Boton variante="secundario" cargando={saliendo} onClick={() => void cerrarSesion()}>
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </Boton>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-peligro">
          {error}
        </p>
      )}
    </Tarjeta>
  );
}
