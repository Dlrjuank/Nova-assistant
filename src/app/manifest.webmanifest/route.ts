import { manifiesto } from '@/lib/manifiesto';

export const dynamic = 'force-static';

/** E11b: manifiesto de la app instalable (ver `src/lib/manifiesto.ts`). */
export function GET() {
  return new Response(JSON.stringify(manifiesto()), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' },
  });
}
