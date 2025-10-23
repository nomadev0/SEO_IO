import './globals.css';
import { ReactNode } from 'react';
import { inter } from './fonts';

export const metadata = {
  title: 'SEO PRO',
  description: 'SEO PRO Dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable}`}>
      <body className="font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}
