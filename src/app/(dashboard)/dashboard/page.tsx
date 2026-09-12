import { listNotes } from '@/modules/notes';

export const dynamic = 'force-dynamic';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value));
}

export default async function DashboardPage() {
  const notes = await listNotes();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-col gap-3 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-mono text-sm uppercase tracking-[0.2em] text-blue-300">NovaAssistant</p>
            <h1 className="text-4xl font-semibold tracking-tight">Panel operativo</h1>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
            Sistema activo
          </span>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Notas registradas</p>
            <p className="mt-2 text-3xl font-semibold">{notes.total}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Colección</p>
            <p className="mt-2 text-3xl font-semibold">note</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Versión</p>
            <p className="mt-2 text-3xl font-semibold">0.1.0</p>
          </article>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-medium">Notas recientes</h2>
            <span className="text-sm text-slate-400">Ordenadas por actualización</span>
          </div>
          <div className="space-y-3">
            {notes.data.map((note) => (
              <article key={note.id} className="border-l-2 border-blue-400/70 bg-slate-900/70 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{note.title}</h3>
                  <time className="text-xs text-slate-500" dateTime={note.updatedAt}>
                    {formatDate(note.updatedAt)}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{note.content}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
