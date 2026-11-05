import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { LoadingSpinner, StatusBadge } from '../../components/ui/Common';
import EquipmentThumb from '../../components/ui/EquipmentThumb';
import { ChevronLeft, ChevronRight, Wrench, ScanLine, MapPin, CalendarDays } from 'lucide-react';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export interface MaintenanceEvent {
  id: string;
  equipmentId: string;
  name: string;
  category: string;
  location?: string;
  health_score: number;
  status: string;
  images?: string;
  date: string;
  type: 'planned' | 'overdue';
  note: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function hashDay(id: string, year: number, month: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 997;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return (h % daysInMonth) + 1;
}

function buildEvents(equipment: any[], year: number, month: number): MaintenanceEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events: MaintenanceEvent[] = [];

  for (const e of equipment) {
    const plannedDay = hashDay(e.id, year, month);
    const plannedDate = toDateKey(year, month, plannedDay);
    const planned = new Date(plannedDate);

    events.push({
      id: `${e.id}-planned-${plannedDate}`,
      equipmentId: e.id,
      name: e.name,
      category: e.category,
      location: e.location,
      health_score: e.health_score ?? 100,
      status: e.status,
      images: e.images,
      date: plannedDate,
      type: planned < today && e.health_score < 70 ? 'overdue' : 'planned',
      note: e.health_score < 50 ? 'Maintenance urgente recommandée' : 'Maintenance préventive planifiée',
    });

    if (e.last_maintenance) {
      const next = new Date(e.last_maintenance);
      next.setDate(next.getDate() + 30);
      if (next.getFullYear() === year && next.getMonth() === month) {
        const d = next.getDate();
        const dateKey = toDateKey(year, month, d);
        if (!events.some(ev => ev.equipmentId === e.id && ev.date === dateKey)) {
          events.push({
            id: `${e.id}-followup-${dateKey}`,
            equipmentId: e.id,
            name: e.name,
            category: e.category,
            location: e.location,
            health_score: e.health_score ?? 100,
            status: e.status,
            images: e.images,
            date: dateKey,
            type: next < today ? 'overdue' : 'planned',
            note: 'Suivi post-maintenance (30 jours)',
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export default function MaintenanceCalendar() {
  const navigate = useNavigate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [selectedEvent, setSelectedEvent] = useState<MaintenanceEvent | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: equipment, loading } = useApi<any[]>(() => api.equipment.list());

  const events = useMemo(
    () => buildEvents(equipment || [], viewYear, viewMonth),
    [equipment, viewYear, viewMonth]
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, MaintenanceEvent[]> = {};
    for (const ev of events) {
      (map[ev.date] ||= []).push(ev);
    }
    return map;
  }, [events]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedEvent(null);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedEvent(null);
  }

  function selectDay(day: number) {
    const key = toDateKey(viewYear, viewMonth, day);
    const dayEvents = eventsByDate[key] || [];
    setSelectedDate(key);
    setSelectedEvent(dayEvents[0] ?? null);
  }

  function selectEvent(ev: MaintenanceEvent, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSelectedDate(ev.date);
    setSelectedEvent(ev);
  }

  useEffect(() => {
    if (!selectedDate || selectedEvent || !events.length) return;
    const dayEvents = eventsByDate[selectedDate] || [];
    if (dayEvents.length) setSelectedEvent(dayEvents[0]);
  }, [events, eventsByDate, selectedDate, selectedEvent]);

  useEffect(() => {
    if (selectedDate && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDate, selectedEvent]);

  if (loading) return <LoadingSpinner />;

  if (!equipment?.length) {
    return (
      <div className="card text-center py-16">
        <CalendarDays className="w-12 h-12 text-ink-faint mx-auto mb-3" />
        <p className="text-ink-soft">Aucun équipement — le calendrier se remplit à partir du parc industriel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Cliquez sur un jour pour voir les maintenances, puis sur un événement pour ouvrir la fiche ou démarrer l'intervention.
      </p>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Calendrier */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="btn-ghost btn-xs" aria-label="Mois précédent">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand-600" />
              {MONTHS[viewMonth]} {viewYear}
            </h3>
            <button type="button" onClick={nextMonth} className="btn-ghost btn-xs" aria-label="Mois suivant">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-ink-faint">
            {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[72px]" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = toDateKey(viewYear, viewMonth, day);
              const dayEvents = eventsByDate[key] || [];
              const isSelected = selectedDate === key;
              const isToday = key === todayKey;
              const hasOverdue = dayEvents.some(e => e.type === 'overdue');

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`min-h-[72px] p-1.5 rounded-xl text-left transition-all border ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
                      : isToday
                        ? 'border-brand-200 bg-brand-50/50 hover:bg-brand-50'
                        : 'border-transparent bg-surface-muted hover:bg-surface hover:border-line-soft'
                  }`}
                >
                  <span className={`text-xs font-semibold ${isToday ? 'text-brand-600' : 'text-ink'}`}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map(ev => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={e => selectEvent(ev, e)}
                          className={`w-full truncate rounded px-1 py-0.5 text-[9px] font-medium text-left hover:ring-1 hover:ring-brand-400 ${
                            ev.type === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-brand-100 text-brand-800'
                          } ${selectedEvent?.id === ev.id ? 'ring-2 ring-brand-500' : ''}`}
                        >
                          {ev.name.split(' ')[0]}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-ink-faint">+{dayEvents.length - 2}</span>
                      )}
                    </div>
                  )}
                  {hasOverdue && !isSelected && (
                    <span className="mt-0.5 block h-1 w-1 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panneau latéral — jour sélectionné */}
        <div ref={panelRef} className="lg:col-span-2 space-y-4">
          <div className="card min-h-[200px]">
            <h3 className="text-sm font-semibold text-ink mb-3">
              {selectedDate
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Sélectionnez un jour'}
            </h3>

            {selectedDate && selectedEvents.length === 0 && (
              <p className="text-sm text-ink-faint">Aucune maintenance ce jour-là.</p>
            )}

            <div className="space-y-2">
              {selectedEvents.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => selectEvent(ev)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                    selectedEvent?.id === ev.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-line-soft hover:bg-surface-muted'
                  }`}
                >
                  <EquipmentThumb equipment={ev} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{ev.name}</p>
                    <p className="text-xs text-ink-faint">{ev.note}</p>
                  </div>
                  {ev.type === 'overdue' && (
                    <span className="text-[10px] font-bold text-red-600 uppercase">Retard</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Détail événement */}
          {selectedEvent && (
            <div className="card animate-fade-in overflow-hidden p-0">
              <EquipmentThumb equipment={selectedEvent} className="h-36 w-full rounded-none" rounded="lg" />
              <div className="p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-ink">{selectedEvent.name}</h4>
                  <p className="text-xs text-ink-soft">{selectedEvent.category}</p>
                  {selectedEvent.location && (
                    <p className="text-xs text-ink-faint flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {selectedEvent.location}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selectedEvent.status} labels={{ active: 'Actif', maintenance: 'En maintenance', retired: 'Retiré' }} />
                  <span className="badge border bg-surface-muted text-ink-soft border-line">Santé {selectedEvent.health_score}%</span>
                </div>
                <p className="text-sm text-ink-soft">{selectedEvent.note}</p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/equipment/${selectedEvent.equipmentId}`)}
                    className="btn-secondary w-full"
                  >
                    <Wrench className="w-4 h-4" /> Voir la fiche équipement
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/scan', { state: { equipmentId: selectedEvent.equipmentId } })}
                    className="btn-primary w-full"
                  >
                    <ScanLine className="w-4 h-4" /> Démarrer maintenance / scan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
