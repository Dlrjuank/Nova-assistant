// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeNegocio } from '@/lib/reglas/errores';

const m = vi.hoisted(() => ({
  exigirSesion: vi.fn(),
  crearTarea: vi.fn(),
  listarTareas: vi.fn(),
  indexarDocumento: vi.fn(),
  listarDocumentos: vi.fn(),
  emitirTokenSubida: vi.fn(),
  consultarYRegistrar: vi.fn(),
  conversacionActual: vi.fn(),
  crearConversacion: vi.fn(),
}));
vi.mock('@/lib/auth/sesion', () => ({ exigirSesion: m.exigirSesion }));
vi.mock('@/lib/dataService', () => ({
  // E11e: la ruta usa crearTareaConResultado; el doble devuelve lo de crearTarea como recién creada.
  crearTareaConResultado: async (...a: unknown[]) => {
    const r = await m.crearTarea(...a);
    return r && typeof r === 'object' && 'yaExistia' in r ? r : { tarea: r, yaExistia: false };
  },
  listarTareas: m.listarTareas,
  indexarDocumento: m.indexarDocumento,
  listarDocumentos: m.listarDocumentos,
  emitirTokenSubida: m.emitirTokenSubida,
  consultarYRegistrar: m.consultarYRegistrar,
  conversacionActual: m.conversacionActual,
  crearConversacion: m.crearConversacion,
}));

import * as consultarRuta from '@/app/api/nova/consultar/route';
import * as conversacionesRuta from '@/app/api/nova/conversaciones/route';
import * as documentosRuta from '@/app/api/nova/documentos/route';
import * as subidaRuta from '@/app/api/nova/documentos/subida/route';
import * as tareasRuta from '@/app/api/nova/tareas/route';

