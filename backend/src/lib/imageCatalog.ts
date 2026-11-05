import fs from 'fs';
import path from 'path';
import { backendDistDir } from './paths.js';

export type ImageCatalog = {
  version: number;
  equipmentByName: Record<string, string[]>;
  categoryFallback: Record<string, string[]>;
  defaultEquipment: string[];
  faultPatterns: { match: string; images: string[] }[];
  faultPriorityFallback: Record<string, string[]>;
};

export function loadImageCatalog(): ImageCatalog {
  const distDir = backendDistDir();
  const candidates = [
    path.join(distDir, 'data/explicitImages.json'),
    path.join(process.cwd(), 'frontend/src/data/explicitImages.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  throw new Error('explicitImages.json introuvable');
}

export function catalogImagesForEquipment(name: string, category: string): string {
  const catalog = loadImageCatalog();
  const urls = catalog.equipmentByName[name] || catalog.categoryFallback[category] || catalog.defaultEquipment;
  return JSON.stringify(urls);
}

export function catalogImagesForFault(
  title: string,
  description: string,
  equipmentName: string,
  category: string,
  priority: string,
): string {
  const catalog = loadImageCatalog();
  const haystack = `${title} ${description} ${equipmentName} ${category}`.toLowerCase();
  for (const rule of catalog.faultPatterns) {
    if (new RegExp(rule.match, 'i').test(haystack)) return JSON.stringify(rule.images);
  }
  const urls = catalog.faultPriorityFallback[priority] || catalog.faultPriorityFallback.medium;
  return JSON.stringify(urls);
}
