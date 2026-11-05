import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { Link } from 'react-router-dom';

function ageLabel(dateStr: string) {
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
  if (h < 1) return 'il y a moins d\'1h';
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function AdminBreakdowns() {
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const { data: faults, loading, refetch } = useApi<any[]>(
    () => api.admin.breakdowns({ priority, status }),
    [priority, status]
  );
  const { data: techs } = useApi<any[]>(() => api.admin.users({ role: 'technician' }));

  async function assign(faultId: string, techId: string) {
    await api.admin.assignBreakdown(faultId, techId);
    refetch();
  }

  function exportCsv() {
    const rows = [['Machine', 'Entreprise', 'Gravité', 'Statut', 'Technicien', 'Âge'].join(',')];
    (faults || []).forEach(f => {
      rows.push([f.equipment_name, f.company_name, f.priority, f.status, f.assigned_name || '', ageLabel(f.created_at)].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pannes.csv';
    a.click();
  }

  if (loading && !faults) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <select className="input w-auto" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="">Toutes gravités</option>
            <option value="critical">Critique</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Faible</option>
          </select>
          <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="submitted">Soumis</option>
            <option value="analysis">Analyse</option>
            <option value="closed">Clôturé</option>
          </select>
        </div>
        <button onClick={exportCsv} className="btn-secondary btn-sm">Export CSV</button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft text-left text-ink-faint">
              <th className="p-3">Machine</th>
              <th className="p-3">Entreprise</th>
              <th className="p-3">Gravité</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Technicien</th>
              <th className="p-3">Âge</th>
            </tr>
          </thead>
          <tbody>
            {(faults || []).map(f => (
              <tr key={f.id} className="border-b border-line-soft">
                <td className="p-3"><Link to={`/faults/${f.id}`} className="font-medium text-brand-600 hover:underline">{f.equipment_name}</Link></td>
                <td className="p-3 text-ink-soft">{f.company_name || '—'}</td>
                <td className="p-3"><StatusBadge status={f.priority} labels={{ critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Faible' }} /></td>
                <td className="p-3"><StatusBadge status={f.status} labels={{ submitted: 'Soumis', analysis: 'Analyse', inspection: 'Inspection', validation: 'Validation', manufacturing: 'Fabrication', delivery: 'Livraison', closed: 'Clôturé' }} /></td>
                <td className="p-3">
                  {!f.assigned_to && f.status !== 'closed' && (
                    <span className="text-xs font-semibold text-red-600 mr-2">Non assignée</span>
                  )}
                  <select className="input py-1 text-xs w-36" value={f.assigned_to || ''} onChange={e => assign(f.id, e.target.value)}>
                    <option value="">— Assigner —</option>
                    {(techs || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td className="p-3 text-xs text-ink-faint">{ageLabel(f.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
