import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Equipment } from '../types';
import { LoadingSpinner, Modal, StatusBadge } from '../components/ui/Common';
import { Plus, Search, MapPin, Heart, Wrench } from 'lucide-react';
import EquipmentThumb from '../components/ui/EquipmentThumb';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

export default function EquipmentList() {
  const { data: equipment, loading, refetch } = useApi<Equipment[]>(() => api.equipment.list());
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', description: '', location: '', technical_sheet: '' });
  const [qrEquipment, setQrEquipment] = useState<string | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const filtered = equipment?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.equipment.create(form);
      addToast('Équipement créé avec succès', 'success');
      setShowModal(false);
      setForm({ name: '', category: '', description: '', location: '', technical_sheet: '' });
      refetch();
    } catch (err: any) { addToast(err.message, 'error'); }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Rechercher un équipement..."
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {can('equipment:write') && (
          <button onClick={() => setShowModal(true)} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(eq => (
          <div
            key={eq.id}
            onClick={() => navigate(`/equipment/${eq.id}`)}
            className="card card-hover cursor-pointer group overflow-hidden p-0"
          >
            <EquipmentThumb equipment={eq} className="h-36 w-full rounded-none rounded-t-2xl" />
            <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <StatusBadge status={eq.status} labels={{ active: 'Actif', maintenance: 'Maintenance', retired: 'Retiré' }} />
            </div>
            <h3 className="text-base font-semibold text-ink group-hover:text-brand-600 transition-colors">{eq.name}</h3>
            <p className="text-sm text-ink-soft mt-1">{eq.category}</p>
            {eq.location && (
              <p className="text-xs text-ink-faint mt-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {eq.location}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-red-500" />
              <div className="flex-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    eq.health_score > 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : eq.health_score > 40 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-red-500 to-rose-400'
                  }`}
                  style={{ width: `${eq.health_score}%` }}
                />
              </div>
              <span className="text-xs font-medium text-ink-soft">{eq.health_score}%</span>
            </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Wrench className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-ink-soft">Aucun équipement trouvé</p>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvel équipement">
        <form onSubmit={handleCreate} className="space-y-6">
          <div><label className="label">Nom</label><input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Catégorie</label><input className="input" required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Localisation</label><input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
          <div><label className="label">Fiche technique</label><input className="input" value={form.technical_sheet} onChange={e => setForm(f => ({ ...f, technical_sheet: e.target.value }))} /></div>
          <button type="submit" className="btn-primary w-full">Ajouter</button>
        </form>
      </Modal>
    </div>
  );
}
