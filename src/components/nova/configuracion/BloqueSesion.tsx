'use client';

import { KeyRound, LogOut } from 'lucide-react';
import { TituloBloque } from './TituloBloque';
import { FormularioContrasenaNueva } from '@/components/login/FormularioContrasenaNueva';
import { useCerrarSesion } from '@/components/nova/navegacion/useCerrarSesion';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';

/**
 * E11 (5.8): cerrar sesión, con la misma ruta que la barra lateral y la hoja "Más". E20c-3 (plan 5.14, salida a):
 * poner una contraseña nueva; si la sesión entró con Google no pide la anterior.
 */
export function BloqueSesion({ pideActual = true }: { pideActual?: boolean }) {
  const { cerrarSesion, error, saliendo } = useCerrarSesion();
  return (
    <Tarjeta className="flex flex-col gap-5">
      <TituloBloque icono={KeyRound}>Sesión</TituloBloque>
      <section className="flex flex-col gap-3" aria-labelledby="titulo-contrasena">
        <h3 id="titulo-contrasena" className="text-sm font-semibold text-texto">
          Poner una contraseña nueva
        </h3>
        {!pideActual && <p className="text-xs text-texto-suave">Entraste con Google: no hace falta la contraseña anterior.</p>}
        <FormularioContrasenaNueva pideActual={pideActual} alTerminar="quedarse" />
      </section>
      <div className="border-t border-borde pt-4">
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
