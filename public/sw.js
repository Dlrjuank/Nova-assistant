/*
 * E11b (PLAN_AMPLIACION 5.10, RB-62, RB-63): service worker de Nova, registrado desde /nova con alcance /nova.
 * - Páginas: primero la red. Con conexión, guarda una copia de Inicio, Tareas, el Calendario del mes actual y
 *   los capítulos. Sin conexión, muestra esa copia, o una página que dice que no hay copia o que hace falta conexión.
 * - Archivos estáticos de Next (con nombre único por versión): primero lo guardado.
 * - Nunca guarda la API, el Asistente, el texto de los documentos ni la respuesta de una acción.
 * - Borra la copia al cerrar sesión, si el servidor rechaza la sesión, si entra otro usuario y tras 7 días sin
 *   una respuesta válida del servidor.
 * E11c le agregará las notificaciones.
 */
importScripts('/sw-reglas.js');

var R = self.NovaReglas;
var ESTATICOS = 'nova-estaticos-v1';
var DATOS = 'nova-datos-v1';
var META = '/__nova/meta';
var MAX_ESTATICOS = 400;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches
      .keys()
      .then(function (nombres) {
        return Promise.all(
          nombres
            .filter(function (n) {
              return n.indexOf('nova-') === 0 && n !== ESTATICOS && n !== DATOS;
            })
            .map(function (n) {
              return caches.delete(n);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

function leerMeta() {
  return caches
    .open(DATOS)
    .then(function (c) {
      return c.match(META);
    })
    .then(function (r) {
      return r ? r.json() : null;
    })
    .catch(function () {
      return null;
    });
}

function guardarMeta(meta) {
  return caches.open(DATOS).then(function (c) {
    return c.put(META, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  });
}

/** RB-63: borra todas las copias con datos del usuario (los archivos estáticos no tienen datos y se quedan). */
function borrarDatos() {
  return caches.delete(DATOS);
}

function avisar(mensaje) {
  return self.clients.matchAll({ type: 'window' }).then(function (ventanas) {
    ventanas.forEach(function (v) {
      v.postMessage(mensaje);
    });
  });
}

/** Página mínima sin conexión, con el tema guardado en el navegador. */
function pagina(texto) {
  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Nova</title><style>' +
    ':root{--fondo:#faf6f0;--texto:#2b2521;--suave:#6b5f57;--acento:#b4471f}' +
    '@media (prefers-color-scheme:dark){:root:not([data-tema=claro]){--fondo:#1a1613;--texto:#f3ece4;--suave:#c4b8ad;--acento:#e07a52}}' +
    ':root[data-tema=oscuro]{--fondo:#1a1613;--texto:#f3ece4;--suave:#c4b8ad;--acento:#e07a52}' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--fondo);color:var(--texto);font-family:system-ui,sans-serif;padding:16px;box-sizing:border-box}' +
    'main{max-width:28rem;text-align:center}h1{font-size:1.5rem;color:var(--acento)}p{color:var(--suave)}' +
    'a{display:inline-block;margin-top:1rem;color:var(--acento);font-weight:600;min-height:40px;line-height:40px}' +
    '</style><script>try{var t=localStorage.getItem("nova-tema");if(t==="claro"||t==="oscuro")document.documentElement.setAttribute("data-tema",t)}catch(e){}</script>' +
    '</head><body><main><h1>Nova</h1><p>' +
    texto +
    '</p><a href="/nova">Ir a Inicio</a></main></body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function recortar(cache) {
  return cache.keys().then(function (llaves) {
    var sobran = llaves.length - MAX_ESTATICOS;
    return Promise.all(
      llaves.slice(0, Math.max(0, sobran)).map(function (k) {
        return cache.delete(k);
      }),
    );
  });
}

function estatico(evento) {
  return caches.open(ESTATICOS).then(function (cache) {
    return cache.match(evento.request).then(function (guardado) {
      if (guardado) return guardado;
      return fetch(evento.request).then(function (r) {
        if (r.ok) evento.waitUntil(cache.put(evento.request, r.clone()).then(function () { return recortar(cache); }));
        return r;
      });
    });
  });
}

/** Con conexión: decide si borrar, guarda la copia y la fecha de la última respuesta válida. Sin bloquear la respuesta. */
function despues(url, metodo, respuesta, ahora) {
  return leerMeta().then(function (meta) {
    var usuario = respuesta.headers.get('x-nova-usuario');
    var motivo = R.debeBorrar({
      url: url,
      metodo: metodo,
      estado: respuesta.status,
      tipo: respuesta.type,
      usuario: usuario,
      usuarioGuardado: meta && meta.usuario,
    });
    var paso = motivo ? borrarDatos().then(function () { return avisar({ tipo: 'nova-copia-borrada', motivo: motivo }); }) : Promise.resolve();
    if (metodo !== 'GET' || !respuesta.ok || !usuario) return paso;
    return paso.then(function () {
      var tipo = respuesta.headers.get('Content-Type') || '';
      var guardar =
        R.paginaGuardable(url, ahora) && tipo.indexOf('text/html') !== -1
          ? respuesta.text().then(function (html) {
              return caches.open(DATOS).then(function (c) {
                return c.put(R.clavePagina(url), new Response(R.marcarCopia(html, ahora.getTime()), { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
              });
            })
          : Promise.resolve();
      return guardar.then(function () {
        return guardarMeta({ usuario: usuario, ultimaValida: ahora.getTime() });
      });
    });
  });
}

function navegar(evento, url) {
  var ahora = new Date();
  return fetch(evento.request)
    .then(function (respuesta) {
      evento.waitUntil(despues(url, 'GET', respuesta.clone(), ahora).catch(function () {}));
      return respuesta;
    })
    .catch(function () {
      // Sin conexión.
      if (!R.paginaGuardable(url, ahora)) return pagina('Necesitas conexión para esto.');
      return leerMeta().then(function (meta) {
        if (!meta || R.vencida(meta.ultimaValida, ahora)) {
          return borrarDatos().then(function () {
            return pagina('Esta pantalla aún no está disponible sin conexión.');
          });
        }
        return caches
          .open(DATOS)
          .then(function (c) {
            return c.match(R.clavePagina(url));
          })
          .then(function (copia) {
            return copia || pagina('Esta pantalla aún no está disponible sin conexión.');
          });
      });
    });
}

/** La API y el cierre de sesión pasan directo; solo se mira la respuesta para RB-63. */
function vigilar(evento, url) {
  return fetch(evento.request).then(function (respuesta) {
    evento.waitUntil(despues(url, evento.request.method, respuesta, new Date()).catch(function () {}));
    return respuesta;
  });
}

self.addEventListener('fetch', function (evento) {
  var pedido = evento.request;
  var url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  var ruta = url.pathname;
  if (ruta === '/api/auth/logout' || ruta === '/api/nova' || ruta.indexOf('/api/nova/') === 0) {
    evento.respondWith(vigilar(evento, url));
    return;
  }
  if (pedido.method !== 'GET') return;
  if (R.esEstatico(url)) {
    evento.respondWith(estatico(evento));
    return;
  }
  if (pedido.mode === 'navigate' && R.esPaginaNova(url) && !R.esRsc(url, pedido.headers)) {
    evento.respondWith(navegar(evento, url));
  }
});

self.addEventListener('message', function (evento) {
  if (evento.data && evento.data.tipo === 'nova-borrar-copia') evento.waitUntil(borrarDatos());
});
