import { CATEGORIA_POR_DEFECTO } from '@/lib/config/nova';
import { consultar, conTransaccion } from '@/lib/db/conexion';
import { textoAlcance, type Dificultad } from '@/lib/reglas/cuestionarios';
import { ErrorDeNegocio } from '@/lib/reglas/errores';
import { esFechaISOValida, hoyBogota } from '@/lib/reglas/fechas';
import { capitulosParaRepasar, compararIntentos } from '@/lib/reglas/historialCuestionarios';
import { numerarCapitulos, PRIORIDAD_PLAN_LECTURA, tituloTareaCapitulo } from '@/lib/reglas/planLectura';
import { resolverCategoria } from './categorias';
import type { CuestionarioHistorial, DocumentoHistorial, SugerenciaRepaso, TareaRepasoCreada } from './tipos';

export type Consulta = <T>(sql: string, valores: unknown[]) => Promise<T[]>;

/**
 * E10f (RB-53, S-59): los capítulos con 2 o más falladas en el intento, con el título de la tarea de repaso y si
 * ya hay una tarea sin completar con ese título. Sirve dentro o fuera de una transacción.
 */
export async function sugerenciasDeRepaso(consulta: Consulta, usuarioId: string, intentoId: string): Promise<SugerenciaRepaso[]> {
  const falladas = await consulta<{ capitulo_id: string | null }>(
    `SELECT p.capitulo_id
     FROM respuestas_intento r
     JOIN preguntas_cuestionario p ON p.id = r.pregunta_id AND p.usuario_id = r.usuario_id
     JOIN intentos_cuestionario i ON i.id = r.intento_id AND i.usuario_id = r.usuario_id
     WHERE r.intento_id = $1 AND r.usuario_id = $2 AND NOT r.acierto
     ORDER BY array_position(i.preguntas, r.pregunta_id)`,
    [intentoId, usuarioId],
  );
  const repasar = capitulosParaRepasar(falladas.map((f) => ({ capituloId: f.capitulo_id })));
  if (repasar.length === 0) return [];

  const capitulos = await consulta<{ id: string; orden: number; nivel: number; titulo: string; etiqueta_paginas: string }>(
    `SELECT c.id, c.orden, c.nivel, c.titulo, c.etiqueta_paginas
     FROM capitulos c
     JOIN cuestionarios q ON q.documento_id = c.documento_id AND q.usuario_id = c.usuario_id
     JOIN intentos_cuestionario i ON i.cuestionario_id = q.id AND i.usuario_id = q.usuario_id
     WHERE i.id = $1 AND i.usuario_id = $2
     ORDER BY c.orden`,
    [intentoId, usuarioId],
  );
  const numeros = numerarCapitulos(capitulos);
  const porId = new Map(capitulos.map((c) => [c.id, c]));
  const sugerencias = repasar.flatMap(({ capituloId, falladas: n }) => {
    const c = porId.get(capituloId);
    const numero = c ? numeros.get(c.orden) : undefined;
    return c && numero !== undefined ? [{ capituloId, titulo: tituloTareaCapitulo(numero, c.titulo, c.etiqueta_paginas, 'Repasar'), falladas: n }] : [];
  });
  if (sugerencias.length === 0) return [];
  const existentes = new Set(
    (
      await consulta<{ titulo: string }>(
        `SELECT titulo FROM tareas_personales WHERE usuario_id = $1 AND estado <> 'Completada' AND titulo = ANY($2::text[])`,
        [usuarioId, sugerencias.map((s) => s.titulo)],
      )
    ).map((t) => t.titulo),
  );
  return sugerencias.map((s) => ({ ...s, yaExiste: existentes.has(s.titulo) }));
}

interface FilaHistorial {
  documento_id: string;
  nombre: string;
  cuestionario_id: string;
  alcance: 'documento' | 'capitulo' | 'paginas';
  capitulo: string | null;
  capitulo_orden: number | null;
  pagina_desde: number | null;
  pagina_hasta: number | null;
  dificultad: Dificultad;
  preguntas: number;
  creado_en: string;
  creado_dia: string;
  intento_id: string | null;
  fecha: string | null;
  repaso: boolean | null;
  terminado: boolean | null;
  aciertos: number | null;
  total: number | null;
  puntaje: number | null;
}

const ORDEN_ALCANCE = { documento: 0, capitulo: 1, paginas: 2 } as const;

/**
 * E10f (5.11, S-58): los cuestionarios del usuario por documento y, dentro, por capítulo (primero los del
 * documento completo, luego los capítulos en su orden y al final los rangos de páginas), con sus intentos.
 */
