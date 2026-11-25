import { COLOR_FONDO } from '@/lib/tema';

/**
 * E20b: la pantalla de carga con la Estrella nova, solo al abrir la app en frío.
 *
 * Va en el HTML inicial del layout de Nova (PantallaCarga), antes que React: este script corre mientras el
 * navegador lee la página y pone `data-nova-carga` en <html>, que es lo que la muestra (globals.css). Cuando
 * React la agrega al navegar dentro de la app (por ejemplo, después de iniciar sesión), el script no corre y
 * la pantalla queda oculta.
 *
 * - En frío: una carga normal (`navigate`) que no viene de otra página de Nova. No en una recarga, ni al volver
 *   atrás, ni en las cargas completas de sin conexión (`cargarPagina`) ni al llegar desde /login.
 * - Se va en cuanto el documento está completo (DOMContentLoaded: ya llegó todo lo que el servidor manda en
 *   la misma respuesta), sin tiempo mínimo. Si eso pasa antes del primer cuadro pintado, se quita sin
 *   desvanecer, así no parpadea.
 * - Mientras se ve, la barra de estado y la del navegador toman su fondo oscuro (una etiqueta theme-color
 *   propia, primera en el <head>, que tema.ts no toca). En la app instalada del iPhone, la estrella se centra
 *   en la pantalla completa, como en la imagen de arranque, aunque la página empiece debajo de la barra.
 */
/**
 * El fondo oscuro para la barra mientras se ve la carga, escrito en mayúsculas a propósito: React 19 reutiliza las
 * etiquetas <meta> que ya están en el <head> y las reconoce por su `content`. Con el mismo texto que la theme-color
 * oscura de Next (`#14110f`), React tomaba esta como suya y, al quitarla, fallaba al navegar (removeChild).
 */
export const COLOR_BARRA_CARGA = COLOR_FONDO.oscuro.toUpperCase();
export const ATRIBUTO_CARGA = 'data-nova-carga';
export const MS_DESVANECER = 350;

export const SCRIPT_CARGA = `(function(){var h=document.documentElement;try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type!=='navigate')return;if(document.referrer&&new URL(document.referrer).origin===location.origin)return;}catch(e){}
h.setAttribute('${ATRIBUTO_CARGA}','');var m=document.createElement('meta');m.name='theme-color';m.content='${COLOR_BARRA_CARGA}';m.setAttribute('${ATRIBUTO_CARGA}','');document.head.insertBefore(m,document.head.firstChild);
try{if(navigator.standalone&&screen.height>innerHeight)h.style.setProperty('--nova-carga-y',(innerHeight-screen.height/2)+'px');}catch(e){}
var p=false;requestAnimationFrame(function(){setTimeout(function(){p=true;},0);});
function quitar(){h.removeAttribute('${ATRIBUTO_CARGA}');h.style.removeProperty('--nova-carga-y');}
function fin(){m.remove();if(!p){quitar();return;}h.setAttribute('${ATRIBUTO_CARGA}','saliendo');setTimeout(quitar,${MS_DESVANECER + 50});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fin,{once:true});else fin();})();`;
