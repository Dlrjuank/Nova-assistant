// @vitest-environment node
// E18 (9.2 a 9.4; RB-19, RB-20, RB-22, RB-23): el plan de estudio con la base y Gemini simulados, y sus rutas.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const U = '11111111-1111-4111-8111-111111111111';
const MAT = '22222222-2222-4222-8222-222222222222';
const C1 = '33333333-3333-4333-8333-333333333331';
const T1 = '66666666-6666-4666-8666-666666666661';
const T2 = '66666666-6666-4666-8666-666666666662';
const HOY = '2026-11-17';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  embeddings: vi.fn(),
  json: vi.fn(),
  materias: vi.fn(),
  crearTareaEn: vi.fn(),
  metas: vi.fn(),
  bd: {
    corte: true,
    plan: null as string | null,
    versiones: [] as Array<{ numero: number; origen: string; contenido: unknown; huella: unknown }>,
    temas: [] as Array<{ id: string; nombre: string }>,
    documentos: [] as Array<{ id: string }>,
    fragmentos: [] as unknown[][],
    pedidosFragmentos: 0,
    enTareas: [] as Array<{ paso_id: string; tarea_id: string }>,
  },
}));

/** Una base mínima que responde según la consulta: cortes, temas, documentos, fragmentos, planes y versiones. */
async function responder(sql: string, v: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
  const { rows } = await filas(sql, v);
  return { rows, rowCount: rows.length };
}

async function filas(sql: string, v: unknown[]): Promise<{ rows: unknown[] }> {
  const bd = m.bd;
  if (sql.includes('m.nombre AS materia FROM planes_estudio p')) return { rows: bd.plan && v[0] === bd.plan ? [{ id: bd.plan, materia: 'Cálculo' }] : [] };
  if (sql.startsWith('SELECT 1 FROM pasos_en_tareas')) return { rows: bd.enTareas.filter((e) => e.paso_id === v[1]) };
  if (sql.startsWith('INSERT INTO pasos_en_tareas')) {
    bd.enTareas.push({ paso_id: v[1] as string, tarea_id: v[2] as string });
    return { rows: [] };
  }
  if (sql.includes('SELECT materia_id FROM cortes')) return { rows: bd.corte ? [{ materia_id: MAT }] : [] };
  if (sql.includes('FROM temas WHERE corte_id')) return { rows: bd.temas };
  if (sql.includes('FROM documentos WHERE usuario_id')) return { rows: bd.documentos };
  if (sql.includes('FROM fragmentos_pdf')) return { rows: bd.fragmentos[bd.pedidosFragmentos++] ?? [] };
  if (sql.startsWith('INSERT INTO planes_estudio')) {
    bd.plan ??= 'plan-1';
    return { rows: [] };
  }
  if (sql.includes('FROM planes_estudio p JOIN cortes')) return { rows: bd.plan ? [{ id: bd.plan, corte_id: C1 }] : [] };
  if (sql.includes('FROM planes_estudio WHERE corte_id')) return { rows: bd.plan ? [{ id: bd.plan }] : [] };
  if (sql.includes('MAX(numero)')) return { rows: [{ n: Math.max(0, ...bd.versiones.map((x) => x.numero)) }] };
  if (sql.startsWith('INSERT INTO versiones_plan')) {
    bd.versiones.push({ numero: v[2] as number, origen: v[3] as string, contenido: JSON.parse(v[4] as string), huella: JSON.parse(v[5] as string) });
    return { rows: [] };
  }
  const desc = () => [...bd.versiones].sort((a, b) => b.numero - a.numero);
  if (sql.includes('ORDER BY numero DESC LIMIT 1')) return { rows: desc().slice(0, 1) };
  if (sql.includes('SELECT contenido, huella FROM versiones_plan')) return { rows: bd.versiones.filter((x) => x.numero === v[1]) };
  if (sql.includes('FROM versiones_plan v')) return { rows: desc().map((x) => ({ ...x, plan_id: bd.plan, creada_en: '2026-11-17T19:40' })) };
  if (sql.includes('FROM pasos_en_tareas')) return { rows: bd.enTareas };
  throw new Error(`Consulta no simulada: ${sql}`);
}

