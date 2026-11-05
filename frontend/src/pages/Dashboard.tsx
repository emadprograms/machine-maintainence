import { api } from '../services/api';
import { DashboardData } from '../types';
import { StatCard, LoadingSpinner, StatusBadge } from '../components/ui/Common';
import { AlertTriangle, Wrench, Package, Activity, CheckCircle, Heart, TrendingUp, ScanLine, Map, Kanban, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { faultImage, equipmentImage } from '../lib/equipmentImages';

function QuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const actions = [
    { label: 'Scanner & signaler', hint: 'Caméra → pré-diagnostic', icon: ScanLine, to: '/scan', accent: true },
    { label: 'Chantiers', hint: 'Vue 2D / 3D du parc', icon: Map, to: '/sites' },
    { label: 'Mes pannes', hint: 'Workflow Kanban', icon: Kanban, to: '/kanban' },
  ];
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">
        Bonjour {user?.name?.split(' ')[0] || ''} · accès rapide
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className={`group flex items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-apple-lg ${
              a.accent ? 'border-transparent bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-apple' : 'border-line-soft bg-surface shadow-apple'
            }`}
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.accent ? 'bg-white/20' : 'bg-brand-50 text-brand-600'}`}>
              <a.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{a.label}</span>
              <span className={`block text-xs ${a.accent ? 'text-white/80' : 'text-ink-faint'}`}>{a.hint}</span>
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 ${a.accent ? 'text-white/80' : 'text-ink-faint'} transition-transform group-hover:translate-x-0.5`} />
          </button>
        ))}
      </div>
    </div>
  );
}

import { useApi } from '../hooks/useApi';

const COLORS = ['#0071e3', '#5e5ce6', '#ff9f0a', '#30b0c7', '#ff375f', '#34c759', '#af52de'];
const TOOLTIP_STYLE = { background: '#ffffff', border: '1px solid #d2d2d7', borderRadius: 12, color: '#1d1d1f', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.2)' };

export default function Dashboard() {
  const { data: d, loading } = useApi<DashboardData>(() => api.dashboard.get());

  if (loading) return <LoadingSpinner />;
  if (!d) return <p className="text-ink-soft">Aucune donnée disponible.</p>;

  return (
    <div className="space-y-6">
      <QuickActions />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Équipements" value={d.totalEquipment} icon={Wrench} color="bg-brand-50 text-brand-600" subtitle={`Santé moyenne: ${d.avgHealth}%`} />
        <StatCard title="Pannes actives" value={d.activeFaults} icon={AlertTriangle} color="bg-red-50 text-red-600" subtitle={`${d.criticalFaults} critiques`} />
        <StatCard title="Pannes résolues" value={d.closedFaults} icon={CheckCircle} color="bg-green-50 text-green-600" />
        <StatCard title="Pièces en attente" value={d.pendingParts} icon={Package} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-brand-600" /> Flux des statuts</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.statusFlow.map((s: any) => ({ ...s, label: ({ submitted: 'Soumis', analysis: 'Analyse', inspection: 'Inspection', validation: 'Validation', manufacturing: 'Fabrication', delivery: 'Livraison', closed: 'Clôturé' } as any)[s.status] || s.status }))}>
                <XAxis dataKey="label" tick={{ fill: '#86868b', fontSize: 11 }} axisLine={{ stroke: '#d2d2d7' }} tickLine={false} />
                <YAxis tick={{ fill: '#86868b', fontSize: 11 }} axisLine={{ stroke: '#d2d2d7' }} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#0071e3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-600" /> Priorités des pannes</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {['#4D1BFF', '#8b5cf6', '#f59e0b', '#06b6d4'].map((c, i) => (
                    <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={d.faultsByPriority.map((p: any) => ({ ...p, label: ({ low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique' } as any)[p.priority] || p.priority }))}
                  dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={65} outerRadius={105}
                  paddingAngle={4} stroke="none" animationDuration={800}
                >
                  {d.faultsByPriority.map((_: any, i: number) => <Cell key={i} fill={`url(#pieGrad${i})`} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {d.faultsByPriority.map((p: any, i: number) => (
              <div key={p.priority} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card-30 border-subtle">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-muted font-medium">{p.count} {(p.priority === 'critical' ? 'critique' : p.priority === 'high' ? 'haute' : p.priority === 'medium' ? 'moyenne' : 'faible')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-red-500" /> Équipements à surveiller</h3>
          {d.lowHealthEquipment.length === 0 ? (
            <p className="text-sm text-ink-faint">Tous les équipements sont en bonne santé.</p>
          ) : (
            <div className="space-y-2.5">
              {d.lowHealthEquipment.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted">
                  <img src={equipmentImage(e)} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  <span className="text-sm font-medium text-ink flex-1 truncate">{e.name}</span>
                  <span className={`badge border ${e.health_score < 40 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {e.health_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-ink mb-4">Dernières pannes signalées</h3>
          <div className="space-y-2.5">
            {d.recentFaults.map((f: any) => (
              <div key={f.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-muted">
                <img src={faultImage(f)} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{f.title}</p>
                  <p className="text-xs text-ink-faint mt-0.5">{f.equipment_name}</p>
                </div>
                <StatusBadge status={f.priority} labels={{ low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique' }} />
              </div>
            ))}
            {d.recentFaults.length === 0 && <p className="text-sm text-ink-faint">Aucune panne récente.</p>}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-ink mb-4">Équipements par catégorie</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {d.equipmentByCategory.map((c: any) => (
            <div key={c.category} className="text-center p-4 rounded-xl bg-surface-muted">
              <p className="text-2xl font-semibold text-ink tracking-tight">{c.count}</p>
              <p className="text-xs text-ink-soft mt-1">{c.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