const post = (cuerpo: unknown) =>
  new Request('http://x/api/nova', {
    method: 'POST',
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
const get = (url: string) => new Request(url);
const USUARIO = '22222222-2222-4222-8222-222222222222';
const URL_BLOB = 'https://abc123.public.blob.vercel-storage.com/a-xyz.pdf';

describe('rutas /api/nova', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.exigirSesion.mockResolvedValue({ id: USUARIO, email: 'dueno@ejemplo.com' });
  });

  describe('ninguna ruta toca datos sin sesión o fuera de la lista', () => {
    const casos: Array<[string, () => Promise<Response>, () => unknown]> = [
      ['GET tareas', () => tareasRuta.GET(get('http://x/api/nova/tareas')), () => m.listarTareas],
      ['POST tareas', () => tareasRuta.POST(post({ titulo: 'a', fechaLimite: '2026-03-10' })), () => m.crearTarea],
      ['GET documentos', () => documentosRuta.GET(), () => m.listarDocumentos],
      [
        'POST documentos',
        () => documentosRuta.POST(post({ urlBlob: URL_BLOB, nombreArchivo: 'a.pdf' })),
        () => m.indexarDocumento,
      ],
      [
        'POST subida',
        () => subidaRuta.POST(post({ type: 'blob.generate-client-token' })),
        () => m.emitirTokenSubida,
      ],
      ['POST consultar', () => consultarRuta.POST(post({ pregunta: 'Mi agenda de hoy' })), () => m.consultarYRegistrar],
      ['GET conversaciones', () => conversacionesRuta.GET(), () => m.conversacionActual],
      ['POST conversaciones', () => conversacionesRuta.POST(), () => m.crearConversacion],
    ];

    it.each(casos)('%s: 401 sin sesión y 403 fuera de la lista', async (_nombre, llamar, servicio) => {
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('NO_AUTORIZADO'));
      const sin = await llamar();
      expect(sin.status).toBe(401);
      expect(sin.headers.get('Cache-Control')).toBe('no-store');
      m.exigirSesion.mockRejectedValue(new ErrorDeNegocio('ACCESO_DENEGADO'));
      expect((await llamar()).status).toBe(403);
      expect(servicio()).not.toHaveBeenCalled();
    });
  });

  describe('tareas', () => {
    it('POST válido responde 201 con el formato del contrato', async () => {
      m.crearTarea.mockResolvedValue({ id: '1', titulo: 'Pagar luz' });
      const r = await tareasRuta.POST(post({ titulo: 'Pagar luz', fechaLimite: '2026-03-10' }));
      expect(r.status).toBe(201);
      expect(await r.json()).toEqual({ ok: true, datos: { id: '1', titulo: 'Pagar luz' } });
    });

    it('E11e (7.14): con idCliente, si ya existía responde 200 con la misma tarea; un idCliente que no es UUID es 400', async () => {
      m.crearTarea.mockResolvedValue({ tarea: { id: '1', titulo: 'Pagar luz' }, yaExistia: true });
      const id = '0b0e7c6a-1d2f-4e5a-9b8c-7d6e5f4a3b21';
      const r = await tareasRuta.POST(post({ titulo: 'Pagar luz', fechaLimite: '2026-03-10', idCliente: id }));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ ok: true, datos: { id: '1', titulo: 'Pagar luz' } });
      expect(m.crearTarea.mock.calls[0]?.[1]).toMatchObject({ idCliente: id });
      m.crearTarea.mockClear();
      expect((await tareasRuta.POST(post({ titulo: 'a', fechaLimite: '2026-03-10', idCliente: 'x' }))).status).toBe(400);
      expect(m.crearTarea).not.toHaveBeenCalled();
    });

    it('prioridad 5 llega al servicio y vuelve 422 con el mensaje exacto', async () => {
      m.crearTarea.mockRejectedValue(new ErrorDeNegocio('PRIORIDAD_INVALIDA'));
      const r = await tareasRuta.POST(post({ titulo: 'a', prioridad: 5, fechaLimite: '2026-03-10' }));
      expect(r.status).toBe(422);
      expect((await r.json()).error.mensaje).toBe('La prioridad debe ser 1, 2 o 3');
    });

    it('un cuerpo sin título, con tipos erróneos o sin JSON es 400 y no llega al servicio', async () => {
      const malos = [{ fechaLimite: '2026-03-10' }, { titulo: 'a', prioridad: 'alta', fechaLimite: 'x' }, 'no-json'];
      for (const cuerpo of malos) {
        const r = await tareasRuta.POST(post(cuerpo));
        expect(r.status).toBe(400);
        expect((await r.json()).error.codigo).toBe('DATOS_INVALIDOS');
      }
      expect(m.crearTarea).not.toHaveBeenCalled();
    });

    it('GET pasa los filtros y rechaza un estado inválido', async () => {
      m.listarTareas.mockResolvedValue([]);
      await tareasRuta.GET(get('http://x/api/nova/tareas?estado=Pendiente&fecha=2026-03-10'));
      expect(m.listarTareas).toHaveBeenCalledWith(USUARIO, { estado: 'Pendiente', fecha: '2026-03-10' });
      const r = await tareasRuta.GET(get('http://x/api/nova/tareas?estado=Inventado'));
      expect(r.status).toBe(400);
    });
  });

  describe('documentos y consulta', () => {
    it('POST documentos responde 201 y rechaza URLs que no son de Vercel Blob', async () => {
      m.indexarDocumento.mockResolvedValue({ documentoId: 'd1', numFragmentos: 3 });
      const bien = await documentosRuta.POST(post({ urlBlob: URL_BLOB, nombreArchivo: 'a.pdf' }));
      expect(bien.status).toBe(201);
      const ajenas = [
        'https://evil.com/a.pdf',
        'http://abc.public.blob.vercel-storage.com/a.pdf',
        'https://blob.vercel-storage.com.evil.com/a.pdf',
        'no-es-url',
      ];
      for (const urlBlob of ajenas) {
        const r = await documentosRuta.POST(post({ urlBlob, nombreArchivo: 'a.pdf' }));
        expect(r.status).toBe(400);
      }
      expect(m.indexarDocumento).toHaveBeenCalledTimes(1);
    });

    it('declaran un maxDuration holgado', () => {
      expect(documentosRuta.maxDuration).toBeGreaterThanOrEqual(60);
      expect(consultarRuta.maxDuration).toBeGreaterThanOrEqual(60);
    });

    it('POST consultar: corta es 422 con el mensaje exacto; válida devuelve respuesta y fuentes', async () => {
      m.consultarYRegistrar.mockRejectedValueOnce(new ErrorDeNegocio('CONSULTA_MUY_CORTA'));
      const corta = await consultarRuta.POST(post({ pregunta: 'Agenda' }));
      expect(corta.status).toBe(422);
      expect((await corta.json()).error.mensaje).toBe('La instrucción es demasiado corta');

      const datos = { respuesta: 'Sí', fuentes: [], conversacionId: 'c1', guardada: true };
      m.consultarYRegistrar.mockResolvedValueOnce(datos);
      const ok = await consultarRuta.POST(post({ pregunta: 'Mi agenda de hoy' }));
      expect(await ok.json()).toEqual({ ok: true, datos });
      expect(m.consultarYRegistrar).toHaveBeenLastCalledWith(USUARIO, 'Mi agenda de hoy', undefined, undefined);
    });

    it('POST consultar pasa el id de conversación del cuerpo y rechaza uno que no es UUID', async () => {
      const CONV = '33333333-3333-4333-8333-333333333333';
      m.consultarYRegistrar.mockResolvedValue({ respuesta: 'Sí', fuentes: [], conversacionId: CONV, guardada: true });
      await consultarRuta.POST(post({ pregunta: '¿y el segundo?', conversacionId: CONV }));
      expect(m.consultarYRegistrar).toHaveBeenLastCalledWith(USUARIO, '¿y el segundo?', CONV, undefined);
      const malo = await consultarRuta.POST(post({ pregunta: '¿y el segundo?', conversacionId: 'x' }));
      expect(malo.status).toBe(400);
      expect(m.consultarYRegistrar).toHaveBeenCalledTimes(1);
    });

    it('conversaciones: GET devuelve la del usuario; POST crea una con 201', async () => {
      m.conversacionActual.mockResolvedValue(null);
      expect(await (await conversacionesRuta.GET()).json()).toEqual({ ok: true, datos: null });
      expect(m.conversacionActual).toHaveBeenCalledWith(USUARIO);
      m.crearConversacion.mockResolvedValue({ id: 'c2' });
      const r = await conversacionesRuta.POST();
      expect(r.status).toBe(201);
      expect(await r.json()).toEqual({ ok: true, datos: { id: 'c2' } });
      expect(m.crearConversacion).toHaveBeenCalledWith(USUARIO);
    });

    it('subida: entrega cuerpo y petición a handleUpload y conserva su respuesta', async () => {
      m.emitirTokenSubida.mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 'tok' });
      const r = await subidaRuta.POST(post({ type: 'blob.generate-client-token', payload: {} }));
      expect(await r.json()).toEqual({ type: 'blob.generate-client-token', clientToken: 'tok' });
      expect(m.emitirTokenSubida.mock.calls[0]?.[0]).toMatchObject({ type: 'blob.generate-client-token' });
      expect((await subidaRuta.POST(post({ payload: {} }))).status).toBe(400);
    });
  });
});