vi.mock('@/lib/db/conexion', () => ({
  consultar: async (sql: string, v?: unknown[]) => (await responder(sql, v)).rows,
  conTransaccion: async (trabajo: (tx: unknown) => Promise<unknown>) => trabajo({ query: responder }),
  aLiteralVector: (x: number[]) => `[${x.join(',')}]`,
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/llm/gemini', () => ({ llm: { generarEmbeddings: m.embeddings, generarJson: m.json } }));
vi.mock('@/lib/datos/semestre', () => ({ listarMaterias: m.materias, listarMetasNota: m.metas }));
vi.mock('@/lib/datos/tareas', () => ({ crearTareaEn: m.crearTareaEn }));
vi.mock('@/lib/datos/configuracion', () => ({ obtenerPreferencias: async () => ({ redondeo: 'truncar' }) }));
vi.mock('@/lib/dataService', async () => import('@/lib/datos/planEstudio'));

import * as rutaGenerar from '@/app/api/nova/cortes/[id]/plan/generar/route';
import * as rutaPlan from '@/app/api/nova/cortes/[id]/plan/route';
import * as rutaRestaurar from '@/app/api/nova/cortes/[id]/plan/restaurar/route';
import * as rutaVersiones from '@/app/api/nova/cortes/[id]/plan/versiones/route';
import * as rutaPasar from '@/app/api/nova/planes/[id]/pasos/[pasoId]/tarea/route';
import { generarPlan, guardarVersionManual, obtenerPlan, pasarPasoATarea, restaurarVersion } from '@/lib/datos/planEstudio';

const materia = (fecha: string | null, usaCortes = true) => ({
  id: MAT,
  nombre: 'Cálculo',
  creditos: 3,
  docente: null,
  usaCortes,
  fallasLimite: null,
  fallasRegistradas: 0,
  cortes: [
    {
      id: C1,
      orden: 1,
      nombre: 'Corte 1',
      porcentaje: 10000,
      fecha,
      componentes: [{ id: 'k1', orden: 1, nombre: 'Parcial', porcentaje: 10000, notas: [{ id: 'n1', orden: 1, nombre: null, nota: 350, fecha: null }] }],
    },
  ],
});
const fragmento = (id: string, pagina: string) => ({ id, documento_id: 'd1', numero: 1, contenido: `Texto ${id}`, nombre_archivo: 'syllabus.pdf', distancia: 0.1, etiqueta_paginas: pagina });
const planValido = { dias: [{ fecha: '2026-11-18', pasos: [{ titulo: 'Repasar límites', tema: 'T1', minutos: 45, fuentes: ['F1'] }] }, { fecha: '2026-11-25', pasos: [{ titulo: 'Derivadas', tema: 'T2', minutos: 60, fuentes: [] }] }] };
const contexto = (id = C1) => ({ params: Promise.resolve({ id }) });
const peticion = (cuerpo?: unknown) => new Request('http://x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo === undefined ? null : JSON.stringify(cuerpo) });

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(m.bd, {
    corte: true,
    plan: null,
    versiones: [],
    temas: [
      { id: T1, nombre: 'Límites' },
      { id: T2, nombre: 'Derivadas' },
    ],
    documentos: [{ id: 'd1' }],
    fragmentos: [[fragmento('f1', '2'), fragmento('f2', '3')], [fragmento('f2', '3'), fragmento('f3', '4')]],
    pedidosFragmentos: 0,
    enTareas: [],
  });
  m.exigirSesion.mockResolvedValue({ id: U });
  m.materias.mockResolvedValue([materia('2026-11-30')]);
  m.metas.mockResolvedValue([{ materiaId: MAT, corteId: C1, meta: 400 }]);
  m.embeddings.mockResolvedValue([
    [0.1, 0.2],
    [0.3, 0.4],
  ]);
});

describe('generar el plan (9.2, 9.3)', () => {
  it('RB-19: sin fecha futura no gasta cuota; texto según tenga cortes o no', async () => {
    m.materias.mockResolvedValue([materia(HOY)]);
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'PLAN_SIN_FECHA', message: 'Pon una fecha futura al corte para generar el plan.' });
    m.materias.mockResolvedValue([materia(null, false)]);
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ message: 'Pon una fecha final futura a la materia para generar el plan.' });
    expect(m.embeddings).not.toHaveBeenCalled();
    expect(m.json).not.toHaveBeenCalled();
  });

  it('RB-20: sin temas confirmados no gasta cuota', async () => {
    m.bd.temas = [];
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'SIN_TEMAS_CONFIRMADOS', message: 'Primero confirma al menos un tema del corte.' });
    expect(m.embeddings).not.toHaveBeenCalled();
    expect(m.json).not.toHaveBeenCalled();
  });

  it('un corte ajeno o inexistente', async () => {
    m.bd.corte = false;
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'CORTE_NO_ENCONTRADO' });
  });

  it('con un pedido de embeddings, 2 fragmentos por tema sin repetir, la meta y las notas; guarda la versión 1 con la huella', async () => {
    m.json.mockResolvedValueOnce(planValido);
    const plan = await generarPlan(U, C1, HOY);
    expect(m.embeddings).toHaveBeenCalledTimes(1);
    expect(m.embeddings.mock.calls[0]?.[0]).toEqual(['Explicación, ejemplos y ejercicios de Límites', 'Explicación, ejemplos y ejercicios de Derivadas']);
    const pedido = String(m.json.mock.calls[0]?.[0].contenido);
    expect(pedido).toContain('[T1] Límites');
    expect(pedido).toContain('[F3]\nTexto f3');
    expect(pedido).not.toContain('[F4]'); // f2 se repetía
    expect(pedido).toContain('Meta del corte: 4,0');
    expect(pedido).toContain('Nota actual del corte: 3,5 con el 100 % calificado.');
    expect(pedido).toContain(`HOY: ${HOY}`);
    expect(pedido).toContain('FECHA DEL CORTE: 2026-11-30');
    expect(m.bd.versiones).toHaveLength(1);
    expect(m.bd.versiones[0]).toMatchObject({ numero: 1, origen: 'asistente', huella: { meta: 400, documentos: ['d1'], notas: [{ id: 'n1', nota: 350 }] } });
    expect(plan).toMatchObject({ vigente: 1, cambios: [], version: { numero: 1, origen: 'asistente' } });
    const pasos = (plan.version.contenido.semanas.flatMap((s) => s.dias.flatMap((d) => d.pasos)));
    expect(pasos[0]).toMatchObject({ tema_id: T1, fuentes: ['syllabus.pdf · p. 2'] });
    expect(pasos[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sin PDF de la materia: no pide embeddings y el modelo lo sabe', async () => {
    m.bd.documentos = [];
    // F1 no se entregó: un plan que lo cita se descarta (las dos veces).
    m.json.mockResolvedValue(planValido);
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'PLAN_INVALIDO' });
    expect(m.embeddings).not.toHaveBeenCalled();
    expect(String(m.json.mock.calls[0]?.[0].contenido)).toContain('No hay fragmentos de PDF');
    m.json.mockReset();
    m.json.mockResolvedValueOnce({ dias: [{ fecha: '2026-11-18', pasos: [{ titulo: 'Repasar límites', tema: 'T1', minutos: 45, fuentes: [] }] }] });
    await expect(generarPlan(U, C1, HOY)).resolves.toMatchObject({ vigente: 1 });
  });

  it('RB-22: un plan que no cumple se pide otra vez; si vuelve a fallar, PLAN_INVALIDO y no se guarda nada', async () => {
    m.json.mockResolvedValueOnce({ dias: [{ fecha: '2026-11-18', pasos: [{ titulo: 'x', tema: 'T9', minutos: 30, fuentes: [] }] }] }).mockResolvedValueOnce(planValido);
    await expect(generarPlan(U, C1, HOY)).resolves.toMatchObject({ vigente: 1 });
    expect(m.json).toHaveBeenCalledTimes(2);
    m.bd.versiones = [];
    m.bd.pedidosFragmentos = 0;
    m.json.mockReset();
    m.json.mockResolvedValue({ dias: [{ fecha: '2026-12-15', pasos: [{ titulo: 'x', tema: 'T1', minutos: 30, fuentes: [] }] }] });
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'PLAN_INVALIDO', message: 'El plan generado no cumplía las reglas y se descartó. Intenta de nuevo.' });
    expect(m.json).toHaveBeenCalledTimes(2);
    expect(m.bd.versiones).toHaveLength(0);
  });

  it('un JSON roto cuenta como un intento; la cuota agotada se informa enseguida', async () => {
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.json.mockRejectedValueOnce(new ErrorDeNegocio('ERROR_LLM')).mockResolvedValueOnce(planValido);
    await expect(generarPlan(U, C1, HOY)).resolves.toMatchObject({ vigente: 1 });
    m.bd.pedidosFragmentos = 0;
    m.json.mockReset();
    m.json.mockRejectedValueOnce(new ErrorDeNegocio('CUOTA_AGOTADA'));
    await expect(generarPlan(U, C1, HOY)).rejects.toMatchObject({ codigo: 'CUOTA_AGOTADA' });
    expect(m.json).toHaveBeenCalledTimes(1);
  });
});

