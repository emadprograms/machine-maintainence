import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Common';

const ACTION_LABELS: Record<string, string> = {
  login: 'Connexion', logout: 'Déconnexion', create_equipment: 'Création équipement',
  update_workflow: 'Workflow', assign_breakdown: 'Assignation', create_user: 'Création user',
  suspend_user: 'Suspension', create_breakdown: 'Déclaration panne', submit_report: 'Rapport',
};

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const { data: logs, loading } = useApi<any[]>(() => api.admin.audit({ action }), [action]);

  if (loading && !logs) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <select className="input w-auto" value={action} onChange={e => setAction(e.target.value)}>
        <option value="">Toutes actions</option>
        {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <div className="card space-y-0 p-0 divide-y divide-line-soft">
        {(logs || []).map(l => (
          <div key={l.id} className="p-4 flex gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
              {(l.user_email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{l.user_email || 'Système'}</span>
                {' · '}{ACTION_LABELS[l.action] || l.action}
                {l.entity_type && <span className="text-ink-soft"> ({l.entity_type})</span>}
              </p>
              <p className="text-xs text-ink-faint mt-0.5">
                {new Date(l.created_at).toLocaleString('fr-FR')}
                {l.ip && ` · ${l.ip}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
