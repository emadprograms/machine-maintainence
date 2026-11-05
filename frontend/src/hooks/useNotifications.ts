import { Activity } from '../types';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

let listeners: Array<() => void> = [];
let cache = { activities: [] as Activity[], unread: 0 };
let lastFetch = 0;

function notify() {
  for (const l of listeners) l();
}

export async function refreshNotifications() {
  try {
    const data = await api.notifications.list();
    cache = data;
    lastFetch = Date.now();
    notify();
  } catch {}
}

export function useNotifications() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.push(listener);
    if (Date.now() - lastFetch > 10000) refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000);
    return () => {
      listeners = listeners.filter(l => l !== listener);
      clearInterval(interval);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    await api.notifications.markRead(id);
    refreshNotifications();
  }, []);

  const markAllRead = useCallback(async () => {
    await api.notifications.markAllRead();
    refreshNotifications();
  }, []);

  return { activities: cache.activities, unread: cache.unread, markRead, markAllRead };
}