describe('versiones y huella (9.4, RB-23)', () => {
  async function conPlan() {
    m.json.mockResolvedValueOnce(planValido);
    return generarPlan(U, C1, HOY);
  }

  it('RB-23: un PDF nuevo y una nota nueva se avisan; el plan no cambia solo', async () => {
    await conPlan();
    m.bd.documentos = [{ id: 'd1' }, { id: 'd2' }];
    const conNota = materia('2026-11-30');
    conNota.cortes[0]?.componentes[0]?.notas.push({ id: 'n2', orden: 2, nombre: null, nota: 400, fecha: null });
    m.materias.mockResolvedValue([conNota]);
    const plan = await obtenerPlan(U, C1);
    expect(plan?.cambios).toEqual(['un PDF nuevo', 'notas nuevas']);
    expect(m.bd.versiones).toHaveLength(1);
    // "Actualizar plan" genera la versión 2 con la huella nueva: el aviso desaparece.
    m.bd.pedidosFragmentos = 0;
    m.json.mockResolvedValueOnce(planValido);
    await expect(generarPlan(U, C1, HOY)).resolves.toMatchObject({ vigente: 2, cambios: [] });
  });

  it('editar crea una versión manual con la huella de la vigente; restaurar copia una anterior como nueva', async () => {
    const plan = await conPlan();
    const [p1] = plan.version.contenido.semanas.flatMap((s) => s.dias.flatMap((d) => d.pasos));
    const editado = await guardarVersionManual(U, C1, [{ id: p1?.id, titulo: 'Límites con ejercicios', fecha: '2026-11-18', minutos: 50, temaId: T1 }], HOY);
    expect(editado).toMatchObject({ vigente: 2, version: { origen: 'manual' } });
    expect(m.bd.versiones[1]?.huella).toEqual(m.bd.versiones[0]?.huella);
    expect(editado.versiones.map((v) => [v.numero, v.origen, v.pasos])).toEqual([
      [2, 'manual', 1],
      [1, 'asistente', 2],
    ]);
    const restaurado = await restaurarVersion(U, C1, 1);
    expect(restaurado).toMatchObject({ vigente: 3, version: { origen: 'restaurada' } });
    expect(m.bd.versiones[2]?.contenido).toEqual(m.bd.versiones[0]?.contenido);
    await expect(restaurarVersion(U, C1, 9)).rejects.toMatchObject({ codigo: 'VERSION_NO_ENCONTRADA' });
    await expect(obtenerPlan(U, C1, 1)).resolves.toMatchObject({ vigente: 3, version: { numero: 1 } });
  });

  it('sin plan: obtener devuelve null; editar o restaurar responden que no hay plan', async () => {
    await expect(obtenerPlan(U, C1)).resolves.toBeNull();
    await expect(guardarVersionManual(U, C1, [{ titulo: 'x', fecha: HOY, minutos: 30, temaId: T1 }], HOY)).rejects.toMatchObject({ codigo: 'PLAN_NO_ENCONTRADO' });
    await expect(restaurarVersion(U, C1, 1)).rejects.toMatchObject({ codigo: 'PLAN_NO_ENCONTRADO' });
  });
});

