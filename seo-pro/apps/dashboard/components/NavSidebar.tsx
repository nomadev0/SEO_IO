'use client';

const NAV_ITEMS = [
  { label: 'Dashboard', active: true },
  { label: 'Domain overview', active: false },
  { label: 'Organic research', active: false },
  { label: 'Keyword gap', active: false },
  { label: 'Backlink gap', active: false },
  { label: 'Site audit', active: false },
  { label: 'Content ideas', active: false },
  { label: 'Reports & alerts', active: false },
];

export function NavSidebar() {
  return (
    <aside className="hidden w-72 flex-col bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-800 px-6 py-8 text-white lg:flex">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 p-6 shadow-lg">
        <div className="text-xs uppercase tracking-[0.3em] text-white/70">SEO PRO</div>
        <div className="mt-2 text-2xl font-semibold">Mission Control</div>
        <p className="mt-4 text-sm text-white/80">
          Audita, optimiza y monitoriza la salud SEO de tus proyectos desde un tablero unico.
        </p>
      </div>

      <nav className="mt-10 flex-1 space-y-2">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href="#"
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
              item.active
                ? 'bg-white text-neutral-900 shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{item.label}</span>
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                item.active ? 'bg-neutral-900 text-white' : 'bg-white/10 text-white/70'
              }`}
            >
              •
            </span>
          </a>
        ))}
      </nav>

      <div className="mt-8 rounded-3xl bg-white/10 p-5 text-sm text-white/80 shadow-inner">
        <p className="text-xs uppercase tracking-wide text-white/60">Estado del crawler</p>
        <div className="mt-2 text-lg font-semibold text-white">Programado</div>
        <p className="mt-3">
          Los crawls automaticos se ejecutaran esta noche. Recibiras alertas si detectamos issues criticos.
        </p>
      </div>
    </aside>
  );
}
