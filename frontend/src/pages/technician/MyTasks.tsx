import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { faultImage } from '../../lib/equipmentImages';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Soumis', analysis: 'Analyse', inspection: 'Inspection',
  validation: 'Validation', manufacturing: 'Fabrication', delivery: 'Livraison', closed: 'Clôturé',
};

export default function MyTasks() {
  const [tab, setTab] = useState<'active' | 'todo' | 'done'>('active');
  const { data: faults, loading } = useApi<any[]>(() => api.faults.listMine());

  if (loading) return <LoadingSpinner />;

  const all = faults || [];
  const active = all.filter(f => f.status !== 'closed' && ['analysis', 'inspection', 'validation', 'manufacturing', 'delivery'].includes(f.status));
  const todo = all.filter(f => f.status === 'submitted' || !f.status);
  const done = all.filter(f => f.status === 'closed');

  const list = tab === 'active' ? active : tab === 'todo' ? todo : done;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-full bg-surface-muted p-1 border border-line-soft w-fit">
        {([['active', 'En cours'], ['todo', 'À faire'], ['done', 'Terminées']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === k ? 'bg-surface shadow-apple-sm text-ink' : 'text-ink-faint'}`}>
            {label} ({k === 'active' ? active.length : k === 'todo' ? todo.length : done.length})
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {list.length === 0 && <p className="text-sm text-ink-faint">Aucune intervention dans cette catégorie.</p>}
        {list.map(f => (
          <Link key={f.id} to={`/faults/${f.id}`} className="card card-hover flex items-center gap-4">
            <img src={faultImage(f)} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0 bg-surface-muted" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink truncate">{f.title}</p>
              <p className="text-sm text-ink-soft">{f.equipment_name} · {f.company_name || 'Site'}</p>
              <p className="text-xs text-ink-faint mt-1">{STATUS_LABELS[f.status] || f.status}</p>
            </div>
            <StatusBadge status={f.priority} labels={{ critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Faible' }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
