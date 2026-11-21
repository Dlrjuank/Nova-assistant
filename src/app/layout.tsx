import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { imagenesArranque } from '@/lib/arranque';
import { COLOR_FONDO, SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'NovaAssistant',
  description: 'Sistema fullstack TypeScript con JSON Database Layer',
  // E11b: lo del iPhone (app, ícono, nombre y pantallas de arranque) va en <head> con EtiquetasIphone.
};

/**
 * E11b: al agregarla a inicio en el iPhone, se abre como app, con su ícono y el nombre "Nova", y al abrirla,
 * mientras llega la primera respuesta, el fondo de Nova con su ícono en vez de negro. Ajuste de E20: escritas
 * aquí, en el <head> real; con `metadata` Next 15.5 las manda al final del cuerpo y sin
 * `apple-mobile-web-app-capable`, e iOS volvió a abrir en negro.
 */
function EtiquetasIphone() {
  return (
    <>
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Nova" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      {imagenesArranque().map((i) => (
        <link key={i.url} rel="apple-touch-startup-image" href={i.url} media={i.media} />
      ))}
    </>
  );
}

export const viewport: Viewport = {
  // E11b: en la app instalada del iPhone, la página llega hasta los bordes y cada barra respeta el área segura
  // (--nova-seguro-abajo en globals.css). En Safari y en el PC ese margen sigue en 0, como antes.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: COLOR_FONDO.claro },
    { media: '(prefers-color-scheme: dark)', color: COLOR_FONDO.oscuro },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning: el script del tema pone data-tema en <html> antes de que React hidrate.
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
        {/* E11b: con credenciales, para que también funcione en la vista previa protegida por Vercel. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <EtiquetasIphone />
      </head>
      <body>{children}</body>
    </html>
  );
}
