import { Equipment, Fault } from '../types';

export type Severity = 'critical' | 'high' | 'medium' | 'ok' | 'idle';

export interface PlacedEquipment {
  id: string;
  name: string;
  category: string;
  status: Equipment['status'];
  health: number;
  location?: string;
  openFaults: number;
  severity: Severity;
  /** World position (center of footprint), in world units. */
  x: number;
  y: number;
}

export interface SiteZone {
  key: string;
  label: string;
  /** Footprint origin (top-left) and size in world units. */
  x: number;
  y: number;
  w: number;
  d: number;
  /** Extrusion height for the 3D view. */
  height: number;
  equipment: PlacedEquipment[];
}

export interface SiteModel {
  zones: SiteZone[];
  width: number;
  depth: number;
  stats: { zones: number; equipment: number; faults: number; critical: number };
}

const CELL = 24;          // size of one equipment cell (world units)
const ZONE_PADDING = 16;  // inner padding inside a zone
const ZONE_GAP = 40;      // gap between zones
const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'ok', 'idle'];

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ff3b30', // red
  high: '#ff9500',     // orange
  medium: '#ffcc00',   // amber
  ok: '#34c759',       // green
  idle: '#8e8e93',     // gray
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Panne critique',
  high: 'Panne majeure',
  medium: 'À surveiller',
  ok: 'Opérationnel',
  idle: 'Inactif / retiré',
};

function buildingOf(location?: string): string {
  if (!location) return 'Non localisé';
  // Split on common separators: " - ", " · ", "/", ","
  const part = location.split(/\s[-·]\s|\/|,/)[0]?.trim();
  return part || 'Non localisé';
}

function severityOf(eq: Equipment, openFaults: number, maxPriority: number): Severity {
  if (eq.status === 'retired') return 'idle';
  if (openFaults > 0) {
    if (maxPriority >= 4) return 'critical';
    if (maxPriority >= 3) return 'high';
    return 'medium';
  }
  if (eq.status === 'maintenance' || eq.health_score < 50) return 'medium';
  return 'ok';
}

/** Builds a deterministic spatial layout of sites/zones from equipment + faults. */
export function buildSiteModel(equipment: Equipment[], faults: Fault[]): SiteModel {
  // Open faults per equipment + max priority
  const openByEq = new Map<string, { count: number; maxPriority: number }>();
  for (const f of faults) {
    if (f.status === 'closed') continue;
    const cur = openByEq.get(f.equipment_id) || { count: 0, maxPriority: 0 };
    cur.count += 1;
    cur.maxPriority = Math.max(cur.maxPriority, PRIORITY_RANK[f.priority] || 0);
    openByEq.set(f.equipment_id, cur);
  }

  // Group equipment by building
  const groups = new Map<string, Equipment[]>();
  for (const eq of equipment) {
    const key = buildingOf(eq.location);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(eq);
  }

  const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const outerCols = Math.max(1, Math.ceil(Math.sqrt(entries.length)));

  const zones: SiteZone[] = [];
  let cursorX = 0;
  let rowMaxDepth = 0;
  let rowStartY = 0;
  let col = 0;
  let totalFaults = 0;
  let critical = 0;

  for (const [label, eqs] of entries) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(eqs.length)));
    const rows = Math.ceil(eqs.length / cols);
    const w = cols * CELL + ZONE_PADDING * 2;
    const d = rows * CELL + ZONE_PADDING * 2;

    if (col >= outerCols) {
      col = 0;
      cursorX = 0;
      rowStartY += rowMaxDepth + ZONE_GAP;
      rowMaxDepth = 0;
    }

    const zoneX = cursorX;
    const zoneY = rowStartY;

    const placed: PlacedEquipment[] = eqs.map((eq, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const info = openByEq.get(eq.id) || { count: 0, maxPriority: 0 };
      totalFaults += info.count;
      const sev = severityOf(eq, info.count, info.maxPriority);
      if (sev === 'critical') critical += 1;
      return {
        id: eq.id,
        name: eq.name,
        category: eq.category,
        status: eq.status,
        health: eq.health_score,
        location: eq.location,
        openFaults: info.count,
        severity: sev,
        x: zoneX + ZONE_PADDING + c * CELL + CELL / 2,
        y: zoneY + ZONE_PADDING + r * CELL + CELL / 2,
      };
    });

    zones.push({
      key: label,
      label,
      x: zoneX,
      y: zoneY,
      w,
      d,
      height: 26 + Math.min(40, eqs.length * 4),
      equipment: placed,
    });

    cursorX += w + ZONE_GAP;
    rowMaxDepth = Math.max(rowMaxDepth, d);
    col += 1;
  }

  const width = Math.max(1, ...zones.map(z => z.x + z.w));
  const depth = Math.max(1, ...zones.map(z => z.y + z.d));

  return {
    zones,
    width,
    depth,
    stats: { zones: zones.length, equipment: equipment.length, faults: totalFaults, critical },
  };
}

/* ------------------------------- Projection -------------------------------- */

export interface Pt { x: number; y: number }

const ISO_COS = Math.cos(Math.PI / 6); // 0.866
const ISO_SIN = 0.52;                  // vertical foreshortening

/**
 * Rotatable isometric projection. World (x, y) lies on the ground plane,
 * z is the height. `yaw` (radians) spins the scene around the vertical axis.
 */
export function projectIso(x: number, y: number, z: number, yaw: number): Pt {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;
  return {
    x: (rx - ry) * ISO_COS,
    y: (rx + ry) * ISO_SIN - z,
  };
}

/** Depth key for painter's algorithm (larger = closer to viewer = draw later). */
export function isoDepth(x: number, y: number, yaw: number): number {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return (x * sin + y * cos) + (x * cos - y * sin);
}
