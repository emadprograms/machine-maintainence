import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ScanLine, Activity, LogOut } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import { navForRole } from '../../lib/navigation';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { ThemeToggle } from '../ui/ThemeToggle';

const titles: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': { title: 'Centre de contrôle', subtitle: 'Vue temps réel plateforme' },
  '/admin/users': { title: 'Utilisateurs', subtitle: 'Gestion des comptes' },
  '/admin/companies': { title: 'Entreprises', subtitle: 'Parc multi-clients' },
  '/admin/breakdowns': { title: 'Supervision pannes', subtitle: 'Toutes entreprises' },
  '/admin/audit': { title: 'Journal d\'audit', subtitle: 'Historique des actions' },
  '/admin/settings': { title: 'Paramètres', subtitle: 'Configuration système' },
  '/dashboard': { title: 'Dashboard', subtitle: "Vue d'ensemble maintenance" },
  '/portal': { title: 'Mon espace', subtitle: 'Vos équipements et demandes' },
  '/my-requests': { title: 'Mes demandes', subtitle: 'Suivi de vos pannes' },
  '/my-equipment': { title: 'Mes équipements', subtitle: 'Parc de votre entreprise' },
  '/my-tasks': { title: 'Mes interventions', subtitle: 'Pannes assignées' },
  '/my-tasks/calendar': { title: 'Calendrier', subtitle: 'Maintenances planifiées' },
  '/scan': { title: 'Capture visuelle', subtitle: 'Scan guidé' },
  '/sites': { title: 'Chantiers', subtitle: 'Vue 2D / 3D' },
  '/kanban': { title: 'Kanban', subtitle: 'Workflow pannes' },
  '/equipment': { title: 'Équipements', subtitle: 'Parc industriel' },
  '/spare-parts': { title: 'Pièces', subtitle: 'Commandes' },
  '/notifications': { title: 'Activité', subtitle: 'Temps réel' },
  '/profile': { title: 'Profil', subtitle: 'Mon compte' },
  '/onboarding': { title: 'Bienvenue', subtitle: 'Première connexion' },
};

function currentMeta(pathname: string) {
  const key = Object.keys(titles)
    .sort((a, b) => b.length - a.length)
    .find(k => pathname.startsWith(k));
  return key ? titles[key] : { title: 'MaintainX Pro', subtitle: '' };
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function badgeCount(key: string | undefined, counts: Record<string, number>): number {
  if (!key) return 0;
  return counts[key] || 0;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { unread } = useNotifications();
  const { user, logout, can } = useAuth();
  const meta = currentMeta(location.pathname);
  const navItems = navForRole(user?.role);

  const { data: myTasks } = useApi<any[]>(
    () => user?.role === 'technician' ? api.faults.listMine() : Promise.resolve([]),
    [user?.role]
  );
  const { data: adminDash } = useApi<any>(
    () => user?.role === 'admin' ? api.admin.dashboard() : Promise.resolve(null),
    [user?.role]
  );
  const { data: pending } = useApi<any[]>(
    () => user?.role === 'admin' ? api.admin.pendingUsers() : Promise.resolve([]),
    [user?.role]
  );

  const badges: Record<string, number> = {
    myTasks: (myTasks || []).filter(f => f.status !== 'closed').length,
    criticalFaults: adminDash?.kpis?.criticalFaults || 0,
    pendingUsers: pending?.length || 0,
  };

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const showFab = user?.role !== 'client' && location.pathname !== '/scan';

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="hidden md:flex w-64 bg-surface/70 backdrop-blur-2xl border-r border-line-soft flex-col shrink-0">
        <div className="px-5 h-16 flex items-center border-b border-line-soft">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-apple-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-ink leading-tight tracking-tight">MaintainX Pro</h1>
              <p className="text-[11px] text-ink-faint">{ROLE_LABELS[user?.role || ''] || 'Maintenance'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const count = badgeCount(item.badgeKey, badges);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    isActive
                      ? item.accent ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-700'
                      : 'text-ink-soft hover:text-ink hover:bg-ink/[0.06]'
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${item.badgeKey === 'criticalFaults' ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'}`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
                {item.to === '/notifications' && unread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line-soft">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-ink/[0.06] transition-colors cursor-pointer" onClick={() => navigate('/profile')}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-xs font-semibold text-white">
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink truncate">{user.name}</p>
                <p className="text-[11px] text-ink-faint truncate">{ROLE_LABELS[user.role]}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleLogout(); }} className="btn-ghost btn-xs shrink-0" title="Déconnexion">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 h-16 border-b border-line-soft bg-surface/70 backdrop-blur-2xl flex items-center justify-between px-4 md:px-8">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink truncate tracking-tight">{meta.title}</h2>
            {meta.subtitle && <p className="text-[12px] text-ink-faint truncate hidden sm:block">{meta.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle compact />
            {can('admin:access') && adminDash?.onlineUsers && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] text-green-700 font-medium">{adminDash.onlineUsers.length} en ligne</span>
              </div>
            )}
            {user?.role !== 'client' && (
              <button onClick={() => navigate('/scan')} className="btn-accent btn-sm">
                <ScanLine className="w-4 h-4" /> <span className="hidden sm:inline">Scanner</span>
              </button>
            )}
            {user?.role === 'client' && (
              <button onClick={() => navigate('/scan')} className="btn-primary btn-sm">
                <ScanLine className="w-4 h-4" /> Déclarer une panne
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-[1280px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/85 backdrop-blur-2xl border-t border-line-soft flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {navItems.slice(0, user?.role === 'client' ? 4 : 5).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? (item.accent ? 'text-accent-600' : 'text-brand-600') : 'text-ink-faint'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>

      {showFab && (
        <button
          onClick={() => navigate('/scan')}
          className="fixed right-4 bottom-20 md:bottom-6 z-40 flex items-center gap-2 rounded-full bg-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-apple-lg transition-all hover:bg-accent-400 hover:-translate-y-0.5 active:scale-95"
        >
          <ScanLine className="h-5 w-5" />
          <span className="hidden sm:inline">Scanner</span>
        </button>
      )}
    </div>
  );
}
