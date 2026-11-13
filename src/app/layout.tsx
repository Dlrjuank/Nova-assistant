import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { imagenesArranque } from '@/lib/arranque';
import { COLOR_FONDO, SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? 'NovaAssistant',
  description: 'Sistema fullstack TypeScript con JSON Database Layer',
  // E11b: al agregarla a inicio en el iPhone, se abre como app, con su ícono y el nombre "Nova".
  // Al abrirla, mientras llega la primera respuesta, el fondo de Nova con su ícono en vez de negro.
  appleWebApp: { capable: true, title: 'Nova', statusBarStyle: 'default', startupImage: imagenesArranque() },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

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
      </head>
      <body>{children}</body>
    </html>
  );
}
