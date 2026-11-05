import {
  LayoutDashboard, Users, Building2, Wrench, AlertTriangle, Package,
  BarChart3, Layers, ScrollText, Settings, ScanLine, Kanban, Map,
  ClipboardList, Calendar, Home, PlusCircle, User,
} from 'lucide-react';

export type Role = 'admin' | 'manager' | 'technician' | 'client';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  technician: 'Technicien',
  client: 'Client',
};

export function homeRoute(role?: string): string {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'client': return '/portal';
    case 'technician': return '/dashboard';
    default: return '/dashboard';
  }
}

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  accent?: boolean;
  badgeKey?: 'pendingUsers' | 'criticalFaults' | 'myTasks';
  /** NavLink exact match — évite d'activer /my-tasks sur /my-tasks/calendar */
  end?: boolean;
}

export function navForRole(role?: string): NavItem[] {
  switch (role) {
    case 'admin':
      return [
        { to: '/admin/dashboard', label: 'Centre de contrôle', icon: LayoutDashboard },
        { to: '/admin/users', label: 'Utilisateurs', icon: Users, badgeKey: 'pendingUsers' },
        { to: '/admin/companies', label: 'Entreprises', icon: Building2 },
        { to: '/equipment', label: 'Équipements', icon: Wrench },
        { to: '/admin/breakdowns', label: 'Pannes', icon: AlertTriangle, badgeKey: 'criticalFaults' },
        { to: '/spare-parts', label: 'Pièces', icon: Package },
        { to: '/kanban', label: 'Kanban', icon: Kanban },
        { to: '/sites', label: 'Jumeau 3D', icon: Layers },
        { to: '/admin/audit', label: 'Journal d\'audit', icon: ScrollText },
        { to: '/admin/settings', label: 'Paramètres', icon: Settings },
      ];
    case 'client':
      return [
        { to: '/portal', label: 'Mon espace', icon: Home },
        { to: '/my-requests', label: 'Mes demandes', icon: ClipboardList },
        { to: '/my-equipment', label: 'Mes équipements', icon: Wrench },
        { to: '/scan', label: 'Scanner QR', icon: ScanLine },
        { to: '/spare-parts', label: 'Pièces', icon: Package },
        { to: '/profile', label: 'Profil', icon: User },
      ];
    case 'technician':
      return [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/my-tasks', label: 'Mes interventions', icon: ClipboardList, badgeKey: 'myTasks', end: true },
        { to: '/my-tasks/calendar', label: 'Calendrier', icon: Calendar },
        { to: '/equipment', label: 'Équipements', icon: Wrench },
        { to: '/kanban', label: 'Pannes', icon: Kanban },
        { to: '/spare-parts', label: 'Pièces', icon: Package },
        { to: '/sites', label: 'Jumeau 3D', icon: Map },
        { to: '/scan', label: 'Scanner', icon: ScanLine, accent: true },
        { to: '/profile', label: 'Profil', icon: User },
      ];
    default: // manager
      return [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/scan', label: 'Scan', icon: ScanLine, accent: true },
        { to: '/sites', label: 'Chantiers', icon: Map },
        { to: '/kanban', label: 'Kanban', icon: Kanban },
        { to: '/equipment', label: 'Équipements', icon: Wrench },
        { to: '/spare-parts', label: 'Pièces', icon: Package },
        { to: '/notifications', label: 'Activité', icon: BarChart3 },
        { to: '/profile', label: 'Profil', icon: User },
      ];
  }
}

export const CLIENT_CTA: NavItem = { to: '/scan', label: 'Déclarer', icon: PlusCircle, accent: true };
