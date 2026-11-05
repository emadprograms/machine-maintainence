import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Equipment, PRIORITY_LABELS } from '../types';
import { LoadingSpinner, StatusBadge } from '../components/ui/Common';
import CameraScanner from '../components/scan/CameraScanner';
import { runDiagnostic, DiagnosticResult } from '../lib/diagnostic';
import {
  ScanLine, Wrench, Search, Camera, Sparkles, CheckCircle2, ChevronLeft,
  ArrowRight, Loader2, Cpu, MapPin,
} from 'lucide-react';

type Step = 'equipment' | 'capture' | 'analyze' | 'declare' | 'done';

export default function Scan() {
  const navigate = useNavigate();
  const location = useLocation();
  const preselectId = (location.state as any)?.equipmentId as string | undefined;
  const { data: equipment, loading } = useApi<Equipment[]>(() => api.equipment.list());

  const [step, setStep] = useState<Step>('equipment');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (equipment || []).filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
    ),
    [equipment, search]
  );

  function pickEquipment(eq: Equipment) {
    setSelected(eq);
    setStep('capture');
  }

  // Pré-sélection depuis la vue Chantiers : on saute directement à la capture.
  useEffect(() => {
    if (preselectId && equipment && !selected) {
      const eq = equipment.find(e => e.id === preselectId);
      if (eq) { setSelected(eq); setStep('capture'); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId, equipment]);

  function onScanComplete(imgs: string[]) {
    setImages(imgs);
    setStep('analyze');
    setAnalyzing(true);
    setTimeout(() => {
      const result = runDiagnostic(selected || undefined, imgs.length);
      setDiagnostic(result);
      setForm(f => ({ ...f, title: result.suggestedTitle, priority: result.priority }));
      setAnalyzing(false);
    }, 1400);
  }

  async function submitFault(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      const fault = await api.faults.create({
        equipment_id: selected.id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        images,
      });
      api.equipment.addImages(selected.id, images).catch(() => {});
      setCreatedId(fault.id);
      setStep('done');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'equipment', label: 'Équipement' },
    { key: 'capture', label: 'Capture' },
    { key: 'analyze', label: 'Pré-diagnostic' },
    { key: 'declare', label: 'Déclaration' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-line-soft bg-gradient-to-br from-white to-accent-50 p-6 shadow-apple">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-200/40 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink tracking-tight">Capture visuelle guidée</h1>
            <p className="text-sm text-ink-soft">Scannez l'équipement sous plusieurs angles et obtenez un pré-diagnostic assisté.</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-accent-600' : 'text-ink-faint'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                i < stepIndex ? 'border-accent-500 bg-accent-500 text-white'
                : i === stepIndex ? 'border-accent-500 text-accent-600'
                : 'border-line text-ink-faint'
              }`}>
                {i < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden text-xs font-medium sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < stepIndex ? 'bg-accent-300' : 'bg-line-soft'}`} />}
          </div>
        ))}
      </div>

      {/* Step: equipment */}
      {step === 'equipment' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
            <input className="input pl-10" placeholder="Rechercher un équipement à scanner..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map(eq => (
                <button key={eq.id} onClick={() => pickEquipment(eq)} className="card card-hover flex items-center gap-3 text-left">
                  <div className="rounded-xl bg-brand-50 p-2"><Wrench className="h-5 w-5 text-brand-600" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{eq.name}</p>
                    <p className="truncate text-xs text-ink-faint">{eq.category}{eq.location ? ` · ${eq.location}` : ''}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-ink-faint">Aucun équipement trouvé.</p>}
            </div>
          )}
        </div>
      )}

      {/* Step: capture */}
      {step === 'capture' && selected && (
        <div className="space-y-4">
          <SelectedBanner eq={selected} onBack={() => { setStep('equipment'); setSelected(null); }} />
          <div className="card">
            <CameraScanner onComplete={onScanComplete} onCancel={() => { setStep('equipment'); setSelected(null); }} minShots={1} />
          </div>
        </div>
      )}

      {/* Step: analyze */}
      {step === 'analyze' && selected && (
        <div className="space-y-4">
          <SelectedBanner eq={selected} />
          <div className="card">
            {analyzing || !diagnostic ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="relative">
                  <Cpu className="h-10 w-10 text-accent-600" />
                  <Loader2 className="absolute -right-2 -top-2 h-5 w-5 animate-spin text-accent-500" />
                </div>
                <p className="text-sm font-medium text-ink">Analyse des {images.length} clichés…</p>
                <p className="text-xs text-ink-faint">Détection des anomalies visuelles et corrélation avec l'historique</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-accent-600">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Pré-diagnostic assisté</h3>
                  <span className="ml-auto rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
                    Confiance {diagnostic.confidence}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <InfoTile label="Anomalie probable" value={diagnostic.suggestedTitle} />
                  <InfoTile label="Catégorie" value={diagnostic.category} />
                  <div className="rounded-2xl border border-line-soft bg-surface-muted p-3">
                    <p className="text-xs text-ink-faint">Priorité suggérée</p>
                    <div className="mt-1"><StatusBadge status={diagnostic.priority} labels={PRIORITY_LABELS} /></div>
                  </div>
                  <InfoTile label="Clichés analysés" value={`${images.length} vues`} />
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">Observations</p>
                  <ul className="space-y-1.5">
                    {diagnostic.observations.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />{o}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">Pièces potentiellement nécessaires</p>
                  <div className="flex flex-wrap gap-2">
                    {diagnostic.recommendedParts.map(p => (
                      <span key={p} className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs text-ink-soft">{p}</span>
                    ))}
                  </div>
                </div>

                <p className="rounded-xl border border-line-soft bg-surface-muted px-3 py-2 text-xs text-ink-faint">
                  Suggestion automatique à valider par un technicien — basée sur l'état de l'équipement et la couverture du scan.
                </p>

                <div className="flex gap-2">
                  <button onClick={() => setStep('capture')} className="btn-secondary"><ChevronLeft className="h-4 w-4" /> Reprendre le scan</button>
                  <button onClick={() => setStep('declare')} className="btn-accent ml-auto">Déclarer la panne <ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: declare */}
      {step === 'declare' && selected && (
        <div className="space-y-4">
          <SelectedBanner eq={selected} />
          <form onSubmit={submitFault} className="card space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-faint">Preuves visuelles ({images.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <img key={i} src={src} alt={`cliché ${i + 1}`} className="h-16 w-16 shrink-0 rounded-xl border border-line-soft object-cover" />
                ))}
              </div>
            </div>
            <div>
              <label className="label">Titre de la panne *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea className="input" rows={3} required placeholder="Décrivez le problème constaté..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Niveau de gravité</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('analyze')} className="btn-secondary"><ChevronLeft className="h-4 w-4" /> Retour</button>
              <button type="submit" disabled={submitting} className="btn-primary ml-auto">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Créer la panne
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step: done */}
      {step === 'done' && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center animate-scale-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink tracking-tight">Panne déclarée avec preuves visuelles</h2>
            <p className="text-sm text-ink-soft">{images.length} clichés enregistrés et liés à {selected?.name}.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {createdId && <button onClick={() => navigate(`/faults/${createdId}`)} className="btn-primary">Voir la panne</button>}
            <button onClick={() => navigate('/kanban')} className="btn-secondary">Aller au Kanban</button>
            <button
              onClick={() => { setStep('equipment'); setSelected(null); setImages([]); setDiagnostic(null); setForm({ title: '', description: '', priority: 'medium' }); setCreatedId(null); }}
              className="btn-ghost"
            >
              <Camera className="h-4 w-4" /> Nouveau scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedBanner({ eq, onBack }: { eq: Equipment; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-surface px-4 py-3 shadow-apple-sm">
      <div className="rounded-xl bg-brand-50 p-2"><Wrench className="h-5 w-5 text-brand-600" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{eq.name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-ink-faint">
          {eq.category}{eq.location && <><MapPin className="h-3 w-3" /> {eq.location}</>}
        </p>
      </div>
      {onBack && <button onClick={onBack} className="btn-ghost btn-sm">Changer</button>}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-muted p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
