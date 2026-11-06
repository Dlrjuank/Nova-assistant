'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import type { ResultadoWeb } from '@/lib/dataService';
import { CATEGORIA_POR_DEFECTO, MAX_FUENTES_WEB_POR_CATEGORIA, WEB_MAX_CARACTERES } from '@/lib/config/nova';
import { esConsultaValida, normalizarConsulta } from '@/lib/reglas/consulta';
import { MENSAJES } from '@/lib/reglas/errores';

/** CU-06: buscar en Wikipedia, resumir y guardar la fuente (RN-02, RN-05). */
export function BuscadorWeb() {
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIA_POR_DEFECTO);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoWeb | null>(null);
  const [error, setError] = useState<{ codigo: string; mensaje: string } | null>(null);

  const valida = esConsultaValida(consulta);
  const demasiadoCorta = consulta.trim() !== '' && !valida;

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    if (!valida || buscando) return;
    setError(null);
    setResultado(null);
    setBuscando(true);
    try {
      const respuesta = await fetch('/api/nova/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta: normalizarConsulta(consulta),
          categoria: categoria.trim() || CATEGORIA_POR_DEFECTO,
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        datos?: ResultadoWeb;
        error?: { codigo?: string; mensaje?: string };
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.datos) {
        setError({
          codigo: cuerpo?.error?.codigo ?? 'ERROR_INTERNO',
          mensaje: cuerpo?.error?.mensaje ?? MENSAJES.ERROR_INTERNO,
        });
        return;
      }
      setResultado(cuerpo.datos);
    } catch {
      setError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor. Intente de nuevo.' });
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="max-w-xl">
        <form onSubmit={buscar} className="flex flex-col gap-4">
          <Campo
            id="consulta"
            etiqueta="¿Qué quieres buscar?"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            error={demasiadoCorta ? MENSAJES.CONSULTA_MUY_CORTA : undefined}
            placeholder="Por ejemplo: Sierra Nevada de Santa Marta"
            maxLength={WEB_MAX_CARACTERES}
            autoComplete="off"
          />
          <Campo
            id="categoria"
            etiqueta="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            ayuda={`La fuente se guarda en esta categoría. Máximo ${MAX_FUENTES_WEB_POR_CATEGORIA} por categoría.`}
            maxLength={80}
            autoComplete="off"
          />
          <div>
            <Boton type="submit" disabled={!valida} cargando={buscando}>
              Buscar en Wikipedia
            </Boton>
          </div>
        </form>
      </Tarjeta>

      {buscando && (
        <p role="status" className="text-sm text-texto-suave">
          Buscando en Wikipedia y resumiendo…
        </p>
      )}
      {error && <Aviso tipo={error.codigo === 'LIMITE_FUENTES' ? 'advertencia' : 'error'}>{error.mensaje}</Aviso>}
      {resultado && <Resultado datos={resultado} />}
    </div>
  );
}

function Resultado({ datos }: { datos: ResultadoWeb }) {
  if (!datos.guardada) return <Aviso tipo="info">{datos.resumen}</Aviso>;
  return (
    <Tarjeta className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-texto">Resumen</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-texto">{datos.resumen}</p>
      </div>
      <div>
        <h2 className="text-sm font-semibold text-texto">Artículos usados</h2>
        <ul className="mt-1 flex flex-col gap-1 text-sm">
          {datos.articulos.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="break-all text-primario underline">
                {a.titulo}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <Aviso tipo="exito">
        Fuente guardada en «{datos.categoria}»: {datos.url} ({datos.fuentesEnCategoria} de {MAX_FUENTES_WEB_POR_CATEGORIA} en esta
        categoría).
      </Aviso>
    </Tarjeta>
  );
}
