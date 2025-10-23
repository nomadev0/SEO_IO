import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'SEO PRO Dashboard',
  description: 'Suite de auditoria y analisis SEO de alto impacto',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
