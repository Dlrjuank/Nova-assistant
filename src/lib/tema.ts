/**
 * Tema de apariencia (PLAN_AMPLIACION 3.2). "automatico" sigue al sistema (prefers-color-scheme);
 * "claro" y "oscuro" se fijan con data-tema en <html>. Desde E11 se guarda por usuario (preferencias_usuario) y
 * también en el navegador, para que el script del <head> lo aplique antes de pintar.
 */
export type Tema = 'claro' | 'oscuro' | 'automatico';

export const CLAVE_TEMA = 'nova-tema';

/** E11b: el fondo de Nova de cada modo (--nova-fondo), para la barra del navegador y la de estado del iPhone. */
export const COLOR_FONDO = { claro: '#faf6f0', oscuro: '#1a1613' } as const;

export function esTema(valor: unknown): valor is Tema {
  return valor === 'claro' || valor === 'oscuro' || valor === 'automatico';
}

/** Lo que pone el script en <html>: nada para "automatico" (manda el CSS con prefers-color-scheme). */
export function atributoTema(guardado: string | null): 'claro' | 'oscuro' | null {
  return guardado === 'claro' || guardado === 'oscuro' ? guardado : null;
}

/**
 * Script mínimo que va en el <head>: aplica el tema guardado antes de pintar, para que no parpadee.
 * Si el navegador bloquea localStorage, queda "automático".
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CLAVE_TEMA}');if(t==='claro'||t==='oscuro'){document.documentElement.setAttribute('data-tema',t);var f=function(){var c=t==='claro'?'${COLOR_FONDO.claro}':'${COLOR_FONDO.oscuro}';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){var o=m.getAttribute('media');if(o&&!m.getAttribute('data-media-original'))m.setAttribute('data-media-original',o);m.removeAttribute('media');m.setAttribute('content',c);});};f();document.addEventListener('DOMContentLoaded',f);}}catch(e){}})();`;

/**
 * E11b: la barra de color del navegador y la de estado del iPhone siguen el tema elegido en Nova. Con "claro" u
 * "oscuro", todas las etiquetas theme-color toman ese fondo sin importar el sistema; con "automático", cada una
 * vuelve a su `media` (claro u oscuro según el sistema).
 */
export function aplicarColorBarra(tema: Tema): void {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const actual = m.getAttribute('media');
    if (!m.dataset.mediaOriginal && actual) m.dataset.mediaOriginal = actual;
    const media = m.dataset.mediaOriginal ?? '';
    if (tema === 'automatico') {
      if (media) m.setAttribute('media', media);
      m.setAttribute('content', media.includes('dark') ? COLOR_FONDO.oscuro : COLOR_FONDO.claro);
    } else {
      m.removeAttribute('media');
      m.setAttribute('content', COLOR_FONDO[tema]);
    }
  });
}

/** E11: aplica el tema en <html> y lo recuerda en el navegador. Si localStorage está bloqueado, solo lo aplica. */
export function aplicarTema(tema: Tema): void {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento: se aplica igual; al recargar, el servidor lo vuelve a mandar.
  }
  const atributo = atributoTema(tema);
  if (atributo) document.documentElement.setAttribute('data-tema', atributo);
  else document.documentElement.removeAttribute('data-tema');
  aplicarColorBarra(tema);
}
