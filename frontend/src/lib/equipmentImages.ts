import { parseImages } from '../types';
import catalog from '../data/explicitImages.json';

type Catalog = typeof catalog;

const C = catalog as Catalog;

function imagesForEquipment(name?: string, category?: string): string[] {
  if (name && C.equipmentByName[name as keyof typeof C.equipmentByName]) {
    return C.equipmentByName[name as keyof typeof C.equipmentByName];
  }
  if (category && C.categoryFallback[category as keyof typeof C.categoryFallback]) {
    return C.categoryFallback[category as keyof typeof C.categoryFallback];
  }
  return C.defaultEquipment;
}

function imagesForFault(fault: {
  title?: string;
  description?: string;
  priority?: string;
  equipment_category?: string;
  equipment_name?: string;
}): string[] {
  const haystack = `${fault.title || ''} ${fault.description || ''} ${fault.equipment_name || ''} ${fault.equipment_category || ''}`.toLowerCase();

  for (const rule of C.faultPatterns) {
    const re = new RegExp(rule.match, 'i');
    if (re.test(haystack)) return rule.images;
  }

  const pri = fault.priority || 'medium';
  const fb = C.faultPriorityFallback[pri as keyof typeof C.faultPriorityFallback];
  if (fb) return fb;

  return C.faultPriorityFallback.medium;
}

export function categoryImage(category?: string): string {
  return imagesForEquipment(undefined, category)[0];
}

export function equipmentImage(equipment: { name?: string; category?: string; images?: string | null }): string {
  const stored = parseImages(equipment.images);
  if (stored.length > 0) return stored[0];
  return imagesForEquipment(equipment.name, equipment.category)[0];
}

export function equipmentImages(equipment: { name?: string; category?: string; images?: string | null }): string[] {
  const stored = parseImages(equipment.images);
  if (stored.length > 0) return stored;
  return imagesForEquipment(equipment.name, equipment.category);
}

export function faultImage(
  fault: {
    images?: string | null;
    priority?: string;
    title?: string;
    description?: string;
    equipment_category?: string;
    equipment_name?: string;
  },
  index = 0,
): string {
  const stored = parseImages(fault.images);
  if (stored.length > index) return stored[index];
  if (stored.length > 0) return stored[0];
  const pool = imagesForFault(fault);
  return pool[index % pool.length];
}

export function faultImages(fault: Parameters<typeof faultImage>[0]): string[] {
  const stored = parseImages(fault.images);
  if (stored.length > 0) return stored;
  return imagesForFault(fault);
}

/** Version du catalogue — utilisée côté backend pour re-migrer les images demo. */
export const IMAGE_CATALOG_VERSION = C.version;
