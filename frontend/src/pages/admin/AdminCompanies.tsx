import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, Modal } from '../../components/ui/Common';
import { Building2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminCompanies() {
  const { data: companies, loading, refetch } = useApi<any[]>(() => api.admin.companies());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', sector: '', country: 'France' });
  const [selected, setSelected] = useState<any>(null);
  const { data: stats } = useApi<any>(() => selected ? api.admin.companyStats(selected.id) : Promise.resolve(null), [selected?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.admin.createCompany(form);
    setShowModal(false);
    refetch();
  }

  if (loading && !companies) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="page-title">Entreprises</h2>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> Nouvelle</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(companies || []).map(c => (
          <button key={c.id} onClick={() => setSelected(c)} className="card card-hover text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-ink-faint">{c.sector} · {c.country}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-surface-muted"><p className="font-bold text-ink">{c.equipment_count}</p><p className="text-ink-faint">Équip.</p></div>
              <div className="p-2 rounded-lg bg-surface-muted"><p className="font-bold text-red-600">{c.active_faults}</p><p className="text-ink-faint">Pannes</p></div>
              <div className="p-2 rounded-lg bg-surface-muted"><p className="font-bold text-ink">{c.user_count}</p><p className="text-ink-faint">Users</p></div>
            </div>
          </button>
        ))}
      </div>

      {selected && stats && (
        <div className="card">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-ink flex items-center gap-2"><Building2 className="w-4 h-4" /> {selected.name}</h3>
            <button onClick={() => setSelected(null)} className="btn-ghost btn-xs">Fermer</button>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-4 text-sm">
            <p>Équipements: <strong>{stats.equipment?.length || 0}</strong></p>
            <p>Pannes: <strong>{stats.faults?.length || 0}</strong></p>
            <p>Coût pièces: <strong>{stats.partsCost?.toFixed?.(0) || stats.partsCost} €</strong></p>
          </div>
          <Link to={`/equipment?company=${selected.id}`} className="btn-secondary btn-sm">Voir tous les équipements</Link>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle entreprise">
        <form onSubmit={create} className="space-y-3">
          <input className="input" placeholder="Nom" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Secteur" value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })} />
          <input className="input" placeholder="Pays" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          <button type="submit" className="btn-primary w-full">Créer</button>
        </form>
      </Modal>
    </div>
  );
}
