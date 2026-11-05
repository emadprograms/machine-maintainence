import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import EquipmentThumb from '../../components/ui/EquipmentThumb';

export default function MyEquipment() {
  const navigate = useNavigate();
  const { data: equipment, loading } = useApi<any[]>(() => api.equipment.list());

  if (loading) return <LoadingSpinner />;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(equipment || []).map(eq => {
        const risk = eq.health_score < 40 ? 'high' : eq.health_score < 70 ? 'medium' : 'low';
        return (
          <div key={eq.id} className="card card-hover overflow-hidden p-0">
            <EquipmentThumb equipment={eq} className="h-32 w-full rounded-none rounded-t-2xl" />
            <div className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-ink">{eq.name}</p>
                <p className="text-xs text-ink-faint">{eq.location}</p>
              </div>
              <StatusBadge status={eq.status} labels={{ active: 'Opérationnel', maintenance: 'Maintenance', retired: 'Retiré' }} />
            </div>
            {risk !== 'low' && (
              <div className={`flex items-center gap-1.5 text-xs mb-3 p-2 rounded-lg ${risk === 'high' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Risque {risk === 'high' ? 'élevé' : 'modéré'} — maintenance recommandée ({eq.health_score}%)
              </div>
            )}
            <div className="flex gap-2">
              <Link to={`/equipment/${eq.id}`} className="btn-secondary btn-sm flex-1">Détails</Link>
              <button onClick={() => navigate('/scan', { state: { equipmentId: eq.id } })} className="btn-primary btn-sm flex-1">
                Déclarer panne
              </button>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
