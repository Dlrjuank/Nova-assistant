import { COLOR_FONDO } from '@/lib/tema';

/**
 * E20b: la pantalla de carga con la Estrella nova, solo al abrir la app en frío. Versión del 2026-11-25 (pedida por el
 * usuario a partir de una referencia):
 * 1. Fondo oscuro sin nada; un cometa de luz dibuja el anillo de la estrella (0,7 s, de frente).
 * 2. Al cerrarse el anillo, la estrella se enciende con un pequeño rebote, con "Nova" y su frase debajo (0,3 s).
 * 3. Cuando la app está lista, el anillo se abre como un portal: la app (`[data-nova-fondo]`) se revela por dentro de
 *    un círculo que crece desde la estrella (`clip-path: circle()`), con un aro de luz en el borde (0,5 s).
 * Con la app lista a tiempo, todo dura 1,5 s como máximo; si tarda más, la estrella respira hasta que esté lista.
 * Con "reducir movimiento": la estrella ya encendida y quieta, y un desvanecido corto en cuanto la app está lista.
 *
 * Va en el HTML inicial del layout de Nova (PantallaCarga), antes que React: este script corre mientras el
 * navegador lee la página y pone `data-nova-carga` en <html>, que es lo que la muestra (globals.css). Cuando
 * React la agrega al navegar dentro de la app (por ejemplo, después de iniciar sesión), el script no corre y
 * la pantalla queda oculta.
 *
 * - En frío: una carga normal (`navigate`) que no viene de otra página de Nova. No en una recarga, ni al volver
 *   atrás, ni en las cargas completas de sin conexión (`cargarPagina`) ni al llegar desde /login.
 * - "Lista" es DOMContentLoaded (ya llegó todo lo que el servidor manda en la misma respuesta). El reloj de la
 *   secuencia empieza en el primer cuadro pintado: aunque la app esté lista antes, el portal espera al cometa y a la
 *   estrella (la secuencia empieza en el fondo vacío, así que no hay parpadeo). Con la pestaña oculta se quita sin animar.
 * - Mientras se ve, la barra de estado y la del navegador toman su fondo oscuro (una etiqueta theme-color
 *   propia, primera en el <head>, que tema.ts no toca). En la app instalada del iPhone, la estrella se centra
 *   en la pantalla completa aunque la página empiece debajo de la barra.
 * - Al abrirse el portal (o al quitarse), avisa con el evento `nova-carga-fin`: los números de Inicio cuentan
 *   recién entonces (Contador).
 */

/**
 * El fondo oscuro para la barra mientras se ve la carga, escrito en mayúsculas a propósito: React 19 reutiliza las
 * etiquetas <meta> que ya están en el <head> y las reconoce por su `content`. Con el mismo texto que la theme-color
 * oscura de Next (`#14110f`), React tomaba esta como suya y, al quitarla, fallaba al navegar (removeChild).
 */
export const COLOR_BARRA_CARGA = COLOR_FONDO.oscuro.toUpperCase();
export const ATRIBUTO_CARGA = 'data-nova-carga';
export const EVENTO_FIN_CARGA = 'nova-carga-fin';
/** El cometa (0,7 s) y el encendido de la estrella (0,3 s): antes de eso el portal no se abre. */
export const MS_ANTES_DEL_PORTAL = 1000;
export const MS_PORTAL = 500;
/** "Reducir movimiento": solo el desvanecido. */
export const MS_DESVANECER = 350;

export const SCRIPT_CARGA = `(function(){var h=document.documentElement,A='${ATRIBUTO_CARGA}';try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type!=='navigate')return;if(document.referrer&&new URL(document.referrer).origin===location.origin)return;}catch(e){}
var t0=0,pintada=false,listo=false,quieto=false;try{quieto=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
h.setAttribute(A,'');var m=document.createElement('meta');m.name='theme-color';m.content='${COLOR_BARRA_CARGA}';m.setAttribute(A,'');document.head.insertBefore(m,document.head.firstChild);
try{if(navigator.standalone&&screen.height>innerHeight)h.style.setProperty('--nova-carga-y',(innerHeight-screen.height/2)+'px');}catch(e){}
var avisado=false;requestAnimationFrame(function(){t0=performance.now();pintada=true;if(listo)programar();});
function avisar(){if(avisado)return;avisado=true;try{window.dispatchEvent(new Event('${EVENTO_FIN_CARGA}'));}catch(e){}}
function quitar(){var app=document.querySelector('[data-nova-fondo]');if(app)app.style.clipPath='';h.removeAttribute(A);h.style.removeProperty('--nova-carga-y');if(m.parentNode)m.remove();avisar();}
function portal(){var app=document.querySelector('[data-nova-fondo]'),s=document.querySelector('.nova-carga svg'),aro=document.querySelector('.nova-carga-aro');if(!app||!s){quitar();return;}
var b=s.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,W=innerWidth,H=innerHeight,R=Math.sqrt(Math.pow(Math.max(x,W-x),2)+Math.pow(Math.max(y,H-y),2))+12,r0=b.width*0.47,ini=0,hecho=false;
function dibujar(r,k){app.style.clipPath='circle('+r.toFixed(1)+'px at '+x.toFixed(1)+'px '+y.toFixed(1)+'px)';if(aro){aro.style.width=aro.style.height=(2*r).toFixed(1)+'px';aro.style.transform='translate('+(x-r).toFixed(1)+'px,'+(y-r).toFixed(1)+'px)';aro.style.opacity=String(1-k);}}
function terminar(){if(hecho)return;hecho=true;quitar();}
dibujar(r0,0);h.setAttribute(A,'portal');if(m.parentNode)m.remove();avisar();
function paso(ahora){if(hecho)return;if(!ini)ini=ahora;var k=Math.min(1,(ahora-ini)/${MS_PORTAL}),e=k<0.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;dibujar(r0+(R-r0)*e,k);if(k<1)requestAnimationFrame(paso);else terminar();}
requestAnimationFrame(paso);setTimeout(terminar,${MS_PORTAL + 700});}
function programar(){setTimeout(portal,Math.max(0,t0+${MS_ANTES_DEL_PORTAL}-performance.now()));}
function fin(){if(document.visibilityState==='hidden'){quitar();return;}if(quieto){avisar();h.setAttribute(A,'saliendo');setTimeout(quitar,${MS_DESVANECER + 50});return;}listo=true;if(pintada)programar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fin,{once:true});else fin();})();`;

/**
 * Corre `listo` cuando la pantalla de carga ya deja ver la app (al abrirse el portal o al quitarse), o enseguida si no
 * hay pantalla de carga. Devuelve cómo cancelar la espera.
 */
export function alVerseLaApp(listo: () => void): () => void {
  const estado = document.documentElement.getAttribute(ATRIBUTO_CARGA);
  if (estado === null || estado === 'portal' || estado === 'saliendo') {
    listo();
    return () => {};
  }
  window.addEventListener(EVENTO_FIN_CARGA, listo, { once: true });
  return () => window.removeEventListener(EVENTO_FIN_CARGA, listo);
}
