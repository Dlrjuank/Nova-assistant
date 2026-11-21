'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { estadoFallas, puedeSumarFalla, textoFallas, textoLimiteFallas, validarFallas, validarFallasConLimite, validarLimiteFallas } from '@/lib/reglas/notas';
import { mensajeDe, pedirSemestre, type Resultado } from './peticion';

/**
 * E14 (5.7, 7.7; RB-14, RB-15): el límite y las fallas registradas de una materia, con +1 y −1 y la alerta a 2 o
 * menos del límite. Sin límite, solo se cuentan.
 */
export function Fallas({ materiaId, limite, registradas }: { materiaId: string; limite: number | null; registradas: number }) {
  const router = useRouter();
  const [campoLimite, setCampoLimite] = useState(limite === null ? '' : String(limite));
  const [campoRegistradas, setCampoRegistradas] = useState(String(registradas));
  const [errores, setErrores] = useState<{ limite?: string; registradas?: string }>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const estado = estadoFallas(limite, registradas);
  const aviso = textoFallas(estado, limite, registradas);
  const enLimite = textoLimiteFallas(limite, registradas);

  async function pedir(pedido: () => Promise<Resultado<unknown>>) {
    setError('');
    setEnviando(true);
    const r = await pedido();
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    router.refresh();
  }

  function guardar(evento: FormEvent) {
    evento.preventDefault();
    const errorLimite = mensajeDe(() => validarLimiteFallas(campoLimite));
    const nuevos = {
      limite: errorLimite,
      // Con un límite válido, además, las registradas no pueden pasarlo.
      registradas: mensajeDe(() => {
        const n = validarFallas(campoRegistradas);
        if (!errorLimite) validarFallasConLimite(validarLimiteFallas(campoLimite), n);
      }),
    };
    setErrores(nuevos);
    if (nuevos.limite || nuevos.registradas) return;
    void pedir(() => pedirSemestre(`/api/nova/materias/${materiaId}/fallas`, 'PATCH', { limite: campoLimite.trim() || null, registradas: campoRegistradas }));
  }

  const cambiar = (cambio: 1 | -1) => void pedir(() => pedirSemestre(`/api/nova/materias/${materiaId}/fallas`, 'POST', { cambio }));

  return (
    <Tarjeta className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-texto">Fallas</h2>
      {aviso && <Aviso tipo={estado.tipo === 'perdida' ? 'error' : 'advertencia'}>{aviso}</Aviso>}
      <div className="flex flex-wrap items-center gap-4">
        <Boton variante="secundario" className="size-12 rounded-full p-0" aria-label="Restar una falla" disabled={enviando || registradas === 0} onClick={() => cambiar(-1)}>
          <Minus aria-hidden="true" className="size-5" />
        </Boton>
        <p aria-live="polite" className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-texto tabular-nums">{registradas}</span>
          <span className="text-sm text-texto-suave">{limite === null ? (registradas === 1 ? 'falla · sin límite registrado' : 'fallas · sin límite registrado') : `de ${limite} ${limite === 1 ? 'falla' : 'fallas'}`}</span>
        </p>
        <Boton variante="secundario" className="size-12 rounded-full p-0" aria-label="Sumar una falla"
          aria-describedby={enLimite ? 'fallas-en-limite' : undefined}
          disabled={enviando || !puedeSumarFalla(limite, registradas)}
          onClick={() => cambiar(1)}
        >
          <Plus aria-hidden="true" className="size-5" />
        </Boton>
      </div>
      {enLimite && (
        <p id="fallas-en-limite" className="text-sm text-texto-suave">
          {enLimite}
        </p>
      )}
      <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-[12rem_12rem_auto] sm:items-start" noValidate>
        <Campo
          id="fallas-limite"
          etiqueta="Límite de fallas"
          value={campoLimite}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => setCampoLimite(e.target.value)}
          error={errores.limite}
          ayuda="Vacío si la materia no tiene límite."
        />
        <Campo id="fallas-registradas" etiqueta="Fallas registradas" value={campoRegistradas} inputMode="numeric" maxLength={4} onChange={(e) => setCampoRegistradas(e.target.value)} error={errores.registradas} />
        <div className="sm:pt-7">
          <Boton type="submit" variante="secundario" cargando={enviando} disabled={enviando}>
            Guardar fallas
          </Boton>
        </div>
      </form>
      {error && <Aviso tipo="error">{error}</Aviso>}
    </Tarjeta>
  );
}
