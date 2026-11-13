/**
 * Señal de carga de Nova (corrección de E11b): al tocar una pestaña, la pantalla cambia al instante a este
 * esqueleto mientras el servidor responde, en vez de quedarse quieta. Next lo pide por adelantado con los enlaces
 * del menú, así que aparece sin esperar la red. Solo tokens de Nova; sin animación con "reducir movimiento".
 */
export default function CargandoNova() {
  const bloque = 'rounded-lg bg-superficie-2 motion-safe:animate-pulse';
  return (
    <div data-nova-cargando aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className={`${bloque} h-7 w-40`} />
        <div className={`${bloque} h-4 w-64 max-w-full`} />
      </div>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-suave sm:p-6">
          <div className={`${bloque} h-5 w-32`} />
          <div className={`${bloque} h-4 w-full`} />
          <div className={`${bloque} h-4 w-5/6`} />
          <div className={`${bloque} h-4 w-2/3`} />
        </div>
      ))}
    </div>
  );
}
