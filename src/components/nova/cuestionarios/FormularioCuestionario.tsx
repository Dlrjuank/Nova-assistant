'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Selector } from '@/components/ui/Selector';
import type { CuestionarioCreado } from '@/lib/dataService';
import { CANTIDADES, DIFICULTADES, NOMBRE_DIFICULTAD, rangoValido, type Cantidad, type Dificultad } from '@/lib/reglas/cuestionarios';
import { MENSAJES } from '@/lib/reglas/errores';
import { citaDePaginas } from '@/lib/reglas/libros';

type Alcance = 'documento' | 'capitulo' | 'paginas';

function Opciones<T extends string | number>({
  leyenda,
  nombre,
  valor,
  opciones,
  alCambiar,
}: {
  leyenda: string;
  nombre: string;
  valor: T;
  opciones: ReadonlyArray<{ valor: T; texto: string }>;
  alCambiar: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-texto">{leyenda}</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {opciones.map((o) => (
          <label key={String(o.valor)} className="flex min-h-10 items-center gap-2 text-sm text-texto">
            <input type="radio" name={nombre} checked={valor === o.valor} onChange={() => alCambiar(o.valor)} className="size-4 accent-acento" />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** E10e (5.11, RB-48): alcance, cuántas preguntas y dificultad. La generación puede tardar hasta un par de minutos. */
export function FormularioCuestionario({
  documento,
  capitulos,
  capituloInicial,
}: {
  documento: { id: string; paginas: number };
  capitulos: ReadonlyArray<{ orden: number; nivel: number; titulo: string; etiquetaPaginas: string }>;
  capituloInicial?: number | undefined;
}) {
  const router = useRouter();
  const inicial = capitulos.find((c) => c.orden === capituloInicial);
  const [alcance, setAlcance] = useState<Alcance>(inicial ? 'capitulo' : 'documento');
  const [capitulo, setCapitulo] = useState(String(inicial?.orden ?? capitulos[0]?.orden ?? ''));
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState(String(Math.min(documento.paginas, 10)));
  const [pedidas, setPedidas] = useState<Cantidad>(5);
  const [dificultad, setDificultad] = useState<Dificultad>('media');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const mensajeRango = `El rango de páginas no es válido: este documento tiene ${documento.paginas} páginas.`;
  const errorRango = alcance === 'paginas' && !rangoValido(Number(desde), Number(hasta), documento.paginas) ? mensajeRango : '';

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (creando || errorRango) return;
    setError('');
    setCreando(true);
    const cuerpo = {
      documentoId: documento.id,
      pedidas,
      dificultad,
      alcance,
      ...(alcance === 'capitulo' ? { capitulo: Number(capitulo) } : {}),
      ...(alcance === 'paginas' ? { desde: Number(desde), hasta: Number(hasta) } : {}),
    };
    try {
      const respuesta = await fetch('/api/nova/cuestionarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const datos = (await respuesta.json().catch(() => null)) as { ok?: boolean; datos?: CuestionarioCreado; error?: { mensaje?: string } } | null;
      if (!respuesta.ok || !datos?.ok || !datos.datos) {
        setError(datos?.error?.mensaje ?? MENSAJES.ERROR_LLM);
        setCreando(false);
        return;
      }
      const { id, creadas } = datos.datos;
      router.push(`/nova/cuestionarios/${id}${creadas < datos.datos.pedidas ? `?obtenidas=${creadas}&pedidas=${datos.datos.pedidas}` : ''}`);
    } catch {
      setError('No se pudo conectar con el servidor. Intenta de nuevo.');
      setCreando(false);
    }
  }

  const alcances: Array<{ valor: Alcance; texto: string }> = [
    { valor: 'documento', texto: 'Todo el documento' },
    ...(capitulos.length > 0 ? [{ valor: 'capitulo' as const, texto: 'Un capítulo' }] : []),
    { valor: 'paginas', texto: 'Un rango de páginas' },
  ];

  return (
    <form onSubmit={(e) => void crear(e)} className="flex flex-col gap-5">
      <Opciones leyenda="¿De qué parte?" nombre="alcance" valor={alcance} opciones={alcances} alCambiar={setAlcance} />
      {alcance === 'capitulo' && (
        <Selector
          id="cuestionario-capitulo"
          etiqueta="Capítulo"
          value={capitulo}
          onChange={(e) => setCapitulo(e.target.value)}
          opciones={capitulos.map((c) => ({ valor: String(c.orden), texto: `${c.nivel === 2 ? '— ' : ''}${c.titulo} (${citaDePaginas(c.etiquetaPaginas)})` }))}
        />
      )}
      {alcance === 'paginas' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo id="cuestionario-desde" etiqueta="Desde la página" type="number" inputMode="numeric" min={1} max={documento.paginas} value={desde} onChange={(e) => setDesde(e.target.value)} error={errorRango} />
          <Campo id="cuestionario-hasta" etiqueta="Hasta la página" type="number" inputMode="numeric" min={1} max={documento.paginas} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      )}
      <Opciones leyenda="Cuántas preguntas" nombre="pedidas" valor={pedidas} opciones={CANTIDADES.map((n) => ({ valor: n, texto: String(n) }))} alCambiar={setPedidas} />
      <Opciones leyenda="Dificultad" nombre="dificultad" valor={dificultad} opciones={DIFICULTADES.map((d) => ({ valor: d, texto: NOMBRE_DIFICULTAD[d] }))} alCambiar={setDificultad} />
      <p className="text-xs text-texto-suave">
        Las preguntas salen solo del texto del documento, y cada una muestra la cita y la página para que la compruebes. El fragmento elegido se envía al proveedor del asistente.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex flex-col items-start gap-2">
        <Boton type="submit" cargando={creando} disabled={creando || Boolean(errorRango)}>
          Crear cuestionario
        </Boton>
        {creando && (
          <p role="status" className="text-sm text-texto-suave">
            Creando el cuestionario. Puede tardar hasta un par de minutos.
          </p>
        )}
      </div>
    </form>
  );
}
