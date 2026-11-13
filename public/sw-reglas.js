/*
 * E11b (PLAN_AMPLIACION 5.10, RB-62, RB-63): reglas puras del service worker de Nova.
 * Script clásico: el service worker lo carga con importScripts y las pruebas lo evalúan con un `self` falso.
 * Solo se guardan copias de Inicio, Tareas, el Calendario del mes actual y los capítulos. Nunca el Asistente,
 * las respuestas de la API, el texto de los documentos ni la respuesta de una acción.
 */
(function (global) {
  var SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
  var CAPITULOS = /^\/nova\/fuentes\/[0-9a-f-]{36}\/capitulos$/i;

  /** "2026-11" del momento dado, en Bogotá (igual que el resto de la app). */
  function mesActual(ahora) {
    var partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(ahora);
    var anio = '';
    var mes = '';
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].type === 'year') anio = partes[i].value;
      if (partes[i].type === 'month') mes = partes[i].value;
    }
    return anio + '-' + mes;
  }

  /** Archivos estáticos con nombre único por versión (y el manifiesto y los íconos): se pueden guardar siempre. */
  function esEstatico(url) {
    return url.pathname.indexOf('/_next/static/') === 0 || url.pathname.indexOf('/icons/') === 0 || url.pathname === '/manifest.webmanifest';
  }

  /** Pedido interno de Next para navegar sin recargar (RSC): nunca se guarda. */
  function esRsc(url, encabezados) {
    return url.searchParams.has('_rsc') || (encabezados && encabezados.get && encabezados.get('RSC') === '1');
  }

  /** Una página de Nova (para avisar que necesita conexión o que no tiene copia). */
  function esPaginaNova(url) {
    return url.pathname === '/nova' || url.pathname.indexOf('/nova/') === 0;
  }

  /** RB-62: Inicio, Tareas (con sus filtros), el Calendario del mes actual y los capítulos de un documento. */
  function paginaGuardable(url, ahora) {
    var ruta = url.pathname;
    if (ruta === '/nova' || ruta === '/nova/tareas') return true;
    if (ruta === '/nova/calendario') {
      var mes = url.searchParams.get('mes');
      return mes === null || mes === mesActual(ahora);
    }
    return CAPITULOS.test(ruta);
  }

  /** La copia se guarda por dirección completa, sin el ancla; "?pregunta=" de Inicio no cambia lo que se ve. */
  function clavePagina(url) {
    var copia = new URL(url.href);
    copia.hash = '';
    copia.searchParams.delete('pregunta');
    copia.searchParams.sort();
    return copia.pathname + copia.search;
  }

  /**
   * RB-63: cuándo borrar la copia, a partir de una respuesta con conexión.
   * `r` = { url, metodo, estado, tipo, usuario, usuarioGuardado }.
   */
  function debeBorrar(r) {
    var ruta = r.url.pathname;
    // Cerró sesión.
    if (r.metodo === 'POST' && ruta === '/api/auth/logout' && r.estado >= 200 && r.estado < 300) return 'cerro-sesion';
    // El servidor rechazó la sesión: 401 o 403 en la API de Nova, o una página de Nova que redirige (a /login o /home).
    if ((ruta === '/api/nova' || ruta.indexOf('/api/nova/') === 0) && (r.estado === 401 || r.estado === 403)) return 'sesion-rechazada';
    if (esPaginaNova(r.url) && r.tipo === 'opaqueredirect') return 'sesion-rechazada';
    // Entró otro usuario.
    if (r.usuario && r.usuarioGuardado && r.usuario !== r.usuarioGuardado) return 'otro-usuario';
    return null;
  }

  /** RB-63: sin una respuesta válida del servidor en 7 días, la copia ya no se muestra. */
  function vencida(ultimaValida, ahora) {
    return typeof ultimaValida !== 'number' || ahora.getTime() - ultimaValida > SIETE_DIAS_MS;
  }

  /** Marca el HTML guardado con la hora en que se guardó, para el aviso `Sin conexión · datos de las HH:MM`. */
  function marcarCopia(html, guardadoEn) {
    var meta = '<meta name="nova-copia" content="' + new Date(guardadoEn).toISOString() + '">';
    var i = html.indexOf('</head>');
    return i === -1 ? meta + html : html.slice(0, i) + meta + html.slice(i);
  }

  global.NovaReglas = {
    SIETE_DIAS_MS: SIETE_DIAS_MS,
    mesActual: mesActual,
    esEstatico: esEstatico,
    esRsc: esRsc,
    esPaginaNova: esPaginaNova,
    paginaGuardable: paginaGuardable,
    clavePagina: clavePagina,
    debeBorrar: debeBorrar,
    vencida: vencida,
    marcarCopia: marcarCopia,
  };
})(self);
