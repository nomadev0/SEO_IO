'use client';

const MENU = [
  {
    title: 'SEO',
    items: [
      'Panel de SEO',
      'Visión general de dominio',
      'Investigación orgánica',
      'Brecha de palabras clave',
      'Brecha de backlinks',
    ],
  },
  {
    title: 'Contenido',
    items: ['Auditoría del sitio', 'On Page Checker', 'Topic Research', 'SEO Writing Assistant'],
  },
  {
    title: 'Generación de enlaces',
    items: ['Análisis de backlinks', 'Link Building', 'Backlink Audit'],
  },
  {
    title: 'Informes',
    items: ['Dashboards', 'Report Builder', 'Alertas'],
  },
];

export function NavSidebar() {
  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-neutral-200 bg-white px-4 py-6 lg:block">
      <div className="mb-6">
        <span className="text-xs uppercase text-neutral-500">SEO PRO</span>
        <h2 className="mt-1 text-lg font-semibold text-neutral-900">Panel</h2>
      </div>
      <nav className="space-y-6 text-sm text-neutral-600">
        {MENU.map((section) => (
          <div key={section.title}>
            <div className="text-xs uppercase tracking-wide text-neutral-400">{section.title}</div>
            <ul className="mt-2 space-y-1">
              {section.items.map((item) => (
                <li key={item}>
                  <a
                    className="block rounded-lg px-3 py-2 hover:bg-neutral-100 hover:text-neutral-900"
                    href="#"
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
