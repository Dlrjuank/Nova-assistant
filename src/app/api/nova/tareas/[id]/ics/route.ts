import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/auth/sesion';
import { obtenerPreferencias, obtenerTarea } from '@/lib/dataService';
import { conManejoDeErrores } from '@/lib/http/respuestas';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { generarIcs, nombreArchivoIcs } from '@/lib/reglas/ics';
import { rutaDeTarea } from '@/lib/reglas/recordatorios';
import { esquemaIdTarea } from '@/lib/validacion/esquemas';

export const dynamic = 'force-dynamic';

/**
 * E11d (RB-47, S-50): "Agregar a mi calendario". Devuelve la tarea como .ics, con la alarma de su recordatorio
 * (sin horario, a la hora fija de Configuración). Una tarea de otro usuario se comporta como inexistente (RB-01).
 */
export const GET = conManejoDeErrores(
  async (peticion: Request, { params }: { params: Promise<{ id: string }> }) => {
    const sesion = await exigirSesion();
    const id = esquemaIdTarea.parse((await params).id);
    const [tarea, preferencias] = await Promise.all([
      obtenerTarea(sesion.id, id),
      obtenerPreferencias(sesion.id),
    ]);
    if (!tarea) throw new ErrorDeNegocio('TAREA_NO_ENCONTRADA');
    const origen = new URL(peticion.url);
    const ics = generarIcs(
      {
        id: tarea.id,
        titulo: tarea.titulo,
        fechaLimite: String(tarea.fechaLimite).slice(0, 10),
        horaInicio: tarea.horaInicio,
        horaFin: tarea.horaFin,
        recordatorio: tarea.recordatorio,
      },
      {
        horaFija: preferencias.horaRecordatorio,
        enlace: `${origen.origin}${rutaDeTarea(tarea.id)}`,
        dominio: origen.hostname,
      },
    );
    const nombre = nombreArchivoIcs(tarea.titulo);
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
