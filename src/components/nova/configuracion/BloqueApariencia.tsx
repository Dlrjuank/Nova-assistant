'use client';

import { Clock3, Clock9, MonitorSmartphone, Moon, Palette, Sun, type LucideIcon } from 'lucide-react';
import { TituloBloque } from './TituloBloque';
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

// E20b (commit 9): cada opción como una tarjeta con su ícono.
const ICONOS: Record<string, LucideIcon> = { claro: Sun, oscuro: Moon, automatico: MonitorSmartphone, '24': Clock9, '12': Clock3 };

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
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-texto">{leyenda}</legend>
      <div className={`grid gap-2 ${opciones.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {opciones.map(([v, texto]) => {
          const Icono = ICONOS[v];
          return (
            <label
              key={v}
              data-opcion={v}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-borde bg-superficie px-3 py-2.5 text-sm text-texto transition-colors duration-150 hover:border-acento has-[:checked]:border-acento has-[:checked]:bg-acento-suave has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento sm:flex-col sm:items-start sm:gap-2"
            >
              <input type="radio" name={nombre} value={v} checked={valor === v} disabled={deshabilitado} onChange={() => alCambiar(v)} className="sr-only" />
              {Icono && <Icono aria-hidden="true" className={`size-5 shrink-0 ${valor === v ? 'text-acento' : 'text-texto-suave'}`} />}
              {texto}
            </label>
          );
        })}
      </div>
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
      <TituloBloque icono={Palette}>Apariencia</TituloBloque>
      <Opciones nombre="tema" leyenda="Tema" opciones={TEMAS} valor={tema} deshabilitado={guardando} alCambiar={(v) => void cambiarTema(v)} />
      <Opciones nombre="formato-hora" leyenda="Formato de hora" opciones={FORMATOS} valor={formato} deshabilitado={guardando} alCambiar={(v) => void cambiarFormato(v)} />
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Tarjeta>
  );
}
