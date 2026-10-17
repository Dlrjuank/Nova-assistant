'use client';

import { useState, type FormEvent } from 'react';
import { ChangePasswordForm } from '@/components/login/ChangePasswordForm';
import { LogoutButton } from '@/components/login/LogoutButton';

interface UserPortalProps {
  email: string;
  fullName: string | null;
  phone: string | null;
}

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
}

function getDemoReply(message: string): string {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes('hola') || normalizedMessage.includes('buenas')) {
    return '¡Hola! Soy NovaAssistant en modo demostración. ¿En qué te gustaría que te ayude?';
  }
  if (normalizedMessage.includes('contraseña') || normalizedMessage.includes('clave')) {
    return 'Puedes cambiar tu contraseña desde la pestaña «Mi perfil», verificando primero tu contraseña actual.';
  }
  if (normalizedMessage.includes('ayuda')) {
    return 'Claro. Esta conversación es una simulación local; cuéntame qué necesitas y te mostraré una respuesta de ejemplo.';
  }
  return 'Gracias por tu mensaje. Esta es una respuesta simulada de NovaAssistant; todavía no se conecta a un modelo de inteligencia artificial.';
}

export function UserPortal({ email, fullName, phone }: UserPortalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'assistant'>('profile');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text: '¡Hola! Soy NovaAssistant en modo demostración. Escribe un mensaje para probar la conversación.',
    },
  ]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      return;
    }

    const userMessage: ChatMessage = { id: Date.now(), role: 'user', text };
    const assistantMessage: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      text: getDemoReply(text),
    };
    setMessages((currentMessages) => [...currentMessages, userMessage, assistantMessage]);
    setInput('');
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 font-mono text-sm uppercase tracking-[0.2em] text-blue-300">
              NovaAssistant
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tu espacio personal</h1>
            <p className="mt-2 text-sm text-slate-400">Hola, {fullName || email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">{email}</span>
            <LogoutButton />
          </div>
        </header>

        <nav aria-label="Secciones de tu cuenta" className="mb-6 flex gap-2">
          <button
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'profile'
                ? 'bg-blue-500 text-white'
                : 'border border-white/10 text-slate-300 hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            Mi perfil
          </button>
          <button
            aria-current={activeTab === 'assistant' ? 'page' : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'assistant'
                ? 'bg-blue-500 text-white'
                : 'border border-white/10 text-slate-300 hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('assistant')}
            type="button"
          >
            Asistente virtual
          </button>
        </nav>

        {activeTab === 'profile' ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Cuenta</p>
              <h2 className="mt-2 text-2xl font-semibold">Mi perfil</h2>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-400">Nombre</dt>
                  <dd className="mt-1 font-medium">{fullName || 'Aún no has agregado tu nombre'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-400">Correo electrónico</dt>
                  <dd className="mt-1 break-all font-medium">{email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-400">Teléfono</dt>
                  <dd className="mt-1 font-medium">{phone || 'No agregado'}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <h2 className="mb-4 text-xl font-semibold">Seguridad</h2>
              <p className="mb-4 max-w-sm text-sm leading-6 text-slate-400">
                Actualiza tu contraseña cuando quieras. Se te pedirá la contraseña actual para verificar tu identidad.
              </p>
              <ChangePasswordForm />
            </div>
          </section>
        ) : (
          <section className="flex min-h-[min(68vh,640px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold">Conversación de demostración</h2>
              <p className="mt-1 text-xs text-amber-200/80">
                Simulación local: los mensajes no se envían a un servicio de IA.
              </p>
            </div>
            <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((message) => (
                <div
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  key={message.id}
                >
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'border border-white/10 bg-slate-900 text-slate-200'
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              ))}
            </div>
            <form className="flex gap-3 border-t border-white/10 p-4" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="assistant-message">Tu mensaje</label>
              <input
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                id="assistant-message"
                maxLength={1000}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe un mensaje…"
                value={input}
              />
              <button
                className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                type="submit"
              >
                Enviar
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
