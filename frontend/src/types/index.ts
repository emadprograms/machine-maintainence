export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'technician';
  avatar?: string;
  created_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  description?: string;
  location?: string;
  technical_sheet?: string;
  status: 'active' | 'maintenance' | 'retired';
  health_score: number;
  last_maintenance?: string;
  images?: string;
  created_at: string;
  updated_at: string;
}

/** Safely parse the JSON-encoded `images` column (faults & equipment). */
export function parseImages(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface Fault {
  id: string;
  equipment_id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: FaultStatus;
  images: string;
  reported_by?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  equipment_name?: string;
  equipment_category?: string;
  comments?: FaultComment[];
  spare_parts?: SparePart[];
}

export type FaultStatus = 'submitted' | 'analysis' | 'inspection' | 'validation' | 'manufacturing' | 'delivery' | 'closed';

export interface FaultComment {
  id: string;
  fault_id: string;
  user_id?: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export interface SparePart {
  id: string;
  fault_id?: string;
  name: string;
  reference?: string;
  quantity: number;
  unit_price: number;
  supplier?: string;
  status: 'pending' | 'ordered' | 'received' | 'installed' | 'cancelled';
  created_at: string;
  updated_at: string;
  fault_title?: string;
  equipment_name?: string;
}

export interface Activity {
  id: string;
  type: string;
  message: string;
  related_id?: string;
  related_type?: string;
  user_id?: string;
  read: number;
  created_at: string;
}

export interface DashboardData {
  totalEquipment: number;
  activeFaults: number;
  closedFaults: number;
  pendingParts: number;
  criticalFaults: number;
  avgHealth: number;
  faultsByStatus: { status: string; count: number }[];
  faultsByPriority: { priority: string; count: number }[];
  equipmentByCategory: { category: string; count: number }[];
  recentFaults: Fault[];
  statusFlow: { status: string; count: number }[];
  lowHealthEquipment: { id: string; name: string; health_score: number }[];
}

export const STATUS_LABELS: Record<FaultStatus, string> = {
  submitted: 'Soumis',
  analysis: 'Analyse',
  inspection: 'Inspection',
  validation: 'Validation',
  manufacturing: 'Fabrication',
  delivery: 'Livraison',
  closed: 'Clôturé',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
};

export const STATUS_COLORS: Record<FaultStatus, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  analysis: 'bg-purple-50 text-purple-700 border-purple-200',
  inspection: 'bg-amber-50 text-amber-700 border-amber-200',
  validation: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  manufacturing: 'bg-orange-50 text-orange-700 border-orange-200',
  delivery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  closed: 'bg-green-50 text-green-700 border-green-200',
};
