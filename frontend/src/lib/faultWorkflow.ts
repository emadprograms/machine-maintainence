import type { FaultStatus } from '../types';

export const FAULT_STATUS_FLOW: FaultStatus[] = [
  'submitted',
  'analysis',
  'inspection',
  'validation',
  'manufacturing',
  'delivery',
  'closed',
];

export function faultStatusIndex(status: FaultStatus): number {
  return FAULT_STATUS_FLOW.indexOf(status);
}

export function nextFaultStatus(status: FaultStatus): FaultStatus | null {
  const i = faultStatusIndex(status);
  if (i < 0 || i >= FAULT_STATUS_FLOW.length - 1) return null;
  return FAULT_STATUS_FLOW[i + 1];
}

export function prevFaultStatus(status: FaultStatus): FaultStatus | null {
  const i = faultStatusIndex(status);
  if (i <= 0) return null;
  return FAULT_STATUS_FLOW[i - 1];
}

/** Forward drag: one step only. Backward drag: any earlier stage. */
export function resolveKanbanDrop(from: FaultStatus, target: FaultStatus): FaultStatus | null {
  const fromIdx = faultStatusIndex(from);
  const targetIdx = faultStatusIndex(target);
  if (fromIdx < 0 || targetIdx < 0 || targetIdx === fromIdx) return null;
  if (targetIdx > fromIdx) return FAULT_STATUS_FLOW[fromIdx + 1];
  return target;
}
