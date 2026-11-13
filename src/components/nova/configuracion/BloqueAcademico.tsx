'use client';

import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { MENSAJES } from '@/lib/reglas/errores';
import {
  aCentesimas,
  formatearNota,
  formatearPorcentaje,
  MAX_CORTES,
  mensajeCortesNoSuman,
  type Redondeo,
} from '@/lib/reglas/preferencias';
import { guardarConfiguracion } from './guardar';

const REDONDEOS: ReadonlyArray<[Redondeo, string]> = [
  ['truncar', 'Truncar (3,47 → 3,4)'],
  ['redondear', 'Redondear (3,47 → 3,5)'],
];

/**
 * E11 (5.8, RB-11): escala fija de 0,0 a 5,0; nota para aprobar; redondeo; y la plantilla de cortes que se
 * propondrá al dividir una materia en cortes (aquí sí deben sumar 100 % para guardar). Lo usa Semestre (E12).
 */
export function BloqueAcademico({ notaAprobar, redondeo: redondeoInicial, cortesDefecto }: { notaAprobar: number; redondeo: Redondeo; cortesDefecto: number[] }) {
  const [nota, setNota] = useState(formatearNota(notaAprobar));
  const [redondeo, setRedondeo] = useState(redondeoInicial);
  const [cortes, setCortes] = useState(cortesDefecto.map(formatearPorcentaje));
  const [errores, setErrores] = useState<{ nota?: string; cortes?: string; general?: string }>({});
  const [hecho, setHecho] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cambiar = () => {
    setErrores({});
    setHecho(false);
  };

  const centesimas = cortes.map(aCentesimas);
  const validos = centesimas.every((c) => c !== null && c > 0 && c <= 10000);
  const suma = validos ? (centesimas as number[]).reduce((a, b) => a + b, 0) : null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const notaCent = aCentesimas(nota);
    const nuevos: typeof errores = {};
    if (notaCent === null || notaCent > 500) nuevos.nota = MENSAJES.NOTA_APROBAR_INVALIDA;
    if (!validos) nuevos.cortes = MENSAJES.PORCENTAJE_INVALIDO;
    else if (suma !== 10000) nuevos.cortes = mensajeCortesNoSuman(suma as number);
    setErrores(nuevos);
    if (nuevos.nota || nuevos.cortes) return;
    setCargando(true);
    const r = await guardarConfiguracion({ notaAprobar: nota, redondeo, cortesDefecto: cortes });
    setCargando(false);
    if (!r.ok) {
      setErrores({ general: r.mensaje });
      return;
    }
    const p = r.datos.preferencias;
    setNota(formatearNota(p.notaAprobar));
    setCortes(p.cortesDefecto.map(formatearPorcentaje));
    setHecho(true);
  }

  return (
    <Tarjeta>
      <form className="flex flex-col gap-5" onSubmit={(e) => void guardar(e)} noValidate>
        <h2 className="text-base font-semibold text-texto">Académico</h2>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-texto">Escala de notas</span>
          <span className="text-sm text-texto-suave">De 0,0 a 5,0</span>
        </div>
        <Campo
          id="nota-aprobar"
          etiqueta="Nota para aprobar"
          value={nota}
          inputMode="decimal"
          maxLength={4}
          autoComplete="off"
          onChange={(e) => {
            setNota(e.target.value);
            cambiar();
          }}
          error={errores.nota}
          ayuda="La nota mínima para aprobar una materia. Por ejemplo, 3,0."
          className="max-w-32"
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-texto">Redondeo de las notas</legend>
          {REDONDEOS.map(([v, texto]) => (
            <label key={v} className="flex min-h-10 items-center gap-3 text-sm text-texto">
              <input
                type="radio"
                name="redondeo"
                value={v}
                checked={redondeo === v}
                onChange={() => {
                  setRedondeo(v);
                  cambiar();
                }}
                className="size-4 accent-acento"
              />
              {texto}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-2" aria-describedby="cortes-ayuda">
          <legend className="mb-1 text-sm font-medium text-texto">Cortes por defecto</legend>
          <p id="cortes-ayuda" className="text-xs text-texto-suave">
            Se proponen al dividir una materia en cortes. Deben sumar 100 %.
          </p>
          <ol className="flex flex-col gap-2">
            {cortes.map((valor, i) => (
              <li key={i} className="flex items-center gap-2">
                <label htmlFor={`corte-${i}`} className="w-16 shrink-0 text-sm text-texto">
                  Corte {i + 1}
                </label>
                <input
                  id={`corte-${i}`}
                  value={valor}
                  inputMode="decimal"
                  maxLength={6}
                  autoComplete="off"
                  aria-invalid={errores.cortes ? true : undefined}
                  onChange={(e) => {
                    setCortes((previos) => previos.map((c, j) => (j === i ? e.target.value : c)));
                    cambiar();
                  }}
                  className="min-h-10 w-24 rounded-xl border border-borde bg-superficie px-3 py-2 text-sm text-texto focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-acento"
                />
                <span className="text-sm text-texto-suave">%</span>
                {cortes.length > 1 && (
                  <Boton
                    variante="fantasma"
                    aria-label={`Quitar el corte ${i + 1}`}
                    className="min-h-10 px-2"
                    onClick={() => {
                      setCortes((previos) => previos.filter((_, j) => j !== i));
                      cambiar();
                    }}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </Boton>
                )}
              </li>
            ))}
          </ol>
          <p className={`text-sm ${suma === 10000 ? 'text-texto-suave' : 'text-peligro'}`} aria-live="polite">
            {suma === null ? 'Revisa los porcentajes.' : `Suman ${formatearPorcentaje(suma)} %.`}
          </p>
          {errores.cortes && <p className="text-xs font-medium text-peligro">{errores.cortes}</p>}
          {cortes.length < MAX_CORTES && (
            <div>
              <Boton
                variante="secundario"
                className="min-h-10"
                onClick={() => {
                  setCortes((previos) => [...previos, '']);
                  cambiar();
                }}
              >
                <Plus aria-hidden="true" className="size-4" />
                Agregar corte
              </Boton>
            </div>
          )}
        </fieldset>
        {errores.general && <Aviso tipo="error">{errores.general}</Aviso>}
        {hecho && <Aviso tipo="exito">Se guardaron tus preferencias académicas.</Aviso>}
        <div>
          <Boton type="submit" cargando={cargando} disabled={cargando}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
