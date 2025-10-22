import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEO PRO Dashboard',
  description: 'Suite de auditoría y análisis SEO de alto impacto.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-100 text-neutral-900">{children}</body>
    </html>
  );
}
