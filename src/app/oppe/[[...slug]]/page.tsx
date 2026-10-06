import { redirect } from 'next/navigation';

/**
 * Route /oppe/* — INMrsds adalah dashboard satu halaman (src/app/page.tsx)
 * yang berpindah modul lewat `activeTab`. Supaya alamat OPPE tetap bisa
 * dibuka/dibagikan langsung, route ini memetakan URL ke tab OPPE lalu
 * mengarahkan ke dashboard (`/?tab=...`). Autentikasi & hak akses tetap
 * ditangani dashboard + RLS seperti modul lain.
 *
 *   /oppe, /oppe/dashboard        -> oppe-dashboard
 *   /oppe/doctors                 -> oppe-doctors
 *   /oppe/indicators              -> oppe-indicators
 *   /oppe/templates               -> oppe-templates
 *   /oppe/evaluations             -> oppe-evaluations
 *   /oppe/evaluations/new         -> oppe-evaluations-new
 *   /oppe/evaluations/<id>        -> oppe-evaluation:<id>
 *   /oppe/monitoring | results | fppe | reports | import | export | audit | settings
 */
const SIMPLE: Record<string, string> = {
  dashboard: 'oppe-dashboard',
  doctors: 'oppe-doctors',
  indicators: 'oppe-indicators',
  templates: 'oppe-templates',
  evaluations: 'oppe-evaluations',
  monitoring: 'oppe-monitoring',
  results: 'oppe-results',
  fppe: 'oppe-fppe',
  reports: 'oppe-reports',
  import: 'oppe-import',
  export: 'oppe-export',
  audit: 'oppe-audit',
  settings: 'oppe-settings',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OppeRoute({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const [first, second] = slug;
  let tab = 'oppe-dashboard';
  if (first === 'evaluations' && second === 'new') tab = 'oppe-evaluations-new';
  else if (first === 'evaluations' && second && UUID.test(second)) tab = `oppe-evaluation:${second}`;
  else if (first && SIMPLE[first]) tab = SIMPLE[first];
  redirect(`/?tab=${encodeURIComponent(tab)}`);
}
