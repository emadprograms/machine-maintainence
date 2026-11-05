import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, Modal, StatusBadge } from '../../components/ui/Common';
import { Plus, Search } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', technician: 'Technicien', client: 'Client',
};

export default function AdminUsers() {
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data: users, loading, refetch } = useApi<any[]>(
    () => api.admin.users({ role, status, q }),
    [role, status, q]
  );
  const { data: pending } = useApi<any[]>(() => api.admin.pendingUsers());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'technician' });

  async function changeRole(id: string, newRole: string) {
    await api.admin.updateRole(id, newRole);
    refetch();
  }

  async function toggleStatus(id: string, current: string) {
    await api.admin.updateStatus(id, current === 'active' ? 'suspended' : 'active');
    refetch();
  }

  async function approve(id: string) {
    await api.admin.approveUser(id);
    refetch();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    await api.admin.createUser(form);
    setShowCreate(false);
    refetch();
  }

  if (loading && !users) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {(pending?.length || 0) > 0 && (
        <div className="card border-amber-200 bg-amber-50">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">Inscriptions en attente ({pending!.length})</h3>
          <div className="space-y-2">
            {pending!.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white">
                <span className="text-sm">{u.name} · {u.email} · {ROLE_LABELS[u.role]}</span>
                <div className="flex gap-2">
                  <button onClick={() => approve(u.id)} className="btn-primary btn-xs">Approuver</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input className="input pl-9 w-48" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input w-auto" value={role} onChange={e => setRole(e.target.value)}>
            <option value="">Tous rôles</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="pending">En attente</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> Créer</button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft text-left text-ink-faint">
              <th className="p-3">Utilisateur</th>
              <th className="p-3">Rôle</th>
              <th className="p-3">Entreprise</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Dernière connexion</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map(u => (
              <tr key={u.id} className="border-b border-line-soft hover:bg-surface-muted/50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${u.online ? 'bg-green-500' : 'bg-zinc-300'}`} />
                    <div>
                      <p className="font-medium text-ink">{u.name}</p>
                      <p className="text-xs text-ink-faint">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <select className="input py-1 text-xs w-28" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="p-3 text-ink-soft">{u.company_name || '—'}</td>
                <td className="p-3"><StatusBadge status={u.status === 'active' ? 'active' : 'pending'} labels={{ active: 'Actif', pending: u.status, suspended: 'Suspendu' }} /></td>
                <td className="p-3 text-xs text-ink-faint">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('fr-FR') : '—'}</td>
                <td className="p-3">
                  <button onClick={() => toggleStatus(u.id, u.status)} className="btn-secondary btn-xs">
                    {u.status === 'active' ? 'Suspendre' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer un utilisateur">
        <form onSubmit={createUser} className="space-y-3">
          <input className="input" placeholder="Nom" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Mot de passe" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="submit" className="btn-primary w-full">Créer</button>
        </form>
      </Modal>
    </div>
  );
}
