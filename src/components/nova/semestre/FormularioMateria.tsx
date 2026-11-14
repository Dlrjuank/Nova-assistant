'use client';

import { useState, type FormEvent } from 'react';
import { Aviso } from '@/components/ui/Aviso';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { MAX_DOCENTE, MAX_NOMBRE_MATERIA, validarCreditos, validarNombreMateria } from '@/lib/reglas/notas';
import { mensajeDe, pedirSemestre } from './peticion';

export interface DatosFormularioMateria {
  id: string;
  nombre: string;
  creditos: number;
  docente: string | null;
}

/** E12 (RB-05, RB-06): nombre, créditos y docente de una materia; crea o edita. */
export function FormularioMateria({ materia, alTerminar }: { materia?: DatosFormularioMateria | undefined; alTerminar: (id: string) => void }) {
  const [nombre, setNombre] = useState(materia?.nombre ?? '');
  const [creditos, setCreditos] = useState(materia ? String(materia.creditos) : '');
  const [docente, setDocente] = useState(materia?.docente ?? '');
  const [errores, setErrores] = useState<{ nombre?: string; creditos?: string }>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = { nombre: mensajeDe(() => validarNombreMateria(nombre)), creditos: mensajeDe(() => validarCreditos(creditos)) };
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.creditos) return;
    setError('');
    setEnviando(true);
    const cuerpo = { nombre, creditos, docente: docente.trim() || null };
    const r = materia ? await pedirSemestre<{ id: string }>(`/api/nova/materias/${materia.id}`, 'PATCH', cuerpo) : await pedirSemestre<{ id: string }>('/api/nova/materias', 'POST', cuerpo);
    setEnviando(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    alTerminar(r.datos.id);
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-4" noValidate>
      <Campo id="materia-nombre" etiqueta="Nombre" value={nombre} maxLength={MAX_NOMBRE_MATERIA} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoComplete="off" />
      <Campo
        id="materia-creditos"
        etiqueta="Créditos"
        value={creditos}
        inputMode="numeric"
        maxLength={2}
        onChange={(e) => setCreditos(e.target.value.replace(/\D/g, ''))}
        error={errores.creditos}
        ayuda="Un número entero de 1 a 10."
      />
      <Campo id="materia-docente" etiqueta="Docente (opcional)" value={docente} maxLength={MAX_DOCENTE} onChange={(e) => setDocente(e.target.value)} autoComplete="off" />
      {!materia && <p className="text-xs text-texto-suave">La materia empieza sin cortes. También se crea una categoría de tareas con su nombre, si no existe.</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div>
        <Boton type="submit" cargando={enviando} disabled={enviando}>
          {materia ? 'Guardar cambios' : 'Crear materia'}
        </Boton>
      </div>
    </form>
  );
}
