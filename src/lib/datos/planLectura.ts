import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { hoyBogota } from '@/lib/reglas/fechas';
import { numerarCapitulos, PRIORIDAD_PLAN_LECTURA, repartirFechas, tituloTareaCapitulo, type ModoPlan } from '@/lib/reglas/planLectura';
import { resolverCategoria } from './categorias';
import type { PlanLectura, ResultadoPlanLectura } from './tipos';

export type DatosPlanLectura = ModoPlan & { capitulos: number[]; categoria?: string | undefined };

type Consulta = <T>(sql: string, valores: unknown[]) => Promise<T[]>;

interface FilaCapitulo {
  id: string;
  orden: number;
  nivel: number;
  titulo: string;
  etiqueta_paginas: string;
  en_tareas: boolean;
}

/** RB-42: el mismo cálculo para la vista previa y para confirmar; al confirmar, con las filas bloqueadas. */
async function armarPlan(consulta: Consulta, usuarioId: string, documentoId: string, datos: DatosPlanLectura, bloquear: boolean) {
  const [documento] = await consulta<{ categoria: string }>('SELECT categoria FROM documentos WHERE id = $1 AND usuario_id = $2', [documentoId, usuarioId]);
  if (!documento) throw new ErrorDeNegocio('DOCUMENTO_NO_ENCONTRADO'); // RB-01: el ajeno es inexistente
  const filas = await consulta<FilaCapitulo>(
    `SELECT id, orden, nivel, titulo, etiqueta_paginas, tarea_id IS NOT NULL AS en_tareas
     FROM capitulos WHERE documento_id = $1 AND usuario_id = $2 ORDER BY orden${bloquear ? ' FOR UPDATE' : ''}`,
    [documentoId, usuarioId],
  );
  const numeros = numerarCapitulos(filas);
  const pedidos = new Set(datos.capitulos);
  const elegidos = filas.filter((c) => pedidos.has(c.orden) && numeros.has(c.orden));
  if (elegidos.length !== pedidos.size) throw new ErrorDeNegocio('DATOS_INVALIDOS'); // solo capítulos de nivel 1 del documento

  const pendientes = elegidos.filter((c) => !c.en_tareas);
  const fechas = repartirFechas(pendientes.length, datos);
  const titulo = (c: FilaCapitulo) => tituloTareaCapitulo(numeros.get(c.orden) as number, c.titulo, c.etiqueta_paginas);
  return {
    categoria: datos.categoria?.trim() || documento.categoria || CATEGORIA_POR_DEFECTO,
    tareas: pendientes.map((c, i) => ({ capituloId: c.id, orden: c.orden, titulo: titulo(c), fechaLimite: fechas[i] as string })),
    yaEnTareas: elegidos.filter((c) => c.en_tareas).map((c) => ({ orden: c.orden, titulo: c.titulo })),
  };
}

/** RB-42: vista previa, sin crear nada. */
export async function vistaPreviaPlanLectura(usuarioId: string, documentoId: string, datos: DatosPlanLectura): Promise<PlanLectura> {
  const plan = await armarPlan(consultar as Consulta, usuarioId, documentoId, datos, false);
  return { ...plan, tareas: plan.tareas.map((t) => ({ orden: t.orden, titulo: t.titulo, fechaLimite: t.fechaLimite })) };
}

/**
 * RB-42: crea una tarea por capítulo en una transacción (categoría con RB-33, prioridad 2) y marca
 * capitulos.tarea_id. Las filas se bloquean: dos toques seguidos no repiten capítulos.
 */
export async function confirmarPlanLectura(usuarioId: string, documentoId: string, datos: DatosPlanLectura): Promise<ResultadoPlanLectura> {
  return conTransaccion(async (tx) => {
    const consulta: Consulta = async <T>(sql: string, valores: unknown[]) => (await tx.query(sql, valores)).rows as T[];
    const plan = await armarPlan(consulta, usuarioId, documentoId, datos, true);
    if (plan.tareas.length === 0) throw new ErrorDeNegocio('CAPITULO_EN_TAREAS');
    const categoria = await resolverCategoria(tx, usuarioId, plan.categoria);
    for (const t of plan.tareas) {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO tareas_personales (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion, usuario_id)
         VALUES ($1, $2, $3, 'Pendiente', $4, $5, $6) RETURNING id`,
        [t.titulo, categoria, PRIORIDAD_PLAN_LECTURA, t.fechaLimite, hoyBogota(), usuarioId],
      );
      await tx.query('UPDATE capitulos SET tarea_id = $1 WHERE id = $2 AND usuario_id = $3', [rows[0]?.id, t.capituloId, usuarioId]);
    }
    return { creadas: plan.tareas.length, omitidas: plan.yaEnTareas.length, categoria };
  });
}
