import type { Role } from '../context/AuthContext';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: string;
}

export interface QuickReply {
  id: string;
  label: string;
  query: string;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

const DEMO_ACCOUNTS = `Comptes de démonstration (mot de passe : demo1234) :
• Admin — admin@maintainx.com
• Manager — sophie@maintainx.com
• Technicien — thomas@maintainx.com
• Client — client@techcorp.com`;

const RESPONSES: { keys: string[]; answer: string }[] = [
  {
    keys: ['bonjour', 'salut', 'hello', 'coucou', 'hey'],
    answer: 'Bonjour ! Je suis l\'assistant MaintainX Pro. Posez-moi une question ou choisissez une suggestion ci-dessous.',
  },
  {
    keys: ['demo', 'compte', 'connexion', 'login', 'mot de passe', 'password', 'se connecter'],
    answer: DEMO_ACCOUNTS,
  },
  {
    keys: ['inscription', 'inscrire', 'register', 'creer un compte', 'creer compte'],
    answer: 'L\'inscription est ouverte : onglet « Inscription » sur la page de connexion. Choisissez Technicien, Manager ou Client. Les comptes Technicien et Manager sont actifs tout de suite ; les Clients passent par une validation admin.',
  },
  {
    keys: ['scan', 'scanner', 'camera', 'capture', 'photo', 'visuel'],
    answer: 'Module Scan (/scan) :\n1. Sélectionnez un équipement\n2. Lancez le scan guidé (caméra ou import photo)\n3. Consultez le pré-diagnostic assisté\n4. Validez la déclaration de panne\n\nAu moins une photo est obligatoire. Sur mobile, utilisez HTTPS pour activer la caméra.',
  },
  {
    keys: ['kanban', 'panne', 'pannes', 'workflow', 'glisser', 'drag'],
    answer: 'Le Kanban (/kanban) suit 7 étapes : Soumis → Analyse → Inspection → Validation → Fabrication → Livraison → Clôturé.\n\nGlissez-déposez une carte pour faire avancer une panne. Chaque mouvement génère une notification.',
  },
  {
    keys: ['piece', 'pieces', 'spare', 'commande', 'fournisseur'],
    answer: 'Pièces détachées (/spare-parts) : consultez le stock, liez une pièce à une panne, puis faites évoluer le statut — En attente → Commandé → Reçu → Installé. Les managers et admins peuvent commander.',
  },
  {
    keys: ['equipement', 'parc', 'machine', 'health', 'score', 'sante'],
    answer: 'Chaque équipement a un Health Score (0–100) visible sur le Dashboard et la fiche détail. Plus le score est bas, plus le pré-diagnostic signale une priorité élevée lors d\'un scan.',
  },
  {
    keys: ['chantier', 'site', '3d', '2d', 'carte', 'jumeau', 'plan'],
    answer: 'Chantiers (/sites) : vue 2D et 3D isométrique du parc. Les équipements sont colorés selon la sévérité des pannes. Cliquez sur un équipement pour voir le détail ou lancer un scan.',
  },
  {
    keys: ['role', 'admin', 'manager', 'technicien', 'client', 'profil', 'permission'],
    answer: '4 rôles :\n• Admin — supervision globale, utilisateurs, audit\n• Manager — dashboard, Kanban, pièces\n• Technicien — interventions, scan terrain\n• Client — portail, déclaration et suivi de ses demandes',
  },
  {
    keys: ['theme', 'sombre', 'clair', 'dark', 'mode', 'apparence'],
    answer: 'Mode clair / sombre : icône en haut à droite (connexion ou header), ou section « Apparence » dans Profil. Options : Clair, Sombre, Système.',
  },
  {
    keys: ['notif', 'activite', 'alerte'],
    answer: 'Les notifications d\'activité sont dans le menu « Activité » (/notifications). Le compteur rouge indique les éléments non lus.',
  },
  {
    keys: ['aide', 'help', 'comment', 'utiliser', 'fonctionnement'],
    answer: 'MaintainX Pro relie capture visuelle, workflow Kanban et pièces détachées.\n\nParcours type : Scanner une panne → Kanban pour le suivi → Pièces pour commander → Dashboard pour le pilotage.\n\nQue souhaitez-vous approfondir ?',
  },
  {
    keys: ['hackathon', 'projet', 'equipe', 'maintainx'],
    answer: 'MaintainX Pro — plateforme PWA de maintenance industrielle développée pour le hackathon Smart Industrial Asset Intelligence & Spare Parts Innovation.\n\nDémo live : maintanxpro.netlify.app',
  },
  {
    keys: ['contact', 'support', 'humain', 'email', 'probleme', 'bug', 'erreur', '502'],
    answer: 'Pour l\'instant je suis un assistant automatisé. En cas de bug, rafraîchissez la page ou reconnectez-vous.\n\nDémo hackathon : utilisez les comptes demo1234. Pour une escalade humaine, contactez l\'équipe projet sur place.',
  },
  {
    keys: ['merci', 'thanks', 'super', 'parfait'],
    answer: 'Avec plaisir ! N\'hésitez pas si vous avez d\'autres questions. Bonne maintenance.',
  },
];

export function defaultQuickReplies(): QuickReply[] {
  return [
    { id: 'demo', label: 'Comptes démo', query: 'Quels sont les comptes de démo ?' },
    { id: 'scan', label: 'Comment scanner ?', query: 'Comment utiliser le scan ?' },
    { id: 'kanban', label: 'Kanban', query: 'Comment fonctionne le Kanban ?' },
    { id: 'pieces', label: 'Pièces', query: 'Gestion des pièces détachées' },
  ];
}

export function roleQuickReplies(role?: Role): QuickReply[] {
  const base = defaultQuickReplies();
  if (role === 'admin') {
    return [
      { id: 'admin', label: 'Centre admin', query: 'Que peut faire un admin ?' },
      ...base.slice(0, 3),
    ];
  }
  if (role === 'client') {
    return [
      { id: 'declare', label: 'Déclarer une panne', query: 'Comment déclarer une panne ?' },
      { id: 'suivi', label: 'Suivi demandes', query: 'Où voir mes demandes ?' },
      ...base.slice(0, 2),
    ];
  }
  return base;
}

export function greeting(name?: string, role?: Role): string {
  const who = name ? ` ${name.split(' ')[0]}` : '';
  const roleHint = role === 'technician'
    ? ' Besoin d\'aide pour le scan terrain ou vos interventions ?'
    : role === 'client'
      ? ' Je peux vous guider pour déclarer ou suivre une panne.'
      : ' Je peux vous aider sur le scan, le Kanban, les pièces et plus encore.';
  return `Bonjour${who} !${roleHint}`;
}

export function findBotReply(input: string, role?: Role): string {
  const q = norm(input);
  if (!q) return 'Écrivez votre question ou touchez une suggestion.';

  if (role && (q.includes('admin') || q.includes('centre'))) {
    if (role !== 'admin') {
      return 'Le centre de contrôle admin est réservé au rôle Administrateur. Connectez-vous avec admin@maintainx.com pour y accéder.';
    }
    return 'Espace Admin : tableau de bord global, gestion utilisateurs/entreprises, supervision pannes, journal d\'audit et paramètres système.';
  }

  if (q.includes('demande') || q.includes('suivi') || q.includes('declarer')) {
    if (role === 'client') {
      return 'Client : « Scanner » ou « Déclarer une panne » pour créer une demande avec photos. Suivez l\'avancement dans « Mes demandes » (/my-requests).';
    }
    return 'Pour déclarer une panne : menu Scanner (/scan), choisissez l\'équipement, capturez les preuves visuelles, validez le pré-diagnostic puis envoyez.';
  }

  let best: { score: number; answer: string } | null = null;
  for (const entry of RESPONSES) {
    let score = 0;
    for (const key of entry.keys) {
      const k = norm(key);
      if (q.includes(k)) score += k.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, answer: entry.answer };
    }
  }

  if (best) return best.answer;

  return 'Je n\'ai pas trouvé de réponse précise. Essayez : « comptes démo », « scan », « kanban », « pièces » ou « rôles ». Vous pouvez aussi utiliser les boutons de suggestion.';
}

export function newMessage(role: 'user' | 'bot', text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}