export async function listarCuestionarios(usuarioId: string, documentoId?: string | undefined): Promise<DocumentoHistorial[]> {
  const filas = await consultar<FilaHistorial>(
    `SELECT d.id AS documento_id, d.nombre_archivo AS nombre, q.id AS cuestionario_id, q.alcance, cap.titulo AS capitulo,
            cap.orden AS capitulo_orden, q.pagina_desde, q.pagina_hasta, q.dificultad, q.creado_en,
            to_char(q.creado_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS creado_dia,
            (SELECT count(*)::int FROM preguntas_cuestionario p WHERE p.cuestionario_id = q.id AND p.usuario_id = q.usuario_id) AS preguntas,
            i.id AS intento_id, to_char(i.iniciado_en AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS fecha,
            i.repaso_de IS NOT NULL AS repaso, i.terminado_en IS NOT NULL AS terminado, i.aciertos, i.total, i.puntaje
     FROM cuestionarios q
     JOIN documentos d ON d.id = q.documento_id AND d.usuario_id = q.usuario_id
     LEFT JOIN capitulos cap ON cap.id = q.capitulo_id
     LEFT JOIN intentos_cuestionario i ON i.cuestionario_id = q.id AND i.usuario_id = q.usuario_id
     WHERE q.usuario_id = $1 AND ($2::uuid IS NULL OR q.documento_id = $2)
     ORDER BY lower(d.nombre_archivo), d.id, q.creado_en, i.iniciado_en`,
    [usuarioId, documentoId ?? null],
  );

  const documentos = new Map<string, DocumentoHistorial>();
  const cuestionarios = new Map<string, CuestionarioHistorial>();
  const claves = new Map<string, [number, number, string]>();
  const intentos = new Map<string, Array<FilaHistorial>>();
  for (const f of filas) {
    if (!documentos.has(f.documento_id)) documentos.set(f.documento_id, { id: f.documento_id, nombre: f.nombre, cuestionarios: [] });
    if (!cuestionarios.has(f.cuestionario_id)) {
      const c = {
        id: f.cuestionario_id,
        alcance: textoAlcance(f.alcance, f.capitulo, f.pagina_desde, f.pagina_hasta),
        dificultad: f.dificultad,
        preguntas: f.preguntas,
        creadoEn: f.creado_dia,
        intentos: [],
      };
      cuestionarios.set(f.cuestionario_id, c);
      claves.set(f.cuestionario_id, [ORDEN_ALCANCE[f.alcance], f.capitulo_orden ?? f.pagina_desde ?? 0, new Date(f.creado_en).toISOString()]);
      (documentos.get(f.documento_id) as DocumentoHistorial).cuestionarios.push(c);
      intentos.set(f.cuestionario_id, []);
    }
    if (f.intento_id) intentos.get(f.cuestionario_id)?.push(f);
  }

  for (const [id, lista] of intentos) {
    const comparaciones = compararIntentos(lista.map((i) => ({ repaso: Boolean(i.repaso), puntaje: i.terminado ? i.puntaje : null })));
    (cuestionarios.get(id) as CuestionarioHistorial).intentos = lista
      .map((i, n) => ({
        id: i.intento_id as string,
        fecha: i.fecha as string,
        repaso: Boolean(i.repaso),
        terminado: Boolean(i.terminado),
        aciertos: i.aciertos,
        total: i.total as number,
        puntaje: i.puntaje,
        comparacion: comparaciones[n] ?? null,
      }))
      .reverse();
  }

  return [...documentos.values()].map((d) => ({
    ...d,
    cuestionarios: d.cuestionarios.sort((x, y) => {
      const [a, b] = [claves.get(x.id) as [number, number, string], claves.get(y.id) as [number, number, string]];
      return a[0] - b[0] || a[1] - b[1] || b[2].localeCompare(a[2]);
    }),
  }));
}

export interface DatosTareaRepaso {
  capituloId: string;
  fecha: string;
  categoria?: string | undefined;
}

/**
 * E10f (RB-53): crea "Repasar cap. N: Título (pp. a–b)" solo si el capítulo tiene 2 o más falladas en ese intento
 * terminado y no hay ya una tarea sin completar con ese título. Un bloqueo por usuario y título evita que dos
 * toques seguidos la dupliquen.
 */
export async function crearTareaRepaso(usuarioId: string, intentoId: string, datos: DatosTareaRepaso): Promise<TareaRepasoCreada> {
  if (!esFechaISOValida(datos.fecha)) throw new ErrorDeNegocio('FECHA_INVALIDA');
  return conTransaccion(async (tx) => {
    const consulta: Consulta = async <T>(sql: string, valores: unknown[]) => (await tx.query(sql, valores)).rows as T[];
    const [intento] = await consulta<{ terminado: boolean; categoria: string }>(
      `SELECT i.terminado_en IS NOT NULL AS terminado, d.categoria
       FROM intentos_cuestionario i
       JOIN cuestionarios q ON q.id = i.cuestionario_id
       JOIN documentos d ON d.id = q.documento_id
       WHERE i.id = $1 AND i.usuario_id = $2`,
      [intentoId, usuarioId],
    );
    if (!intento) throw new ErrorDeNegocio('CUESTIONARIO_NO_ENCONTRADO'); // RB-01: el ajeno es inexistente
    if (!intento.terminado) throw new ErrorDeNegocio('DATOS_INVALIDOS');
    const sugerencia = (await sugerenciasDeRepaso(consulta, usuarioId, intentoId)).find((s) => s.capituloId === datos.capituloId);
    if (!sugerencia) throw new ErrorDeNegocio('DATOS_INVALIDOS'); // capítulo sin 2 falladas, o de otro documento

    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tarea-repaso:${usuarioId}:${sugerencia.titulo}`]);
    const { rows: repetidas } = await tx.query(
      `SELECT 1 FROM tareas_personales WHERE usuario_id = $1 AND estado <> 'Completada' AND titulo = $2 LIMIT 1`,
      [usuarioId, sugerencia.titulo],
    );
    if (repetidas.length > 0) throw new ErrorDeNegocio('TAREA_REPASO_EXISTENTE');

    const categoria = await resolverCategoria(tx, usuarioId, datos.categoria?.trim() || intento.categoria || CATEGORIA_POR_DEFECTO); // RB-33
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO tareas_personales (titulo, categoria, prioridad, estado, fecha_limite, fecha_creacion, usuario_id)
       VALUES ($1, $2, $3, 'Pendiente', $4, $5, $6) RETURNING id`,
      [sugerencia.titulo, categoria, PRIORIDAD_PLAN_LECTURA, datos.fecha, hoyBogota(), usuarioId],
    );
    return { id: rows[0]?.id as string, titulo: sugerencia.titulo, categoria };
  });
}
