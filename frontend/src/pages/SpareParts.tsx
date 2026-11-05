import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { SparePart } from '../types';
import { LoadingSpinner, Modal, StatusBadge } from '../components/ui/Common';
import { Package, Plus, Search, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

export default function SpareParts() {
  const { data: parts, loading, refetch } = useApi<SparePart[]>(() => api.spareParts.list());
  const { can } = useAuth();
  const canManage = can('parts:manage');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useToast();

  const filtered = parts?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  async function updateStatus(id: string, status: string) {
    await api.spareParts.updateStatus(id, status);
    addToast(`Pièce mise à jour: ${status}`, 'success');
    refetch();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Rechercher une pièce..."
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-ink-soft">Aucune pièce trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line-soft bg-surface-muted">
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Pièce</th>
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Référence</th>
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Qté</th>
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Fournisseur</th>
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Panne liée</th>
                  <th className="text-left py-3 px-4 text-ink-faint font-medium">Statut</th>
                  <th className="text-right py-3 px-4 text-ink-faint font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-line-soft last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="py-3 px-4 font-medium text-ink">{p.name}</td>
                    <td className="py-3 px-4 text-ink-soft">{p.reference || '-'}</td>
                    <td className="py-3 px-4 text-ink-soft">{p.quantity}</td>
                    <td className="py-3 px-4 text-ink-soft">{p.supplier || '-'}</td>
                    <td className="py-3 px-4 text-ink-soft">{p.fault_title || '-'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={p.status} labels={{
                        pending: 'En attente', ordered: 'Commandé', received: 'Reçu', installed: 'Installé', cancelled: 'Annulé'
                      }} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!canManage && <span className="text-xs text-ink-faint">—</span>}
                      {canManage && p.status === 'pending' && (
                        <button onClick={() => updateStatus(p.id, 'ordered')} className="btn-ghost btn-xs">
                          <Truck className="w-3 h-3" /> Commander
                        </button>
                      )}
                      {canManage && p.status === 'ordered' && (
                        <button onClick={() => updateStatus(p.id, 'received')} className="btn-ghost btn-xs">
                          Marquer reçu
                        </button>
                      )}
                      {canManage && p.status === 'received' && (
                        <button onClick={() => updateStatus(p.id, 'installed')} className="btn-ghost btn-xs">
                          Installé
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle pièce détachée">
        <PartsForm onDone={() => { setShowModal(false); refetch(); }} />
      </Modal>
    </div>
  );
}

function PartsForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: '', reference: '', quantity: 1, unit_price: 0, supplier: '', fault_id: '' });
  const { data: faults } = useApi<any[]>(() => api.faults.list());
  const { addToast } = useToast();
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try { await api.spareParts.create(form); addToast('Pièce créée avec succès', 'success'); onDone(); }
    catch (err: any) { addToast(err.message, 'error'); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div><label className="label">Nom</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div><label className="label">Référence</label><input className="input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-5">
        <div><label className="label">Quantité</label><input className="input" type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} /></div>
        <div><label className="label">Prix unitaire</label><input className="input" type="number" min={0} step={0.01} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: +e.target.value }))} /></div>
      </div>
      <div><label className="label">Fournisseur</label><input className="input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
      <div><label className="label">Panne associée</label>
        <select className="input" value={form.fault_id} onChange={e => setForm(f => ({ ...f, fault_id: e.target.value }))}>
          <option value="">Aucune</option>
          {faults?.map((f: any) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-primary w-full">Ajouter</button>
    </form>
  );
}