describe('rutas (sección 10)', () => {
  it('generar responde 201; ver una versión con ?version=; un número inválido, 400', async () => {
    m.json.mockResolvedValueOnce(planValido);
    const r = await rutaGenerar.POST(peticion(), contexto());
    expect(r.status).toBe(201);
    const g = await rutaPlan.GET(new Request('http://x/?version=1'), contexto());
    expect(((await g.json()) as { datos: { version: { numero: number } } }).datos.version.numero).toBe(1);
    expect((await rutaPlan.GET(new Request('http://x/?version=abc'), contexto())).status).toBe(400);
    expect((await rutaPlan.GET(new Request('http://x/'), contexto('no-es-uuid'))).status).toBe(400);
  });

  it('guardar versión y restaurar con su cuerpo; campos de más, 400; sin sesión, 401', async () => {
    m.json.mockResolvedValueOnce(planValido);
    await generarPlan(U, C1, HOY);
    const v = await rutaVersiones.POST(peticion({ pasos: [{ titulo: 'Nuevo', fecha: '2026-11-20', minutos: '30', temaId: T2 }] }), contexto());
    expect(v.status).toBe(201);
    expect((await rutaVersiones.POST(peticion({ pasos: [], extra: 1 }), contexto())).status).toBe(400);
    expect((await rutaRestaurar.POST(peticion({ numero: 1 }), contexto())).status).toBe(201);
    const { ErrorDeNegocio } = await import('@/lib/reglas/errores');
    m.exigirSesion.mockRejectedValueOnce(new ErrorDeNegocio('NO_AUTORIZADO'));
    expect((await rutaGenerar.POST(peticion(), contexto())).status).toBe(401);
  });

  it('las reglas llegan con su mensaje: un paso con fecha fuera de rango, 422', async () => {
    m.json.mockResolvedValueOnce(planValido);
    await generarPlan(U, C1, HOY);
    const r = await rutaVersiones.POST(peticion({ pasos: [{ titulo: 'x', fecha: '2027-01-01', minutos: 30, temaId: T1 }] }), contexto());
    expect(r.status).toBe(422);
    expect(((await r.json()) as { error: { mensaje: string } }).error.mensaje).toBe('La fecha del paso debe estar entre hoy y la fecha del corte.');
  });
});


