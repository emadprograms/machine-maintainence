import { useNotifications } from '../hooks/useNotifications';
import { Bell, CheckCheck, AlertTriangle, RefreshCw, Package, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const iconMap: Record<string, any> = {
  fault_created: AlertTriangle,
  status_change: RefreshCw,
  part_ordered: Package,
  part_received: Package,
  equipment_added: Wrench,
  comment: Bell,
};

const colorMap: Record<string, string> = {
  fault_created: 'text-red-600 bg-red-50',
  status_change: 'text-blue-600 bg-blue-50',
  part_ordered: 'text-amber-600 bg-amber-50',
  part_received: 'text-green-600 bg-green-50',
  equipment_added: 'text-brand-600 bg-brand-50',
  comment: 'text-purple-600 bg-purple-50',
};

export default function Notifications() {
  const { activities, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  async function handleClick(a: any) {
    if (!a.read) await markRead(a.id);
    if (a.related_type === 'fault' && a.related_id) navigate(`/faults/${a.related_id}`);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          {unread > 0 ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
        </p>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn-secondary shadow-lg">
            <CheckCheck className="w-5 h-5" /> Tout marquer lu
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {activities.length === 0 ? (
          <div className="text-center py-20 card">
            <Bell className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-ink-soft">Aucune activité</p>
          </div>
        ) : (
          activities.map((a, i) => {
            const Icon = iconMap[a.type] || Bell;
            const color = colorMap[a.type] || 'text-ink-soft bg-zinc-100';
            return (
              <div
                key={a.id}
                onClick={() => handleClick(a)}
                className={`card card-hover flex items-start gap-4 cursor-pointer ${
                  !a.read ? 'ring-1 ring-brand-200 bg-brand-50/40' : ''
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`p-2.5 rounded-2xl ${color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${!a.read ? 'text-ink font-medium' : 'text-ink-soft'}`}>
                    {a.message}
                  </p>
                  <p className="text-xs text-ink-faint mt-1">
                    {new Date(a.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {!a.read && (
                  <span className="relative flex h-3 w-3 shrink-0 mt-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500" />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
