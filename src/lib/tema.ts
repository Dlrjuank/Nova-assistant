/**
 * Tema de apariencia (PLAN_AMPLIACION 3.2). "automatico" sigue al sistema (prefers-color-scheme);
 * "claro" y "oscuro" se fijan con data-tema en <html>. Desde E11 se guarda por usuario (preferencias_usuario) y
 * también en el navegador, para que el script del <head> lo aplique antes de pintar.
 */
export type Tema = 'claro' | 'oscuro' | 'automatico';

export const CLAVE_TEMA = 'nova-tema';

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
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('${CLAVE_TEMA}');if(t==='claro'||t==='oscuro')document.documentElement.setAttribute('data-tema',t);}catch(e){}})();`;

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
}
