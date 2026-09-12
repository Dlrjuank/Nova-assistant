import { count } from '@/lib/json-db';

export default async function StatusPage() {
  const noteCount = await count('note');

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm uppercase tracking-[0.2em] text-blue-300">Diagnóstico</p>
        <h1 className="mt-3 text-4xl font-semibold">Estado del sistema</h1>
        <div className="mt-10 divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.04]">
          <div className="flex items-center justify-between p-5"><span>API</span><strong className="text-emerald-300">Operativa</strong></div>
          <div className="flex items-center justify-between p-5"><span>Entorno</span><strong>{process.env.NODE_ENV ?? 'unknown'}</strong></div>
          <div className="flex items-center justify-between p-5"><span>Colección note</span><strong>{noteCount} registros</strong></div>
        </div>
      </div>
    </main>
  );
}
