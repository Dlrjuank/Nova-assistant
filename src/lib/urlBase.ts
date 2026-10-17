export function obtenerUrlBase(): string {
  const urlConfigurada = process.env.APP_URL?.trim();
  if (urlConfigurada) {
    return urlConfigurada.replace(/\/+$/, '');
  }

  const urlProduccion = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.VERCEL_ENV === 'production' && urlProduccion) {
    return `https://${urlProduccion}`;
  }

  const urlVercel = process.env.VERCEL_URL?.trim();
  if (urlVercel) {
    return `https://${urlVercel}`;
  }

  return 'http://localhost:3000';
}
