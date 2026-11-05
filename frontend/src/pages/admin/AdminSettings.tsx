import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Common';

export default function AdminSettings() {
  const { data, loading, refetch } = useApi<any>(() => api.admin.settings());
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.admin.updateSettings(form);
    refetch();
  }

  if (loading && !data) return <LoadingSpinner />;

  return (
    <form onSubmit={save} className="space-y-6 max-w-xl">
      <div className="card space-y-4">
        <h3 className="font-semibold text-ink">Seuils d'alerte</h3>
        <div>
          <label className="label">Risk score alerte (&gt;)</label>
          <input type="number" className="input" value={form.risk_score_alert || 80} onChange={e => setForm({ ...form, risk_score_alert: e.target.value })} />
        </div>
        <div>
          <label className="label">Panne non assignée (heures)</label>
          <input type="number" className="input" value={form.unassigned_hours_alert || 2} onChange={e => setForm({ ...form, unassigned_hours_alert: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.maintenance_mode === true || form.maintenance_mode === 'true'} onChange={e => setForm({ ...form, maintenance_mode: e.target.checked })} />
          Mode maintenance (bandeau global)
        </label>
      </div>

      <div className="card">
        <h3 className="font-semibold text-ink mb-3">Statut des services</h3>
        <div className="space-y-2 text-sm">
          <p className="flex justify-between"><span>Base de données</span><span className="text-green-600 font-medium">SQLite · OK</span></p>
          <p className="flex justify-between"><span>Gemini API</span><span className="text-ink-faint">Non configuré</span></p>
          <p className="flex justify-between"><span>Statut général</span><span className="text-green-600 font-medium">Opérationnel</span></p>
        </div>
      </div>

      <button type="submit" className="btn-primary">Enregistrer</button>
    </form>
  );
}
