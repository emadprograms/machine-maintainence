import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { StatCard, LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { AlertTriangle, Wrench, Package, Users, Building2, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { data, loading, refetch } = useApi<any>(() => api.admin.dashboard());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => { refetch(); setTick(t => t + 1); }, 10000);
    return () => clearInterval(id);
  }, [refetch]);

  if (loading && !data) return <LoadingSpinner />;

  const d = data || { kpis: {}, onlineUsers: [], activity: [], alerts: [], hourlyActivity: [], byCompany: [] };

  return (
    <div className="space-y-6">
      {/* Online bar */}
      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink">{d.onlineUsers?.length || 0} utilisateur(s) en ligne</span>
        <div className="flex flex-wrap gap-2">
          {(d.onlineUsers || []).map((u: any) => (
            <span key={u.id} className="badge border bg-green-50 text-green-700 border-green-200">
              {u.name} · {u.role}
            </span>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-faint">MAJ auto · {tick > 0 ? 'live' : ''}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Link to="/admin/companies"><StatCard title="Entreprises" value={d.kpis.companies} icon={Building2} color="bg-brand-50 text-brand-600" /></Link>
        <Link to="/equipment"><StatCard title="Équipements" value={d.kpis.equipment} icon={Wrench} color="bg-indigo-50 text-indigo-600" /></Link>
        <Link to="/admin/breakdowns"><StatCard title="Pannes actives" value={d.kpis.activeFaults} icon={AlertTriangle} color="bg-amber-50 text-amber-600" /></Link>
        <Link to="/admin/breakdowns?priority=critical"><StatCard title="Critiques" value={d.kpis.criticalFaults} icon={AlertTriangle} color="bg-red-50 text-red-600" subtitle="Pulsant" /></Link>
        <Link to="/spare-parts"><StatCard title="Pièces en attente" value={d.kpis.pendingParts} icon={Package} color="bg-orange-50 text-orange-600" /></Link>
        <StatCard title="Taux résolution" value={`${d.kpis.resolutionRate}%`} icon={Activity} color="bg-green-50 text-green-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity feed */}
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4">Activité temps réel</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(d.activity || []).map((a: any) => (
              <div key={a.id} className="text-sm p-2 rounded-lg bg-surface-muted">
                <span className="font-medium text-ink">{a.user_email || 'Système'}</span>
                <span className="text-ink-soft"> — {a.action}</span>
                <p className="text-xs text-ink-faint mt-0.5">{new Date(a.created_at).toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4">Alertes prioritaires</h3>
          <div className="space-y-2">
            {(d.alerts || []).length === 0 && <p className="text-sm text-ink-faint">Aucune alerte critique.</p>}
            {(d.alerts || []).map((a: any) => (
              <Link key={a.id} to={`/faults/${a.id}`} className="block p-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium text-red-800">{a.title}</span>
                  <StatusBadge status={a.priority} labels={{ critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Faible' }} />
                </div>
                <p className="text-xs text-red-700 mt-1">{a.equipment_name} · {a.company_name || '—'}</p>
                {!a.assigned_to && <span className="text-xs font-semibold text-red-600">Non assignée</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* By company */}
      <div className="card">
        <h3 className="text-sm font-semibold text-ink mb-4">Équipements par entreprise</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(d.byCompany || []).map((c: any) => (
            <Link key={c.id} to={`/admin/companies`} className="p-4 rounded-xl bg-surface-muted hover:shadow-apple transition-all">
              <p className="font-semibold text-ink">{c.name}</p>
              <p className="text-xs text-ink-soft mt-1">{c.equipment_count} équip. · {c.active_faults} pannes</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
