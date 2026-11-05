import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Fault, FaultStatus, STATUS_LABELS, PRIORITY_LABELS } from '../types';
import { LoadingSpinner, Modal, StatusBadge } from '../components/ui/Common';
import { Plus, Clock, Wrench, ScanLine, GripVertical, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CameraScanner from '../components/scan/CameraScanner';
import { faultImage } from '../lib/equipmentImages';
import { useToast } from '../components/ui/Toast';
import {
  FAULT_STATUS_FLOW,
  faultStatusIndex,
  nextFaultStatus,
  resolveKanbanDrop,
} from '../lib/faultWorkflow';

const columns: FaultStatus[] = FAULT_STATUS_FLOW;

const columnColors: Record<FaultStatus, string> = {
  submitted: 'border-t-blue-500',
  analysis: 'border-t-purple-500',
  inspection: 'border-t-amber-500',
  validation: 'border-t-cyan-500',
  manufacturing: 'border-t-orange-500',
  delivery: 'border-t-indigo-500',
  closed: 'border-t-green-500',
};

const columnGradients: Record<FaultStatus, string> = {
  submitted: 'from-blue-600/20 to-blue-950/20 border-blue-500/20',
  analysis: 'from-purple-600/20 to-purple-950/20 border-purple-500/20',
  inspection: 'from-amber-600/20 to-amber-950/20 border-amber-500/20',
  validation: 'from-cyan-600/20 to-cyan-950/20 border-cyan-500/20',
  manufacturing: 'from-orange-600/20 to-orange-950/20 border-orange-500/20',
  delivery: 'from-indigo-600/20 to-indigo-950/20 border-indigo-500/20',
  closed: 'from-green-600/20 to-green-950/20 border-green-500/20',
};

const priorityIcon: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export default function KanbanBoard() {
  const { data: faults, loading, refetch } = useApi<Fault[]>(() => api.faults.list());
  const { data: equipment } = useApi<any[]>(() => api.equipment.list());
  const [columnsData, setColumnsData] = useState<Record<string, Fault[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    if (!faults) return;
    const grouped: Record<string, Fault[]> = {};
    for (const col of columns) grouped[col] = faults.filter(f => f.status === col);
    setColumnsData(grouped);
  }, [faults]);

  async function moveFault(fault: Fault, targetStatus: FaultStatus) {
    const sourceCol = fault.status;
    if (sourceCol === targetStatus) return;

    setAdvancingId(fault.id);
    const newColumns = { ...columnsData };
    const sourceItems = [...(newColumns[sourceCol] || [])];
    const destItems = [...(newColumns[targetStatus] || [])];
    const idx = sourceItems.findIndex(f => f.id === fault.id);
    if (idx < 0) return;
    const [moved] = sourceItems.splice(idx, 1);
    moved.status = targetStatus;
    destItems.unshift(moved);
    newColumns[sourceCol] = sourceItems;
    newColumns[targetStatus] = destItems;
    setColumnsData(newColumns);

    try {
      await api.faults.updateStatus(fault.id, targetStatus);
      addToast(`Panne passée à « ${STATUS_LABELS[targetStatus]} »`, 'success');
      refetch();
    } catch (err: any) {
      addToast(err.message || 'Erreur lors du déplacement', 'error');
      refetch();
    } finally {
      setAdvancingId(null);
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
    const sourceCol = result.source.droppableId as FaultStatus;
    const requestedCol = result.destination.droppableId as FaultStatus;
    const faultId = result.draggableId;
    const fault = (columnsData[sourceCol] || []).find(f => f.id === faultId);
    if (!fault) return;

    const destCol = resolveKanbanDrop(sourceCol, requestedCol);
    if (!destCol) return;

    if (destCol !== requestedCol && faultStatusIndex(requestedCol) > faultStatusIndex(sourceCol)) {
      addToast(`Étape suivante : ${STATUS_LABELS[destCol]}`, 'info');
    }
    await moveFault(fault, destCol);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Avancez étape par étape (Soumis → … → Clôturé) via le bouton ou en glissant vers la colonne suivante.
        </p>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nouvelle panne
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {columns.map(col => (
            <div key={col} className="flex-shrink-0 w-72">
              <div className={`rounded-t-2xl border-t-[3px] ${columnColors[col]} bg-surface border-x border-line-soft pt-3 px-3`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">{STATUS_LABELS[col]}</h3>
                  <span className="text-xs text-ink-faint bg-surface-muted rounded-full px-2 py-0.5">
                    {(columnsData[col] || []).length}
                  </span>
                </div>
              </div>
              <Droppable droppableId={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-surface-muted border-x border-b border-line-soft p-3 space-y-3 min-h-[200px] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-brand-50' : ''
                    }`}
                    style={{ borderBottomLeftRadius: '1.125rem', borderBottomRightRadius: '1.125rem' }}
                  >
                    {(columnsData[col] || []).map((fault, index) => {
                      const next = nextFaultStatus(fault.status);
                      const busy = advancingId === fault.id;
                      return (
                      <Draggable key={fault.id} draggableId={fault.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`card p-0 overflow-hidden ${
                              snapshot.isDragging ? 'shadow-apple-lg border-brand-300' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between px-2 py-1.5 border-b border-line-soft bg-surface-muted/80">
                              <div
                                {...provided.dragHandleProps}
                                className="flex cursor-grab items-center gap-1 text-ink-faint active:cursor-grabbing"
                                title="Glisser pour changer d'étape"
                              >
                                <GripVertical className="h-4 w-4" />
                                <span className="text-[10px] font-medium">Déplacer</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate(`/faults/${fault.id}`)}
                                className="flex items-center gap-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-700"
                              >
                                Détail <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                            <img src={faultImage(fault)} alt="" className="h-20 w-full object-cover" draggable={false} />
                            <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priorityIcon[fault.priority] || 'bg-zinc-400'}`} />
                              <StatusBadge status={fault.priority} labels={PRIORITY_LABELS} />
                            </div>
                            <h4 className="text-sm font-medium text-ink mb-1 line-clamp-2">{fault.title}</h4>
                            {fault.equipment_name && (
                              <p className="text-xs text-ink-faint flex items-center gap-1 mt-1">
                                <Wrench className="w-3 h-3" /> {fault.equipment_name}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-line-soft">
                              <span className="text-[10px] text-ink-faint flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(fault.created_at).toLocaleDateString('fr-FR')}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${fault.priority === 'critical' ? 'bg-red-500 animate-pulse' : fault.priority === 'high' ? 'bg-orange-500' : fault.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                            </div>
                            {next ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => moveFault(fault, next)}
                                className="btn-primary btn-xs w-full mt-3"
                              >
                                {busy ? 'En cours…' : <>Avancer <ArrowRight className="h-3 w-3" /> {STATUS_LABELS[next]}</>}
                              </button>
                            ) : (
                              <p className="mt-3 text-center text-[10px] font-medium text-green-600">Clôturée</p>
                            )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );})}
                    {provided.placeholder}
                    {(columnsData[col] || []).length === 0 && (
                      <p className="text-xs text-ink-faint text-center py-8">Aucune panne</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nouvelle panne">
        <FaultForm onDone={() => { setShowModal(false); refetch(); }} equipment={equipment || []} />
      </Modal>
    </div>
  );
}

function FaultForm({ onDone, equipment }: { onDone: () => void; equipment: any[] }) {
  const [form, setForm] = useState({ equipment_id: '', title: '', description: '', priority: 'medium' });
  const [images, setImages] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (images.length === 0) {
      alert('Au moins une preuve visuelle est obligatoire. Lancez le scan guidé.');
      return;
    }
    setSubmitting(true);
    try {
      await api.faults.create({ ...form, images });
      onDone();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (scanning) {
    return (
      <CameraScanner
        onComplete={imgs => { setImages(prev => [...prev, ...imgs]); setScanning(false); }}
        onCancel={() => setScanning(false)}
        minShots={1}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="label">Équipement</label>
        <select className="input" required value={form.equipment_id} onChange={e => setForm(f => ({ ...f, equipment_id: e.target.value }))}>
          <option value="">Sélectionner...</option>
          {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Titre</label>
        <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Fuite d'huile compresseur" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={4} required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez le problème..." />
      </div>
      <div>
        <label className="label">Priorité</label>
        <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          <option value="low">Faible</option>
          <option value="medium">Moyenne</option>
          <option value="high">Haute</option>
          <option value="critical">Critique</option>
        </select>
      </div>

      <div>
        <label className="label">Preuves visuelles * <span className="text-ink-faint font-normal">(obligatoire)</span></label>
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative h-16 w-16 overflow-hidden rounded-xl border border-line-soft">
                <img src={src} alt={`cliché ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                  className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white">×</button>
              </div>
            ))}
            <button type="button" onClick={() => setScanning(true)} className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-line text-ink-faint hover:border-accent-500 hover:text-accent-600">
              <Plus className="h-4 w-4" /><span className="text-[9px]">Ajouter</span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setScanning(true)} className="btn-accent w-full">
            <ScanLine className="h-4 w-4" /> Lancer le scan guidé
          </button>
        )}
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Création...' : 'Créer la panne'}
      </button>
    </form>
  );
}
