import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Equipment, Fault, STATUS_LABELS, parseImages } from '../types';
import { LoadingSpinner, StatusBadge, Modal } from '../components/ui/Common';
import { ArrowLeft, Wrench, MapPin, Heart, AlertTriangle, ClipboardList, Camera, ScanLine } from 'lucide-react';
import EquipmentThumb, { EquipmentHero } from '../components/ui/EquipmentThumb';
import ImageGallery from '../components/ui/ImageGallery';
import CameraScanner from '../components/scan/CameraScanner';
import { DEFAULT_ANGLES } from '../components/scan/CameraScanner';
import { equipmentImages, faultImage } from '../lib/equipmentImages';

const EQUIPMENT_ANGLES = DEFAULT_ANGLES.filter(a => a.key !== 'defect');

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: equipment, loading: eqLoading, refetch } = useApi<Equipment>(() => api.equipment.get(id!));
  const { data: faults, loading: faultsLoading } = useApi<Fault[]>(() => api.equipment.faults(id!));
  const [showScan, setShowScan] = useState(false);

  if (eqLoading) return <LoadingSpinner />;
  if (!equipment) return <p className="text-ink-soft">Équipement introuvable.</p>;

  const images = parseImages(equipment.images);
  const galleryImages = images.length > 0 ? images : equipmentImages(equipment);

  async function handleAddImages(imgs: string[]) {
    setShowScan(false);
    if (!imgs.length) return;
    await api.equipment.addImages(equipment!.id, imgs);
    refetch();
  }

  return (
    <div className="space-y-10 max-w-4xl animate-fade-in">
      <button onClick={() => navigate('/equipment')} className="btn-ghost">
        <ArrowLeft className="w-5 h-5" /> Retour
      </button>

      <EquipmentHero equipment={equipment} className="h-52 w-full" />

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-ink tracking-tight">{equipment.name}</h1>
            <p className="text-sm text-ink-soft">{equipment.category}</p>
          </div>
          <StatusBadge status={equipment.status} labels={{ active: 'Actif', maintenance: 'Maintenance', retired: 'Retiré' }} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
          {equipment.location && (
            <div>
              <p className="text-xs text-ink-faint flex items-center gap-1"><MapPin className="w-3 h-3" /> Localisation</p>
              <p className="text-sm text-ink mt-0.5">{equipment.location}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-faint flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> Santé</p>
            <p className={`text-sm font-medium mt-0.5 ${equipment.health_score > 70 ? 'text-green-600' : equipment.health_score > 40 ? 'text-amber-600' : 'text-red-600'}`}>
              {equipment.health_score}%
            </p>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              equipment.health_score > 70 ? 'bg-green-500' : equipment.health_score > 40 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${equipment.health_score}%` }}
          />
        </div>

        {equipment.description && (
          <p className="text-sm text-ink-soft mt-4">{equipment.description}</p>
        )}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Camera className="h-4 w-4 text-accent-600" /> Photos & scans ({galleryImages.length})
          </h2>
          <button onClick={() => setShowScan(true)} className="btn-ghost btn-xs">
            <ScanLine className="h-3 w-3" /> Scanner
          </button>
        </div>
        <ImageGallery images={galleryImages} emptyLabel="Aucune photo — scannez l'équipement pour documenter son état" />
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-ink mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Historique des pannes ({faults?.length || 0})
        </h2>

        {faultsLoading ? (
          <LoadingSpinner />
        ) : faults && faults.length > 0 ? (
          <div className="space-y-2.5">
            {faults.map(f => (
              <div
                key={f.id}
                onClick={() => navigate(`/faults/${f.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-muted cursor-pointer hover:bg-zinc-100 transition-colors"
              >
                <img src={faultImage(f)} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{f.title}</p>
                  <p className="text-xs text-ink-faint mt-0.5">{new Date(f.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <StatusBadge status={f.priority} labels={{ low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique' }} />
                  <StatusBadge status={f.status} labels={STATUS_LABELS} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Aucune panne enregistrée pour cet équipement.
          </p>
        )}
      </div>

      <Modal open={showScan} onClose={() => setShowScan(false)} title="Scanner l'équipement">
        <CameraScanner angles={EQUIPMENT_ANGLES} onComplete={handleAddImages} onCancel={() => setShowScan(false)} minShots={1} />
      </Modal>
    </div>
  );
}
