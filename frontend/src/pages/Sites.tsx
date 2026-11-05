import { useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { Equipment, Fault } from '../types';
import { LoadingSpinner } from '../components/ui/Common';
import {
  buildSiteModel, projectIso, isoDepth, SEVERITY_COLORS, SEVERITY_LABELS,
  Severity, PlacedEquipment, SiteZone,
} from '../lib/siteLayout';
import {
  Box, Map as MapIcon, RotateCcw, ScanLine, Wrench, ArrowRight, MapPin,
  AlertTriangle, Layers, Building2, X,
} from 'lucide-react';

type ViewMode = '2d' | '3d';

export default function Sites() {
  const navigate = useNavigate();
  const { data: equipment, loading: l1 } = useApi<Equipment[]>(() => api.equipment.list());
  const { data: faults, loading: l2 } = useApi<Fault[]>(() => api.faults.list());

  const [mode, setMode] = useState<ViewMode>('3d');
  const [selected, setSelected] = useState<PlacedEquipment | null>(null);

  const model = useMemo(
    () => buildSiteModel(equipment || [], faults || []),
    [equipment, faults]
  );

  if (l1 || l2) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip icon={Building2} label="Chantiers" value={model.stats.zones} tint="bg-brand-50 text-brand-600" />
        <StatChip icon={Wrench} label="Équipements" value={model.stats.equipment} tint="bg-indigo-50 text-indigo-600" />
        <StatChip icon={Layers} label="Pannes ouvertes" value={model.stats.faults} tint="bg-amber-50 text-amber-600" />
        <StatChip icon={AlertTriangle} label="Critiques" value={model.stats.critical} tint="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Map */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MapPin className="h-4 w-4 text-brand-600" /> Plan des chantiers
            </div>
            <div className="flex rounded-full bg-surface-muted p-1 border border-line-soft">
              <button
                onClick={() => setMode('2d')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${mode === '2d' ? 'bg-surface text-ink shadow-apple-sm' : 'text-ink-faint hover:text-ink'}`}
              >
                <MapIcon className="h-3.5 w-3.5" /> 2D
              </button>
              <button
                onClick={() => setMode('3d')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${mode === '3d' ? 'bg-surface text-ink shadow-apple-sm' : 'text-ink-faint hover:text-ink'}`}
              >
                <Box className="h-3.5 w-3.5" /> 3D
              </button>
            </div>
          </div>

          {model.zones.length === 0 ? (
            <div className="py-20 text-center text-sm text-ink-faint">Aucun équipement localisé à afficher.</div>
          ) : mode === '2d' ? (
            <FloorPlan2D model={model} selected={selected} onSelect={setSelected} />
          ) : (
            <Scene3D model={model} selected={selected} onSelect={setSelected} />
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t border-line-soft">
            {(['critical', 'high', 'medium', 'ok', 'idle'] as Severity[]).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLORS[s] }} />
                <span className="text-[11px] text-ink-soft">{SEVERITY_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:sticky lg:top-2 h-fit">
          {selected ? (
            <SelectionPanel eq={selected} onClose={() => setSelected(null)} navigate={navigate} />
          ) : (
            <div className="card text-center py-10">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <MapPin className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-ink">Sélectionnez un équipement</p>
              <p className="mt-1 text-xs text-ink-faint">
                {mode === '3d' ? 'Faites glisser pour pivoter la vue, puis touchez un repère.' : 'Touchez un repère sur le plan.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- 2D view --------------------------------- */

function FloorPlan2D({ model, selected, onSelect }: {
  model: ReturnType<typeof buildSiteModel>; selected: PlacedEquipment | null; onSelect: (e: PlacedEquipment) => void;
}) {
  const pad = 24;
  return (
    <div className="bg-gradient-to-br from-surface-muted to-surface" style={{ aspectRatio: `${model.width + pad * 2} / ${model.depth + pad * 2}` }}>
      <svg viewBox={`${-pad} ${-pad} ${model.width + pad * 2} ${model.depth + pad * 2}`} className="w-full h-full">
        {model.zones.map(z => (
          <g key={z.key}>
            <rect x={z.x} y={z.y} width={z.w} height={z.d} rx={10}
              fill="#ffffff" stroke="#d2d2d7" strokeWidth={1.5} />
            <text x={z.x + 10} y={z.y + 16} fontSize={11} fontWeight={600} fill="#6e6e73">{z.label}</text>
            {z.equipment.map(eq => {
              const isSel = selected?.id === eq.id;
              return (
                <g key={eq.id} className="cursor-pointer" onClick={() => onSelect(eq)}>
                  {isSel && <circle cx={eq.x} cy={eq.y} r={11} fill="none" stroke={SEVERITY_COLORS[eq.severity]} strokeWidth={2} opacity={0.5} />}
                  <circle cx={eq.x} cy={eq.y} r={7} fill={SEVERITY_COLORS[eq.severity]} stroke="#fff" strokeWidth={2} />
                  {eq.openFaults > 0 && (
                    <text x={eq.x} y={eq.y + 3} fontSize={8} fontWeight={700} fill="#fff" textAnchor="middle">{eq.openFaults}</text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* --------------------------------- 3D view --------------------------------- */

function Scene3D({ model, selected, onSelect }: {
  model: ReturnType<typeof buildSiteModel>; selected: PlacedEquipment | null; onSelect: (e: PlacedEquipment) => void;
}) {
  const [yaw, setYaw] = useState(0.6);
  const drag = useRef<{ x: number; yaw: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { x: e.clientX, yaw, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [yaw]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    setYaw(drag.current.yaw + dx * 0.008);
  }, []);

  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  const MARKER_H = 18;

  // Project everything for the current yaw and compute the viewBox.
  const scene = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const zones = model.zones.map(z => {
      const x0 = z.x, y0 = z.y, x1 = z.x + z.w, y1 = z.y + z.d, h = z.height;
      const corners = {
        // bottom
        b: [projectIso(x0, y0, 0, yaw), projectIso(x1, y0, 0, yaw), projectIso(x1, y1, 0, yaw), projectIso(x0, y1, 0, yaw)],
        // top
        t: [projectIso(x0, y0, h, yaw), projectIso(x1, y0, h, yaw), projectIso(x1, y1, h, yaw), projectIso(x0, y1, h, yaw)],
      };
      corners.b.forEach(p => pts.push(p));
      corners.t.forEach(p => pts.push(p));
      const labelTop = projectIso(x0 + z.w / 2, y0 + z.d / 2, h, yaw);
      const markers = z.equipment.map(eq => {
        const base = projectIso(eq.x, eq.y, 0, yaw);
        const head = projectIso(eq.x, eq.y, MARKER_H, yaw);
        return { eq, base, head, depth: isoDepth(eq.x, eq.y, yaw) };
      });
      return { z, corners, labelTop, markers, depth: isoDepth(z.x + z.w / 2, z.y + z.d / 2, yaw) };
    });

    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys) - MARKER_H, maxY = Math.max(...ys);
    const pad = 30;
    const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

    zones.sort((a, b) => a.depth - b.depth);
    const allMarkers = zones.flatMap(z => z.markers).sort((a, b) => a.depth - b.depth);
    return { zones, allMarkers, vb, aspect: (maxX - minX + pad * 2) / (maxY - minY + pad * 2) };
  }, [model, yaw]);

  const poly = (a: { x: number; y: number }[]) => a.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className="relative bg-gradient-to-b from-[#eef1f6] to-surface-muted touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ aspectRatio: `${Math.max(1.2, Math.min(2.4, scene.aspect))}` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <svg viewBox={scene.vb} className="w-full h-full">
        {/* Zones as extruded prisms */}
        {scene.zones.map(({ z, corners, labelTop }) => {
          // Side walls (draw all four; painter handles overlaps well enough)
          const walls = [
            [corners.b[0], corners.b[1], corners.t[1], corners.t[0]],
            [corners.b[1], corners.b[2], corners.t[2], corners.t[1]],
            [corners.b[2], corners.b[3], corners.t[3], corners.t[2]],
            [corners.b[3], corners.b[0], corners.t[0], corners.t[3]],
          ];
          return (
            <g key={z.key}>
              {walls.map((w, i) => (
                <polygon key={i} points={poly(w)} fill={i % 2 === 0 ? '#c9d2e0' : '#b9c4d6'} stroke="#aab4c6" strokeWidth={0.5} />
              ))}
              <polygon points={poly(corners.t)} fill="#ffffff" stroke="#d2d2d7" strokeWidth={1} />
              <text x={labelTop.x} y={labelTop.y} fontSize={9} fontWeight={600} fill="#86868b" textAnchor="middle">{z.label}</text>
            </g>
          );
        })}

        {/* Equipment pins */}
        {scene.allMarkers.map(({ eq, base, head }) => {
          const isSel = selected?.id === eq.id;
          const color = SEVERITY_COLORS[eq.severity];
          return (
            <g key={eq.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); if (!drag.current?.moved) onSelect(eq); }}>
              <ellipse cx={base.x} cy={base.y} rx={5} ry={2.4} fill="rgba(0,0,0,0.18)" />
              <line x1={base.x} y1={base.y} x2={head.x} y2={head.y} stroke={color} strokeWidth={2} />
              {isSel && <circle cx={head.x} cy={head.y} r={9} fill="none" stroke={color} strokeWidth={2} opacity={0.45} />}
              <circle cx={head.x} cy={head.y} r={6} fill={color} stroke="#fff" strokeWidth={2} />
              {eq.openFaults > 0 && (
                <text x={head.x} y={head.y + 2.5} fontSize={7} fontWeight={700} fill="#fff" textAnchor="middle">{eq.openFaults}</text>
              )}
            </g>
          );
        })}
      </svg>

      <button
        onClick={() => setYaw(0.6)}
        className="absolute bottom-3 right-3 btn-secondary btn-xs shadow-apple-sm"
        title="Réinitialiser l'orientation"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Recentrer
      </button>
    </div>
  );
}

/* ------------------------------ Side panel etc ----------------------------- */

function SelectionPanel({ eq, onClose, navigate }: { eq: PlacedEquipment; onClose: () => void; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${SEVERITY_COLORS[eq.severity]}1f`, color: SEVERITY_COLORS[eq.severity] }}>
            <Wrench className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-ink leading-tight">{eq.name}</p>
            <p className="text-xs text-ink-faint">{eq.category}</p>
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost btn-xs p-1"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Tile label="État" value={SEVERITY_LABELS[eq.severity]} />
        <Tile label="Santé" value={`${eq.health}%`} />
        <Tile label="Pannes ouvertes" value={String(eq.openFaults)} />
        <Tile label="Localisation" value={eq.location || '—'} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button onClick={() => navigate('/scan', { state: { equipmentId: eq.id } })} className="btn-accent w-full">
          <ScanLine className="h-4 w-4" /> Scanner & signaler
        </button>
        <button onClick={() => navigate(`/equipment/${eq.id}`)} className="btn-secondary w-full">
          Voir la fiche <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface-muted p-2.5">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink truncate">{value}</p>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-lg font-semibold text-ink leading-none">{value}</p>
        <p className="text-[11px] text-ink-faint mt-0.5">{label}</p>
      </div>
    </div>
  );
}
