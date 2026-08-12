import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DevLeague — X1 de programação', template: '%s · DevLeague' },
  description: 'Prática e competição de programação em partidas X1 justas e rápidas.',
  applicationName: 'DevLeague',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'DevLeague — Programação é melhor no X1',
    description: 'Um problema. Dois devs. Dez minutos.',
    type: 'website',
    images: [{ url: '/og-devleague.png', width: 1729, height: 910, alt: 'Programação é melhor no X1 — DevLeague' }]
  },
  twitter: { card: 'summary_large_image', images: ['/og-devleague.png'] }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