describe('pasar un paso a Tareas (9.5, RB-24)', () => {
  async function conPlan() {
    m.json.mockResolvedValueOnce(planValido);
    const plan = await generarPlan(U, C1, HOY);
    return { plan, pasos: plan.version.contenido.semanas.flatMap((s) => s.dias.flatMap((d) => d.pasos.map((p) => ({ ...p, fecha: d.fecha })))) };
  }

  it('crea la tarea con la fecha del paso, la materia como categoría y prioridad 2, y marca el paso', async () => {
    const { plan, pasos } = await conPlan();
    m.crearTareaEn.mockResolvedValueOnce({ id: 'tarea-1', titulo: 'Repasar límites', categoria: 'Cálculo' });
    const r = await pasarPasoATarea(U, plan.planId, pasos[0]?.id as string);
    expect(m.crearTareaEn.mock.calls[0]?.slice(1)).toEqual([U, { titulo: 'Repasar límites', fechaLimite: '2026-11-18', categoria: 'Cálculo', prioridad: 2 }]);
    expect(r).toEqual({ tareaId: 'tarea-1', titulo: 'Repasar límites', fecha: '2026-11-18', categoria: 'Cálculo' });
    await expect(obtenerPlan(U, C1)).resolves.toMatchObject({ enTareas: { [pasos[0]?.id as string]: 'tarea-1' } });
  });

  it('RB-24: la segunda vez responde que ya está, sin crear otra tarea; la marca sigue en una versión editada', async () => {
    const { plan, pasos } = await conPlan();
    m.crearTareaEn.mockResolvedValue({ id: 'tarea-1', titulo: 'x', categoria: 'Cálculo' });
    await pasarPasoATarea(U, plan.planId, pasos[0]?.id as string);
    await expect(pasarPasoATarea(U, plan.planId, pasos[0]?.id as string)).rejects.toMatchObject({ codigo: 'PASO_YA_EN_TAREAS', message: 'Este paso ya está en Tareas.' });
    expect(m.crearTareaEn).toHaveBeenCalledTimes(1);
    const editado = await guardarVersionManual(U, C1, pasos.map((p) => ({ id: p.id, titulo: p.titulo + ' (editado)', fecha: p.fecha, minutos: p.minutos, temaId: p.tema_id })), HOY);
    expect(editado.enTareas[pasos[0]?.id as string]).toBe('tarea-1');
  });

  it('un paso que no está en la versión vigente, o un plan ajeno, no crean nada', async () => {
    const { plan, pasos } = await conPlan();
    await guardarVersionManual(U, C1, [{ id: pasos[1]?.id, titulo: 'Solo derivadas', fecha: pasos[1]?.fecha as string, minutos: 60, temaId: T2 }], HOY);
    await expect(pasarPasoATarea(U, plan.planId, pasos[0]?.id as string)).rejects.toMatchObject({ codigo: 'PASO_NO_ENCONTRADO' });
    await expect(pasarPasoATarea(U, 'otro-plan', pasos[1]?.id as string)).rejects.toMatchObject({ codigo: 'PLAN_NO_ENCONTRADO' });
    expect(m.crearTareaEn).not.toHaveBeenCalled();
  });

  it('la ruta: 201, 409 la segunda vez y 400 con un id que no es uuid', async () => {
    const { plan, pasos } = await conPlan();
    m.crearTareaEn.mockResolvedValue({ id: 'tarea-1', titulo: 'x', categoria: 'Cálculo' });
    const ctx = (pasoId: string) => ({ params: Promise.resolve({ id: plan.planId, pasoId }) });
    m.bd.plan = '44444444-4444-4444-8444-444444444444';
    plan.planId = m.bd.plan;
    expect((await rutaPasar.POST(peticion(), ctx(pasos[0]?.id as string))).status).toBe(201);
    const r = await rutaPasar.POST(peticion(), ctx(pasos[0]?.id as string));
    expect(r.status).toBe(409);
    expect((await rutaPasar.POST(peticion(), ctx('no-es-uuid'))).status).toBe(400);
  });
});
