'use client';

import { UserRound } from 'lucide-react';
import { TituloBloque } from './TituloBloque';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { useListo } from '@/components/ui/useListo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { MENSAJES } from '@/lib/reglas/errores';
import { MAX_NOMBRE } from '@/lib/reglas/preferencias';
import { guardarConfiguracion } from './guardar';

/** E11 (5.8, RB-26): nombre editable y correo de solo lectura. */
function Nombre({ nombreInicial, email }: { nombreInicial: string; email: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [guardado, setGuardado] = useState(nombreInicial);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [listo, marcarListo] = useListo();

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setHecho(false);
    if (!nombre.trim()) {
      setError(MENSAJES.NOMBRE_PERFIL_INVALIDO);
      return;
    }
    setError('');
    setCargando(true);
    const r = await guardarConfiguracion({ nombre });
    setCargando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setNombre(r.datos.perfil.nombre);
    setGuardado(r.datos.perfil.nombre);
    setHecho(true);
    marcarListo();
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void guardar(e)}>
      {/* E20b (commit 9): la inicial del nombre, como en la barra lateral. */}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" data-inicial-perfil className="grid size-12 shrink-0 place-items-center rounded-full bg-acento font-display text-lg font-extrabold text-acento-texto">
          {(guardado.trim() || email).charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-texto">{guardado.trim() || 'Sin nombre'}</p>
          <p className="truncate text-sm text-texto-suave">{email}</p>
        </div>
      </div>
      <Campo
        id="perfil-nombre"
        etiqueta="Nombre"
        value={nombre}
        maxLength={MAX_NOMBRE}
        autoComplete="name"
        onChange={(e) => {
          setNombre(e.target.value);
          setError('');
          setHecho(false);
        }}
        error={error}
      />
      <Campo id="perfil-correo" etiqueta="Correo" value={email} readOnly ayuda="El correo no se puede cambiar." className="text-texto-suave" />
      {hecho && <Aviso tipo="exito">Se guardó tu nombre.</Aviso>}
      <div>
        <Boton type="submit" cargando={cargando} listo={listo} textoListo="Guardado" disabled={cargando || nombre.trim() === guardado}>
          Guardar nombre
        </Boton>
      </div>
    </form>
  );
}

/** RB-28: usa la ruta existente /api/auth/password y muestra sus mensajes tal cual. */
function CambiarContrasena() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function cambiar(e: FormEvent) {
    e.preventDefault();
    setMensaje('');
    setError('');
    if (nueva !== confirmacion) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setCargando(true);
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: actual, newPassword: nueva }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(d.error ?? 'No se pudo cambiar la contraseña.');
        return;
      }
      setActual('');
      setNueva('');
      setConfirmacion('');
      setMensaje('Tu contraseña se actualizó correctamente.');
    } catch {
      setError('No se pudo conectar con el servidor para cambiar la contraseña.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="flex flex-col gap-4 border-t border-borde pt-5" onSubmit={(e) => void cambiar(e)}>
      <h3 className="text-sm font-semibold text-texto">Cambiar contraseña</h3>
      <Campo id="clave-actual" etiqueta="Contraseña actual" type="password" autoComplete="current-password" maxLength={128} value={actual} onChange={(e) => setActual(e.target.value)} required />
      <Campo
        id="clave-nueva"
        etiqueta="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        ayuda="Entre 8 y 128 caracteres."
        required
      />
      <Campo
        id="clave-confirmacion"
        etiqueta="Repite la contraseña nueva"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        required
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      <div>
        <Boton type="submit" variante="secundario" cargando={cargando} disabled={cargando || !actual || !nueva || !confirmacion}>
          Cambiar contraseña
        </Boton>
      </div>
    </form>
  );
}

export function BloquePerfil({ nombre, email }: { nombre: string; email: string }) {
  return (
    <Tarjeta className="flex flex-col gap-5">
      <TituloBloque icono={UserRound}>Perfil</TituloBloque>
      <Nombre nombreInicial={nombre} email={email} />
      <CambiarContrasena />
    </Tarjeta>
  );
}
