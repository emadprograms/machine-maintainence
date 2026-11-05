import { Equipment } from '../types';

export interface DiagnosticResult {
  suggestedTitle: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  observations: string[];
  recommendedParts: string[];
}

interface Profile {
  match: RegExp;
  title: string;
  category: string;
  observations: string[];
  parts: string[];
}

const PROFILES: Profile[] = [
  {
    match: /presse|vérin|hydrau/i,
    title: 'Anomalie hydraulique détectée',
    category: 'Hydraulique',
    observations: ['Traces potentielles de fuite sur les flexibles', 'Usure possible des joints du vérin'],
    parts: ['Joint SPI', 'Flexible hydraulique', 'Vérin double effet'],
  },
  {
    match: /convoyeur|rouleau|bande/i,
    title: 'Usure mécanique sur entraînement',
    category: 'Mécanique',
    observations: ['Désalignement possible du rouleau', 'Tension de bande à vérifier'],
    parts: ['Rouleau d\'entraînement', 'Roulement', 'Courroie'],
  },
  {
    match: /robot|soud|bras/i,
    title: 'Défaut axe / actionneur robot',
    category: 'Robotique',
    observations: ['Position de bras non nominale', 'Capteur de fin de course suspect'],
    parts: ['Capteur de position inductif', 'Servo-moteur axe', 'Carte de commande'],
  },
  {
    match: /compresseur|vis|air/i,
    title: 'Perte de performance compresseur',
    category: 'Pneumatique',
    observations: ['Surchauffe possible', 'Filtre à air potentiellement encrassé'],
    parts: ['Filtre à air', 'Kit de joints', 'Séparateur huile'],
  },
  {
    match: /four|thermique|chauff/i,
    title: 'Anomalie de régulation thermique',
    category: 'Thermique',
    observations: ['Dérive possible de la sonde de température', 'Isolation à inspecter'],
    parts: ['Thermocouple', 'Résistance chauffante', 'Régulateur PID'],
  },
  {
    match: /centrifug|pompe|moteur/i,
    title: 'Vibration / balourd détecté',
    category: 'Mécanique',
    observations: ['Vibration anormale probable', 'Roulements en fin de vie'],
    parts: ['Roulement', 'Garniture mécanique', 'Accouplement'],
  },
];

const FALLBACK: Omit<Profile, 'match'> = {
  title: 'Défaut visuel à qualifier',
  category: 'Général',
  observations: ['Anomalie visible sur les clichés', 'Inspection physique recommandée'],
  parts: ['Pièce à déterminer'],
};

/**
 * Pré-diagnostic assisté (heuristique de démonstration).
 * Combine la catégorie/état de l'équipement et le nombre de clichés
 * pour proposer un point de départ au technicien — à valider sur site.
 */
export function runDiagnostic(equipment: Equipment | undefined, shotCount: number): DiagnosticResult {
  const haystack = `${equipment?.name ?? ''} ${equipment?.category ?? ''}`;
  const profile = PROFILES.find(p => p.match.test(haystack));
  const base = profile ?? { ...FALLBACK, match: /.*/ };

  const health = equipment?.health_score ?? 100;
  let priority: DiagnosticResult['priority'] = 'medium';
  if (health < 40) priority = 'critical';
  else if (health < 60) priority = 'high';
  else if (health < 80) priority = 'medium';
  else priority = 'low';

  // Plus de clichés + santé faible => confiance plus élevée.
  const coverage = Math.min(1, shotCount / 6);
  const healthFactor = (100 - health) / 100;
  const confidence = Math.round(Math.min(96, 52 + coverage * 28 + healthFactor * 16));

  return {
    suggestedTitle: base.title,
    category: base.category,
    priority,
    confidence,
    observations: base.observations,
    recommendedParts: base.parts,
  };
}
