import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { Link } from 'react-router-dom';
import { faultImage } from '../../lib/equipmentImages';

const STEPS = ['submitted', 'analysis', 'inspection', 'validation', 'manufacturing', 'delivery', 'closed'];
const STEP_LABELS: Record<string, string> = {
  submitted: 'Soumis', analysis: 'Analyse', inspection: 'Inspection', validation: 'Validation',
  manufacturing: 'Fabrication', delivery: 'Livraison', closed: 'Clôturé',
};
const HUMAN: Record<string, string> = {
  submitted: 'Demande reçue', analysis: 'En cours d\'analyse', inspection: 'En cours d\'inspection',
  validation: 'En validation', manufacturing: 'Fabrication en cours', delivery: 'Livraison', closed: 'Résolue',
};

export default function MyRequests() {
  const [filter, setFilter] = useState('all');
  const { data: faults, loading } = useApi<any[]>(() => api.faults.list());

  if (loading) return <LoadingSpinner />;

  const filtered = (faults || []).filter(f => {
    if (filter === 'active') return f.status !== 'closed';
    if (filter === 'closed') return f.status === 'closed';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'active', 'closed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
            {f === 'all' ? 'Toutes' : f === 'active' ? 'En cours' : 'Résolues'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(f => {
          const stepIdx = STEPS.indexOf(f.status);
          return (
            <div key={f.id} className="card overflow-hidden">
              <div className="flex gap-4">
                <img src={faultImage(f)} alt="" className="h-24 w-24 sm:h-28 sm:w-28 object-cover rounded-xl shrink-0 bg-surface-muted" />
                <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-semibold text-ink">{f.title}</p>
                  <p className="text-sm text-ink-soft">{f.equipment_name}</p>
                </div>
                <StatusBadge status={f.status === 'closed' ? 'closed' : 'analysis'} labels={{ closed: 'Résolue', analysis: HUMAN[f.status] || f.status }} />
              </div>
              <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex-1 min-w-[40px] h-1.5 rounded-full ${i <= stepIdx ? 'bg-brand-500' : 'bg-line-soft'}`} title={STEP_LABELS[s]} />
                ))}
              </div>
              <Link to={`/faults/${f.id}`} className="btn-secondary btn-sm">Voir le détail</Link>
              {f.status === 'submitted' && (
                <button className="btn-ghost btn-sm ml-2 text-red-600">Annuler</button>
              )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
