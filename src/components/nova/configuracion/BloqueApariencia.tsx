'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { FormatoHora, Tema } from '@/lib/reglas/preferencias';
import { aplicarTema } from '@/lib/tema';
import { guardarConfiguracion } from './guardar';

const TEMAS: ReadonlyArray<[Tema, string]> = [
  ['claro', 'Claro'],
  ['oscuro', 'Oscuro'],
  ['automatico', 'Automático (como el teléfono o el computador)'],
];

const FORMATOS: ReadonlyArray<[FormatoHora, string]> = [
  ['24', '24 horas (13:30)'],
  ['12', '12 horas (1:30 p. m.)'],
];

function Opciones<T extends string>({
  nombre,
  leyenda,
  opciones,
  valor,
  deshabilitado,
  alCambiar,
}: {
  nombre: string;
  leyenda: string;
  opciones: ReadonlyArray<[T, string]>;
  valor: T;
  deshabilitado: boolean;
  alCambiar: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-texto">{leyenda}</legend>
      {opciones.map(([v, texto]) => (
        <label key={v} className="flex min-h-10 items-center gap-3 text-sm text-texto">
          <input type="radio" name={nombre} value={v} checked={valor === v} disabled={deshabilitado} onChange={() => alCambiar(v)} className="size-4 accent-acento" />
          {texto}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * E11 (5.8, RB-27, B-03): el tema cambia toda la app al momento y se guarda en la base y en el navegador; el
 * formato de hora (24 o 12 horas) cambia cómo se ven los horarios de las tareas en toda la app.
 */
export function BloqueApariencia({ tema: temaInicial, formatoHora: formatoInicial }: { tema: Tema; formatoHora: FormatoHora }) {
  const router = useRouter();
  const [tema, setTema] = useState(temaInicial);
  const [formato, setFormato] = useState(formatoInicial);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cambiarTema(nuevo: Tema) {
    const anterior = tema;
    setTema(nuevo);
    aplicarTema(nuevo); // sin esperar al servidor
    setError('');
    setGuardando(true);
    const r = await guardarConfiguracion({ tema: nuevo });
    setGuardando(false);
    if (!r.ok) {
      setTema(anterior);
      aplicarTema(anterior);
      setError(r.mensaje);
      return;
    }
    router.refresh();
  }

  async function cambiarFormato(nuevo: FormatoHora) {
    const anterior = formato;
    setFormato(nuevo);
    setError('');
    setGuardando(true);
    const r = await guardarConfiguracion({ formatoHora: nuevo });
    setGuardando(false);
    if (!r.ok) {
      setFormato(anterior);
      setError(r.mensaje);
      return;
    }
    router.refresh(); // los horarios de toda la app usan el formato nuevo
  }

  return (
    <Tarjeta className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-texto">Apariencia</h2>
      <Opciones nombre="tema" leyenda="Tema" opciones={TEMAS} valor={tema} deshabilitado={guardando} alCambiar={(v) => void cambiarTema(v)} />
      <Opciones nombre="formato-hora" leyenda="Formato de hora" opciones={FORMATOS} valor={formato} deshabilitado={guardando} alCambiar={(v) => void cambiarFormato(v)} />
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Tarjeta>
  );
}
