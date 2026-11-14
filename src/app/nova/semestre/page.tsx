import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { entradaDe, InsigniaEstadoMateria } from '@/components/nova/semestre/estadoMateria';
import { NuevaMateria } from '@/components/nova/semestre/NuevaMateria';
import { CLASE_FOCO } from '@/components/ui/Boton';
import { EncabezadoPantalla } from '@/components/ui/EncabezadoPantalla';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { exigirSesion, listarMaterias, type Materia } from '@/lib/dataService';
import { obtenerPreferencias } from '@/lib/datos/configuracion';
import { avisoDeComponentes, avisoDeCortes, calcularMateria, estadoDe, promedioSemestre, SIN_NOTAS, textoNota, type Calculo } from '@/lib/reglas/notas';
import type { Redondeo } from '@/lib/reglas/preferencias';

export const dynamic = 'force-dynamic';

/** E12 y E13: créditos, nota actual con su estado (o RB-13) y si algún porcentaje no suma 100 %. */
function TarjetaMateria({ materia, calculo, notaAprobar, redondeo }: { materia: Materia; calculo: Calculo; notaAprobar: number; redondeo: Redondeo }) {
  const e = entradaDe(materia);
  const revisar = Boolean(avisoDeCortes(e) || e.cortes.some((c) => avisoDeComponentes(c, e.usaCortes)));
  const estado = estadoDe(calculo, notaAprobar, redondeo);
  return (
    <li>
      <Link
        href={`/nova/semestre/${materia.id}`}
        prefetch={false}
        className={`flex h-full items-center gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave transition-colors hover:border-acento ${CLASE_FOCO}`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="break-words text-base font-semibold text-texto">{materia.nombre}</span>
          <span className="text-sm text-texto-suave">
            {materia.creditos} {materia.creditos === 1 ? 'crédito' : 'créditos'}
            {materia.docente ? ` · ${materia.docente}` : ''}
            {materia.usaCortes ? ` · ${materia.cortes.length} cortes` : ''}
          </span>
          {calculo.actual === null ? (
            <span className="text-sm text-texto-suave">{SIN_NOTAS}</span>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-texto">
                {calculo.definitiva ? 'Nota definitiva' : 'Nota actual'} <strong className="text-lg tabular-nums">{textoNota(calculo.actual, redondeo)}</strong>
              </span>
              {estado && <InsigniaEstadoMateria estado={estado} />}
            </span>
          )}
          {revisar && <span className="text-sm font-medium text-aviso">Revisa los porcentajes: no suman 100 %.</span>}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-texto-suave" />
      </Link>
    </li>
  );
}

/** E12 y E13 (5.7): Semestre, con el promedio del semestre y la pestaña "Materias y notas". */
export default async function SemestrePage() {
  const sesion = await exigirSesion();
  const [materias, { notaAprobar, redondeo }] = await Promise.all([listarMaterias(sesion.id), obtenerPreferencias(sesion.id)]);
  const calculos = materias.map((m) => calcularMateria(entradaDe(m)));
  const promedio = promedioSemestre(materias.map((m, i) => ({ creditos: m.creditos, calculo: calculos[i] as Calculo })));
  return (
    <>
      <EncabezadoPantalla titulo="Semestre" subtitulo="Tus materias, sus componentes de evaluación y tus notas." accion={materias.length > 0 ? <NuevaMateria /> : undefined} />
      <Pestanas etiqueta="Secciones de Semestre" pestanas={[{ href: '/nova/semestre', texto: 'Materias y notas', activa: true }]} />
      {materias.length === 0 ? (
        <EstadoVacio titulo="Aún no tienes materias." descripcion="Crea tu primera materia con sus créditos; luego agrega sus componentes de evaluación y tus notas." accion={<NuevaMateria />} />
      ) : (
        <>
          <Tarjeta className="flex max-w-4xl flex-col gap-2">
            <h2 className="text-base font-semibold text-texto">Promedio del semestre</h2>
            {promedio.actual === null ? (
              <p className="text-sm text-texto-suave">{SIN_NOTAS}</p>
            ) : (
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <p className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold text-texto tabular-nums">{textoNota(promedio.actual, redondeo)}</span>
                  <span className="text-sm text-texto-suave">actual</span>
                </p>
                {promedio.asegurado && (
                  <p className="text-sm text-texto">
                    Asegurado: <strong className="tabular-nums">{textoNota(promedio.asegurado, redondeo)}</strong> de 5,0
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-texto-suave">Ponderado por créditos. El actual cuenta solo las materias con notas; el asegurado, todas.</p>
          </Tarjeta>
          <ul aria-label="Materias" className="grid max-w-4xl gap-3 md:grid-cols-2">
            {materias.map((m, i) => (
              <TarjetaMateria key={m.id} materia={m} calculo={calculos[i] as Calculo} notaAprobar={notaAprobar} redondeo={redondeo} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
