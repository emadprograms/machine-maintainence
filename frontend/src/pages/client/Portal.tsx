import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ScanLine, ClipboardList, Wrench } from 'lucide-react';
import EquipmentThumb from '../../components/ui/EquipmentThumb';
import { faultImage, categoryImage } from '../../lib/equipmentImages';

const STATUS_HUMAN: Record<string, string> = {
  submitted: 'Demande reçue', analysis: 'En cours d\'analyse', inspection: 'En inspection',
  validation: 'En validation', manufacturing: 'Fabrication pièce', delivery: 'Livraison en cours', closed: 'Résolue',
};

export default function Portal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: equipment, loading: l1 } = useApi<any[]>(() => api.equipment.list());
  const { data: faults, loading: l2 } = useApi<any[]>(() => api.faults.list());

  if (l1 || l2) return <LoadingSpinner />;

  const activeFaults = (faults || []).filter(f => f.status !== 'closed');
  const critical = activeFaults.find(f => f.priority === 'critical');
  const recent = [...(faults || [])].slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink tracking-tight">
          Bonjour {user?.name?.split(' ')[0]}, voici l'état de vos équipements
        </h2>
      </div>

      {critical && (
        <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden flex flex-col sm:flex-row">
          <img src={faultImage(critical)} alt="" className="h-28 sm:h-auto sm:w-36 object-cover shrink-0" />
          <div className="p-4 flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{critical.title} — panne critique</p>
              <p className="text-sm text-red-700">{critical.equipment_name}{critical.assigned_name ? ` · Technicien: ${critical.assigned_name}` : ''}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Équipements', value: equipment?.length || 0, icon: Wrench, color: 'bg-brand-50 text-brand-600' },
          { label: 'Pannes actives', value: activeFaults.length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
          { label: 'Demandes en cours', value: activeFaults.length, icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-6">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}><s.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-ink">{s.value}</p>
            <p className="text-xs text-ink-soft mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <button onClick={() => navigate('/scan')} className="btn-primary"><ScanLine className="w-4 h-4" /> Déclarer une panne</button>
        <button onClick={() => navigate('/scan')} className="btn-secondary"><ScanLine className="w-4 h-4" /> Scanner</button>
        <button onClick={() => navigate('/my-requests')} className="btn-secondary"><ClipboardList className="w-4 h-4" /> Mes demandes</button>
      </div>

      {(equipment || []).length > 0 && (
        <div className="card overflow-hidden p-0">
          <img src={categoryImage(equipment![0]?.category)} alt="" className="h-32 w-full object-cover" />
          <div className="p-4">
            <h3 className="text-sm font-semibold text-ink mb-3">Votre parc ({equipment?.length} équipements)</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(equipment || []).slice(0, 6).map(eq => (
                <Link key={eq.id} to={`/equipment/${eq.id}`} className="shrink-0 w-24 text-center group">
                  <EquipmentThumb equipment={eq} className="h-16 w-16 mx-auto" />
                  <p className="text-[10px] text-ink-soft mt-1 truncate group-hover:text-brand-600">{eq.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-ink mb-3">Dernières mises à jour</h3>
        <div className="space-y-2">
          {recent.map(f => (
            <Link key={f.id} to={`/faults/${f.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted hover:bg-brand-50 transition-colors">
              <img src={faultImage(f)} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0 bg-surface-muted" />
              <p className="text-sm text-ink min-w-0">Votre panne <strong>{f.title}</strong> — {STATUS_HUMAN[f.status] || f.status}</p>
            </Link>
          ))}
          {recent.length === 0 && <p className="text-sm text-ink-faint">Aucune demande récente.</p>}
        </div>
      </div>
    </div>
  );
}
